"""
Notification Service - Enterprise Grade

Core service for the Podacium notification system.
Handles multi-channel delivery, user preferences, and real-time updates.

Architectural Principles:
- Multi-channel support (in-app, email, push, SMS, webhook)
- Granular user preferences with category-specific settings
- Delivery tracking with retry logic
- Rate limiting and abuse prevention
- Comprehensive caching for performance
- Event-driven architecture for real-time updates
"""

from typing import List, Optional, Dict, Any, Set, Tuple
from datetime import datetime, timezone, timedelta
import asyncio
import json
import logging

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.schemas.notifications import (
    NotificationCreate,
    NotificationBroadcastCreate,
    NotificationPreferencesCreate,
    NotificationPreferencesUpdate,
    NotificationResponse,
    NotificationPreferencesResponse,
    NotificationStats,
    NotificationDeliveryResponse,
    BulkNotificationUpdate,
    BulkMarkAsReadResponse,
    BroadcastResponse,
    NotificationCategory,
    NotificationPriority,
    NotificationChannel,
    NotificationDeliveryStatus,
    DigestFrequency,
    NotificationFilter,
    BulkDeleteResponse,
    PushSubscriptionCreate,
)

logger = logging.getLogger(__name__)


# ============================================================================
# CACHE IMPLEMENTATION
# ============================================================================


class NotificationCache:
    """
    Multi-tier caching for notifications.
    Uses Redis if available, falls back to in-memory.
    """

    _in_memory_cache: Dict[str, Any] = {}
    _in_memory_expiry: Dict[str, datetime] = {}
    _lock = asyncio.Lock()
    _redis_client = None
    _redis_checked = False

    @classmethod
    def _get_redis(cls):
        """Get singleton Redis client with connection pooling."""
        if cls._redis_client is not None:
            return cls._redis_client
        if cls._redis_checked:
            return None  # Already tried and failed
        cls._redis_checked = True
        try:
            import redis.asyncio as redis
            from app.core.config import setting

            redis_url = getattr(setting, "REDIS_URL", "")
            if redis_url:
                cls._redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    max_connections=20,
                )
            return cls._redis_client
        except Exception:
            return None

    @classmethod
    async def get(cls, key: str) -> Optional[Any]:
        """Get value from cache"""
        # Try Redis first
        redis_client = cls._get_redis()
        if redis_client:
            try:
                value = await redis_client.get(key)
                if value:
                    return json.loads(value)
            except Exception:
                pass

        # Fallback to in-memory
        async with cls._lock:
            if key in cls._in_memory_cache:
                if datetime.now(timezone.utc) < cls._in_memory_expiry.get(
                    key, datetime.min.replace(tzinfo=timezone.utc)
                ):
                    return cls._in_memory_cache[key]
                else:
                    # Expired
                    del cls._in_memory_cache[key]
                    if key in cls._in_memory_expiry:
                        del cls._in_memory_expiry[key]

        return None

    @classmethod
    async def set(cls, key: str, value: Any, ttl_seconds: int = 60):
        """Set value in cache"""
        # Try Redis first
        redis_client = cls._get_redis()
        if redis_client:
            try:
                await redis_client.setex(
                    key, ttl_seconds, json.dumps(value, default=str)
                )
                return
            except Exception:
                pass

        # Fallback to in-memory
        async with cls._lock:
            cls._in_memory_cache[key] = value
            cls._in_memory_expiry[key] = datetime.now(timezone.utc) + timedelta(
                seconds=ttl_seconds
            )

    @classmethod
    async def delete(cls, key: str):
        """Delete value from cache"""
        # Try Redis first
        redis_client = cls._get_redis()
        if redis_client:
            try:
                await redis_client.delete(key)
            except Exception:
                pass

        # Also delete from in-memory
        async with cls._lock:
            if key in cls._in_memory_cache:
                del cls._in_memory_cache[key]
            if key in cls._in_memory_expiry:
                del cls._in_memory_expiry[key]

    @classmethod
    async def delete_pattern(cls, pattern: str):
        """Delete keys matching pattern"""
        # Try Redis first
        redis_client = cls._get_redis()
        if redis_client:
            try:
                keys_to_del = []
                async for key in redis_client.scan_iter(
                    match=f"*{pattern}*", count=100
                ):
                    keys_to_del.append(key)
                if keys_to_del:
                    await redis_client.delete(*keys_to_del)
            except Exception:
                pass

        # Also delete from in-memory
        async with cls._lock:
            keys_to_delete = [k for k in cls._in_memory_cache if pattern in k]
            for key in keys_to_delete:
                del cls._in_memory_cache[key]
                if key in cls._in_memory_expiry:
                    del cls._in_memory_expiry[key]


# ============================================================================
# RATE LIMITING
# ============================================================================


class NotificationRateLimiter:
    """Rate limiter for notification operations"""

    def __init__(self):
        self._buckets: Dict[Tuple[int, str], List[datetime]] = {}
        self._lock = asyncio.Lock()

    async def check_rate_limit(
        self,
        user_id: int,
        action: str,
        max_requests: int = 100,
        window_seconds: int = 3600,
    ) -> bool:
        """Check if user is within rate limit"""
        async with self._lock:
            key = (user_id, action)
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(seconds=window_seconds)

            requests = self._buckets.get(key, [])
            requests = [r for r in requests if r > window_start]

            if len(requests) >= max_requests:
                return False

            requests.append(now)
            self._buckets[key] = requests
            return True


rate_limiter = NotificationRateLimiter()


# ============================================================================
# EVENT PUBLISHER
# ============================================================================


class NotificationEventPublisher:
    """Publisher for notification events"""

    _subscribers: Dict[int, List[callable]] = {}

    @classmethod
    def subscribe(cls, user_id: int, callback: callable):
        """Subscribe user to notification events"""
        if user_id not in cls._subscribers:
            cls._subscribers[user_id] = []
        cls._subscribers[user_id].append(callback)

    @classmethod
    def unsubscribe(cls, user_id: int, callback: callable):
        """Unsubscribe user from notification events"""
        if user_id in cls._subscribers:
            cls._subscribers[user_id] = [
                cb for cb in cls._subscribers[user_id] if cb != callback
            ]

    @classmethod
    async def publish(cls, user_id: int, event_type: str, data: Dict[str, Any]):
        """Publish event to user subscribers"""
        if user_id in cls._subscribers:
            for callback in cls._subscribers[user_id]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event_type, data)
                    else:
                        callback(event_type, data)
                except Exception as e:
                    logger.error(f"Error publishing notification event: {e}")


# ============================================================================
# SERVICE
# ============================================================================


class NotificationService:
    """Enterprise-grade notification service"""

    # ============================================================================
    # NOTIFICATION CRUD
    # ============================================================================

    @staticmethod
    async def create_notification(
        notification_data: NotificationCreate,
    ) -> NotificationResponse:
        """
        Create a new notification with multi-channel delivery.

        Args:
            notification_data: Notification creation data

        Returns:
            Created notification response
        """
        if not notification_data.user_id:
            raise ValueError("user_id is required to create a notification")

        # Check idempotency key if provided
        if notification_data.idempotency_key:
            idemp_key = f"notif_idemp_{notification_data.user_id}_{notification_data.idempotency_key}"
            existing_notif_id = await NotificationCache.get(idemp_key)
            if existing_notif_id:
                existing = await prisma.notification.find_unique(
                    where={"id": existing_notif_id}
                )
                if existing:
                    logger.info(
                        f"Duplicate notification suppressed for idempotency key {notification_data.idempotency_key}"
                    )
                    return await NotificationService._format_notification_response(
                        existing
                    )

        # Validate user exists
        user = await prisma.user.find_unique(where={"id": notification_data.user_id})
        if not user:
            raise ValueError(f"User with id {notification_data.user_id} not found")

        # Get user preferences
        preferences = await NotificationService.get_user_preferences(
            notification_data.user_id
        )

        # Determine channels based on preferences
        channels = (
            list(notification_data.channels)
            if getattr(notification_data, "channels", None)
            else [NotificationChannel.IN_APP]
        )
        if (
            getattr(notification_data, "send_email", False)
            and NotificationChannel.EMAIL not in channels
        ):
            channels.append(NotificationChannel.EMAIL)

        # Check if should send based on preferences with security override
        is_security_critical = (
            getattr(notification_data, "category", None)
            == NotificationCategory.SECURITY
            or getattr(notification_data, "priority", None)
            == NotificationPriority.URGENT
        )
        should_send_in_app = preferences.in_app_notifications if preferences else True
        should_send_email = (
            preferences.email_notifications if preferences else True
        ) or is_security_critical
        should_send_push = (
            preferences.push_notifications if preferences else True
        ) or is_security_critical

        # Check quiet hours (security alerts always bypass quiet hours)
        if (
            not is_security_critical
            and preferences
            and preferences.quiet_hours_start
            and preferences.quiet_hours_end
        ):
            if NotificationService._is_in_quiet_hours(preferences):
                # Queue for later delivery
                should_send_email = False
                should_send_push = False

        # Prepare payload dictionary
        payload_data = notification_data.data or {}
        if notification_data.payload:
            payload_data["payload"] = (
                notification_data.payload.model_dump(mode="json")
                if hasattr(notification_data.payload, "model_dump")
                else notification_data.payload
            )
            # Flatten critical deep-linking fields for backward compatibility
            if notification_data.payload.action_url:
                payload_data["action_url"] = notification_data.payload.action_url
                payload_data["url"] = notification_data.payload.action_url
            if notification_data.payload.entity_type:
                payload_data["entity_type"] = notification_data.payload.entity_type
            if notification_data.payload.entity_id:
                payload_data["entity_id"] = notification_data.payload.entity_id

        # Create notification
        create_data = {
            "userId": notification_data.user_id,
            "type": notification_data.type,
            "body": notification_data.body or "New Notification",
            "isRead": False,
            "inAppDelivered": should_send_in_app
            and NotificationChannel.IN_APP in channels,
            "emailSent": False,
            "pushSent": False,
            "priority": notification_data.priority.value
            if hasattr(notification_data.priority, "value")
            else (notification_data.priority or NotificationPriority.NORMAL.value),
            "createdAt": datetime.now(timezone.utc),
        }

        if notification_data.title:
            create_data["title"] = notification_data.title

        if payload_data:
            create_data["data"] = Json(payload_data)

        # Map extended categories to valid Prisma DB enum values
        _CATEGORY_DB_MAPPING = {
            "SECURITY": "SECURITY",
            "PROJECT": "PROJECT",
            "FREELANCE": "PROJECT",
            "COURSE": "COURSE",
            "EDUCATION": "COURSE",
            "LIVE": "COURSE",
            "MARKETING": "MARKETING",
            "SYSTEM": "SYSTEM",
            "BILLING": "BILLING",
            "SUPPORT": "SYSTEM",
            "MESSAGING": "SYSTEM",
            "BI": "SYSTEM",
        }
        if notification_data.category:
            cat_value = (
                notification_data.category.value
                if hasattr(notification_data.category, "value")
                else str(notification_data.category)
            )
            db_cat = _CATEGORY_DB_MAPPING.get(cat_value.upper(), "SYSTEM")
            create_data["category"] = db_cat

        if notification_data.expires_at:
            create_data["expiresAt"] = notification_data.expires_at

        notification = await prisma.notification.create(data=create_data)

        # Cache idempotency key if provided
        if notification_data.idempotency_key:
            idemp_key = f"notif_idemp_{notification_data.user_id}_{notification_data.idempotency_key}"
            await NotificationCache.set(idemp_key, notification.id, ttl_seconds=86400)

        # Create delivery records for each channel
        delivery_tasks = []

        if should_send_email and NotificationChannel.EMAIL in channels:
            delivery_tasks.append(
                NotificationService._queue_email_delivery(
                    notification.id, notification_data
                )
            )

        if should_send_push and NotificationChannel.PUSH in channels:
            delivery_tasks.append(
                NotificationService._queue_push_delivery(
                    notification.id, notification_data
                )
            )

        # Run deliveries in background
        if delivery_tasks:
            asyncio.ensure_future(
                asyncio.gather(*delivery_tasks, return_exceptions=True)
            )

        # Invalidate cache
        await NotificationCache.delete_pattern(f"notif_{notification_data.user_id}")

        # Publish real-time event via distributed WebSocket manager and in-memory publisher
        formatted_resp = await NotificationService._format_notification_response(
            notification
        )
        try:
            from app.routers.websocket import manager as ws_manager

            payload = {
                "type": "notification",
                "data": (
                    formatted_resp.model_dump(mode="json")
                    if hasattr(formatted_resp, "model_dump")
                    else formatted_resp
                ),
            }
            await ws_manager.send_to_user_distributed(
                notification_data.user_id, payload
            )
        except Exception as ws_err:
            logger.debug(f"Failed to publish notification to WebSocket: {ws_err}")

        await NotificationEventPublisher.publish(
            notification_data.user_id,
            "NEW_NOTIFICATION",
            {"notificationId": notification.id},
        )

        logger.info(
            f"Created notification {notification.id} for user {notification_data.user_id}"
        )
        return formatted_resp

    @staticmethod
    async def get_user_notifications(
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        filters: Optional[NotificationFilter] = None,
    ) -> Dict[str, Any]:
        """
        Get notifications for a user with filtering.
        Uses caching for performance.

        Args:
            user_id: User ID
            skip: Number to skip
            limit: Number to return
            filters: Optional filters

        Returns:
            Dictionary with notifications, total, and unread count
        """
        # Build cache key with deterministic filter string
        filter_str = (
            f"{getattr(filters, 'is_read', None)}_{getattr(filters, 'category', None)}_{getattr(filters, 'priority', None)}"
            if filters
            else "all"
        )
        cache_key = f"notif_list_{user_id}_{skip}_{limit}_{filter_str}"

        # Try cache first
        cached = await NotificationCache.get(cache_key)
        if cached:
            return cached

        # Build where clause
        where_clause = {"userId": user_id, "deletedAt": None}

        if filters:
            if filters.is_read is not None:
                where_clause["isRead"] = filters.is_read
            if filters.category:
                where_clause["category"] = filters.category.value
            if filters.priority:
                where_clause["priority"] = filters.priority.value
            if filters.start_date:
                where_clause["createdAt"] = {"gte": filters.start_date}
            if filters.end_date:
                where_clause["createdAt"] = {"lte": filters.end_date}

        # Execute all queries concurrently without unnecessary relational joins
        notifications_task = prisma.notification.find_many(
            where=where_clause, skip=skip, take=limit, order={"createdAt": "desc"}
        )
        total_task = prisma.notification.count(where=where_clause)
        unread_task = NotificationService.get_unread_count(user_id)

        notifications, total, unread_count = await asyncio.gather(
            notifications_task, total_task, unread_task
        )

        result = {
            "notifications": [
                await NotificationService._format_notification_response(n)
                for n in notifications
            ],
            "total": total,
            "unread_count": unread_count,
        }

        serializable_result = {
            "notifications": [
                n.model_dump(mode="json") if hasattr(n, "model_dump") else n
                for n in result["notifications"]
            ],
            "total": result["total"],
            "unread_count": result["unread_count"],
        }
        await NotificationCache.set(cache_key, serializable_result, ttl_seconds=30)

        return result

    @staticmethod
    async def get_unread_count(user_id: int) -> int:
        """Get unread notification count (cached)"""
        cache_key = f"notif_unread_{user_id}"

        cached = await NotificationCache.get(cache_key)
        if cached is not None:
            return cached

        count = await prisma.notification.count(
            where={"userId": user_id, "isRead": False, "deletedAt": None}
        )

        # Cache for 15 seconds
        await NotificationCache.set(cache_key, count, ttl_seconds=15)

        return count

    @staticmethod
    async def mark_as_read(notification_id: int, user_id: int) -> NotificationResponse:
        """
        Mark a notification as read.

        Args:
            notification_id: Notification ID
            user_id: User ID (for verification)

        Returns:
            Updated notification
        """
        # Verify notification belongs to user
        notification = await prisma.notification.find_first(
            where={"id": notification_id, "userId": user_id, "deletedAt": None}
        )

        if not notification:
            raise ValueError("Notification not found")

        if notification.isRead:
            return await NotificationService._format_notification_response(notification)

        updated = await prisma.notification.update(
            where={"id": notification_id},
            data={"isRead": True, "readAt": datetime.now(timezone.utc)},
            include={"deliveries": True},
        )

        # Invalidate cache
        await NotificationCache.delete_pattern(f"notif_{user_id}")

        # Publish event
        await NotificationEventPublisher.publish(
            user_id,
            "NOTIFICATION_READ",
            {"notificationId": notification_id, "isRead": True},
        )

        return await NotificationService._format_notification_response(updated)

    @staticmethod
    async def mark_all_as_read(user_id: int) -> int:
        """
        Mark all notifications as read for a user.

        Args:
            user_id: User ID

        Returns:
            Number of notifications marked as read
        """
        result = await prisma.notification.update_many(
            where={"userId": user_id, "isRead": False, "deletedAt": None},
            data={"isRead": True, "readAt": datetime.now(timezone.utc)},
        )

        # Invalidate cache
        await NotificationCache.delete_pattern(f"notif_{user_id}")

        # Publish event
        await NotificationEventPublisher.publish(
            user_id, "ALL_NOTIFICATIONS_READ", {"markedCount": result}
        )

        logger.info(f"Marked {result} notifications as read for user {user_id}")
        return result

    @staticmethod
    async def delete_notification(notification_id: int, user_id: int) -> bool:
        """
        Soft delete a notification.

        Args:
            notification_id: Notification ID
            user_id: User ID (for verification)

        Returns:
            True if successful
        """
        notification = await prisma.notification.find_first(
            where={"id": notification_id, "userId": user_id, "deletedAt": None}
        )

        if not notification:
            raise ValueError("Notification not found")

        await prisma.notification.update(
            where={"id": notification_id},
            data={"deletedAt": datetime.now(timezone.utc)},
        )

        # Invalidate cache
        await NotificationCache.delete_pattern(f"notif_{user_id}")

        # Publish event
        await NotificationEventPublisher.publish(
            user_id, "NOTIFICATION_DELETED", {"notificationId": notification_id}
        )

        return True

    @staticmethod
    async def bulk_update_notifications(
        data: BulkNotificationUpdate, user_id: int
    ) -> BulkMarkAsReadResponse:
        """
        Bulk update notifications.

        Args:
            data: Bulk update data
            user_id: User ID

        Returns:
            Bulk update response
        """
        # Verify all notifications belong to user
        notifications = await prisma.notification.find_many(
            where={
                "id": {"in": data.notification_ids},
                "userId": user_id,
                "deletedAt": None,
            }
        )

        valid_ids = [n.id for n in notifications]

        if not valid_ids:
            return BulkMarkAsReadResponse(marked_count=0, notification_ids=[])

        await prisma.notification.update_many(
            where={"id": {"in": valid_ids}},
            data={
                "isRead": data.is_read,
                "readAt": datetime.now(timezone.utc) if data.is_read else None,
            },
        )

        # Invalidate cache
        await NotificationCache.delete_pattern(f"notif_{user_id}")

        return BulkMarkAsReadResponse(
            marked_count=len(valid_ids), notification_ids=valid_ids
        )

    @staticmethod
    async def bulk_delete_notifications(
        notification_ids: List[int], user_id: int
    ) -> "BulkDeleteResponse":
        """
        Bulk soft-delete notifications.

        Args:
            notification_ids: List of notification IDs to delete
            user_id: User ID (for verification)

        Returns:
            Bulk delete response
        """
        # Verify all notifications belong to user
        notifications = await prisma.notification.find_many(
            where={
                "id": {"in": notification_ids},
                "userId": user_id,
                "deletedAt": None,
            }
        )

        valid_ids = [n.id for n in notifications]

        if not valid_ids:
            return BulkDeleteResponse(deleted_count=0, notification_ids=[])

        await prisma.notification.update_many(
            where={"id": {"in": valid_ids}},
            data={"deletedAt": datetime.now(timezone.utc)},
        )

        # Invalidate cache
        await NotificationCache.delete_pattern(f"notif_{user_id}")

        # Publish event
        await NotificationEventPublisher.publish(
            user_id, "NOTIFICATIONS_BULK_DELETED", {"notificationIds": valid_ids}
        )

        return BulkDeleteResponse(
            deleted_count=len(valid_ids), notification_ids=valid_ids
        )

    @staticmethod
    async def register_push_subscription(
        user_id: int, subscription: "PushSubscriptionCreate"
    ) -> None:
        """
        Register a Web Push subscription in Redis for fast lookup.

        Push subscriptions are stored as a Redis hash keyed by user ID,
        allowing multiple devices per user.

        Args:
            user_id: User ID
            subscription: Push subscription data (endpoint, keys)
        """
        import json

        try:
            redis_client = NotificationCache._get_redis()
            if not redis_client:
                logger.warning("Redis not available for push subscription")
                return

            sub_data = json.dumps(
                {
                    "endpoint": subscription.endpoint,
                    "keys": {
                        "p256dh": subscription.p256dh,
                        "auth": subscription.auth,
                    },
                    "user_agent": subscription.user_agent,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )

            # Store in Redis hash: push_subs:{user_id} -> {endpoint_hash: sub_data}
            # Use endpoint as hash field for deduplication
            import hashlib

            endpoint_hash = hashlib.sha256(subscription.endpoint.encode()).hexdigest()[
                :16
            ]
            key = f"push_subs:{user_id}"

            await redis_client.hset(key, endpoint_hash, sub_data)
            # Set TTL of 30 days (subscriptions should be refreshed)
            await redis_client.expire(key, 30 * 24 * 60 * 60)

            logger.info(f"Registered push subscription for user {user_id}")

        except Exception as e:
            logger.error(f"Error registering push subscription for user {user_id}: {e}")
            raise

    @staticmethod
    async def unregister_push_subscription(user_id: int, endpoint: str) -> None:
        """
        Unregister a Web Push subscription from Redis.

        Args:
            user_id: User ID
            endpoint: Push subscription endpoint URL to remove
        """
        try:
            redis_client = NotificationCache._get_redis()
            if not redis_client:
                return

            import hashlib

            endpoint_hash = hashlib.sha256(endpoint.encode()).hexdigest()[:16]
            key = f"push_subs:{user_id}"

            await redis_client.hdel(key, endpoint_hash)
            logger.info(f"Unregistered push subscription for user {user_id}")

        except Exception as e:
            logger.error(
                f"Error unregistering push subscription for user {user_id}: {e}"
            )
            raise

    # ============================================================================
    # BROADCAST OPERATIONS
    # ============================================================================

    @staticmethod
    async def broadcast_notification(
        data: NotificationBroadcastCreate, sender_id: int
    ) -> BroadcastResponse:
        """
        Broadcast notification to multiple users.

        Args:
            data: Broadcast data
            sender_id: ID of user sending broadcast

        Returns:
            Broadcast response
        """
        # Rate limiting for broadcasts
        if not await rate_limiter.check_rate_limit(
            sender_id, "broadcast", max_requests=5, window_seconds=3600
        ):
            raise ValueError("Broadcast rate limit exceeded")

        # Build target user list
        target_user_ids: Set[int] = set()

        if data.target_user_ids:
            target_user_ids.update(data.target_user_ids)

        if data.target_roles:
            users = await prisma.user.find_many(
                where={
                    "role": {"in": data.target_roles},
                    "isActive": True,
                    "deletedAt": None,
                }
            )
            target_user_ids.update(u.id for u in users)

        # Exclude users
        if data.exclude_user_ids:
            target_user_ids.difference_update(data.exclude_user_ids)

        # Create notifications
        created_count = 0
        errors = []

        for user_id in target_user_ids:
            try:
                notification_data = NotificationCreate(
                    user_id=user_id,
                    type=data.type,
                    title=data.title,
                    body=data.body,
                    data=data.data,
                    category=data.category,
                    priority=data.priority,
                    actions=data.actions,
                    expires_at=data.expires_at,
                )

                await NotificationService.create_notification(notification_data)
                created_count += 1

            except Exception as e:
                errors.append(f"User {user_id}: {str(e)}")
                logger.error(
                    f"Error creating broadcast notification for user {user_id}: {e}"
                )

        return BroadcastResponse(
            message=f"Notification broadcast to {created_count} users",
            sent_count=created_count,
            error_count=len(errors),
            errors=errors if errors else None,
        )

    # ============================================================================
    # PREFERENCES
    # ============================================================================

    @staticmethod
    async def get_user_preferences(
        user_id: int,
    ) -> Optional[NotificationPreferencesResponse]:
        """
        Get notification preferences for a user.

        Args:
            user_id: User ID

        Returns:
            Preferences response or None
        """
        cache_key = f"notif_prefs_{user_id}"

        cached = await NotificationCache.get(cache_key)
        if cached:
            return NotificationPreferencesResponse(**cached)

        preferences = await prisma.notificationpreferences.find_unique(
            where={"userId": user_id}
        )

        if not preferences:
            return None

        result = await NotificationService._format_preferences_response(preferences)

        # Cache for 5 minutes
        await NotificationCache.set(cache_key, result.model_dump(), ttl_seconds=300)

        return result

    @staticmethod
    async def create_user_preferences(
        data: NotificationPreferencesCreate,
    ) -> NotificationPreferencesResponse:
        """
        Create notification preferences for a user.

        Args:
            data: Preferences data

        Returns:
            Created preferences
        """
        # Check if preferences already exist
        existing = await prisma.notificationpreferences.find_unique(
            where={"userId": data.user_id}
        )

        if existing:
            raise ValueError("Notification preferences already exist for this user")

        create_data = {
            "userId": data.user_id,
            "emailNotifications": data.email_notifications,
            "pushNotifications": data.push_notifications,
            "inAppNotifications": data.in_app_notifications,
            "smsNotifications": data.sms_notifications,
            "marketingEmails": data.marketing_emails,
            "newsletter": data.newsletter,
            "digestFrequency": data.digest_frequency.value,
            "quietHoursStart": data.quiet_hours_start,
            "quietHoursEnd": data.quiet_hours_end,
            "quietHoursTimezone": data.quiet_hours_timezone,
            "digestTime": data.digest_time,
            "digestTimezone": data.digest_timezone,
            "digestDay": data.digest_day,
        }

        if data.category_preferences:
            create_data["categoryPreferences"] = Json(data.category_preferences)

        preferences = await prisma.notificationpreferences.create(data=create_data)

        return await NotificationService._format_preferences_response(preferences)

    @staticmethod
    async def update_user_preferences(
        user_id: int, data: NotificationPreferencesUpdate
    ) -> NotificationPreferencesResponse:
        """
        Update notification preferences for a user.

        Args:
            user_id: User ID
            data: Update data

        Returns:
            Updated preferences
        """
        update_data = {}

        if data.email_notifications is not None:
            update_data["emailNotifications"] = data.email_notifications
        if data.push_notifications is not None:
            update_data["pushNotifications"] = data.push_notifications
        if data.in_app_notifications is not None:
            update_data["inAppNotifications"] = data.in_app_notifications
        if data.sms_notifications is not None:
            update_data["smsNotifications"] = data.sms_notifications
        if data.marketing_emails is not None:
            update_data["marketingEmails"] = data.marketing_emails
        if data.newsletter is not None:
            update_data["newsletter"] = data.newsletter
        if data.digest_frequency is not None:
            update_data["digestFrequency"] = data.digest_frequency.value
        if data.quiet_hours_start is not None:
            update_data["quietHoursStart"] = data.quiet_hours_start
        if data.quiet_hours_end is not None:
            update_data["quietHoursEnd"] = data.quiet_hours_end
        if data.quiet_hours_timezone is not None:
            update_data["quietHoursTimezone"] = data.quiet_hours_timezone
        if data.digest_time is not None:
            update_data["digestTime"] = data.digest_time
        if data.digest_timezone is not None:
            update_data["digestTimezone"] = data.digest_timezone
        if data.digest_day is not None:
            update_data["digestDay"] = data.digest_day
        if data.category_preferences is not None:
            update_data["categoryPreferences"] = Json(data.category_preferences)

        preferences = await prisma.notificationpreferences.update(
            where={"userId": user_id}, data=update_data
        )

        # Invalidate cache
        await NotificationCache.delete(f"notif_prefs_{user_id}")

        return await NotificationService._format_preferences_response(preferences)

    @staticmethod
    async def should_send_to_user(
        user_id: int, category: NotificationCategory, channel: NotificationChannel
    ) -> bool:
        """
        Check if notification should be sent to user based on preferences.

        Args:
            user_id: User ID
            category: Notification category
            channel: Delivery channel

        Returns:
            True if should send
        """
        # 🔒 SECURITY: Critical security alerts MUST NEVER be suppressed (CWE-693)
        if category == NotificationCategory.SECURITY:
            return True

        preferences = await NotificationService.get_user_preferences(user_id)

        if not preferences:
            return True  # Default to sending

        # Check channel preference
        if channel == NotificationChannel.EMAIL and not preferences.email_notifications:
            return False
        if channel == NotificationChannel.PUSH and not preferences.push_notifications:
            return False
        if (
            channel == NotificationChannel.IN_APP
            and not preferences.in_app_notifications
        ):
            return False
        if channel == NotificationChannel.SMS and not preferences.sms_notifications:
            return False

        # Check category-specific preferences
        if (
            preferences.category_preferences
            and category.value in preferences.category_preferences
        ):
            category_prefs = preferences.category_preferences[category.value]
            channel_key = channel.value.lower()
            if channel_key in category_prefs:
                return category_prefs[channel_key]

        # Check marketing preference
        if (
            category == NotificationCategory.MARKETING
            and not preferences.marketing_emails
        ):
            return False

        return True

    # ============================================================================
    # STATISTICS
    # ============================================================================

    @staticmethod
    async def get_notification_stats(user_id: int) -> NotificationStats:
        """
        Get notification statistics for a user.

        Args:
            user_id: User ID

        Returns:
            Statistics response
        """
        cache_key = f"notif_stats_{user_id}"

        cached = await NotificationCache.get(cache_key)
        if cached:
            return NotificationStats(**cached)

        base_where = {"userId": user_id, "deletedAt": None}

        # Get counts concurrently
        total_task = prisma.notification.count(where=base_where)
        unread_task = prisma.notification.count(where={**base_where, "isRead": False})

        total, unread = await asyncio.gather(total_task, unread_task)
        read = total - unread

        # Get category counts
        notifications = await prisma.notification.find_many(where=base_where, take=1000)

        by_category = {}
        by_priority = {}

        for notification in notifications:
            category = notification.category or "UNCATEGORIZED"
            by_category[category] = by_category.get(category, 0) + 1

            priority = notification.priority or "NORMAL"
            by_priority[priority] = by_priority.get(priority, 0) + 1

        stats = NotificationStats(
            total=total,
            unread=unread,
            read=read,
            by_category=by_category,
            by_priority=by_priority,
        )

        # Cache for 60 seconds
        await NotificationCache.set(cache_key, stats.model_dump(), ttl_seconds=60)

        return stats

    # ============================================================================
    # PRIVATE METHODS
    # ============================================================================

    @staticmethod
    def _is_in_quiet_hours(preferences: NotificationPreferencesResponse) -> bool:
        """Check if current time is within user's quiet hours"""
        if not preferences.quiet_hours_start or not preferences.quiet_hours_end:
            return False

        try:
            import pytz

            tz = pytz.timezone(preferences.quiet_hours_timezone)
            now = datetime.now(tz)
            current_time = now.strftime("%H:%M")

            start = preferences.quiet_hours_start
            end = preferences.quiet_hours_end

            # Handle overnight quiet hours (e.g., 22:00 - 08:00)
            if start > end:
                return current_time >= start or current_time <= end
            else:
                return start <= current_time <= end

        except Exception:
            return False

    @staticmethod
    async def _queue_email_delivery(notification_id: int, data: NotificationCreate):
        """Queue email delivery for a notification via Celery.

        Creates a NotificationDelivery record in QUEUED status, then dispatches
        a Celery task to send the email asynchronously via SMTP. The task updates
        the delivery status to SENT or FAILED upon completion.
        """
        try:
            # Record the queued delivery in the database
            await prisma.notificationdelivery.create(
                data={
                    "notificationId": notification_id,
                    "channel": NotificationChannel.EMAIL.value,
                    "status": NotificationDeliveryStatus.QUEUED.value,
                    "createdAt": datetime.now(timezone.utc),
                }
            )

            # Dispatch Celery task to send the email asynchronously
            from app.tasks.email_tasks import send_notification_email

            # Look up the recipient's email
            recipient_email = getattr(data, "email", None)
            if not recipient_email and hasattr(data, "user_id"):
                try:
                    user = await prisma.user.find_unique(where={"id": data.user_id})
                    if user and user.email:
                        recipient_email = user.email
                except Exception:
                    pass

            if recipient_email:
                subject = (
                    getattr(data, "title", None)
                    or getattr(data, "subject", None)
                    or "New Notification from Podacium"
                )
                text_body = (
                    getattr(data, "body", None)
                    or getattr(data, "message", None)
                    or getattr(data, "title", None)
                    or "You have received a new notification from Podacium."
                )
                html_body = getattr(data, "html_message", None)

                send_notification_email.delay(
                    to_email=recipient_email,
                    subject=subject,
                    text_body=text_body,
                    html_body=html_body,
                    notification_id=notification_id,
                )
                logger.info(
                    f"Dispatched email task for notification {notification_id} "
                    f"to {recipient_email}"
                )
            else:
                logger.warning(
                    f"Cannot send email for notification {notification_id}: "
                    f"no recipient email found"
                )
                # Mark as failed since we can't deliver without an address
                await prisma.notificationdelivery.update_many(
                    where={
                        "notificationId": notification_id,
                        "channel": NotificationChannel.EMAIL.value,
                    },
                    data={
                        "status": NotificationDeliveryStatus.FAILED.value,
                        "errorMessage": "No recipient email address",
                        "failedAt": datetime.now(timezone.utc),
                    },
                )

        except Exception as e:
            logger.error(
                f"Error queuing email delivery for notification {notification_id}: {e}"
            )

    @staticmethod
    async def _queue_push_delivery(notification_id: int, data: NotificationCreate):
        """Queue push notification delivery"""
        try:
            await prisma.notificationdelivery.create(
                data={
                    "notificationId": notification_id,
                    "channel": NotificationChannel.PUSH.value,
                    "status": NotificationDeliveryStatus.QUEUED.value,
                    "createdAt": datetime.now(timezone.utc),
                }
            )

            # Dispatch via multi-channel notification cascade (WebSocket -> Web Push -> WhatsApp -> Email)
            try:
                from app.tasks.notification_cascade import (
                    orchestrate_notification_cascade,
                )

                cat = (
                    getattr(data.category, "value", str(data.category))
                    if data.category
                    else "SYSTEM"
                )
                prio = (
                    getattr(data.priority, "value", str(data.priority))
                    if data.priority
                    else "NORMAL"
                )
                payload = {
                    "title": data.title or "Podacium Notification",
                    "body": data.body,
                    "category": cat,
                    "priority": prio,
                }
                orchestrate_notification_cascade.delay(
                    notification_id, data.user_id, payload
                )
            except Exception as ex:
                logger.debug(
                    f"Notification cascade dispatch deferred or unavailable: {ex}"
                )

            logger.info(f"Queued push delivery for notification {notification_id}")

        except Exception as e:
            logger.error(f"Error queuing push delivery: {e}")

    @staticmethod
    async def _format_notification_response(notification: Any) -> NotificationResponse:
        """Format notification for API response"""
        # Format deliveries
        deliveries = []
        if hasattr(notification, "deliveries") and notification.deliveries:
            deliveries = [
                NotificationDeliveryResponse(
                    id=d.id,
                    channel=NotificationChannel(d.channel),
                    status=NotificationDeliveryStatus(d.status),
                    sent_at=d.sentAt,
                    delivered_at=d.deliveredAt,
                    failed_at=d.failedAt,
                    error_message=d.errorMessage,
                    retry_count=d.retryCount,
                    external_id=d.externalId,
                )
                for d in notification.deliveries
            ]

        # Parse data field (handle both dict and string representations)
        raw_data = notification.data
        if isinstance(raw_data, str):
            try:
                import json

                raw_data = json.loads(raw_data)
            except (json.JSONDecodeError, TypeError):
                raw_data = {}
        elif not isinstance(raw_data, dict):
            raw_data = {}

        return NotificationResponse(
            id=notification.id,
            user_id=notification.userId,
            type=notification.type,
            title=notification.title,
            body=notification.body,
            data=raw_data,
            is_read=notification.isRead,
            read_at=notification.readAt,
            in_app_delivered=notification.inAppDelivered,
            email_sent=notification.emailSent,
            email_sent_at=notification.emailSentAt,
            push_sent=notification.pushSent,
            push_sent_at=notification.pushSentAt,
            category=NotificationCategory(notification.category)
            if notification.category
            else None,
            priority=NotificationPriority(notification.priority)
            if notification.priority
            else NotificationPriority.NORMAL,
            created_at=notification.createdAt,
            deleted_at=notification.deletedAt,
            expires_at=notification.expiresAt,
            actions=notification.data.get("actions") if notification.data else None,
            deliveries=deliveries,
        )

    @staticmethod
    async def _format_preferences_response(
        preferences: Any,
    ) -> NotificationPreferencesResponse:
        """Format preferences for API response"""
        category_prefs = None
        if preferences.categoryPreferences:
            category_prefs = (
                json.loads(preferences.categoryPreferences)
                if isinstance(preferences.categoryPreferences, str)
                else preferences.categoryPreferences
            )

        return NotificationPreferencesResponse(
            id=preferences.id,
            user_id=preferences.userId,
            email_notifications=preferences.emailNotifications,
            push_notifications=preferences.pushNotifications,
            in_app_notifications=preferences.inAppNotifications,
            sms_notifications=preferences.smsNotifications,
            marketing_emails=preferences.marketingEmails,
            newsletter=preferences.newsletter,
            digest_frequency=DigestFrequency(preferences.digestFrequency),
            quiet_hours_start=preferences.quietHoursStart,
            quiet_hours_end=preferences.quietHoursEnd,
            quiet_hours_timezone=preferences.quietHoursTimezone,
            digest_time=preferences.digestTime,
            digest_timezone=preferences.digestTimezone,
            digest_day=preferences.digestDay,
            category_preferences=category_prefs,
            created_at=preferences.createdAt,
            updated_at=preferences.updatedAt,
        )


def resolve_whatsapp_template_payload(
    template_name: str,
    user_preferred_locale: Optional[str] = "fr",
    components: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Whenever dispatching Meta WhatsApp Cloud API templates:
    If user.preferred_locale == "kab", automatically map to the approved French template ("fr")
    and prepend a Tamazight bilingual greeting line ("Azul!").
    """
    locale = (user_preferred_locale or "fr").strip().lower()
    if locale == "kab" or locale.startswith("kab-") or locale.startswith("kab_"):
        language_code = "fr"
        adjusted_components: List[Dict[str, Any]] = []
        if components:
            import copy

            adjusted_components = copy.deepcopy(components)
            for comp in adjusted_components:
                if comp.get("type") == "body" and "parameters" in comp:
                    for param in comp["parameters"]:
                        if param.get("type") == "text" and "text" in param:
                            orig_text = param["text"]
                            if not orig_text.startswith("Azul"):
                                param["text"] = f"Azul! {orig_text}"
                            break
        else:
            adjusted_components = [
                {"type": "body", "parameters": [{"type": "text", "text": "Azul!"}]}
            ]
        return language_code, adjusted_components

    from app.services.whatsapp_service import _resolve_whatsapp_language

    return _resolve_whatsapp_language(locale), components or []
