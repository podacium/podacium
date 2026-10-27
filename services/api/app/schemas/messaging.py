"""
Messaging System Schemas - Enterprise Grade

Pydantic schemas for the Podacium messaging system.
Supports: Freelance, Education, BI Collaboration, System, and Support pillars.

Design Principles:
- Strict validation with clear error messages
- Support for optimistic locking (version fields)
- Comprehensive metadata structures
- Type-safe enums with proper serialization
"""

from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================


class ConversationType(str, Enum):
    """Conversation types for different business pillars"""

    FREELANCE = "FREELANCE"
    EDUCATION = "EDUCATION"
    SYSTEM = "SYSTEM"
    BI_COLLABORATION = "BI_COLLABORATION"
    SUPPORT = "SUPPORT"


class ParticipantRole(str, Enum):
    """Participant roles in conversations with granular permissions"""

    CLIENT = "CLIENT"
    FREELANCER = "FREELANCER"
    INSTRUCTOR = "INSTRUCTOR"
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    OWNER = "OWNER"
    MODERATOR = "MODERATOR"
    SUPPORT_AGENT = "SUPPORT_AGENT"
    GUEST = "GUEST"


class MessageType(str, Enum):
    """Message content types"""

    TEXT = "TEXT"
    FILE = "FILE"
    SYSTEM = "SYSTEM"
    TYPING_INDICATOR = "TYPING_INDICATOR"
    REACTION = "REACTION"


class MessageStatus(str, Enum):
    """Message delivery status for optimistic UI updates"""

    SENDING = "SENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"


# ============================================================================
# BASE SCHEMAS
# ============================================================================


class ConversationParticipantBase(BaseModel):
    """Base schema for conversation participants"""

    user_id: int = Field(..., alias="userId", ge=1)
    role: ParticipantRole = Field(default=ParticipantRole.MEMBER)

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class MessageBase(BaseModel):
    """Base schema for messages with content validation"""

    content: str = Field(default="", max_length=50000)
    message_type: MessageType = Field(default=MessageType.TEXT, alias="messageType")
    reply_to_id: Optional[str] = Field(None, alias="replyToId")
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ============================================================================
# CREATE SCHEMAS
# ============================================================================


class ConversationCreate(BaseModel):
    """Schema for creating a new conversation"""

    type: ConversationType = Field(default=ConversationType.FREELANCE)
    title: Optional[str] = Field(None, max_length=200)
    participants: List[ConversationParticipantBase] = Field(
        ..., min_length=1, max_length=100
    )
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    @model_validator(mode="after")
    def validate_participants(self):
        """Ensure unique participants"""
        user_ids = [p.user_id for p in self.participants]
        if len(user_ids) != len(set(user_ids)):
            raise ValueError("Duplicate participants are not allowed")
        return self


class DirectConversationCreate(BaseModel):
    """Schema for creating a direct 1-to-1 conversation"""

    type: ConversationType = Field(default=ConversationType.FREELANCE)
    other_user_id: int = Field(..., alias="otherUserId", ge=1)
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True)


class ContractConversationCreate(BaseModel):
    """Schema for creating a conversation linked to a contract"""

    contract_id: int = Field(..., alias="contractId", ge=1)
    client_id: int = Field(..., alias="clientId", ge=1)
    freelancer_id: int = Field(..., alias="freelancerId", ge=1)
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True)


class MessageAttachmentCreate(BaseModel):
    """Schema for attaching files to messages"""

    file_name: str = Field(..., alias="fileName", max_length=255)
    file_type: str = Field(..., alias="fileType", max_length=100)
    file_size: int = Field(
        ..., alias="fileSize", ge=1, le=100 * 1024 * 1024
    )  # Max 100MB
    file_url: str = Field(..., alias="fileUrl")
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")

    model_config = ConfigDict(populate_by_name=True)


class MessageCreate(BaseModel):
    """Schema for creating a new message"""

    content: str = Field(default="", max_length=50000)
    message_type: MessageType = Field(default=MessageType.TEXT, alias="messageType")
    reply_to_id: Optional[str] = Field(None, alias="replyToId")
    metadata: Optional[Dict[str, Any]] = None
    client_message_id: Optional[str] = Field(None, alias="clientMessageId")
    attachments: Optional[List[MessageAttachmentCreate]] = None

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    @model_validator(mode="after")
    def validate_content_or_attachments(self):
        """Ensure message has either content or attachments"""
        has_content = bool(self.content and self.content.strip())
        has_attachments = bool(self.attachments and len(self.attachments) > 0)
        if not has_content and not has_attachments:
            raise ValueError(
                "Message must have either text content or at least one attachment"
            )
        if self.content:
            self.content = self.content.strip()
            if len(self.content) > 50000:
                raise ValueError(
                    "Message content exceeds maximum length of 50000 characters"
                )
        return self


class ReactionCreate(BaseModel):
    """Schema for adding a reaction to a message"""

    emoji: str = Field(..., min_length=1, max_length=50)

    @field_validator("emoji")
    @classmethod
    def validate_emoji(cls, v: str) -> str:
        """Validate emoji is a valid Unicode emoji or shortcode"""
        v = v.strip()
        # Allow Unicode emojis and common shortcodes (:emoji:)
        if not v:
            raise ValueError("Emoji cannot be empty")
        return v


# ============================================================================
# UPDATE SCHEMAS
# ============================================================================


class MessageUpdate(BaseModel):
    """Schema for updating a message"""

    content: str = Field(..., min_length=1, max_length=50000)
    expected_version: Optional[int] = Field(None, alias="expectedVersion", ge=0)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message content cannot be empty")
        v = v.strip()
        if len(v) > 50000:
            raise ValueError(
                "Message content exceeds maximum length of 50000 characters"
            )
        return v


class MarkAsReadRequest(BaseModel):
    """Schema for marking conversation as read"""

    last_read_message_id: Optional[str] = Field(None, alias="lastReadMessageId")

    model_config = ConfigDict(populate_by_name=True)


class ConversationParticipantUpdate(BaseModel):
    """Schema for updating participant settings"""

    muted_until: Optional[datetime] = Field(None, alias="mutedUntil")
    is_archived: Optional[bool] = Field(None, alias="isArchived")
    is_pinned: Optional[bool] = Field(None, alias="isPinned")

    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class UserMinimalResponse(BaseModel):
    """Minimal user info for embedding in responses"""

    id: int
    full_name: str = Field(..., alias="fullName")
    profile_picture_url: Optional[str] = Field(None, alias="profilePictureUrl")
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ParticipantResponse(BaseModel):
    """Schema for participant in responses"""

    id: int
    user_id: int = Field(..., alias="userId")
    role: ParticipantRole
    joined_at: datetime = Field(..., alias="joinedAt")
    left_at: Optional[datetime] = Field(None, alias="leftAt")
    last_read_at: Optional[datetime] = Field(None, alias="lastReadAt")
    last_read_message_id: Optional[str] = Field(None, alias="lastReadMessageId")
    is_archived: bool = Field(default=False, alias="isArchived")
    is_pinned: bool = Field(default=False, alias="isPinned")
    muted_until: Optional[datetime] = Field(None, alias="mutedUntil")
    user: Optional[UserMinimalResponse] = None

    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, use_enum_values=True
    )


class MessageAttachmentResponse(BaseModel):
    """Schema for message attachment in responses"""

    id: int
    file_name: str = Field(..., alias="fileName")
    file_type: str = Field(..., alias="fileType")
    file_size: int = Field(..., alias="fileSize")
    file_url: str = Field(..., alias="fileUrl")
    thumbnail_url: Optional[str] = Field(None, alias="thumbnailUrl")
    created_at: datetime = Field(..., alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class MessageReactionResponse(BaseModel):
    """Schema for message reaction in responses"""

    id: int
    user_id: int = Field(..., alias="userId")
    emoji: str
    created_at: datetime = Field(..., alias="createdAt")
    user: Optional[UserMinimalResponse] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class MessageReadReceiptResponse(BaseModel):
    """Schema for read receipt in responses"""

    user_id: int = Field(..., alias="userId")
    read_at: datetime = Field(..., alias="readAt")
    user: Optional[UserMinimalResponse] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class MessageResponse(BaseModel):
    """Schema for message responses with full metadata"""

    id: int
    message_id: str = Field(..., alias="messageId")
    conversation_id: int = Field(..., alias="conversationId")
    sender_id: int = Field(..., alias="senderId")
    content: str
    message_type: MessageType = Field(..., alias="messageType")
    status: MessageStatus = Field(default=MessageStatus.SENT, alias="status")

    # Edit tracking
    is_edited: bool = Field(..., alias="isEdited")
    edited_at: Optional[datetime] = Field(None, alias="editedAt")
    edited_by_id: Optional[int] = Field(None, alias="editedById")

    # Reply threading
    reply_to_id: Optional[str] = Field(None, alias="replyToId")
    reply_to_message: Optional["MessageResponse"] = Field(None, alias="replyToMessage")

    # Timestamps
    created_at: datetime = Field(..., alias="createdAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")

    # Metadata
    metadata: Optional[Dict[str, Any]] = None
    moderation_status: Optional[str] = Field(None, alias="moderationStatus")
    client_message_id: Optional[str] = Field(None, alias="clientMessageId")
    version: int = Field(default=0)

    # Relations
    sender: Optional[UserMinimalResponse] = None
    attachments: List[MessageAttachmentResponse] = Field(
        default_factory=list, alias="attachments"
    )
    reactions: List[MessageReactionResponse] = Field(
        default_factory=list, alias="reactions"
    )
    read_receipts: List[MessageReadReceiptResponse] = Field(
        default_factory=list, alias="readReceipts"
    )

    # Client-side helpers
    is_own_message: bool = Field(default=False, alias="isOwnMessage")

    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, use_enum_values=True
    )


class ConversationResponse(BaseModel):
    """Schema for conversation responses"""

    id: int
    conversation_id: str = Field(..., alias="conversationId")
    type: ConversationType
    title: Optional[str] = None
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")
    archived_at: Optional[datetime] = Field(None, alias="archivedAt")
    metadata: Optional[Dict[str, Any]] = None
    version: int = Field(default=0)

    # Participants
    participants: List[ParticipantResponse] = Field(default_factory=list)

    # Last message info
    last_message: Optional[MessageResponse] = Field(None, alias="lastMessage")

    # Unread count for current user
    unread_count: int = Field(default=0, alias="unreadCount")

    # For display
    display_title: Optional[str] = Field(None, alias="displayTitle")
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")

    # User-specific settings
    is_muted: bool = Field(default=False, alias="isMuted")
    is_archived: bool = Field(default=False, alias="isArchived")
    is_pinned: bool = Field(default=False, alias="isPinned")

    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, use_enum_values=True
    )


class ConversationListResponse(BaseModel):
    """Schema for paginated conversation list"""

    items: List[ConversationResponse] = Field(default_factory=list)
    total: int = Field(default=0)
    page: int = Field(default=1)
    page_size: int = Field(default=20, alias="pageSize")
    has_more: bool = Field(default=False, alias="hasMore")

    model_config = ConfigDict(populate_by_name=True)


class MessageListResponse(BaseModel):
    """Schema for paginated message list (cursor-based)"""

    items: List[MessageResponse] = Field(default_factory=list)
    next_cursor: Optional[str] = Field(None, alias="nextCursor")
    has_more: bool = Field(default=False, alias="hasMore")
    total_count: int = Field(default=0, alias="totalCount")

    model_config = ConfigDict(populate_by_name=True)


class TypingIndicatorResponse(BaseModel):
    """Schema for typing indicator events"""

    conversation_id: str = Field(..., alias="conversationId")
    user_id: int = Field(..., alias="userId")
    user_name: str = Field(..., alias="userName")
    is_typing: bool = Field(..., alias="isTyping")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# SEARCH/FILTER SCHEMAS
# ============================================================================


class ConversationSearch(BaseModel):
    """Schema for searching conversations"""

    type: Optional[ConversationType] = None
    search: Optional[str] = Field(None, max_length=100)
    include_archived: bool = Field(default=False, alias="includeArchived")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class MessageSearch(BaseModel):
    """Schema for searching messages in a conversation"""

    cursor: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=100)
    before: Optional[datetime] = None
    after: Optional[datetime] = None
    include_deleted: bool = Field(default=False, alias="includeDeleted")

    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# FREELANCE INTEGRATION SCHEMAS
# ============================================================================


class ConversationWithContractResponse(BaseModel):
    """Schema for conversation with contract context"""

    conversation: ConversationResponse
    contract_id: int = Field(..., alias="contractId")
    can_message: bool = Field(..., alias="canMessage")

    model_config = ConfigDict(populate_by_name=True)


class CanMessageResponse(BaseModel):
    """Schema for checking if user can message in a conversation"""

    can_message: bool = Field(..., alias="canMessage")
    reason: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# WEBSOCKET/REALTIME SCHEMAS
# ============================================================================


class MessageEvent(BaseModel):
    """Base schema for message events via WebSocket"""

    event_type: str = Field(..., alias="eventType")
    conversation_id: str = Field(..., alias="conversationId")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any]

    model_config = ConfigDict(populate_by_name=True)


class NewMessageEvent(MessageEvent):
    """Event schema for new message notifications"""

    event_type: str = Field(default="NEW_MESSAGE", alias="eventType")
    message: MessageResponse


class MessageUpdatedEvent(MessageEvent):
    """Event schema for message update notifications"""

    event_type: str = Field(default="MESSAGE_UPDATED", alias="eventType")
    message: MessageResponse


class MessageDeletedEvent(MessageEvent):
    """Event schema for message deletion notifications"""

    event_type: str = Field(default="MESSAGE_DELETED", alias="eventType")
    message_id: str = Field(..., alias="messageId")
    deleted_by_id: int = Field(..., alias="deletedById")


class ReadReceiptEvent(MessageEvent):
    """Event schema for read receipt updates"""

    event_type: str = Field(default="READ_RECEIPT", alias="eventType")
    message_id: str = Field(..., alias="messageId")
    user_id: int = Field(..., alias="userId")
    read_at: datetime = Field(..., alias="readAt")


class ReactionEvent(MessageEvent):
    """Event schema for reaction updates"""

    event_type: str = Field(default="REACTION", alias="eventType")
    message_id: str = Field(..., alias="messageId")
    reaction: MessageReactionResponse
    action: str  # "added" or "removed"


class UnreadCountResponse(BaseModel):
    """Response schema for total unread messages count"""

    unread_count: int = Field(..., alias="unreadCount")

    model_config = ConfigDict(populate_by_name=True)
