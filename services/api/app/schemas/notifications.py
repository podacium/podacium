"""
Notification System Schemas - Enterprise Grade

Pydantic schemas for the Podacium notification system.
Supports multi-channel delivery, granular preferences, and real-time updates.

Design Principles:
- Multi-channel support (in-app, email, push, SMS)
- Granular user preferences
- Delivery tracking and retry logic
- Type-safe enums with proper serialization
"""

from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================


class NotificationCategory(str, Enum):
    """Notification categories for filtering and preferences"""

    SECURITY = "SECURITY"
    PROJECT = "PROJECT"
    COURSE = "COURSE"
    MARKETING = "MARKETING"
    SYSTEM = "SYSTEM"
    BILLING = "BILLING"
    MESSAGING = "MESSAGING"
    FREELANCE = "FREELANCE"
    EDUCATION = "EDUCATION"
    LIVE = "LIVE"
    SUPPORT = "SUPPORT"
    BI = "BI"


class NotificationPriority(str, Enum):
    """Notification priority levels"""

    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class NotificationChannel(str, Enum):
    """Delivery channels for notifications"""

    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    PUSH = "PUSH"
    SMS = "SMS"
    WEBHOOK = "WEBHOOK"


class NotificationDeliveryStatus(str, Enum):
    """Delivery status for tracking"""

    PENDING = "PENDING"
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


class DigestFrequency(str, Enum):
    """Digest frequency options"""

    REALTIME = "REALTIME"
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"


# ============================================================================
# BASE SCHEMAS
# ============================================================================


class ActionVariant(str, Enum):
    """Action button styling variant"""

    PRIMARY = "primary"
    SECONDARY = "secondary"
    DANGER = "danger"
    OUTLINE = "outline"


class NotificationAction(BaseModel):
    """Action button for notifications"""

    type: str = Field(
        default="navigate", max_length=50
    )  # "navigate", "dismiss", "approve", "api_call"
    label: str = Field(..., max_length=100)
    target: Optional[str] = Field(None, max_length=2048)  # URL or route
    url: Optional[str] = Field(None, max_length=2048)
    variant: ActionVariant = Field(default=ActionVariant.PRIMARY)
    data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True)


class NotificationActor(BaseModel):
    """Actor (user/system) who triggered the notification"""

    id: int
    name: str
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")
    role: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class NotificationPayload(BaseModel):
    """Structured domain payload for deep linking and action execution"""

    entity_type: str = Field(
        ...,
        description="Domain entity type: course, project, contract, milestone, live_session, ticket, payment, security, kyc",
    )
    entity_id: str = Field(..., description="Entity identifier")
    action_url: str = Field(..., description="Canonical Next.js deep-link target")
    actor: Optional[NotificationActor] = None
    actions: List[NotificationAction] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class NotificationBase(BaseModel):
    """Base schema for notifications"""

    type: str = Field(default="system", min_length=1, max_length=100)
    title: Optional[str] = Field(None, max_length=200)
    body: str = Field(default="", max_length=5000)
    data: Optional[Dict[str, Any]] = None
    payload: Optional[NotificationPayload] = None
    category: Optional[NotificationCategory] = None
    priority: NotificationPriority = NotificationPriority.NORMAL
    actions: Optional[List[NotificationAction]] = None
    expires_at: Optional[datetime] = Field(default=None, alias="expiresAt")
    idempotency_key: Optional[str] = Field(default=None, alias="idempotencyKey")

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    @model_validator(mode="before")
    @classmethod
    def normalize_notification_inputs(cls, data: Any) -> Any:
        """Handle backward compatibility for legacy callers."""
        if not isinstance(data, dict):
            return data

        # Priority normalization (e.g. MEDIUM -> NORMAL)
        prio = data.get("priority")
        if isinstance(prio, str) and prio.upper() == "MEDIUM":
            data["priority"] = NotificationPriority.NORMAL

        # Category normalization
        cat = data.get("category")
        if isinstance(cat, str) and cat.upper() == "LIVE":
            data["category"] = NotificationCategory.LIVE

        # Title normalization (e.g. title_key -> title)
        if not data.get("title") and data.get("title_key"):
            data["title"] = data.get("title_key")

        # Body normalization (e.g. body_key / message -> body)
        if not data.get("body"):
            if data.get("body_key"):
                data["body"] = data.get("body_key")
            elif data.get("message"):
                data["body"] = data.get("message")
            elif data.get("title"):
                data["body"] = data.get("title")
            else:
                data["body"] = "New Notification"

        return data


class NotificationPreferencesBase(BaseModel):
    """Base schema for notification preferences"""

    email_notifications: bool = Field(default=True, alias="emailNotifications")
    push_notifications: bool = Field(default=True, alias="pushNotifications")
    in_app_notifications: bool = Field(default=True, alias="inAppNotifications")
    sms_notifications: bool = Field(default=False, alias="smsNotifications")
    marketing_emails: bool = Field(default=False, alias="marketingEmails")
    newsletter: bool = Field(default=False, alias="newsletter")
    digest_frequency: DigestFrequency = Field(
        default=DigestFrequency.DAILY, alias="digestFrequency"
    )
    quiet_hours_start: Optional[str] = Field(default=None, alias="quietHoursStart")
    quiet_hours_end: Optional[str] = Field(default=None, alias="quietHoursEnd")
    quiet_hours_timezone: str = Field(default="UTC", alias="quietHoursTimezone")
    digest_time: Optional[str] = Field(default=None, alias="digestTime")
    digest_timezone: str = Field(default="UTC", alias="digestTimezone")
    digest_day: Optional[int] = Field(default=None, ge=0, le=6, alias="digestDay")

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    @field_validator("quiet_hours_start", "quiet_hours_end", "digest_time")
    @classmethod
    def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
        """Validate time is in HH:MM format"""
        if v is None:
            return v
        import re

        if not re.match(r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", v):
            raise ValueError("Time must be in HH:MM format (24-hour)")
        return v


# ============================================================================
# CREATE SCHEMAS
# ============================================================================


class NotificationCreate(NotificationBase):
    """Schema for creating a new notification"""

    user_id: Optional[int] = Field(default=None, alias="userId", ge=1)
    channels: Optional[List[NotificationChannel]] = None
    send_email: Optional[bool] = Field(default=None, alias="sendEmail")

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class NotificationBroadcastCreate(NotificationBase):
    """Schema for broadcasting notifications to multiple users"""

    target_roles: Optional[List[str]] = Field(None, alias="targetRoles")
    target_user_ids: Optional[List[int]] = Field(None, alias="targetUserIds")
    exclude_user_ids: Optional[List[int]] = Field(None, alias="excludeUserIds")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_targets(self):
        """Ensure at least one target is specified"""
        if not self.target_roles and not self.target_user_ids:
            raise ValueError("Either target_roles or target_user_ids must be specified")
        return self


class NotificationPreferencesCreate(NotificationPreferencesBase):
    """Schema for creating notification preferences"""

    user_id: int = Field(..., ge=1)
    category_preferences: Optional[Dict[str, Dict[str, bool]]] = Field(
        None, alias="categoryPreferences"
    )

    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# UPDATE SCHEMAS
# ============================================================================


class NotificationUpdate(BaseModel):
    """Schema for updating a notification"""

    is_read: Optional[bool] = Field(None, alias="isRead")

    model_config = ConfigDict(populate_by_name=True)


class NotificationPreferencesUpdate(NotificationPreferencesBase):
    """Schema for updating notification preferences"""

    category_preferences: Optional[Dict[str, Dict[str, bool]]] = Field(
        None, alias="categoryPreferences"
    )

    model_config = ConfigDict(populate_by_name=True)


class BulkNotificationUpdate(BaseModel):
    """Schema for bulk updating notifications"""

    notification_ids: List[int] = Field(..., alias="notificationIds", min_length=1)
    is_read: bool = Field(..., alias="isRead")

    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class NotificationDeliveryResponse(BaseModel):
    """Schema for notification delivery status"""

    id: int
    channel: NotificationChannel
    status: NotificationDeliveryStatus
    sent_at: Optional[datetime] = Field(None, alias="sentAt")
    delivered_at: Optional[datetime] = Field(None, alias="deliveredAt")
    failed_at: Optional[datetime] = Field(None, alias="failedAt")
    error_message: Optional[str] = Field(None, alias="errorMessage")
    retry_count: int = Field(default=0, alias="retryCount")
    external_id: Optional[str] = Field(None, alias="externalId")

    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, use_enum_values=True
    )


class NotificationResponse(NotificationBase):
    """Schema for notification responses"""

    id: int
    user_id: int = Field(..., alias="userId")
    is_read: bool = Field(..., alias="isRead")
    read_at: Optional[datetime] = Field(None, alias="readAt")

    # Delivery tracking
    in_app_delivered: bool = Field(..., alias="inAppDelivered")
    email_sent: bool = Field(..., alias="emailSent")
    email_sent_at: Optional[datetime] = Field(None, alias="emailSentAt")
    push_sent: bool = Field(..., alias="pushSent")
    push_sent_at: Optional[datetime] = Field(None, alias="pushSentAt")

    # Timestamps
    created_at: datetime = Field(..., alias="createdAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")
    expires_at: Optional[datetime] = Field(None, alias="expiresAt")

    # Relations
    deliveries: List[NotificationDeliveryResponse] = Field(default_factory=list)

    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, use_enum_values=True
    )


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list"""

    notifications: List[NotificationResponse] = Field(default_factory=list)
    total: int = Field(default=0)
    unread_count: int = Field(default=0, alias="unreadCount")
    page: int = Field(default=1)
    page_size: int = Field(default=20, alias="pageSize")
    has_more: bool = Field(default=False, alias="hasMore")

    model_config = ConfigDict(populate_by_name=True)


class NotificationPreferencesResponse(NotificationPreferencesBase):
    """Schema for notification preferences response"""

    id: int
    user_id: int = Field(..., alias="userId")
    category_preferences: Optional[Dict[str, Dict[str, bool]]] = Field(
        None, alias="categoryPreferences"
    )
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, use_enum_values=True
    )


class NotificationStats(BaseModel):
    """Schema for notification statistics"""

    total: int = Field(default=0)
    unread: int = Field(default=0)
    read: int = Field(default=0)
    by_category: Dict[str, int] = Field(default_factory=dict, alias="byCategory")
    by_priority: Dict[str, int] = Field(default_factory=dict, alias="byPriority")

    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# FILTER/SEARCH SCHEMAS
# ============================================================================


class NotificationFilter(BaseModel):
    """Schema for filtering notifications"""

    is_read: Optional[bool] = Field(None, alias="isRead")
    category: Optional[NotificationCategory] = None
    priority: Optional[NotificationPriority] = None
    start_date: Optional[datetime] = Field(None, alias="startDate")
    end_date: Optional[datetime] = Field(None, alias="endDate")

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class NotificationSearchRequest(BaseModel):
    """Schema for notification search requests"""

    filters: Optional[NotificationFilter] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: str = Field(default="createdAt", alias="sortBy")
    sort_order: str = Field(default="desc", alias="sortOrder")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("sort_order")
    @classmethod
    def validate_sort_order(cls, v: str) -> str:
        if v not in ("asc", "desc"):
            raise ValueError("sort_order must be 'asc' or 'desc'")
        return v


# ============================================================================
# WEBSOCKET/REALTIME SCHEMAS
# ============================================================================


class NotificationEvent(BaseModel):
    """Base schema for notification events via WebSocket"""

    event_type: str = Field(..., alias="eventType")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any]

    model_config = ConfigDict(populate_by_name=True)


class NewNotificationEvent(NotificationEvent):
    """Event schema for new notification"""

    event_type: str = Field(default="NEW_NOTIFICATION", alias="eventType")
    notification: NotificationResponse


class NotificationReadEvent(NotificationEvent):
    """Event schema for notification read status change"""

    event_type: str = Field(default="NOTIFICATION_READ", alias="eventType")
    notification_id: int = Field(..., alias="notificationId")
    is_read: bool = Field(..., alias="isRead")


class NotificationDeletedEvent(NotificationEvent):
    """Event schema for notification deletion"""

    event_type: str = Field(default="NOTIFICATION_DELETED", alias="eventType")
    notification_id: int = Field(..., alias="notificationId")


class UnreadCountUpdateEvent(NotificationEvent):
    """Event schema for unread count updates"""

    event_type: str = Field(default="UNREAD_COUNT_UPDATE", alias="eventType")
    unread_count: int = Field(..., alias="unreadCount")


# ============================================================================
# BULK OPERATION SCHEMAS
# ============================================================================


# ============================================================================
# PUSH SUBSCRIPTION SCHEMAS
# ============================================================================


class PushSubscriptionCreate(BaseModel):
    """Schema for registering a Web Push subscription."""

    endpoint: str = Field(..., description="Push service endpoint URL")
    p256dh: str = Field(..., description="P-256 Diffie-Hellman public key")
    auth: str = Field(..., description="Authentication secret")
    user_agent: Optional[str] = Field(
        None, alias="userAgent", description="Browser user agent string"
    )

    model_config = ConfigDict(populate_by_name=True)


class PushSubscriptionResponse(BaseModel):
    """Schema for push subscription response."""

    endpoint: str
    created_at: datetime = Field(..., alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class BulkNotificationIds(BaseModel):
    """Schema for bulk notification operations (read/delete) by IDs."""

    notification_ids: List[int] = Field(
        ..., alias="notificationIds", min_length=1, max_length=100
    )

    model_config = ConfigDict(populate_by_name=True)


class BulkMarkAsReadResponse(BaseModel):
    """Schema for bulk mark as read response"""

    marked_count: int = Field(..., alias="markedCount")
    notification_ids: List[int] = Field(..., alias="notificationIds")

    model_config = ConfigDict(populate_by_name=True)


class BulkDeleteResponse(BaseModel):
    """Schema for bulk delete response"""

    deleted_count: int = Field(..., alias="deletedCount")
    notification_ids: List[int] = Field(..., alias="notificationIds")

    model_config = ConfigDict(populate_by_name=True)


class BroadcastResponse(BaseModel):
    """Schema for broadcast notification response"""

    message: str
    sent_count: int = Field(..., alias="sentCount")
    error_count: int = Field(default=0, alias="errorCount")
    errors: Optional[List[str]] = None

    model_config = ConfigDict(populate_by_name=True)
