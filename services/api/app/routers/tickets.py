"""
Support Ticket Router — Full CRUD for CRM & Support.

Endpoints:
- POST   /api/v1/tickets          — Create a ticket
- GET    /api/v1/tickets          — List tickets (with filters)
- GET    /api/v1/tickets/{id}     — Get ticket details
- PATCH  /api/v1/tickets/{id}     — Update ticket (assign, change status/priority)
- POST   /api/v1/tickets/{id}/messages — Add a message to a ticket
- POST   /api/v1/tickets/{id}/close    — Close a ticket
- POST   /api/v1/tickets/{id}/rate     — Submit CSAT rating
- GET    /api/v1/tickets/stats         — Get support statistics (admin)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, status, Query, Depends
from pydantic import BaseModel, Field

from app.core.prisma import prisma
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tickets", tags=["support"])

# SLA definitions (in hours)
SLA_RESPONSE_HOURS = {"URGENT": 1, "HIGH": 4, "NORMAL": 24, "LOW": 72}
SLA_RESOLUTION_HOURS = {"URGENT": 4, "HIGH": 24, "NORMAL": 72, "LOW": 168}


# =============================================================================
# SCHEMAS
# =============================================================================


class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=10, max_length=5000)
    category: str = "GENERAL"
    priority: str = "NORMAL"
    tags: List[str] = []


class TicketMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    is_internal: bool = False


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class TicketRating(BaseModel):
    score: int = Field(..., ge=1, le=5)
    feedback: Optional[str] = Field(None, max_length=1000)


class TicketResponse(BaseModel):
    id: int
    ticket_number: str
    subject: str
    status: str
    priority: str
    category: str
    user_id: int
    assigned_to_id: Optional[int] = None
    sla_response_deadline: Optional[str] = None
    sla_resolution_deadline: Optional[str] = None
    first_response_at: Optional[str] = None
    resolved_at: Optional[str] = None
    csat_score: Optional[int] = None
    tags: List[str] = []
    created_at: str
    messages_count: int = 0


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_ticket(data: TicketCreate, current_user=Depends(get_current_user)):
    """Create a new support ticket."""
    priority = data.priority.upper()
    category = data.category.upper()

    sla_response = datetime.now(timezone.utc) + timedelta(
        hours=SLA_RESPONSE_HOURS.get(priority, 24)
    )
    sla_resolution = datetime.now(timezone.utc) + timedelta(
        hours=SLA_RESOLUTION_HOURS.get(priority, 72)
    )

    ticket = await prisma.ticket.create(
        data={
            "userId": current_user.id,
            "subject": data.subject,
            "priority": priority,
            "category": category,
            "tags": data.tags,
            "slaResponseDeadline": sla_response,
            "slaResolutionDeadline": sla_resolution,
        }
    )

    # Create the initial message
    await prisma.ticketmessage.create(
        data={
            "ticketId": ticket.id,
            "senderId": current_user.id,
            "body": data.message,
        }
    )

    # Send notification to user
    try:
        from app.services.notification_service import NotificationService
        from app.schemas.notifications import (
            NotificationCreate,
            NotificationCategory,
            NotificationPriority,
            NotificationPayload,
        )

        await NotificationService.create_notification(
            NotificationCreate(
                user_id=current_user.id,
                type="SUPPORT_TICKET_CREATED",
                title="Ticket Created",
                body=f"Your ticket '{data.subject}' has been created. We'll respond within {SLA_RESPONSE_HOURS.get(priority, 24)} hours.",
                category=NotificationCategory.SUPPORT,
                priority=NotificationPriority.NORMAL,
                payload=NotificationPayload(
                    entity_type="ticket",
                    entity_id=str(ticket.id),
                    action_url=f"/hub/support/{ticket.id}",
                    metadata={
                        "ticket_id": ticket.id,
                        "ticket_number": ticket.ticketNumber,
                    },
                ),
                data={
                    "ticket_id": ticket.id,
                    "action_url": f"/hub/support/{ticket.id}",
                    "url": f"/hub/support/{ticket.id}",
                },
            )
        )
    except Exception as notif_err:
        logger.warning(f"Failed to send ticket created notification: {notif_err}")

    logger.info(f"Ticket {ticket.ticketNumber} created by user {current_user.id}")

    return {
        "id": ticket.id,
        "ticket_number": ticket.ticketNumber,
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "sla_response_deadline": sla_response.isoformat(),
        "sla_resolution_deadline": sla_resolution.isoformat(),
        "created_at": ticket.createdAt.isoformat(),
    }


@router.get("")
async def list_tickets(
    current_user=Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    category_filter: Optional[str] = Query(None, alias="category"),
    assigned_to_me: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List tickets. Users see their own; admins see all."""
    where: dict = {"deletedAt": None}

    # Non-admin users can only see their own tickets
    if current_user.role not in ("ADMIN", "SUPPORT_AGENT"):
        where["userId"] = current_user.id
    elif assigned_to_me:
        where["assignedToId"] = current_user.id

    if status_filter:
        where["status"] = status_filter.upper()
    if priority_filter:
        where["priority"] = priority_filter.upper()
    if category_filter:
        where["category"] = category_filter.upper()

    tickets = await prisma.ticket.find_many(
        where=where,
        order={"createdAt": "desc"},
        take=limit,
        skip=offset,
    )

    total = await prisma.ticket.count(where=where)

    # The generated client does not support `_count` includes, so count messages
    # per ticket in one grouped query.
    ticket_ids = [t.id for t in tickets]
    msg_counts: dict[int, int] = {}
    if ticket_ids:
        grouped = await prisma.ticketmessage.group_by(
            by=["ticketId"],
            where={"ticketId": {"in": ticket_ids}},
            count={"_all": True},
        )
        msg_counts = {row["ticketId"]: row["_count"]["_all"] for row in grouped}

    return {
        "tickets": [
            {
                "id": t.id,
                "ticket_number": t.ticketNumber,
                "subject": t.subject,
                "status": t.status,
                "priority": t.priority,
                "category": t.category,
                "user_id": t.userId,
                "assigned_to_id": t.assignedToId,
                "created_at": t.createdAt.isoformat(),
                "messages_count": msg_counts.get(t.id, 0),
            }
            for t in tickets
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/stats")
async def get_ticket_stats(current_user=Depends(get_current_user)):
    """Get support statistics (admin only)."""
    if current_user.role not in ("ADMIN", "SUPPORT_AGENT"):
        raise HTTPException(status_code=403, detail="Admin access required")

    open_count = await prisma.ticket.count(where={"status": "OPEN", "deletedAt": None})
    in_progress = await prisma.ticket.count(
        where={"status": "IN_PROGRESS", "deletedAt": None}
    )
    resolved = await prisma.ticket.count(
        where={"status": "RESOLVED", "deletedAt": None}
    )
    total = await prisma.ticket.count(where={"deletedAt": None})

    # Calculate average response time
    responded_tickets = await prisma.ticket.find_many(
        where={"firstResponseAt": {"not": None}, "deletedAt": None},
        take=100,
        order={"createdAt": "desc"},
    )

    avg_response_hours = 0.0
    if responded_tickets:
        total_hours = sum(
            (t.firstResponseAt - t.createdAt).total_seconds() / 3600
            for t in responded_tickets
            if t.firstResponseAt
        )
        avg_response_hours = total_hours / len(responded_tickets)

    # Calculate CSAT
    rated_tickets = await prisma.ticket.find_many(
        where={"csatScore": {"not": None}, "deletedAt": None},
        take=100,
    )
    avg_csat = 0.0
    if rated_tickets:
        avg_csat = sum(t.csatScore for t in rated_tickets if t.csatScore) / len(
            rated_tickets
        )

    # SLA breach count
    now = datetime.now(timezone.utc)
    sla_breached = await prisma.ticket.count(
        where={
            "status": {"in": ["OPEN", "IN_PROGRESS"]},
            "slaResolutionDeadline": {"lt": now},
            "deletedAt": None,
        }
    )

    return {
        "open_tickets": open_count,
        "in_progress_tickets": in_progress,
        "resolved_tickets": resolved,
        "total_tickets": total,
        "avg_response_time_hours": round(avg_response_hours, 1),
        "avg_csat_score": round(avg_csat, 1),
        "sla_breached_count": sla_breached,
    }


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: int, current_user=Depends(get_current_user)):
    """Get ticket details with messages."""
    ticket = await prisma.ticket.find_unique(
        where={"id": ticket_id},
        include={
            "messages": {
                "order_by": {"createdAt": "asc"},
                # Nested relation selects unsupported by the client; load sender.
                "include": {"sender": True},
            },
            "user": True,
            "assignedTo": True,
        },
    )

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Access control
    if (
        current_user.role not in ("ADMIN", "SUPPORT_AGENT")
        and ticket.userId != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    # Filter internal messages for non-staff
    messages = ticket.messages or []
    if current_user.role not in ("ADMIN", "SUPPORT_AGENT"):
        messages = [m for m in messages if not m.isInternal]

    return {
        "id": ticket.id,
        "ticket_number": ticket.ticketNumber,
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "tags": ticket.tags,
        "user": {
            "id": ticket.user.id,
            "full_name": ticket.user.fullName,
            "email": ticket.user.email,
        },
        "assigned_to": {
            "id": ticket.assignedTo.id,
            "full_name": ticket.assignedTo.fullName,
        }
        if ticket.assignedTo
        else None,
        "sla_response_deadline": ticket.slaResponseDeadline.isoformat()
        if ticket.slaResponseDeadline
        else None,
        "sla_resolution_deadline": ticket.slaResolutionDeadline.isoformat()
        if ticket.slaResolutionDeadline
        else None,
        "first_response_at": ticket.firstResponseAt.isoformat()
        if ticket.firstResponseAt
        else None,
        "resolved_at": ticket.resolvedAt.isoformat() if ticket.resolvedAt else None,
        "csat_score": ticket.csatScore,
        "csat_feedback": ticket.csatFeedback,
        "created_at": ticket.createdAt.isoformat(),
        "messages": [
            {
                "id": m.id,
                "body": m.body,
                "is_internal": m.isInternal,
                "sender": {
                    "id": m.sender.id,
                    "full_name": m.sender.fullName,
                    "role": m.sender.role,
                },
                "created_at": m.createdAt.isoformat(),
            }
            for m in messages
        ],
    }


@router.patch("/{ticket_id}")
async def update_ticket(
    ticket_id: int, data: TicketUpdate, current_user=Depends(get_current_user)
):
    """Update ticket (assign, change status/priority). Admin/agent only."""
    if current_user.role not in ("ADMIN", "SUPPORT_AGENT"):
        raise HTTPException(status_code=403, detail="Admin access required")

    ticket = await prisma.ticket.find_unique(where={"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_data: dict = {}

    if data.status:
        update_data["status"] = data.status.upper()
        if data.status.upper() == "RESOLVED":
            update_data["resolvedAt"] = datetime.now(timezone.utc)
    if data.priority:
        update_data["priority"] = data.priority.upper()
    if data.assigned_to_id is not None:
        update_data["assignedToId"] = data.assigned_to_id
    if data.category:
        update_data["category"] = data.category.upper()
    if data.tags is not None:
        update_data["tags"] = data.tags

    updated = await prisma.ticket.update(where={"id": ticket_id}, data=update_data)

    logger.info(f"Ticket {ticket_id} updated by {current_user.id}: {update_data}")
    return {"id": updated.id, "status": updated.status, "priority": updated.priority}


@router.post("/{ticket_id}/messages")
async def add_message(
    ticket_id: int, data: TicketMessageCreate, current_user=Depends(get_current_user)
):
    """Add a message to a ticket."""
    ticket = await prisma.ticket.find_unique(where={"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Access control
    if (
        current_user.role not in ("ADMIN", "SUPPORT_AGENT")
        and ticket.userId != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    # Only staff can post internal notes
    is_internal = data.is_internal and current_user.role in ("ADMIN", "SUPPORT_AGENT")

    message = await prisma.ticketmessage.create(
        data={
            "ticketId": ticket_id,
            "senderId": current_user.id,
            "body": data.body,
            "isInternal": is_internal,
        }
    )

    # Track first response time (when staff first replies)
    if current_user.role in ("ADMIN", "SUPPORT_AGENT") and not ticket.firstResponseAt:
        await prisma.ticket.update(
            where={"id": ticket_id},
            data={"firstResponseAt": datetime.now(timezone.utc)},
        )

    # Notify recipient of new ticket message if not internal note
    if not is_internal:
        try:
            from app.services.notification_service import NotificationService
            from app.schemas.notifications import (
                NotificationCreate,
                NotificationCategory,
                NotificationPriority,
                NotificationPayload,
            )

            # If staff replied, notify ticket creator
            if (
                current_user.role in ("ADMIN", "SUPPORT_AGENT")
                and ticket.userId != current_user.id
            ):
                recipient_user_id = ticket.userId
                notif_title = f"Support Reply: {ticket.subject}"
                notif_body = (
                    f"A support agent has replied to your ticket '{ticket.subject}'."
                )
            else:
                # If user replied, notify assigned agent if any
                recipient_user_id = ticket.assignedToId
                notif_title = f"Ticket Update: {ticket.subject}"
                notif_body = f"User has replied to ticket #{ticket.ticketNumber}."

            if recipient_user_id:
                await NotificationService.create_notification(
                    NotificationCreate(
                        user_id=recipient_user_id,
                        type="SUPPORT_TICKET_REPLY",
                        title=notif_title,
                        body=notif_body,
                        category=NotificationCategory.SUPPORT,
                        priority=NotificationPriority.HIGH,
                        payload=NotificationPayload(
                            entity_type="ticket",
                            entity_id=str(ticket.id),
                            action_url=f"/hub/support/{ticket.id}",
                            metadata={
                                "ticket_id": ticket.id,
                                "ticket_number": ticket.ticketNumber,
                            },
                        ),
                        data={
                            "ticket_id": ticket.id,
                            "action_url": f"/hub/support/{ticket.id}",
                            "url": f"/hub/support/{ticket.id}",
                        },
                    )
                )
        except Exception as notif_err:
            logger.warning(f"Failed to send ticket message notification: {notif_err}")

    return {
        "id": message.id,
        "body": message.body,
        "is_internal": message.isInternal,
        "created_at": message.createdAt.isoformat(),
    }


@router.post("/{ticket_id}/close")
async def close_ticket(ticket_id: int, current_user=Depends(get_current_user)):
    """Close a ticket."""
    ticket = await prisma.ticket.find_unique(where={"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Users can close their own tickets; staff can close any
    if (
        current_user.role not in ("ADMIN", "SUPPORT_AGENT")
        and ticket.userId != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    await prisma.ticket.update(
        where={"id": ticket_id},
        data={
            "status": "CLOSED",
            "closedAt": datetime.now(timezone.utc),
            "resolvedAt": ticket.resolvedAt or datetime.now(timezone.utc),
        },
    )

    # Send CSAT survey notification
    try:
        from app.services.notification_service import NotificationService
        from app.schemas.notifications import (
            NotificationCreate,
            NotificationCategory,
            NotificationPriority,
            NotificationPayload,
        )

        await NotificationService.create_notification(
            NotificationCreate(
                user_id=ticket.userId,
                type="SUPPORT_TICKET_CLOSED",
                title="How was your support experience?",
                body=f"Your ticket '{ticket.subject}' has been closed. Please let us know how we did.",
                category=NotificationCategory.SUPPORT,
                priority=NotificationPriority.LOW,
                payload=NotificationPayload(
                    entity_type="ticket",
                    entity_id=str(ticket.id),
                    action_url=f"/hub/support/{ticket.id}?csat=true",
                    metadata={"ticket_id": ticket.id, "csat": True},
                ),
                data={
                    "ticket_id": ticket.id,
                    "action_url": f"/hub/support/{ticket.id}?csat=true",
                    "url": f"/hub/support/{ticket.id}?csat=true",
                },
            )
        )
    except Exception as notif_err:
        logger.warning(f"Failed to send ticket closed notification: {notif_err}")

    return {"status": "CLOSED", "closed_at": datetime.now(timezone.utc).isoformat()}


@router.post("/{ticket_id}/rate")
async def rate_ticket(
    ticket_id: int, data: TicketRating, current_user=Depends(get_current_user)
):
    """Submit CSAT rating for a closed ticket."""
    ticket = await prisma.ticket.find_unique(where={"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Only the ticket creator can rate")

    if ticket.status not in ("RESOLVED", "CLOSED"):
        raise HTTPException(
            status_code=400, detail="Can only rate resolved/closed tickets"
        )

    if ticket.csatScore is not None:
        raise HTTPException(status_code=400, detail="Ticket already rated")

    await prisma.ticket.update(
        where={"id": ticket_id},
        data={
            "csatScore": data.score,
            "csatFeedback": data.feedback,
            "csatSubmittedAt": datetime.now(timezone.utc),
        },
    )

    return {"ticket_id": ticket_id, "score": data.score, "feedback": data.feedback}
