"""
WebSocket endpoint for real-time messaging and notifications.
Authenticates via JWT token passed as query parameter or cookie.
Supports horizontal scaling via Redis Pub/Sub.
"""

import logging
import json
import asyncio
import time
import uuid
from typing import Dict, Set, Optional, Any
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websockets.exceptions import ConnectionClosed
from app.core.security import verify_token
from app.core.prisma import prisma
from app.core.config import setting

router = APIRouter()
logger = logging.getLogger(__name__)

_WS_RATE_LIMIT_WINDOW = 60
_WS_MAX_MESSAGES_PER_WINDOW = 60
_ws_rate_buckets: Dict[int, list] = {}


def _check_ws_rate_limit(user_id: int) -> bool:
    now = time.time()
    cutoff = now - _WS_RATE_LIMIT_WINDOW
    bucket = _ws_rate_buckets.get(user_id, [])
    bucket = [t for t in bucket if t > cutoff]
    if len(bucket) >= _WS_MAX_MESSAGES_PER_WINDOW:
        return False
    bucket.append(now)
    _ws_rate_buckets[user_id] = bucket
    return True


# Unique ID for this running server instance to prevent cyclic delivery loops
INSTANCE_ID = str(uuid.uuid4())

# =============================================================================
# REDIS PUB/SUB FOR HORIZONTAL SCALING
# =============================================================================


class RedisPubSub:
    """Redis Pub/Sub adapter for cross-instance WebSocket messaging with partitioned channels."""

    def __init__(self):
        self._redis = None
        self._pubsub = None
        self._listening = False
        self._subscribed_channels: Set[str] = set()

    async def connect(self):
        """Initialize Redis connection for pub/sub."""
        if self._redis:
            return
        try:
            import redis.asyncio as aioredis

            redis_url = getattr(setting, "REDIS_URL", "")
            if redis_url:
                self._redis = aioredis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    max_connections=50,
                )
                logger.info("Redis Pub/Sub connected for WebSocket scaling")

                # Start listener loop as background task
                asyncio.create_task(self.listen_loop())
        except Exception as e:
            logger.warning(
                f"Redis Pub/Sub unavailable, falling back to local-only: {e}"
            )
            self._redis = None

    async def subscribe_channel(self, channel: str):
        """Dynamically subscribe this worker to a specific partitioned channel."""
        if not self._pubsub or channel in self._subscribed_channels:
            return
        try:
            await self._pubsub.subscribe(channel)
            self._subscribed_channels.add(channel)
        except Exception as e:
            logger.debug(f"Failed to subscribe to channel {channel}: {e}")

    async def unsubscribe_channel(self, channel: str):
        """Unsubscribe from a channel when no local listeners remain."""
        if not self._pubsub or channel not in self._subscribed_channels:
            return
        try:
            await self._pubsub.unsubscribe(channel)
            self._subscribed_channels.discard(channel)
        except Exception as e:
            logger.debug(f"Failed to unsubscribe from channel {channel}: {e}")

    async def listen_loop(self):
        """Listen to partitioned Redis channels and forward messages to local connections."""
        if not self._redis:
            return

        self._pubsub = self._redis.pubsub()
        # Subscribe to base channel and dynamic channels for locally connected users
        await self._pubsub.subscribe("ws_distributed")
        self._subscribed_channels.add("ws_distributed")

        for u_id in list(manager.active_connections.keys()):
            ch = f"ws:user:{u_id}"
            try:
                await self._pubsub.subscribe(ch)
                self._subscribed_channels.add(ch)
            except Exception:
                pass

        self._listening = True
        logger.info(
            "Started Redis Pub/Sub listener on partitioned user channels (dynamic per-connection)"
        )

        while self._listening:
            try:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message["type"] in ("message", "pmessage"):
                    data = json.loads(message["data"])
                    sender_instance_id = data.get("sender_instance_id")

                    # Prevent circular processing of messages sent by this same instance
                    if sender_instance_id == INSTANCE_ID:
                        continue

                    channel = message.get("channel", "")
                    target_user_id = data.get("user_id")
                    if not target_user_id and channel.startswith("ws:user:"):
                        try:
                            target_user_id = int(channel.split(":")[-1])
                        except ValueError:
                            pass

                    payload = data.get("message")
                    if target_user_id and payload:
                        # Send strictly to local sockets of the target user on this instance
                        await manager.send_to_user(target_user_id, payload)
            except asyncio.CancelledError:
                logger.info("Redis Pub/Sub listener task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in Redis Pub/Sub listener: {e}")
                await asyncio.sleep(1.0)

        self._listening = False

    async def publish(self, channel: str, message: dict):
        """Publish a message to a Redis channel."""
        if not self._redis:
            return
        try:
            await self._redis.publish(channel, json.dumps(message))
        except Exception as e:
            logger.error(f"Redis publish failed: {e}")

    @property
    def available(self) -> bool:
        return self._redis is not None


redis_pubsub = RedisPubSub()


# =============================================================================
# CONNECTION MANAGER
# =============================================================================


class ConnectionManager:
    """Manages active WebSocket connections per user with Redis Pub/Sub support."""

    def __init__(self):
        # user_id -> set of active WebSocket connections (local to this instance)
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        first_connection = (
            user_id not in self.active_connections
            or len(self.active_connections[user_id]) == 0
        )
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        if first_connection and redis_pubsub.available:
            await redis_pubsub.subscribe_channel(f"ws:user:{user_id}")
        logger.info(
            f"WS connected: user {user_id} (local connections: {len(self.active_connections[user_id])})"
        )

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                if redis_pubsub.available:
                    asyncio.create_task(
                        redis_pubsub.unsubscribe_channel(f"ws:user:{user_id}")
                    )
        logger.info(f"WS disconnected: user {user_id}")

    async def send_to_user(self, user_id: int, message: dict):
        """Send a message to all LOCAL connections of a specific user concurrently with timeout."""
        if user_id in self.active_connections:
            connections = list(self.active_connections[user_id])
            if not connections:
                return

            async def _send(conn: WebSocket):
                try:
                    await asyncio.wait_for(conn.send_json(message), timeout=0.5)
                    return None
                except Exception:
                    try:
                        await conn.close()
                    except Exception:
                        pass
                    return conn

            results = await asyncio.gather(
                *[_send(c) for c in connections], return_exceptions=True
            )
            dead_connections = {
                res
                for res in results
                if res is not None and not isinstance(res, Exception)
            }
            if dead_connections and user_id in self.active_connections:
                self.active_connections[user_id].difference_update(dead_connections)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                    if redis_pubsub.available:
                        asyncio.create_task(
                            redis_pubsub.unsubscribe_channel(f"ws:user:{user_id}")
                        )

    async def send_to_user_distributed(self, user_id: int, message: dict):
        """Send a message to a user across instances via partitioned channel ws:user:{user_id}."""
        # Always send locally first
        await self.send_to_user(user_id, message)
        # Publish to partitioned Redis channel for other instances
        if redis_pubsub.available:
            channel = f"ws:user:{user_id}"
            await redis_pubsub.publish(
                channel,
                {
                    "user_id": user_id,
                    "message": message,
                    "sender_instance_id": INSTANCE_ID,
                },
            )

    async def send_to_conversation_distributed(
        self, conversation_id: str, message: dict
    ):
        """Send a message to a conversation room across instances via partitioned channel."""
        if redis_pubsub.available:
            channel = f"ws:conv:{conversation_id}"
            await redis_pubsub.publish(
                channel,
                {
                    "conversation_id": conversation_id,
                    "message": message,
                    "sender_instance_id": INSTANCE_ID,
                },
            )

    async def broadcast_to_users(self, user_ids: list[int], message: dict):
        """Send a message to multiple users (distributed)."""
        for user_id in user_ids:
            await self.send_to_user_distributed(user_id, message)

    def is_online(self, user_id: int) -> bool:
        return (
            user_id in self.active_connections
            and len(self.active_connections[user_id]) > 0
        )

    def get_online_count(self) -> int:
        return len(self.active_connections)


# Singleton manager
manager = ConnectionManager()


# =============================================================================
# AUTHENTICATION
# =============================================================================


async def authenticate_websocket(websocket: WebSocket) -> Optional[int]:
    """Authenticate a WebSocket connection via one-time ticket (primary) or cookie (fallback)."""
    # SECURITY: Verify Origin header to prevent Cross-Site WebSocket Hijacking (CSWSH).
    # Accept both www and non-www variants of the production domain — the browser sends
    # whichever form the current page URL has, and both map to the same application.
    origin = websocket.headers.get("origin") or websocket.headers.get(
        "sec-websocket-origin", ""
    )
    if isinstance(origin, str) and origin:
        origin_clean = origin.rstrip("/")
        frontend_url = setting.FRONTEND_URL.rstrip("/")

        # Build the set of allowed origins: configured URL + its www/non-www counterpart
        allowed_origins: set[str] = {frontend_url}
        if frontend_url.startswith("https://www."):
            allowed_origins.add("https://" + frontend_url[len("https://www.") :])
        elif frontend_url.startswith("https://"):
            allowed_origins.add("https://www." + frontend_url[len("https://") :])

        # Also honour CORS_ORIGINS env var if set (comma-separated list)
        cors_raw = getattr(setting, "CORS_ORIGINS_RAW", "") or ""
        for o in cors_raw.split(","):
            o = o.strip().rstrip("/")
            if o.startswith("https://"):
                allowed_origins.add(o)

        is_allowed = (
            origin_clean in allowed_origins
            or origin_clean.startswith("http://localhost:")
            or origin_clean.startswith("https://localhost:")
        )
        if not is_allowed:
            logger.warning(
                f"WebSocket connection rejected: origin={origin}, "
                f"allowed={sorted(allowed_origins)}"
            )
            return None

    # Method 1: One-time ticket (preferred — prevents JWT exposure in URLs/logs)
    raw_ticket = (
        websocket.query_params.get("ticket")
        if hasattr(websocket, "query_params")
        else None
    )
    ticket = raw_ticket if isinstance(raw_ticket, str) and raw_ticket else None
    if ticket and setting.REDIS_URL:
        import redis.asyncio as aioredis

        r = aioredis.from_url(
            setting.REDIS_URL, decode_responses=True, socket_connect_timeout=2
        )
        try:
            getdel_fn = getattr(r, "getdel", None)
            if callable(getdel_fn):
                user_id_str = await getdel_fn(f"ws_ticket:{ticket}")
            else:
                user_id_str = await r.get(f"ws_ticket:{ticket}")
                if user_id_str:
                    await r.delete(f"ws_ticket:{ticket}")
            if user_id_str:
                user_id = int(user_id_str)
                user = await prisma.user.find_unique(where={"id": user_id})
                if (
                    user
                    and not user.deletedAt
                    and user.isActive
                    and not (getattr(user, "isBanned", False) is True)
                ):
                    return user_id
        except Exception:
            pass
        finally:
            await r.close()
        return None

    # Method 2: HTTP-only cookie (fallback)
    raw_token = (
        websocket.cookies.get("access_token") if hasattr(websocket, "cookies") else None
    )
    auth_token = raw_token if isinstance(raw_token, str) and raw_token else None
    if not auth_token:
        return None

    payload = verify_token(auth_token)
    if not payload or payload.get("type") != "access":
        return None

    try:
        user_id = int(payload["sub"])
        user = await prisma.user.find_unique(where={"id": user_id})
        if (
            not user
            or user.deletedAt
            or not user.isActive
            or (getattr(user, "isBanned", False) is True)
        ):
            return None
        return user_id
    except (ValueError, Exception):
        return None


# =============================================================================
# WEBSOCKET ENDPOINT
# =============================================================================


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint.

    Authentication:
      HTTP-only cookie (access_token) — sent automatically by the browser,
      never appears in logs, Referer headers, or proxy logs.

    Incoming messages (client → server):
      - {"type": "ping"} → responds with {"type": "pong"}
      - {"type": "typing", "conversationId": 123} → broadcasts typing indicator
      - {"type": "read", "messageId": 456} → marks message as read

    Outgoing messages (server → client):
      - {"type": "message", "data": {...}} → new message received
      - {"type": "notification", "data": {...}} → new notification
      - {"type": "typing", "userId": 5, "conversationId": 123} → someone is typing
    """
    # Initialize Redis Pub/Sub on first connection
    await redis_pubsub.connect()

    user_id = await authenticate_websocket(websocket)

    if user_id is None:
        try:
            await websocket.accept()
            await websocket.close(code=4001, reason="Authentication failed")
        except Exception:
            pass
        return

    await manager.connect(websocket, user_id)

    try:
        # Send initial connection confirmation
        await websocket.send_json(
            {
                "type": "connected",
                "userId": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

        # Listen for messages with heartbeat timeout and rate limiting
        while True:
            if not _check_ws_rate_limit(user_id):
                await websocket.send_json({"type": "error", "message": "Rate limited"})
                await asyncio.sleep(1)
                continue
            try:
                # Client sends ping every 30s. If no frame arrives for 75s, socket is dead.
                data = await asyncio.wait_for(websocket.receive_json(), timeout=75.0)
            except asyncio.TimeoutError:
                logger.info(f"WS timeout (no heartbeat in 75s): user {user_id}")
                break

            if data.get("type") == "ping":
                if redis_pubsub.available and redis_pubsub._redis:
                    try:
                        await redis_pubsub._redis.set(
                            f"presence:user:{user_id}", "online", ex=60
                        )
                    except Exception:
                        pass
                await websocket.send_json({"type": "pong"})
            else:
                await handle_client_message(user_id, data)

    except WebSocketDisconnect:
        logger.debug(f"WS disconnected cleanly: user {user_id}")
    except (ConnectionClosed, ConnectionResetError, BrokenPipeError) as e:
        logger.debug(f"WS client disconnected abruptly: user {user_id} ({e})")
    except Exception as e:
        err_msg = str(e).lower()
        if "no close frame" in err_msg or "connection closed" in err_msg:
            logger.debug(
                f"WS connection closed without close frame for user {user_id}: {e}"
            )
        else:
            logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        manager.disconnect(websocket, user_id)
        try:
            await websocket.close()
        except Exception:
            pass


async def handle_client_message(user_id: int, data: dict):
    """Handle incoming WebSocket messages from clients."""
    msg_type = data.get("type")

    if msg_type == "ping":
        await manager.send_to_user(user_id, {"type": "pong"})

    elif msg_type == "typing":
        conversation_id_raw = data.get("conversationId")
        if conversation_id_raw is not None:
            # Ephemeral typing state in Redis with 3-second auto-expiration
            if redis_pubsub.available and redis_pubsub._redis:
                try:
                    await redis_pubsub._redis.set(
                        f"typing:{conversation_id_raw}:{user_id}", "1", ex=3
                    )
                except Exception:
                    pass
            # Resolve conversation internal id if UUID or int
            conv_filter: Dict[str, Any] = (
                {"conversationId": str(conversation_id_raw)}
                if isinstance(conversation_id_raw, str)
                and not conversation_id_raw.isdigit()
                else {"id": int(conversation_id_raw)}
            )
            conv = await prisma.conversation.find_first(
                where=conv_filter,
                include={"participants": {"where": {"leftAt": None}}},
            )
            if conv:
                is_member = any(p.userId == user_id for p in conv.participants)
                if is_member:
                    for p in conv.participants:
                        if p.userId != user_id:
                            await manager.send_to_user_distributed(
                                p.userId,
                                {
                                    "type": "typing",
                                    "userId": user_id,
                                    "conversationId": conv.conversationId,
                                },
                            )

    elif msg_type == "read":
        message_id_raw = data.get("messageId")
        if message_id_raw is not None:
            try:
                msg_filter: Dict[str, Any] = (
                    {"messageId": str(message_id_raw)}
                    if isinstance(message_id_raw, str)
                    and not str(message_id_raw).isdigit()
                    else {"id": int(message_id_raw)}
                )
                msg = await prisma.message.find_first(where=msg_filter)
                if msg:
                    await prisma.messagereadreceipt.upsert(
                        where={
                            "messageId_userId": {"messageId": msg.id, "userId": user_id}
                        },
                        data={
                            "create": {"messageId": msg.id, "userId": user_id},
                            "update": {"readAt": datetime.now(timezone.utc)},
                        },
                    )
            except Exception as e:
                logger.debug(f"Failed to record read receipt via WS: {e}")

    elif msg_type == "mail_presence":
        thread_id = data.get("threadId") or data.get("thread_id")
        action = data.get("action")  # "viewing", "drafting", "left"
        if thread_id:
            try:
                user = await prisma.user.find_unique(where={"id": user_id})
                user_name = user.fullName if user else f"Admin #{user_id}"
                user_avatar = getattr(user, "avatarUrl", None)

                # Only notify admins who can actually access this mailbox:
                # presence must not reveal private thread activity to every admin.
                thread = await prisma.mailthread.find_unique(
                    where={"threadId": str(thread_id)}
                )
                account = (
                    await prisma.mailaccount.find_unique(
                        where={"id": thread.mailAccountId}
                    )
                    if thread
                    else None
                )
                if not account or getattr(account, "deletedAt", None):
                    logger.debug("Ignoring presence event for unavailable mailbox")
                else:
                    assignments = await prisma.mailaccountadminassignment.find_many(
                        where={"mailAccountId": account.id},
                        include={"adminProfile": True},
                    )
                    super_admins = await prisma.adminprofile.find_many(
                        where={
                            "OR": [
                                {"department": "SUPER_ADMIN"},
                                {"clearanceLevel": {"gte": 10}},
                            ]
                        }
                    )

                    assigned_user_ids = {
                        profile.userId
                        for assignment in assignments
                        if (profile := getattr(assignment, "adminProfile", None))
                        and getattr(profile, "userId", None)
                    }
                    super_admin_user_ids = {
                        profile.userId
                        for profile in super_admins
                        if getattr(profile, "userId", None)
                    }

                    # The sender must belong to this mailbox too; otherwise any
                    # authenticated user could spoof presence into a thread they
                    # cannot even read.
                    if (
                        getattr(account, "userId", None) != user_id
                        and user_id not in assigned_user_ids
                        and user_id not in super_admin_user_ids
                    ):
                        logger.warning(
                            "Rejected unauthorized mail presence for thread %s from user %s",
                            thread_id,
                            user_id,
                        )
                        return

                    recipients = set()
                    if getattr(account, "userId", None):
                        recipients.add(account.userId)
                    recipients.update(assigned_user_ids)
                    recipients.update(super_admin_user_ids)

                    event_payload = {
                        "type": "mail_presence",
                        "threadId": str(thread_id),
                        "userId": user_id,
                        "name": user_name,
                        "avatar": user_avatar,
                        "action": action,
                        "timestamp": time.time(),
                    }
                    for recipient_id in recipients:
                        if recipient_id != user_id:
                            await manager.send_to_user_distributed(
                                recipient_id, event_payload
                            )
            except Exception as e:
                logger.debug(f"Failed to broadcast mail presence: {e}")

    elif msg_type == "dashboard_cursor":
        dashboard_id_raw = data.get("dashboardId") or data.get("dashboard_id")
        if dashboard_id_raw is not None:
            try:
                user = await prisma.user.find_unique(where={"id": user_id})
                user_name = user.fullName if user else f"User #{user_id}"
                avatar = getattr(user, "avatarUrl", None) or getattr(
                    user, "profilePictureUrl", None
                )
                from app.services.bi_services.collaboration import (
                    DashboardCollaborationService,
                )

                await DashboardCollaborationService.broadcast_live_cursor(
                    dashboard_id=int(dashboard_id_raw),
                    user_id=user_id,
                    user_name=user_name,
                    position_x=float(data.get("x") or data.get("position_x") or 0.0),
                    position_y=float(data.get("y") or data.get("position_y") or 0.0),
                    widget_id=data.get("widgetId") or data.get("widget_id"),
                    avatar_url=avatar,
                )
            except Exception as e:
                logger.debug(f"Failed to handle dashboard cursor over WS: {e}")

    elif msg_type == "dashboard_presence":
        dashboard_id_raw = data.get("dashboardId") or data.get("dashboard_id")
        action = data.get("action", "active")  # "active", "idle", "left"
        if dashboard_id_raw is not None:
            try:
                user = await prisma.user.find_unique(where={"id": user_id})
                user_name = user.fullName if user else f"User #{user_id}"
                avatar = getattr(user, "avatarUrl", None) or getattr(
                    user, "profilePictureUrl", None
                )
                from app.services.bi_services.collaboration import (
                    DashboardCollaborationService,
                )

                await DashboardCollaborationService.broadcast_presence(
                    dashboard_id=int(dashboard_id_raw),
                    user_id=user_id,
                    user_name=user_name,
                    status=action,
                    avatar_url=avatar,
                )
            except Exception as e:
                logger.debug(f"Failed to handle dashboard presence over WS: {e}")


# =============================================================================
# UTILITY: Send messages from other parts of the app
# =============================================================================


async def notify_user(user_id: int, notification_type: str, data: dict):
    """Send a real-time notification to a user (called from services)."""
    await manager.send_to_user_distributed(
        user_id,
        {
            "type": notification_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


async def send_message_realtime(
    conversation_id: int, sender_id: int, message_data: dict
):
    """Broadcast a new message to all active conversation participants."""
    participants = await prisma.conversationparticipant.find_many(
        where={"conversationId": conversation_id, "leftAt": None},
    )

    for p in participants:
        if p.userId != sender_id:
            await manager.send_to_user_distributed(
                p.userId,
                {
                    "type": "message",
                    "data": message_data,
                    "conversationId": conversation_id,
                },
            )
