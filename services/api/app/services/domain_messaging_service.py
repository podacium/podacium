"""
Domain Messaging Service — Cross-Domain Collaboration Engine

Allows Freelancing (Milestone Submissions, Approvals, Escrow Releases),
EdTech / LMS (Cohort Chats, Tutor Consultations), and
Business Intelligence (Dataset Snapshots, SQL Snippets) to dispatch
first-class interactive system cards into conversation streams.
"""

import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid

from app.core.prisma import prisma
from app.schemas.messaging import MessageType
from app.services.messaging_service import MessageEventPublisher

logger = logging.getLogger(__name__)


class DomainCardAction(BaseModel):
    label: str
    action_type: str  # "LINK", "API_POST", "MODAL"
    target_url: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class DomainCardPayload(BaseModel):
    card_type: str  # e.g., "MILESTONE_DELIVERED", "ESCROW_FUNDED", "BI_SNAPSHOT"
    title: str
    summary: str
    entity_id: str
    entity_type: str  # "contract", "milestone", "module", "dashboard"
    status: Optional[str] = None
    amount: Optional[int] = None
    currency: Optional[str] = "DZD"
    actions: List[DomainCardAction] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DomainMessagingService:
    """Dispatches interactive system cards and messages from core domains into conversations."""

    @staticmethod
    async def post_contract_event_card(
        contract_id: int,
        sender_id: int,
        card_payload: DomainCardPayload,
    ) -> Optional[str]:
        """
        Finds the contract conversation and injects a SYSTEM / SYSTEM_CARD message.
        Broadcasts the event in real-time to all connected participants.
        """
        try:
            # 1. Find the conversation linked to this contract
            conversation = await prisma.conversation.find_first(
                where={
                    "type": "FREELANCE",
                    "metadata": {"path": ["contractId"], "equals": contract_id},
                }
            )

            if not conversation:
                logger.info(
                    f"No conversation found for contract {contract_id} to post event card"
                )
                return None

            msg_uuid = str(uuid.uuid4())
            msg_metadata = card_payload.model_dump()
            msg_metadata["isSystemCard"] = True

            # 2. Persist message in PostgreSQL
            created_msg = await prisma.message.create(
                data={
                    "messageId": msg_uuid,
                    "conversationId": conversation.id,
                    "senderId": sender_id,
                    "content": card_payload.summary,
                    "messageType": MessageType.SYSTEM.value,
                    "metadata": msg_metadata,
                    "createdAt": datetime.now(timezone.utc),
                },
                include={"sender": True},
            )

            # 3. Update conversation timestamp
            await prisma.conversation.update(
                where={"id": conversation.id},
                data={"updatedAt": datetime.now(timezone.utc)},
            )

            # 4. Broadcast via Redis-backed WebSocket bus
            await MessageEventPublisher.publish(
                conversation.conversationId,
                "SYSTEM_CARD_POSTED",
                {
                    "messageId": created_msg.messageId,
                    "conversationId": conversation.conversationId,
                    "content": created_msg.content,
                    "card": msg_metadata,
                    "senderId": sender_id,
                    "createdAt": created_msg.createdAt.isoformat(),
                },
            )

            logger.info(
                f"Posted system card '{card_payload.card_type}' to contract conversation {conversation.conversationId}"
            )
            return created_msg.messageId

        except Exception as e:
            logger.error(
                f"Failed to post contract event card for contract {contract_id}: {e}"
            )
            return None

    @staticmethod
    async def get_or_create_course_cohort_channel(
        module_id: str, title: str, instructor_id: int
    ):
        """Ensures an EDUCATION conversation channel exists for a course/cohort."""
        existing = await prisma.conversation.find_first(
            where={
                "type": "EDUCATION",
                "metadata": {"path": ["moduleId"], "equals": module_id},
            }
        )
        if existing:
            return existing

        return await prisma.conversation.create(
            data={
                "type": "EDUCATION",
                "title": f"Course Discussion: {title}",
                "metadata": {"moduleId": module_id, "channelType": "COHORT_CHAT"},
                "participants": {
                    "create": [{"userId": instructor_id, "role": "INSTRUCTOR"}]
                },
            }
        )
