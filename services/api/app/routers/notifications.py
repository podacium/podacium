"""
Notifications Router - Enterprise Grade

FastAPI router for the Podacium notification system.
All endpoints require authentication.

Features:
- Rate limiting
- Multi-channel delivery support
- Bulk operations
- Broadcast capabilities (admin only)
- Comprehensive filtering
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import Optional
import logging

from app.core.auth import get_current_active_user
from app.services.notification_service import NotificationService
from app.schemas.notifications import (
    NotificationCreate,
    NotificationBroadcastCreate,
    NotificationPreferencesCreate,
    NotificationPreferencesUpdate,
    NotificationPreferencesBase,
    NotificationResponse,
    NotificationListResponse,
    NotificationPreferencesResponse,
    NotificationStats,
    BulkNotificationUpdate,
    BulkMarkAsReadResponse,
    BroadcastResponse,
    NotificationCategory,
    NotificationPriority,
    NotificationFilter,
    PushSubscriptionCreate,
    BulkNotificationIds,
    BulkDeleteResponse,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


# ============================================================================
# NOTIFICATION CRUD
# ============================================================================


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of notifications to skip"),
    limit: int = Query(
        50, ge=1, le=100, description="Number of notifications to return"
    ),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    category: Optional[NotificationCategory] = Query(
        None, description="Filter by category"
    ),
    priority: Optional[NotificationPriority] = Query(
        None, description="Filter by priority"
    ),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get notifications for the current user with filtering.
    Results are cached for 30 seconds.
    """
    try:
        filters = (
            NotificationFilter(is_read=is_read, category=category, priority=priority)
            if any([is_read is not None, category, priority])
            else None
        )

        result = await NotificationService.get_user_notifications(
            user_id=current_user.id, skip=skip, limit=limit, filters=filters
        )

        return NotificationListResponse(
            notifications=result["notifications"],
            total=result["total"],
            unread_count=result["unread_count"],
            page=(skip // limit) + 1,
            page_size=limit,
            has_more=result["total"] > (skip + len(result["notifications"])),
        )

    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch notifications",
        )


@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(current_user: dict = Depends(get_current_active_user)):
    """
    Get notification statistics for the current user.
    Results are cached for 60 seconds.
    """
    try:
        stats = await NotificationService.get_notification_stats(current_user.id)
        return stats

    except Exception as e:
        logger.error(f"Error fetching notification stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch notification statistics",
        )


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_active_user)):
    """
    Get the unread notification count for the current user.
    Results are cached for 15 seconds.
    """
    try:
        count = await NotificationService.get_unread_count(current_user.id)
        return {"unread_count": count}

    except Exception as e:
        logger.error(f"Error fetching unread count: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch unread count",
        )


@router.post(
    "/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED
)
async def create_notification(
    notification_data: NotificationCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Create a new notification (typically used by internal services).
    Users can only create notifications for themselves unless they are admins.
    """
    try:
        # Verify permissions
        if notification_data.user_id != current_user.id:
            if current_user.role not in ["ADMIN", "INSTRUCTOR"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions to create notifications for other users",
                )

        notification = await NotificationService.create_notification(notification_data)
        return notification

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create notification",
        )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int, current_user: dict = Depends(get_current_active_user)
):
    """
    Mark a specific notification as read.
    """
    try:
        notification = await NotificationService.mark_as_read(
            notification_id=notification_id, user_id=current_user.id
        )
        return notification

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notification as read",
        )


@router.post("/read-all", response_model=BulkMarkAsReadResponse)
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Mark all notifications as read for the current user.
    """
    try:
        count = await NotificationService.mark_all_as_read(current_user.id)
        return BulkMarkAsReadResponse(
            marked_count=count,
            notification_ids=[],  # Could be populated if needed
        )

    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notifications as read",
        )


@router.post("/bulk-update", response_model=BulkMarkAsReadResponse)
async def bulk_update_notifications(
    data: BulkNotificationUpdate, current_user: dict = Depends(get_current_active_user)
):
    """
    Bulk update notifications (mark as read/unread).
    """
    try:
        result = await NotificationService.bulk_update_notifications(
            data=data, user_id=current_user.id
        )
        return result

    except Exception as e:
        logger.error(f"Error bulk updating notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notifications",
        )


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int, current_user: dict = Depends(get_current_active_user)
):
    """
    Delete a notification (soft delete).
    """
    try:
        success = await NotificationService.delete_notification(
            notification_id=notification_id, user_id=current_user.id
        )
        if success:
            return {"success": True, "message": "Notification deleted successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete notification",
            )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete notification",
        )


# ============================================================================
# PUSH SUBSCRIPTION ENDPOINTS
# ============================================================================


@router.post("/push-subscriptions", status_code=status.HTTP_201_CREATED)
async def register_push_subscription(
    subscription: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Register a Web Push subscription for the current user's device.
    Subscriptions are stored in Redis for fast lookup during push dispatch.
    """
    try:
        await NotificationService.register_push_subscription(
            user_id=current_user.id, subscription=subscription
        )
        return {"success": True}

    except Exception as e:
        logger.error(f"Error registering push subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register push subscription",
        )


@router.delete("/push-subscriptions")
async def unregister_push_subscription(
    endpoint: str = Query(..., description="Push subscription endpoint to unregister"),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Unregister a Web Push subscription for the current user.
    """
    try:
        await NotificationService.unregister_push_subscription(
            user_id=current_user.id, endpoint=endpoint
        )
        return {"success": True}

    except Exception as e:
        logger.error(f"Error unregistering push subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unregister push subscription",
        )


# ============================================================================
# BULK OPERATIONS
# ============================================================================


@router.post("/bulk-read", response_model=BulkMarkAsReadResponse)
async def bulk_read_notifications(
    data: BulkNotificationIds, current_user: dict = Depends(get_current_active_user)
):
    """
    Bulk mark specific notifications as read.
    """
    try:
        result = await NotificationService.bulk_update_notifications(
            data=BulkNotificationUpdate(
                notification_ids=data.notification_ids, is_read=True
            ),
            user_id=current_user.id,
        )
        return result

    except Exception as e:
        logger.error(f"Error bulk marking notifications as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notifications as read",
        )


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_notifications(
    data: BulkNotificationIds, current_user: dict = Depends(get_current_active_user)
):
    """
    Bulk soft-delete notifications.
    """
    try:
        result = await NotificationService.bulk_delete_notifications(
            notification_ids=data.notification_ids, user_id=current_user.id
        )
        return result

    except Exception as e:
        logger.error(f"Error bulk deleting notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete notifications",
        )


# ============================================================================
# PREFERENCES ENDPOINTS
# ============================================================================


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get notification preferences for the current user.
    Creates default preferences if they don't exist.
    """
    try:
        preferences = await NotificationService.get_user_preferences(current_user.id)

        if not preferences:
            # Create default preferences
            from app.schemas.notifications import NotificationPreferencesCreate

            default_prefs = NotificationPreferencesCreate(user_id=current_user.id)
            preferences = await NotificationService.create_user_preferences(
                default_prefs
            )

        return preferences

    except Exception as e:
        logger.error(f"Error fetching notification preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch notification preferences",
        )


@router.put("/preferences", response_model=NotificationPreferencesResponse)
async def update_notification_preferences(
    preferences_data: NotificationPreferencesUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Update notification preferences for the current user.
    """
    try:
        preferences = await NotificationService.update_user_preferences(
            user_id=current_user.id, data=preferences_data
        )
        return preferences

    except Exception as e:
        logger.error(f"Error updating notification preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification preferences",
        )


@router.post(
    "/preferences",
    response_model=NotificationPreferencesResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_notification_preferences(
    preferences_data: NotificationPreferencesBase,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Create notification preferences (if they don't exist).
    """
    try:
        # Check if preferences already exist
        existing = await NotificationService.get_user_preferences(current_user.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Notification preferences already exist for this user",
            )

        # Create preferences with current user ID
        create_data = NotificationPreferencesCreate(
            user_id=current_user.id,
            email_notifications=preferences_data.email_notifications,
            push_notifications=preferences_data.push_notifications,
            in_app_notifications=preferences_data.in_app_notifications,
            sms_notifications=preferences_data.sms_notifications,
            marketing_emails=preferences_data.marketing_emails,
            newsletter=preferences_data.newsletter,
            digest_frequency=preferences_data.digest_frequency,
            quiet_hours_start=preferences_data.quiet_hours_start,
            quiet_hours_end=preferences_data.quiet_hours_end,
            quiet_hours_timezone=preferences_data.quiet_hours_timezone,
            digest_time=preferences_data.digest_time,
            digest_timezone=preferences_data.digest_timezone,
            digest_day=preferences_data.digest_day,
            category_preferences=preferences_data.category_preferences,
        )

        preferences = await NotificationService.create_user_preferences(create_data)
        return preferences

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating notification preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create notification preferences",
        )


# ============================================================================
# ADMIN BROADCAST ENDPOINTS
# ============================================================================


@router.post("/admin/broadcast", response_model=BroadcastResponse)
async def broadcast_notification(
    notification_data: NotificationBroadcastCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Broadcast notification to multiple users (admin only).
    Rate limited to 5 broadcasts per hour per admin.
    """
    try:
        # Check permissions
        if current_user.role not in ["ADMIN", "INSTRUCTOR"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )

        result = await NotificationService.broadcast_notification(
            data=notification_data, sender_id=current_user.id
        )

        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error broadcasting notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to broadcast notification: {str(e)}",
        )


@router.post("/admin/broadcast-role", response_model=BroadcastResponse)
async def broadcast_notification_to_role(
    notification_data: NotificationCreate,
    target_role: str = Query(..., description="Target role for broadcast"),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Broadcast notification to users with specific role (admin only).
    """
    try:
        # Check permissions
        if current_user.role not in ["ADMIN", "INSTRUCTOR"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )

        # Convert to broadcast format
        broadcast_data = NotificationBroadcastCreate(
            type=notification_data.type,
            title=notification_data.title,
            body=notification_data.body,
            data=notification_data.data,
            category=notification_data.category,
            priority=notification_data.priority,
            actions=notification_data.actions,
            target_roles=[target_role],
        )

        result = await NotificationService.broadcast_notification(
            data=broadcast_data, sender_id=current_user.id
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error broadcasting notification to role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to broadcast notification: {str(e)}",
        )


@router.post("/admin/{user_id}", response_model=NotificationResponse)
async def create_notification_for_user(
    user_id: int,
    notification_data: NotificationCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Create a notification for a specific user (admin/instructor only).
    """
    try:
        # Check permissions
        if current_user.role not in ["ADMIN", "INSTRUCTOR"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )

        # Set the target user
        notification_data.user_id = user_id

        notification = await NotificationService.create_notification(notification_data)
        return notification

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating admin notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create notification: {str(e)}",
        )
