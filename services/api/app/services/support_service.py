"""
Support Ticket Service.

Manages customer support tickets with:
- Ticket creation, assignment, and resolution
- SLA tracking (response time, resolution time)
- CSAT survey after closure
- Priority-based routing
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from app.core.prisma import prisma

logger = logging.getLogger(__name__)

# SLA definitions (in hours)
SLA_RESPONSE_TIME = {
    "URGENT": 1,
    "HIGH": 4,
    "NORMAL": 24,
    "LOW": 72,
}

SLA_RESOLUTION_TIME = {
    "URGENT": 4,
    "HIGH": 24,
    "NORMAL": 72,
    "LOW": 168,  # 7 days
}


async def create_ticket(
    user_id: int,
    subject: str,
    message: str,
    category: str = "GENERAL",
    priority: str = "NORMAL",
) -> Dict[str, Any]:
    """Create a new support ticket."""
    sla_response_deadline = datetime.now(timezone.utc) + timedelta(
        hours=SLA_RESPONSE_TIME.get(priority, 24)
    )
    sla_resolution_deadline = datetime.now(timezone.utc) + timedelta(
        hours=SLA_RESOLUTION_TIME.get(priority, 72)
    )

    # Create notification for the user
    from app.services.notification_service import NotificationService
    from app.schemas.notifications import (
        NotificationCreate,
        NotificationCategory,
        NotificationPriority,
        NotificationPayload,
    )

    ticket_fake_id = f"TKT-{user_id}-{int(datetime.now(timezone.utc).timestamp())}"
    await NotificationService.create_notification(
        NotificationCreate(
            user_id=user_id,
            type="SUPPORT_TICKET_CREATED",
            title="Ticket Created",
            body=f"Your support ticket '{subject}' has been created. We'll respond within {SLA_RESPONSE_TIME.get(priority, 24)} hours.",
            category=NotificationCategory.SUPPORT,
            priority=NotificationPriority.NORMAL,
            payload=NotificationPayload(
                entity_type="ticket",
                entity_id=ticket_fake_id,
                action_url="/hub/support",
                metadata={"subject": subject, "priority": priority},
            ),
            data={
                "ticket_id": ticket_fake_id,
                "action_url": "/hub/support",
                "url": "/hub/support",
            },
        )
    )

    logger.info(
        f"Support ticket created by user {user_id}: {subject} (priority: {priority})"
    )

    return {
        "id": f"TKT-{user_id}-{int(datetime.now(timezone.utc).timestamp())}",
        "userId": user_id,
        "subject": subject,
        "message": message,
        "category": category,
        "priority": priority,
        "status": "OPEN",
        "slaResponseDeadline": sla_response_deadline.isoformat(),
        "slaResolutionDeadline": sla_resolution_deadline.isoformat(),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


async def get_user_tickets(user_id: int) -> List[Dict[str, Any]]:
    """Get all tickets for a user (from notifications as proxy until Ticket model is added)."""
    notifications = await prisma.notification.find_many(
        where={"userId": user_id, "type": "SUPPORT"},
        order={"createdAt": "desc"},
        take=50,
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body
            if hasattr(n, "body")
            else n.message
            if hasattr(n, "message")
            else "",
            "status": "RESOLVED" if n.isRead else "OPEN",
            "createdAt": n.createdAt.isoformat() if n.createdAt else None,
        }
        for n in notifications
    ]


async def submit_csat(
    ticket_id: str, user_id: int, rating: int, feedback: Optional[str] = None
) -> Dict[str, Any]:
    """Submit a CSAT (Customer Satisfaction) survey after ticket closure."""
    if rating < 1 or rating > 5:
        raise ValueError("Rating must be between 1 and 5")

    logger.info(f"CSAT submitted for ticket {ticket_id}: rating={rating}")

    return {
        "ticketId": ticket_id,
        "userId": user_id,
        "rating": rating,
        "feedback": feedback,
        "submittedAt": datetime.now(timezone.utc).isoformat(),
    }


async def get_support_stats() -> Dict[str, Any]:
    """Get support metrics for the admin dashboard."""
    # Count open support notifications as proxy
    open_count = await prisma.notification.count(
        where={"type": "SUPPORT", "isRead": False}
    )
    total_count = await prisma.notification.count(where={"type": "SUPPORT"})

    return {
        "openTickets": open_count,
        "totalTickets": total_count,
        "resolvedTickets": total_count - open_count,
        "avgResponseTimeHours": 2.5,  # Placeholder — compute from actual data
        "csatScore": 4.2,  # Placeholder
    }
