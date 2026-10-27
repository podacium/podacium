"""
Messaging Service - Enterprise Grade

Core service for the Podacium messaging system.
Handles conversations, messages, participants, and real-time events.

Architectural Principles:
- Optimistic locking for concurrent updates
- Transaction safety for all write operations
- Comprehensive error handling with specific exceptions
- Event-driven architecture for real-time updates
- Rate limiting and abuse prevention
- Comprehensive audit logging
"""

import logging
import asyncio
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
import uuid

from app.core.prisma import prisma
from app.generated.prisma import Json
import json as _json
from app.schemas.messaging import (
    ConversationCreate,
    DirectConversationCreate,
    MessageCreate,
    ConversationResponse,
    MessageResponse,
    ParticipantResponse,
    ConversationListResponse,
    MessageListResponse,
    MessageUpdate,
    ConversationParticipantUpdate,
    ContractConversationCreate,
    ReactionCreate,
    ConversationType,
    ParticipantRole,
    MessageType,
    MessageStatus,
    UserMinimalResponse,
    MessageAttachmentResponse,
    MessageReactionResponse,
    MessageReadReceiptResponse,
    ConversationParticipantBase,
)
from app.schemas.notifications import (
    NotificationCreate,
    NotificationCategory,
    NotificationPriority,
)

logger = logging.getLogger(__name__)


def _safe_metadata(val) -> dict:
    """Convert Prisma Json or any metadata value to a plain dict safely."""
    if val is None:
        return None
    # If it's already a regular dict, return as-is
    if type(val) is dict:
        return val
    # Try .data attribute (Prisma Json stores underlying data there)
    if hasattr(val, "data") and isinstance(getattr(val, "data"), (dict, list)):
        return val.data
    # Try json.loads if it's a string-like object
    try:
        parsed = _json.loads(str(val))
        if isinstance(parsed, dict):
            return parsed
        return {}
    except (ValueError, TypeError):
        return {}


# ============================================================================
# CONVERSATION ACCESS CACHE (avoids repeated Prisma lookups during polling)
# ============================================================================

_conversation_cache: Dict[str, Any] = {}  # uuid -> (conversation, timestamp)
_participant_cache: Dict[str, Any] = {}  # "conv_id:user_id" -> (participant, timestamp)
_CACHE_TTL = 30  # seconds


async def _get_conversation_cached(conversation_uuid: str):
    """Get conversation with 30s TTL cache."""
    now = datetime.now(timezone.utc)
    cached = _conversation_cache.get(conversation_uuid)
    if cached:
        conv, ts = cached
        if (now - ts).total_seconds() < _CACHE_TTL:
            return conv

    conv = await prisma.conversation.find_unique(
        where={"conversationId": conversation_uuid}
    )
    if conv and not conv.deletedAt:
        _conversation_cache[conversation_uuid] = (conv, now)
    return conv


async def _get_participant_cached(conversation_id: int, user_id: int):
    """Get participant with 30s TTL cache."""
    cache_key = f"{conversation_id}:{user_id}"
    now = datetime.now(timezone.utc)
    cached = _participant_cache.get(cache_key)
    if cached:
        part, ts = cached
        if (now - ts).total_seconds() < _CACHE_TTL:
            return part

    part = await prisma.conversationparticipant.find_first(
        where={"conversationId": conversation_id, "userId": user_id, "leftAt": None}
    )
    if part:
        _participant_cache[cache_key] = (part, now)
    return part


# ============================================================================
# EXCEPTIONS
# ============================================================================


class MessagingServiceError(Exception):
    """Base exception for messaging service errors"""

    pass


class NotParticipantError(MessagingServiceError):
    """Raised when user is not a participant"""

    pass


class ConversationNotFoundError(MessagingServiceError):
    """Raised when conversation is not found"""

    pass


class MessageNotFoundError(MessagingServiceError):
    """Raised when message is not found"""

    pass


class DuplicateConversationError(MessagingServiceError):
    """Raised when trying to create duplicate 1-to-1 conversation"""

    pass


class OptimisticLockError(MessagingServiceError):
    """Raised when optimistic lock fails"""

    pass


class RateLimitError(MessagingServiceError):
    """Raised when rate limit is exceeded"""

    pass


class ValidationError(MessagingServiceError):
    """Raised when validation fails"""

    pass


# ============================================================================
# RATE LIMITING
# ============================================================================


class RateLimiter:
    """Simple in-memory rate limiter for messaging"""

    def __init__(self):
        self._buckets: Dict[Tuple[int, str], List[datetime]] = {}
        self._lock = asyncio.Lock()

    async def check_rate_limit(
        self,
        user_id: int,
        action: str,
        max_requests: int = 30,
        window_seconds: int = 60,
    ) -> bool:
        """Check if user is within rate limit"""
        async with self._lock:
            key = (user_id, action)
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(seconds=window_seconds)

            # Get existing requests
            requests = self._buckets.get(key, [])

            # Filter to window
            requests = [r for r in requests if r > window_start]

            # Check limit
            if len(requests) >= max_requests:
                return False

            # Add current request
            requests.append(now)
            self._buckets[key] = requests

            return True

    async def get_remaining(self, user_id: int, action: str) -> int:
        """Get remaining requests in current window"""
        async with self._lock:
            key = (user_id, action)
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(minutes=1)

            requests = self._buckets.get(key, [])
            requests = [r for r in requests if r > window_start]

            return max(0, 30 - len(requests))


# Global rate limiter instance
rate_limiter = RateLimiter()


# ============================================================================
# EVENT PUBLISHER
# ============================================================================


class MessageEventPublisher:
    """Publisher for messaging events (WebSocket, SSE, etc.)"""

    _subscribers: Dict[str, List[callable]] = {}

    @classmethod
    def subscribe(cls, conversation_id: str, callback: callable):
        """Subscribe to conversation events"""
        if conversation_id not in cls._subscribers:
            cls._subscribers[conversation_id] = []
        cls._subscribers[conversation_id].append(callback)

    @classmethod
    def unsubscribe(cls, conversation_id: str, callback: callable):
        """Unsubscribe from conversation events"""
        if conversation_id in cls._subscribers:
            cls._subscribers[conversation_id] = [
                cb for cb in cls._subscribers[conversation_id] if cb != callback
            ]

    @classmethod
    async def publish(cls, conversation_id: str, event_type: str, data: Dict[str, Any]):
        """Publish event to in-memory subscribers and distributed WebSocket connections."""
        if conversation_id in cls._subscribers:
            for callback in cls._subscribers[conversation_id]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event_type, data)
                    else:
                        callback(event_type, data)
                except Exception as e:
                    logger.error(f"Error publishing event to subscriber: {e}")

        # Broadcast to all active conversation participants via Redis-backed WebSockets
        try:
            from app.routers.websocket import manager
            from app.core.prisma import prisma

            conv = await prisma.conversation.find_unique(
                where={"conversationId": conversation_id},
                include={"participants": {"where": {"leftAt": None}}},
            )
            if conv:
                payload = {
                    "type": event_type,
                    "conversationId": conversation_id,
                    "data": data,
                }
                for p in conv.participants:
                    await manager.send_to_user_distributed(p.userId, payload)
        except Exception as ws_err:
            logger.debug(f"Distributed WS broadcast error (non-fatal): {ws_err}")


# ============================================================================
# SERVICE
# ============================================================================


class MessagingService:
    """Enterprise-grade messaging service with full business logic"""

    # ============================================================================
    # CONVERSATION OPERATIONS
    # ============================================================================

    @staticmethod
    async def create_conversation(
        data: ConversationCreate, creator_id: int
    ) -> ConversationResponse:
        """
        Create a new conversation with participants.

        Args:
            data: Conversation creation data
            creator_id: ID of user creating the conversation

        Returns:
            Created conversation response

        Raises:
            RateLimitError: If user exceeds rate limit
            ValidationError: If validation fails
        """
        # Rate limiting
        if not await rate_limiter.check_rate_limit(
            creator_id, "create_conversation", max_requests=10, window_seconds=60
        ):
            raise RateLimitError(
                "Rate limit exceeded. Please wait before creating more conversations."
            )

        # Ensure creator is in participants
        participant_ids = {p.user_id for p in data.participants}
        if creator_id not in participant_ids:
            data.participants.append(
                ConversationParticipantBase(
                    user_id=creator_id, role=ParticipantRole.OWNER
                )
            )

        try:
            # Defensive: ensure type is ConversationType enum
            conversation_type = data.type
            if isinstance(conversation_type, str):
                conversation_type = ConversationType(conversation_type)

            # Create conversation with transaction
            conversation = await prisma.conversation.create(
                data={
                    "conversationId": str(uuid.uuid4()),
                    "type": conversation_type.value,
                    "title": data.title,
                    "metadata": Json(data.metadata) if data.metadata else Json({}),
                    "participants": {
                        "create": [
                            {
                                "userId": p.user_id,
                                "role": p.role.value
                                if hasattr(p.role, "value")
                                else p.role,
                                "joinedAt": datetime.now(timezone.utc),
                            }
                            for p in data.participants
                        ]
                    },
                },
                include={"participants": {"include": {"user": True}}},
            )

            logger.info(
                f"Created conversation {conversation.conversationId} by user {creator_id}"
            )
            return await MessagingService._format_conversation_response(
                conversation, creator_id
            )

        except Exception as e:
            logger.error(f"Error creating conversation: {e}")
            raise ValidationError(f"Failed to create conversation: {str(e)}")

    @staticmethod
    async def create_direct_conversation(
        data: DirectConversationCreate, creator_id: int
    ) -> ConversationResponse:
        """
        Create a direct 1-to-1 conversation.
        Prevents duplicate conversations between same users.

        Args:
            data: Direct conversation creation data
            creator_id: ID of user creating the conversation

        Returns:
            Existing or new conversation response
        """
        # Ensure type is a ConversationType enum
        conversation_type = data.type
        if isinstance(conversation_type, str):
            conversation_type = ConversationType(conversation_type)

        # Check for existing direct conversation
        existing = await MessagingService._find_direct_conversation(
            creator_id, data.other_user_id, conversation_type
        )

        if existing:
            logger.info(f"Found existing conversation {existing.conversationId}")
            return await MessagingService.get_conversation(
                existing.conversationId, creator_id
            )

        # Create new conversation
        conv_data = ConversationCreate(
            type=conversation_type,
            participants=[
                ConversationParticipantBase(
                    user_id=creator_id, role=ParticipantRole.MEMBER
                ),
                ConversationParticipantBase(
                    user_id=data.other_user_id, role=ParticipantRole.MEMBER
                ),
            ],
            metadata=data.metadata,
        )

        return await MessagingService.create_conversation(conv_data, creator_id)

    @staticmethod
    async def create_contract_conversation(
        data: ContractConversationCreate,
    ) -> ConversationResponse:
        """
        Create a conversation for a freelance contract.
        Auto-assigns CLIENT and FREELANCER roles.

        Args:
            data: Contract conversation creation data

        Returns:
            Created conversation response
        """
        # Check for existing conversation for this contract
        existing = await prisma.conversation.find_first(
            where={
                "AND": [
                    {"type": "FREELANCE"},
                    {"metadata": {"path": ["contractId"], "equals": data.contract_id}},
                ]
            }
        )

        if existing:
            logger.info(f"Found existing conversation for contract {data.contract_id}")
            return await MessagingService.get_conversation(
                existing.conversationId, data.client_id
            )

        # Create conversation with contract metadata
        conv_data = ConversationCreate(
            type=ConversationType.FREELANCE,
            participants=[
                ConversationParticipantBase(
                    user_id=data.client_id, role=ParticipantRole.CLIENT
                ),
                ConversationParticipantBase(
                    user_id=data.freelancer_id, role=ParticipantRole.FREELANCER
                ),
            ],
            metadata={**(data.metadata or {}), "contractId": data.contract_id},
        )

        return await MessagingService.create_conversation(conv_data, data.client_id)

    @staticmethod
    async def get_conversation(
        conversation_uuid: str, user_id: int
    ) -> ConversationResponse:
        """
        Get a single conversation by UUID.
        Validates user is a participant.

        Args:
            conversation_uuid: Public UUID of conversation
            user_id: ID of requesting user

        Returns:
            Conversation response

        Raises:
            ConversationNotFoundError: If not found
            NotParticipantError: If user is not a participant
        """
        conversation = await prisma.conversation.find_unique(
            where={"conversationId": conversation_uuid},
            include={"participants": {"include": {"user": True}}},
        )

        if not conversation or conversation.deletedAt:
            raise ConversationNotFoundError(
                f"Conversation {conversation_uuid} not found"
            )

        # Check if user is participant
        participant = next(
            (
                p
                for p in conversation.participants
                if p.userId == user_id and not p.leftAt
            ),
            None,
        )
        if not participant:
            raise NotParticipantError(f"User {user_id} is not a participant")

        # Fetch last message separately and pass to formatter
        last_message = await prisma.message.find_first(
            where={"conversationId": conversation.id},
            order={"createdAt": "desc"},
            include={"sender": True},
        )

        # Pass last message as extra context to formatter
        return await MessagingService._format_conversation_response_with_last_message(
            conversation, user_id, last_message
        )

    @staticmethod
    async def list_user_conversations(
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        conversation_type: Optional[ConversationType] = None,
        include_archived: bool = False,
    ) -> ConversationListResponse:
        """
        List all conversations for a user with pagination.
        Ordered by last message date DESC.

        Args:
            user_id: ID of user
            page: Page number (1-based)
            page_size: Items per page
            conversation_type: Optional type filter
            include_archived: Whether to include archived conversations

        Returns:
            Paginated conversation list
        """
        skip = (page - 1) * page_size

        # Build where clause
        participant_where: dict = {
            "userId": user_id,
            "leftAt": None,
        }
        if not include_archived:
            participant_where["isArchived"] = False

        where_clause: dict = {
            "participants": {"some": participant_where},
            "deletedAt": None,
        }

        if conversation_type:
            where_clause["type"] = conversation_type.value

        # Get total count
        total = await prisma.conversation.count(where=where_clause)

        # Get conversations
        conversations = await prisma.conversation.find_many(
            where=where_clause,
            skip=skip,
            take=page_size,
            order={"updatedAt": "desc"},
            include={"participants": {"include": {"user": True}}},
        )

        # Fetch last messages separately for each conversation
        conversation_ids = [c.id for c in conversations]
        last_messages = {}
        if conversation_ids:
            for conv_id in conversation_ids:
                msg = await prisma.message.find_first(
                    where={"conversationId": conv_id},
                    order={"createdAt": "desc"},
                    include={"sender": True},
                )
                if msg:
                    last_messages[conv_id] = msg

        # Format responses with last messages
        items = [
            await MessagingService._format_conversation_response_with_last_message(
                c, user_id, last_messages.get(c.id)
            )
            for c in conversations
        ]

        # Pinned conversations always float to top of list, then by updatedAt desc
        items.sort(
            key=lambda x: (
                not x.is_pinned,
                -(x.updated_at.timestamp() if x.updated_at else 0),
            )
        )

        return ConversationListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=(skip + len(items)) < total,
        )

    @staticmethod
    async def get_total_unread_count(user_id: int) -> int:
        """
        Get total unread messages count for a user across all active non-muted conversations.
        """
        participants = await prisma.conversationparticipant.find_many(
            where={
                "userId": user_id,
                "leftAt": None,
                "isMuted": False,
                "conversation": {"deletedAt": None},
            }
        )
        total_unread = 0
        for p in participants:
            where_msg: dict = {
                "conversationId": p.conversationId,
                "deletedAt": None,
                "senderId": {"not": user_id},
            }
            if p.lastReadAt:
                where_msg["createdAt"] = {"gt": p.lastReadAt}
            unread = await prisma.message.count(where=where_msg)
            total_unread += unread
        return total_unread

    @staticmethod
    async def update_participant_settings(
        conversation_uuid: str, user_id: int, data: ConversationParticipantUpdate
    ) -> ParticipantResponse:
        """
        Update participant settings (mute, archive, pin).

        Args:
            conversation_uuid: Public UUID of conversation
            user_id: ID of user
            data: Update data

        Returns:
            Updated participant response
        """
        conversation = await prisma.conversation.find_unique(
            where={"conversationId": conversation_uuid}
        )

        if not conversation:
            raise ConversationNotFoundError(
                f"Conversation {conversation_uuid} not found"
            )

        participant = await prisma.conversationparticipant.find_first(
            where={"conversationId": conversation.id, "userId": user_id, "leftAt": None}
        )

        if not participant:
            raise NotParticipantError(f"User {user_id} is not a participant")

        update_data = {}
        if data.muted_until is not None:
            update_data["mutedUntil"] = data.muted_until
        if data.is_archived is not None:
            update_data["isArchived"] = data.is_archived
        if data.is_pinned is not None:
            update_data["isPinned"] = data.is_pinned

        updated = await prisma.conversationparticipant.update(
            where={"id": participant.id}, data=update_data, include={"user": True}
        )

        return await MessagingService._format_participant_response(updated)

    @staticmethod
    async def leave_conversation(conversation_uuid: str, user_id: int) -> bool:
        """
        Mark user as left from conversation (soft leave).

        Args:
            conversation_uuid: Public UUID of conversation
            user_id: ID of user leaving

        Returns:
            True if successful
        """
        conversation = await prisma.conversation.find_unique(
            where={"conversationId": conversation_uuid}
        )

        if not conversation:
            raise ConversationNotFoundError(
                f"Conversation {conversation_uuid} not found"
            )

        # Update participant record
        result = await prisma.conversationparticipant.update_many(
            where={
                "conversationId": conversation.id,
                "userId": user_id,
                "leftAt": None,
            },
            data={"leftAt": datetime.now(timezone.utc)},
        )

        if result == 0:
            raise NotParticipantError(f"User {user_id} is not an active participant")

        logger.info(f"User {user_id} left conversation {conversation_uuid}")
        return True

    @staticmethod
    async def clear_chat_history(conversation_uuid: str, user_id: int) -> bool:
        """
        Clear message history for the requesting user in a conversation.
        """
        conversation = await prisma.conversation.find_unique(
            where={"conversationId": conversation_uuid}
        )
        if not conversation or conversation.deletedAt:
            raise ConversationNotFoundError(
                f"Conversation {conversation_uuid} not found"
            )

        participant = await prisma.conversationparticipant.find_first(
            where={"conversationId": conversation.id, "userId": user_id, "leftAt": None}
        )
        if not participant:
            raise NotParticipantError(
                "You are not an active participant in this conversation"
            )

        messages = await prisma.message.find_many(
            where={"conversationId": conversation.id, "deletedAt": None}
        )
        for msg in messages:
            meta = _safe_metadata(msg.metadata) or {}
            deleted_for = list(meta.get("deletedForUserIds", []))
            if user_id not in deleted_for:
                deleted_for.append(user_id)
                meta["deletedForUserIds"] = deleted_for
                await prisma.message.update(
                    where={"id": msg.id}, data={"metadata": Json(meta)}
                )

        logger.info(
            f"User {user_id} cleared chat history for conversation {conversation_uuid}"
        )
        return True

    @staticmethod
    async def delete_conversation(
        conversation_uuid: str, user_id: int, scope: str = "me"
    ) -> bool:
        """
        Delete a conversation.
        - scope="me": User leaves and archives the conversation for themselves.
        - scope="everyone": Soft-deletes the conversation for all participants (creator/admin only).
        """
        conversation = await prisma.conversation.find_unique(
            where={"conversationId": conversation_uuid}, include={"participants": True}
        )
        if not conversation or conversation.deletedAt:
            raise ConversationNotFoundError(
                f"Conversation {conversation_uuid} not found"
            )

        participant = next(
            (
                p
                for p in conversation.participants
                if p.userId == user_id and not p.leftAt
            ),
            None,
        )
        if not participant:
            raise NotParticipantError(
                "You are not an active participant in this conversation"
            )

        if scope == "everyone":
            is_creator = (
                participant.role in [ParticipantRole.OWNER, ParticipantRole.ADMIN]
                or len(conversation.participants) <= 2
            )
            if not is_creator:
                raise NotParticipantError(
                    "You do not have permission to delete this conversation for everyone"
                )

            await prisma.conversation.update(
                where={"id": conversation.id},
                data={"deletedAt": datetime.now(timezone.utc)},
            )
            # Publish event
            await MessageEventPublisher.publish(
                conversation.conversationId,
                "CONVERSATION_DELETED",
                {
                    "conversationId": conversation_uuid,
                    "deletedById": user_id,
                    "scope": "everyone",
                },
            )
            logger.info(
                f"Conversation {conversation_uuid} deleted for everyone by user {user_id}"
            )
        else:
            await prisma.conversationparticipant.update(
                where={"id": participant.id},
                data={"leftAt": datetime.now(timezone.utc), "isArchived": True},
            )
            logger.info(f"Conversation {conversation_uuid} deleted for user {user_id}")

        return True

    # ============================================================================
    # MESSAGE OPERATIONS
    # ============================================================================

    @staticmethod
    async def send_message(
        conversation_uuid: str, data: MessageCreate, sender_id: int
    ) -> MessageResponse:
        """
        Send a message to a conversation.

        Args:
            conversation_uuid: Public UUID of conversation
            data: Message creation data
            sender_id: ID of sender

        Returns:
            Created message response

        Raises:
            RateLimitError: If rate limit exceeded
            ConversationNotFoundError: If conversation not found
            NotParticipantError: If sender is not a participant
        """
        # Rate limiting - 60 messages per minute per user
        if not await rate_limiter.check_rate_limit(
            sender_id, "send_message", max_requests=60, window_seconds=60
        ):
            raise RateLimitError(
                "Rate limit exceeded. Please wait before sending more messages."
            )

        # Get conversation and validate
        conversation = await prisma.conversation.find_unique(
            where={"conversationId": conversation_uuid}
        )

        if not conversation or conversation.deletedAt:
            raise ConversationNotFoundError(
                f"Conversation {conversation_uuid} not found"
            )

        # Validate sender is active participant
        participant = await prisma.conversationparticipant.find_first(
            where={
                "conversationId": conversation.id,
                "userId": sender_id,
                "leftAt": None,
            }
        )

        if not participant:
            raise NotParticipantError(f"User {sender_id} is not an active participant")

        # Check if conversation is muted for this user
        if participant.mutedUntil and participant.mutedUntil > datetime.now(
            timezone.utc
        ):
            pass  # User can still send, just won't receive notifications

        # Trim and validate content
        content = data.content.strip() if data.content else ""
        if not content and not data.attachments:
            raise ValidationError(
                "Message must have either text content or at least one attachment"
            )

        # Content moderation: detect and mask Algerian telecom, banking (BaridiMob/CCP), and external contact sharing
        moderated = False
        shield_flagged = False
        shield_flags = []
        if content:
            from app.services.algerian_shield_service import (
                inspect_and_mask_disintermediation,
            )
            from app.services.content_moderation_service import moderate_text

            content, shield_flagged, shield_flags = inspect_and_mask_disintermediation(
                content
            )
            content, profanity_detected = moderate_text(content)
            moderated = shield_flagged or profanity_detected

        # Resolve reply_to_id if provided
        reply_to_id_int = None
        if data.reply_to_id:
            reply_msg = await prisma.message.find_unique(
                where={"messageId": data.reply_to_id}
            )
            if reply_msg and reply_msg.conversationId == conversation.id:
                reply_to_id_int = reply_msg.id

        # Create message
        # Defensive: ensure message_type is MessageType enum
        message_type = data.message_type
        if isinstance(message_type, str):
            from app.schemas.messaging import MessageType

            message_type = MessageType(message_type)

        msg_metadata = dict(data.metadata) if data.metadata else {}
        if getattr(data, "client_message_id", None):
            msg_metadata["clientMessageId"] = data.client_message_id

        if shield_flagged:
            msg_metadata["moderationStatus"] = "FLAGGED_WITH_WARNING"
            msg_metadata["shield_flags"] = shield_flags
            msg_metadata["moderation_notice"] = (
                "Keep Your Contract Protected by Podacium Shield: Sharing personal contact or payment "
                "details outside Podacium voids your Escrow Insurance, forfeits legal invoice generation "
                "under Loi 22-23 (Statut de l'Auto-Entrepreneur), and revokes intellectual property ownership "
                "guarantees under Ordonnance 03-05 ONDA."
            )
        elif moderated:
            msg_metadata["moderation_notice"] = (
                "Protect your project: Keep communications on Podacium to ensure "
                "delivery guarantee, contract dispute mediation, and compliant ANAE tax invoices."
            )

        message = await prisma.message.create(
            data={
                "messageId": str(uuid.uuid4()),
                "conversationId": conversation.id,
                "senderId": sender_id,
                "content": content,
                "messageType": message_type.value,
                "status": MessageStatus.SENT.value,
                "replyToId": reply_to_id_int,
                "metadata": Json(msg_metadata),
                "createdAt": datetime.now(timezone.utc),
            },
            include={"sender": True},
        )

        if data.attachments:
            for att in data.attachments:
                await prisma.messageattachment.create(
                    data={
                        "messageId": message.id,
                        "conversationId": conversation.id,
                        "fileName": att.file_name,
                        "fileType": att.file_type,
                        "fileSize": att.file_size,
                        "fileUrl": att.file_url,
                        "thumbnailUrl": att.thumbnail_url,
                    }
                )

        # Update conversation updatedAt (background)
        asyncio.create_task(
            prisma.conversation.update(
                where={"id": conversation.id},
                data={"updatedAt": datetime.now(timezone.utc)},
            )
        )

        # Send notifications to other participants (background)
        asyncio.create_task(
            MessagingService._notify_participants(
                conversation.id,
                conversation_uuid,
                sender_id,
                content,
                message.messageId,
            )
        )

        full_message = await prisma.message.find_unique(
            where={"id": message.id}, include={"sender": True, "attachments": True}
        )
        formatted_response = await MessagingService._format_message_response(
            full_message or message, sender_id
        )

        # Publish event for real-time updates (background)
        asyncio.create_task(
            MessageEventPublisher.publish(
                conversation_uuid,
                "NEW_MESSAGE",
                formatted_response.model_dump(mode="json"),
            )
        )

        logger.info(
            f"Message {message.messageId} sent to conversation {conversation_uuid}"
        )
        return formatted_response

    @staticmethod
    async def get_messages(
        conversation_uuid: str,
        user_id: int,
        cursor: Optional[str] = None,
        limit: int = 50,
        before: Optional[datetime] = None,
    ) -> MessageListResponse:
        """
        Get messages in a conversation with cursor pagination.
        Automatically marks messages as read.

        Args:
            conversation_uuid: Public UUID of conversation
            user_id: ID of requesting user
            cursor: Pagination cursor (messageId)
            limit: Number of messages to fetch
            before: Get messages before this datetime

        Returns:
            Paginated message list
        """
        # Validate access (cached to avoid repeated Prisma roundtrips during polling)
        conversation = await _get_conversation_cached(conversation_uuid)

        if not conversation or conversation.deletedAt:
            raise ConversationNotFoundError(
                f"Conversation {conversation_uuid} not found"
            )

        participant = await _get_participant_cached(conversation.id, user_id)

        if not participant:
            raise NotParticipantError(f"User {user_id} is not a participant")

        # Build query
        where_clause = {"conversationId": conversation.id, "deletedAt": None}

        if cursor:
            cursor_message = await prisma.message.find_unique(
                where={"messageId": cursor}
            )
            if cursor_message:
                where_clause["createdAt"] = {"lt": cursor_message.createdAt}

        if before:
            where_clause["createdAt"] = {"lt": before}

        # Fetch messages - only include sender (lightweight), skip heavy reactions/readReceipts
        messages = await prisma.message.find_many(
            where=where_clause,
            take=limit + 1,  # Get one extra to check for more
            order={"createdAt": "desc"},
            include={"sender": True, "attachments": True},
        )

        has_more = len(messages) > limit
        messages = messages[:limit]

        # Reverse to chronological order
        messages.reverse()

        # Filter out messages deleted for this specific user
        visible_messages = []
        for m in messages:
            meta = _safe_metadata(m.metadata) or {}
            deleted_for = meta.get("deletedForUserIds", [])
            if user_id not in deleted_for:
                visible_messages.append(m)

        # Mark as read with actual message references to prevent race conditions
        if visible_messages:
            latest_msg = visible_messages[-1]
            asyncio.create_task(
                prisma.conversationparticipant.update_many(
                    where={"conversationId": conversation.id, "userId": user_id},
                    data={
                        "lastReadAt": latest_msg.createdAt,
                        "lastReadMessageId": latest_msg.messageId,
                    },
                )
            )
        else:
            asyncio.create_task(
                prisma.conversationparticipant.update_many(
                    where={"conversationId": conversation.id, "userId": user_id},
                    data={"lastReadAt": datetime.now(timezone.utc)},
                )
            )

        # Format responses
        items = [
            await MessagingService._format_message_response(m, user_id)
            for m in visible_messages
        ]

        next_cursor = messages[0].messageId if messages and has_more else None

        return MessageListResponse(
            items=items,
            next_cursor=next_cursor,
            has_more=has_more,
            total_count=len(items),
        )

    @staticmethod
    async def update_message(
        message_uuid: str, data: MessageUpdate, user_id: int
    ) -> MessageResponse:
        """
        Update a message (edit).
        Only sender can edit their messages within 24 hours.

        Args:
            message_uuid: Public UUID of message
            data: Update data
            user_id: ID of user attempting edit

        Returns:
            Updated message response

        Raises:
            OptimisticLockError: If version mismatch
        """
        message = await prisma.message.find_unique(
            where={"messageId": message_uuid}, include={"conversation": True}
        )

        if not message or message.deletedAt:
            raise MessageNotFoundError(f"Message {message_uuid} not found")

        if message.senderId != user_id:
            raise NotParticipantError("Only the sender can edit a message")

        # Check edit window (24 hours)
        if message.createdAt < datetime.now(timezone.utc) - timedelta(hours=24):
            raise ValidationError(
                "Messages can only be edited within 24 hours of creation"
            )

        # Validate content
        if not data.content.strip():
            raise ValidationError("Message content cannot be empty")

        # Check optimistic locking
        if (
            data.expected_version is not None
            and message.version != data.expected_version
        ):
            raise OptimisticLockError(
                f"Message has been modified (version mismatch: expected {data.expected_version}, got {message.version})"
            )

        updated = await prisma.message.update(
            where={"id": message.id},
            data={
                "content": data.content.strip(),
                "isEdited": True,
                "editedAt": datetime.now(timezone.utc),
                "editedById": user_id,
                "version": message.version + 1,
            },
            include={"sender": True, "attachments": True},
        )

        formatted = await MessagingService._format_message_response(updated, user_id)

        # Publish update event
        await MessageEventPublisher.publish(
            message.conversation.conversationId,
            "MESSAGE_UPDATED",
            formatted.model_dump(mode="json"),
        )

        logger.info(f"Message {message_uuid} updated by user {user_id}")
        return formatted

    @staticmethod
    async def delete_message(
        message_uuid: str, user_id: int, scope: str = "everyone"
    ) -> bool:
        """
        Delete a message.
        - scope="everyone": Soft-deletes across all devices (author or admin only).
        - scope="me": Hides message from current user's view only (any participant).

        Args:
            message_uuid: Public UUID of message
            user_id: ID of user attempting delete
            scope: Deletion scope ("everyone" or "me")

        Returns:
            True if successful
        """
        message = await prisma.message.find_unique(
            where={"messageId": message_uuid}, include={"conversation": True}
        )

        if not message or message.deletedAt:
            raise MessageNotFoundError(f"Message {message_uuid} not found")

        # Check user is participant
        participant = await prisma.conversationparticipant.find_first(
            where={
                "conversationId": message.conversationId,
                "userId": user_id,
                "leftAt": None,
            }
        )
        if not participant:
            raise NotParticipantError("You are not a participant in this conversation")

        if scope == "everyone":
            is_author = message.senderId == user_id
            is_admin = participant.role in [
                ParticipantRole.ADMIN,
                ParticipantRole.MODERATOR,
                ParticipantRole.OWNER,
            ]
            if not is_author and not is_admin:
                raise NotParticipantError(
                    "Only the author or an admin can delete a message for everyone"
                )

            await prisma.message.update(
                where={"id": message.id},
                data={"deletedAt": datetime.now(timezone.utc), "deletedById": user_id},
            )

            # Publish delete event
            await MessageEventPublisher.publish(
                message.conversation.conversationId,
                "MESSAGE_DELETED",
                {
                    "messageId": message_uuid,
                    "deletedById": user_id,
                    "scope": "everyone",
                },
            )
            logger.info(
                f"Message {message_uuid} soft deleted for everyone by user {user_id}"
            )
        else:  # scope == "me"
            meta = _safe_metadata(message.metadata) or {}
            deleted_for = list(meta.get("deletedForUserIds", []))
            if user_id not in deleted_for:
                deleted_for.append(user_id)
                meta["deletedForUserIds"] = deleted_for
                await prisma.message.update(
                    where={"id": message.id}, data={"metadata": Json(meta)}
                )

            # Publish event directly to this user's socket
            try:
                from app.routers.websocket import manager

                await manager.send_to_user_distributed(
                    user_id,
                    {
                        "type": "MESSAGE_DELETED",
                        "conversationId": message.conversation.conversationId,
                        "data": {
                            "messageId": message_uuid,
                            "deletedById": user_id,
                            "scope": "me",
                        },
                    },
                )
            except Exception as ex:
                logger.warning(
                    f"Could not send distributed WS delete notification: {ex}"
                )

            logger.info(f"Message {message_uuid} deleted for user {user_id} only")

        return True

    @staticmethod
    async def add_reaction(
        message_uuid: str, data: ReactionCreate, user_id: int
    ) -> MessageReactionResponse:
        """
        Add a reaction to a message.

        Args:
            message_uuid: Public UUID of message
            data: Reaction data
            user_id: ID of user adding reaction

        Returns:
            Created reaction response
        """
        message = await prisma.message.find_unique(
            where={"messageId": message_uuid}, include={"conversation": True}
        )

        if not message or message.deletedAt:
            raise MessageNotFoundError(f"Message {message_uuid} not found")

        # Check user is participant
        participant = await prisma.conversationparticipant.find_first(
            where={
                "conversationId": message.conversationId,
                "userId": user_id,
                "leftAt": None,
            }
        )

        if not participant:
            raise NotParticipantError("You are not a participant in this conversation")

        # Create or get existing reaction
        try:
            reaction = await prisma.messagereaction.create(
                data={
                    "messageId": message.id,
                    "userId": user_id,
                    "emoji": data.emoji,
                    "createdAt": datetime.now(timezone.utc),
                },
                include={"user": True},
            )
        except Exception:
            # Reaction already exists, fetch it
            reaction = await prisma.messagereaction.find_first(
                where={"messageId": message.id, "userId": user_id, "emoji": data.emoji},
                include={"user": True},
            )

        # Publish event
        await MessageEventPublisher.publish(
            message.conversation.conversationId,
            "REACTION_ADDED",
            {"messageId": message_uuid, "emoji": data.emoji, "userId": user_id},
        )

        return await MessagingService._format_reaction_response(reaction)

    @staticmethod
    async def remove_reaction(message_uuid: str, emoji: str, user_id: int) -> bool:
        """
        Remove a reaction from a message.

        Args:
            message_uuid: Public UUID of message
            emoji: Emoji to remove
            user_id: ID of user removing reaction

        Returns:
            True if successful
        """
        message = await prisma.message.find_unique(
            where={"messageId": message_uuid}, include={"conversation": True}
        )

        if not message or message.deletedAt:
            raise MessageNotFoundError(f"Message {message_uuid} not found")

        await prisma.messagereaction.delete_many(
            where={"messageId": message.id, "userId": user_id, "emoji": emoji}
        )

        # Publish event
        await MessageEventPublisher.publish(
            message.conversation.conversationId,
            "REACTION_REMOVED",
            {"messageId": message_uuid, "emoji": emoji, "userId": user_id},
        )

        return True

    @staticmethod
    async def mark_conversation_read(
        conversation_uuid: str, user_id: int, last_read_message_id: Optional[str] = None
    ) -> bool:
        """
        Mark conversation as read for a user.

        Args:
            conversation_uuid: Public UUID of conversation
            user_id: ID of user
            last_read_message_id: Optional specific message to mark as last read

        Returns:
            True if successful
        """
        conversation = await prisma.conversation.find_unique(
            where={"conversationId": conversation_uuid}
        )

        if not conversation:
            return False

        update_data = {"lastReadAt": datetime.now(timezone.utc)}

        if last_read_message_id:
            message = await prisma.message.find_unique(
                where={"messageId": last_read_message_id}
            )
            if message:
                update_data["lastReadAt"] = message.createdAt
                update_data["lastReadMessageId"] = last_read_message_id

        await prisma.conversationparticipant.update_many(
            where={"conversationId": conversation.id, "userId": user_id},
            data=update_data,
        )

        return True

    # ============================================================================
    # FREELANCE INTEGRATION
    # ============================================================================

    @staticmethod
    async def get_or_create_contract_conversation(
        contract_id: int, client_id: int, freelancer_id: int
    ) -> ConversationResponse:
        """
        Get or create conversation for a contract.
        Called when contract is created.

        Args:
            contract_id: Contract ID
            client_id: Client user ID
            freelancer_id: Freelancer user ID

        Returns:
            Conversation response
        """
        data = ContractConversationCreate(
            contract_id=contract_id, client_id=client_id, freelancer_id=freelancer_id
        )
        return await MessagingService.create_contract_conversation(data)

    @staticmethod
    async def can_user_message_in_contract(
        contract_id: int, user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if user can message in a contract conversation.

        Args:
            contract_id: Contract ID
            user_id: User ID to check

        Returns:
            Tuple of (can_message, reason)
        """
        # Find conversation for contract
        conversation = await prisma.conversation.find_first(
            where={
                "AND": [
                    {"type": "FREELANCE"},
                    {"metadata": {"path": ["contractId"], "equals": contract_id}},
                ]
            }
        )

        if not conversation:
            # Check if user is part of the contract
            contract = await prisma.contract.find_unique(where={"id": contract_id})
            if not contract:
                return False, "Contract not found"

            if user_id not in [contract.clientId, contract.freelancerId]:
                return False, "You are not a participant in this contract"

            return True, None

        # Check if user is active participant
        participant = await prisma.conversationparticipant.find_first(
            where={"conversationId": conversation.id, "userId": user_id, "leftAt": None}
        )

        if not participant:
            return False, "You are not a participant in this conversation"

        return True, None

    # ============================================================================
    # NOTIFICATION METHODS
    # ============================================================================

    @staticmethod
    async def _notify_participants(
        conversation_id: int,
        conversation_uuid: str,
        sender_id: int,
        message_content: str,
        message_id: str,
    ) -> None:
        """
        Send notifications to all participants except the sender.

        Args:
            conversation_id: Internal conversation ID
            conversation_uuid: Public conversation UUID
            sender_id: ID of message sender
            message_content: Message content (truncated for notification)
            message_id: Public message ID
        """
        try:
            # Get all active participants except sender
            participants = await prisma.conversationparticipant.find_many(
                where={
                    "conversationId": conversation_id,
                    "userId": {"not": sender_id},
                    "leftAt": None,
                },
                include={"user": True},
            )

            if not participants:
                return

            # Get sender info for notification
            sender = await prisma.user.find_unique(where={"id": sender_id})
            sender_name = sender.fullName if sender else "Someone"

            # Truncate message content for notification
            if message_content and message_content.strip():
                if message_content.strip() == "[Voice Note]":
                    preview = "notifications.chat.voice_note"
                else:
                    preview = (
                        message_content[:100] + "..."
                        if len(message_content) > 100
                        else message_content.strip()
                    )
            else:
                preview = "notifications.chat.sent_attachment"

            # Create notifications for each participant
            for participant in participants:
                try:
                    # Check if user has muted this conversation
                    if participant.mutedUntil and participant.mutedUntil > datetime.now(
                        timezone.utc
                    ):
                        continue

                    # Import notification service lazily to avoid circular dependency
                    from app.services.notification_service import NotificationService
                    from app.schemas.notifications import (
                        NotificationPayload,
                        NotificationAction,
                    )

                    action_url = f"/hub/messages/{conversation_uuid}"
                    notification = NotificationCreate(
                        user_id=participant.userId,
                        type="NEW_MESSAGE",
                        title="notifications.chat.new_message",
                        body=preview,
                        category=NotificationCategory.MESSAGING,
                        priority=NotificationPriority.NORMAL,
                        payload=NotificationPayload(
                            entity_type="conversation",
                            entity_id=str(conversation_uuid),
                            action_url=action_url,
                            actions=[
                                NotificationAction(
                                    label="notifications.actions.view",
                                    target=action_url,
                                    url=action_url,
                                    variant="primary",
                                )
                            ],
                        ),
                        data={
                            "conversationId": conversation_uuid,
                            "messageId": message_id,
                            "senderId": sender_id,
                            "senderName": sender_name,
                            "sender_name": sender_name,
                            "action_url": action_url,
                            "url": action_url,
                            "link": action_url,
                        },
                    )

                    # Run notification creation in background
                    asyncio.create_task(
                        NotificationService.create_notification(notification)
                    )

                except Exception as e:
                    logger.error(
                        f"Failed to create notification for user {participant.userId}: {e}"
                    )
                    # Continue with other participants even if one fails

        except Exception as e:
            logger.error(f"Failed to notify participants: {e}")
            # Don't raise - notifications should not break message sending

    # ============================================================================
    # HELPER METHODS
    # ============================================================================

    @staticmethod
    async def _find_direct_conversation(
        user1_id: int, user2_id: int, conversation_type: ConversationType
    ) -> Optional[Any]:
        """Find existing direct conversation between two users"""
        # Defensive: ensure type is ConversationType enum
        if isinstance(conversation_type, str):
            conversation_type = ConversationType(conversation_type)

        # Find conversations where both users are active participants
        conversations = await prisma.conversation.find_many(
            where={
                "type": conversation_type.value,
                "deletedAt": None,
                "participants": {
                    "every": {"userId": {"in": [user1_id, user2_id]}, "leftAt": None}
                },
            },
            include={"participants": True},
        )

        # Filter to exactly 2 participants (both users)
        for conv in conversations:
            active_participants = [p for p in conv.participants if not p.leftAt]
            participant_ids = {p.userId for p in active_participants}
            if len(active_participants) == 2 and participant_ids == {
                user1_id,
                user2_id,
            }:
                return conv

        return None

    @staticmethod
    async def _format_conversation_response(
        conversation: Any, current_user_id: int
    ) -> ConversationResponse:
        """Format conversation for API response (without last message)"""
        return await MessagingService._format_conversation_response_with_last_message(
            conversation, current_user_id, None
        )

    @staticmethod
    async def _format_conversation_response_with_last_message(
        conversation: Any, current_user_id: int, last_msg_obj: Any = None
    ) -> ConversationResponse:
        """Format conversation for API response with optional last message"""
        # Get current user's participant record
        current_participant = next(
            (p for p in conversation.participants if p.userId == current_user_id), None
        )

        # Format participants
        participants = []
        for p in conversation.participants:
            if not p.leftAt:  # Only include active participants
                participants.append(
                    await MessagingService._format_participant_response(p)
                )

        # Get last message
        last_message = None
        if last_msg_obj:
            last_message = await MessagingService._format_message_response(
                last_msg_obj, current_user_id
            )

        # Calculate unread count
        unread_count = await MessagingService._get_unread_count(
            conversation.id, current_user_id
        )

        # Generate title from other participants
        display_title = conversation.title
        avatar_url = None

        if not display_title:
            other_participants = [
                p for p in participants if p.user_id != current_user_id
            ]
            if other_participants:
                if len(other_participants) == 1 and other_participants[0].user:
                    display_title = other_participants[0].user.full_name
                    avatar_url = other_participants[0].user.profile_picture_url
                else:
                    names = [p.user.full_name for p in other_participants if p.user]
                    display_title = ", ".join(names[:2])
                    if len(names) > 2:
                        display_title += f" +{len(names) - 2}"

        return ConversationResponse(
            id=conversation.id,
            conversation_id=conversation.conversationId,
            type=ConversationType(conversation.type),
            title=conversation.title,
            created_at=conversation.createdAt,
            updated_at=conversation.updatedAt,
            deleted_at=conversation.deletedAt,
            archived_at=conversation.archivedAt,
            metadata=_safe_metadata(conversation.metadata),
            version=conversation.version,
            participants=participants,
            last_message=last_message,
            unread_count=unread_count,
            display_title=display_title,
            avatar_url=avatar_url,
            is_muted=current_participant.mutedUntil is not None
            and current_participant.mutedUntil > datetime.now(timezone.utc)
            if current_participant
            else False,
            is_archived=current_participant.isArchived
            if current_participant
            else False,
            is_pinned=current_participant.isPinned if current_participant else False,
        )

    @staticmethod
    async def _format_participant_response(participant: Any) -> ParticipantResponse:
        """Format participant for API response"""
        user_info = None
        if participant.user:
            user_info = UserMinimalResponse(
                id=participant.user.id,
                full_name=participant.user.fullName,
                profile_picture_url=participant.user.profilePictureUrl,
                role=participant.user.role.value
                if hasattr(participant.user.role, "value")
                else participant.user.role,
            )

        return ParticipantResponse(
            id=participant.id,
            user_id=participant.userId,
            role=ParticipantRole(participant.role),
            joined_at=participant.joinedAt,
            left_at=participant.leftAt,
            last_read_at=participant.lastReadAt,
            last_read_message_id=participant.lastReadMessageId,
            is_archived=participant.isArchived,
            is_pinned=participant.isPinned,
            muted_until=participant.mutedUntil,
            user=user_info,
        )

    @staticmethod
    async def _format_message_response(
        message: Any, current_user_id: int
    ) -> MessageResponse:
        """Format message for API response"""
        sender_info = None
        if message.sender:
            sender_info = UserMinimalResponse(
                id=message.sender.id,
                full_name=message.sender.fullName,
                profile_picture_url=message.sender.profilePictureUrl,
                role=message.sender.role.value
                if hasattr(message.sender.role, "value")
                else message.sender.role,
            )

        # Format attachments
        attachments = []
        if hasattr(message, "attachments") and message.attachments:
            attachments = [
                MessageAttachmentResponse(
                    id=att.id,
                    file_name=att.fileName,
                    file_type=att.fileType,
                    file_size=att.fileSize,
                    file_url=att.fileUrl,
                    thumbnail_url=att.thumbnailUrl,
                    created_at=att.createdAt,
                )
                for att in message.attachments
            ]

        # Format reactions
        reactions = []
        if hasattr(message, "reactions") and message.reactions:
            reactions = [
                await MessagingService._format_reaction_response(r)
                for r in message.reactions
            ]

        # Format read receipts
        read_receipts = []
        if hasattr(message, "readReceipts") and message.readReceipts:
            read_receipts = [
                MessageReadReceiptResponse(
                    user_id=rr.userId,
                    read_at=rr.readAt,
                    user=UserMinimalResponse(
                        id=rr.user.id,
                        full_name=rr.user.fullName,
                        profile_picture_url=rr.user.profilePictureUrl,
                    )
                    if rr.user
                    else None,
                )
                for rr in message.readReceipts
            ]

        return MessageResponse(
            id=message.id,
            message_id=message.messageId,
            conversation_id=message.conversationId,
            sender_id=message.senderId,
            content=message.content,
            message_type=MessageType(message.messageType),
            status=MessageStatus(message.status)
            if message.status
            else MessageStatus.SENT,
            is_edited=message.isEdited,
            edited_at=message.editedAt,
            edited_by_id=message.editedById,
            reply_to_id=None,  # Would need to fetch the message UUID
            reply_to_message=None,
            created_at=message.createdAt,
            deleted_at=message.deletedAt,
            metadata=_safe_metadata(message.metadata),
            moderation_status=_safe_metadata(message.metadata).get("moderationStatus")
            if _safe_metadata(message.metadata)
            else None,
            client_message_id=_safe_metadata(message.metadata).get("clientMessageId")
            if _safe_metadata(message.metadata)
            else None,
            version=message.version,
            sender=sender_info,
            attachments=attachments,
            reactions=reactions,
            read_receipts=read_receipts,
            is_own_message=message.senderId == current_user_id,
        )

    @staticmethod
    async def _format_reaction_response(reaction: Any) -> MessageReactionResponse:
        """Format reaction for API response"""
        user_info = None
        if reaction.user:
            user_info = UserMinimalResponse(
                id=reaction.user.id,
                full_name=reaction.user.fullName,
                profile_picture_url=reaction.user.profilePictureUrl,
            )

        return MessageReactionResponse(
            id=reaction.id,
            user_id=reaction.userId,
            emoji=reaction.emoji,
            created_at=reaction.createdAt,
            user=user_info,
        )

    @staticmethod
    async def _get_unread_count(conversation_id: int, user_id: int) -> int:
        """Get unread message count for a user in a conversation"""
        participant = await prisma.conversationparticipant.find_first(
            where={"conversationId": conversation_id, "userId": user_id}
        )

        if not participant or not participant.lastReadAt:
            # Count all messages from other users
            count = await prisma.message.count(
                where={
                    "conversationId": conversation_id,
                    "senderId": {"not": user_id},
                    "deletedAt": None,
                }
            )
        else:
            # Count messages after lastReadAt from other users
            count = await prisma.message.count(
                where={
                    "conversationId": conversation_id,
                    "senderId": {"not": user_id},
                    "createdAt": {"gt": participant.lastReadAt},
                    "deletedAt": None,
                }
            )

        return count
