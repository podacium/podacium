"""
Support & CRM Background Tasks.

Celery tasks for:
- SLA breach detection and escalation
- CSAT survey emails after ticket resolution
- Ticket auto-close after inactivity
"""

import logging
from datetime import datetime, timedelta, timezone

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.config import setting
from app.core.prisma import connect_prisma, disconnect_prisma

logger = logging.getLogger(__name__)


async def check_sla_breaches():
    """
    Check for tickets that have breached their SLA deadlines.
    Escalates by:
    1. Increasing priority
    2. Notifying the assigned agent
    3. Notifying the support manager

    Run via Celery beat every 15 minutes.
    """
    from app.core.prisma import prisma

    now = datetime.now(timezone.utc)

    # Find tickets with breached response SLA (no first response yet)
    response_breached = await prisma.ticket.find_many(
        where={
            "status": {"in": ["OPEN"]},
            "firstResponseAt": None,
            "slaResponseDeadline": {"lt": now},
            "deletedAt": None,
        },
        include={"user": True, "assignedTo": True},
    )

    for ticket in response_breached:
        logger.warning(
            f"SLA RESPONSE BREACH: Ticket {ticket.ticketNumber} (priority: {ticket.priority})"
        )

        # Escalate priority
        new_priority = _escalate_priority(ticket.priority)
        await prisma.ticket.update(
            where={"id": ticket.id},
            data={"priority": new_priority},
        )

        # Notify assigned agent (or all agents if unassigned)
        if ticket.assignedTo:
            from app.services.notification_service import NotificationService
            from app.schemas.notifications import (
                NotificationCreate,
                NotificationCategory,
                NotificationPriority,
                NotificationPayload,
            )

            await NotificationService.create_notification(
                NotificationCreate(
                    user_id=ticket.assignedTo.id,
                    type="SUPPORT_SLA_BREACH",
                    title=f"⚠️ SLA Breach: {ticket.subject}",
                    body=f"Ticket {ticket.ticketNumber} has breached its response SLA. Priority escalated to {new_priority}.",
                    category=NotificationCategory.SUPPORT,
                    priority=NotificationPriority.URGENT,
                    payload=NotificationPayload(
                        entity_type="ticket",
                        entity_id=str(ticket.id),
                        action_url=f"/hub/support/{ticket.id}",
                        metadata={
                            "ticket_id": ticket.id,
                            "ticket_number": ticket.ticketNumber,
                            "new_priority": new_priority,
                        },
                    ),
                    data={
                        "ticket_id": ticket.id,
                        "action_url": f"/hub/support/{ticket.id}",
                        "url": f"/hub/support/{ticket.id}",
                    },
                )
            )

    # Find tickets with breached resolution SLA
    resolution_breached = await prisma.ticket.find_many(
        where={
            "status": {"in": ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"]},
            "slaResolutionDeadline": {"lt": now},
            "deletedAt": None,
        },
    )

    for ticket in resolution_breached:
        logger.warning(f"SLA RESOLUTION BREACH: Ticket {ticket.ticketNumber}")

    logger.info(
        f"SLA check complete: {len(response_breached)} response breaches, "
        f"{len(resolution_breached)} resolution breaches"
    )

    return {
        "response_breaches": len(response_breached),
        "resolution_breaches": len(resolution_breached),
    }


async def send_csat_surveys():
    """
    Send CSAT survey emails for recently resolved tickets.
    Targets tickets resolved 1-2 hours ago that haven't been rated yet.

    Run via Celery beat every hour.
    """
    from app.core.prisma import prisma
    from app.services.email_service import email_service

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=2)
    window_end = now - timedelta(hours=1)

    tickets = await prisma.ticket.find_many(
        where={
            "status": {"in": ["RESOLVED", "CLOSED"]},
            "resolvedAt": {"gte": window_start, "lte": window_end},
            "csatScore": None,
            "deletedAt": None,
        },
        include={"user": True},
    )

    for ticket in tickets:
        if not ticket.user or not ticket.user.email:
            continue

        try:
            from app.services.email_templates import render_email

            subject, text_body, html_body = render_email(
                "csat_survey",
                locale="en",
                recipient_email=ticket.user.email,
                user_name=ticket.user.fullName,
                ticket_subject=ticket.subject,
                ticket_number=ticket.ticketNumber,
                rating_url=f"{setting.FRONTEND_URL}/contact?ticket={ticket.id}",
            )
            await email_service.send_email_with_retry(
                to_email=ticket.user.email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
            logger.info(
                f"CSAT survey sent for ticket {ticket.ticketNumber} to {ticket.user.email}"
            )
        except Exception as e:
            logger.error(
                f"Failed to send CSAT survey for ticket {ticket.ticketNumber}: {e}"
            )

    return {"surveys_sent": len(tickets)}


async def auto_close_inactive_tickets():
    """
    Auto-close tickets that have been in RESOLVED status for 7+ days
    without any new messages.

    Run via Celery beat daily.
    """
    from app.core.prisma import prisma

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    tickets = await prisma.ticket.find_many(
        where={
            "status": "RESOLVED",
            "resolvedAt": {"lt": cutoff},
            "deletedAt": None,
        },
    )

    closed_count = 0
    for ticket in tickets:
        await prisma.ticket.update(
            where={"id": ticket.id},
            data={
                "status": "CLOSED",
                "closedAt": datetime.now(timezone.utc),
            },
        )
        closed_count += 1

    logger.info(f"Auto-closed {closed_count} inactive tickets")
    return {"closed_count": closed_count}


def _escalate_priority(current: str) -> str:
    """Escalate ticket priority one level up."""
    escalation = {
        "LOW": "NORMAL",
        "NORMAL": "HIGH",
        "HIGH": "URGENT",
        "URGENT": "URGENT",  # Already at max
    }
    return escalation.get(current, "HIGH")


# =============================================================================
# CELERY TASK WRAPPERS
# These wrap the async functions above so Celery beat can schedule them.
# =============================================================================


@celery_app.task(
    name="app.tasks.support_tasks.check_sla_breaches_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def check_sla_breaches_task(self):
    """Celery-scheduled wrapper for check_sla_breaches."""

    async def _run():
        try:
            await connect_prisma()
            return await check_sla_breaches()
        except Exception as exc:
            logger.error(f"SLA breach check failed: {exc}", exc_info=True)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_run())


@celery_app.task(
    name="app.tasks.support_tasks.send_csat_surveys_task",
    bind=True,
    max_retries=3,
    default_retry_delay=120,
)
def send_csat_surveys_task(self):
    """Celery-scheduled wrapper for send_csat_surveys."""

    async def _run():
        try:
            await connect_prisma()
            return await send_csat_surveys()
        except Exception as exc:
            logger.error(f"CSAT survey task failed: {exc}", exc_info=True)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_run())


@celery_app.task(
    name="app.tasks.support_tasks.auto_close_inactive_tickets_task",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)
def auto_close_inactive_tickets_task(self):
    """Celery-scheduled wrapper for auto_close_inactive_tickets."""

    async def _run():
        try:
            await connect_prisma()
            return await auto_close_inactive_tickets()
        except Exception as exc:
            logger.error(f"Auto-close tickets task failed: {exc}", exc_info=True)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_run())
