"""
Messaging Router - Enterprise Grade

FastAPI router for the Podacium messaging system.
All endpoints require authentication.

Features:
- Rate limiting
- Comprehensive error handling
- Input validation
- Audit logging
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
import logging

from app.core.auth import get_current_active_user
from app.services.messaging_service import (
    MessagingService,
    MessagingServiceError,
    NotParticipantError,
    ConversationNotFoundError,
    MessageNotFoundError,
    DuplicateConversationError,
    OptimisticLockError,
    RateLimitError,
    ValidationError,
)
from app.schemas.messaging import (
    ConversationCreate,
    DirectConversationCreate,
    MessageCreate,
    ConversationResponse,
    MessageResponse,
    ConversationListResponse,
    MessageListResponse,
    MarkAsReadRequest,
    MessageUpdate,
    ConversationParticipantUpdate,
    ConversationType,
    ReactionCreate,
    CanMessageResponse,
    UnreadCountResponse,
)
from app.core.prisma import prisma

router = APIRouter(prefix="/messaging", tags=["messaging"])
logger = logging.getLogger(__name__)


def handle_messaging_error(e: Exception) -> HTTPException:
    """Convert messaging service errors to HTTP exceptions"""
    if isinstance(e, ConversationNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )
    elif isinstance(e, MessageNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )
    elif isinstance(e, NotParticipantError):
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation",
        )
    elif isinstance(e, DuplicateConversationError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conversation already exists between these users",
        )
    elif isinstance(e, OptimisticLockError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    elif isinstance(e, RateLimitError):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e)
        )
    elif isinstance(e, ValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    else:
        logger.error(f"Unexpected messaging error: {e}")
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )


# ============================================================================
# CONVERSATION ENDPOINTS
# ============================================================================


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    conversation_type: Optional[ConversationType] = Query(
        None, alias="type", description="Filter by conversation type"
    ),
    include_archived: bool = Query(
        True, alias="includeArchived", description="Include archived conversations"
    ),
    current_user: dict = Depends(get_current_active_user),
):
    """
    List all conversations for the current user.
    Ordered by most recent activity.
    """
    try:
        result = await MessagingService.list_user_conversations(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            conversation_type=conversation_type,
            include_archived=include_archived,
        )
        return result
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversations",
        )


@router.get("/conversations/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(current_user: dict = Depends(get_current_active_user)):
    """
    Get total unread messages count for the current user.
    """
    try:
        count = await MessagingService.get_total_unread_count(current_user.id)
        return UnreadCountResponse(unread_count=count)
    except Exception as e:
        logger.error(f"Error fetching unread count: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch unread count",
        )


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    data: ConversationCreate, current_user: dict = Depends(get_current_active_user)
):
    """
    Create a new conversation with specified participants.
    """
    try:
        result = await MessagingService.create_conversation(data, current_user.id)
        return result
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation",
        )


@router.post("/conversations/direct", response_model=ConversationResponse)
async def create_direct_conversation(
    data: DirectConversationCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Create or get existing direct 1-to-1 conversation with another user.
    Prevents duplicate conversations between the same users.
    """
    try:
        result = await MessagingService.create_direct_conversation(
            data, current_user.id
        )
        return result
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error creating direct conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation",
        )


@router.get("/users/search")
async def search_users(
    q: str = Query(..., min_length=2, description="Search query (name or email)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results"),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Search for users to start a conversation with.
    Returns basic user info for display in the conversation creation modal.
    """
    try:
        # Search users by name or email
        users = await prisma.user.find_many(
            where={
                "OR": [{"fullName": {"contains": q}}, {"email": {"contains": q}}],
                "id": {"not": current_user.id},  # Exclude current user
                "isActive": True,
            },
            take=limit,
            include={"freelancerProfile": True},
        )

        # Format response
        result = []
        for user in users:
            # Determine user role
            role = "USER"
            if hasattr(user, "freelancerProfile") and user.freelancerProfile:
                role = "FREELANCER"

            result.append(
                {
                    "id": user.id,
                    "full_name": user.fullName,
                    "profile_picture_url": user.profilePictureUrl,
                    "role": role,
                }
            )

        return {"users": result}

    except Exception as e:
        logger.error(f"Error searching users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search users",
        )


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str, current_user: dict = Depends(get_current_active_user)
):
    """
    Get a specific conversation by ID.
    User must be a participant.
    """
    try:
        result = await MessagingService.get_conversation(
            conversation_id, current_user.id
        )
        return result
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error fetching conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversation",
        )


@router.patch(
    "/conversations/{conversation_id}/settings", response_model=ConversationResponse
)
async def update_conversation_settings(
    conversation_id: str,
    data: ConversationParticipantUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Update participant settings for a conversation (mute, archive, pin).
    """
    try:
        await MessagingService.update_participant_settings(
            conversation_uuid=conversation_id, user_id=current_user.id, data=data
        )
        # Return updated conversation
        return await MessagingService.get_conversation(conversation_id, current_user.id)
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error updating conversation settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings",
        )


@router.post("/conversations/{conversation_id}/leave")
async def leave_conversation(
    conversation_id: str, current_user: dict = Depends(get_current_active_user)
):
    """
    Leave a conversation (soft leave - can be rejoined).
    """
    try:
        await MessagingService.leave_conversation(conversation_id, current_user.id)
        return {"success": True, "message": "Left conversation successfully"}
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error leaving conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to leave conversation",
        )


@router.post("/conversations/{conversation_id}/clear")
async def clear_conversation_history(
    conversation_id: str, current_user: dict = Depends(get_current_active_user)
):
    """
    Clear all messages in a conversation for the current user.
    """
    try:
        await MessagingService.clear_chat_history(conversation_id, current_user.id)
        return {"success": True, "message": "Chat history cleared successfully"}
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error clearing chat history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear chat history",
        )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    scope: str = Query("me", description="Scope of deletion ('me' or 'everyone')"),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Delete a conversation.
    - scope='me': Leaves/hides conversation for current user.
    - scope='everyone': Soft-deletes conversation for all participants (creator/admin).
    """
    try:
        await MessagingService.delete_conversation(
            conversation_id, current_user.id, scope=scope
        )
        return {"success": True, "message": f"Conversation deleted ({scope})"}
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete conversation",
        )


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: str,
    data: Optional[MarkAsReadRequest] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Mark all messages in a conversation as read.
    """
    try:
        last_read_id = data.last_read_message_id if data else None
        await MessagingService.mark_conversation_read(
            conversation_id, current_user.id, last_read_id
        )
        return {"success": True, "message": "Marked as read"}
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error marking conversation as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark as read",
        )


# ============================================================================
# MESSAGE ENDPOINTS
# ============================================================================


@router.get(
    "/conversations/{conversation_id}/messages", response_model=MessageListResponse
)
async def get_messages(
    conversation_id: str,
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(50, ge=1, le=100, description="Number of messages to fetch"),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get messages in a conversation with cursor pagination.
    Automatically marks messages as read.
    """
    try:
        result = await MessagingService.get_messages(
            conversation_uuid=conversation_id,
            user_id=current_user.id,
            cursor=cursor,
            limit=limit,
        )
        return result
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch messages",
        )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: str,
    data: MessageCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Send a message to a conversation.
    Rate limited to 60 messages per minute per user.
    """
    try:
        result = await MessagingService.send_message(
            conversation_uuid=conversation_id, data=data, sender_id=current_user.id
        )
        return result
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        import traceback

        logger.error(f"Error sending message: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message",
        )


@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: str,
    data: MessageUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Edit a message. Only the sender can edit within 24 hours.
    Supports optimistic locking with expected_version.
    """
    try:
        result = await MessagingService.update_message(
            message_id, data, current_user.id
        )
        return result
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error updating message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update message",
        )


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    scope: str = Query(
        "everyone", description="Scope of deletion ('everyone' or 'me')"
    ),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Delete a message.
    - scope='everyone': Soft-deletes across all devices (author or admin).
    - scope='me': Hides message from current user's view only.
    """
    try:
        await MessagingService.delete_message(message_id, current_user.id, scope=scope)
        return {"success": True, "message": f"Message deleted ({scope})"}
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete message",
        )


@router.post("/messages/{message_id}/reactions")
async def add_reaction(
    message_id: str,
    data: ReactionCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Add a reaction to a message.
    """
    try:
        result = await MessagingService.add_reaction(message_id, data, current_user.id)
        return result
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error adding reaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add reaction",
        )


@router.delete("/messages/{message_id}/reactions/{emoji}")
async def remove_reaction(
    message_id: str, emoji: str, current_user: dict = Depends(get_current_active_user)
):
    """
    Remove a reaction from a message.
    """
    try:
        await MessagingService.remove_reaction(message_id, emoji, current_user.id)
        return {"success": True, "message": "Reaction removed"}
    except MessagingServiceError as e:
        raise handle_messaging_error(e)
    except Exception as e:
        logger.error(f"Error removing reaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove reaction",
        )


# ============================================================================
# FREELANCE INTEGRATION ENDPOINTS
# ============================================================================


@router.get(
    "/contracts/{contract_id}/conversation", response_model=ConversationResponse
)
async def get_contract_conversation(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """
    Get or create conversation for a contract.
    Both client and freelancer can access.
    """
    try:
        from app.core.prisma import prisma

        # Check if conversation exists
        conversation = await prisma.conversation.find_first(
            where={
                "AND": [
                    {"type": "FREELANCE"},
                    {"metadata": {"path": ["contractId"], "equals": contract_id}},
                ]
            }
        )

        if conversation:
            result = await MessagingService.get_conversation(
                conversation.conversationId, current_user.id
            )
            return result

        # Need to create - get contract details
        contract = await prisma.contract.find_unique(
            where={"id": contract_id}, include={"project": True}
        )

        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found"
            )

        # Verify user is client or freelancer
        if current_user.id not in [contract.clientId, contract.freelancerId]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this contract",
            )

        # Create conversation
        result = await MessagingService.get_or_create_contract_conversation(
            contract_id=contract_id,
            client_id=contract.clientId,
            freelancer_id=contract.freelancerId,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contract conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get contract conversation",
        )


@router.get("/contracts/{contract_id}/can-message", response_model=CanMessageResponse)
async def can_message_in_contract(
    contract_id: int, current_user: dict = Depends(get_current_active_user)
):
    """
    Check if current user can message in a contract.
    """
    try:
        can_message, reason = await MessagingService.can_user_message_in_contract(
            contract_id=contract_id, user_id=current_user.id
        )
        return CanMessageResponse(can_message=can_message, reason=reason)
    except Exception as e:
        logger.error(f"Error checking messaging permission: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check permissions",
        )
