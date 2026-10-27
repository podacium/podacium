"""
Milestone Auto-Approval & Dispute SLA Tasks.

Celery tasks for automated milestone approval and dispute arbitration:
- Auto-approves milestones delivered more than 7 days ago with no client action.
- Releases partial escrow for the milestone amount.
- Auto-resolves disputes older than 14 days with default ruling (refund to creator).

Beat schedule entries registered in app/core/celery.py.
"""

import logging
from datetime import datetime, timedelta, timezone

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma
from app.tasks.dispute_tasks import (
    process_dispute_auto_resolution,
    _auto_resolve_disputes,
    AUTO_RESOLVE_DAYS as DISPUTE_AUTO_RESOLVE_DAYS,
)

logger = logging.getLogger(__name__)

MILESTONE_AUTO_APPROVE_DAYS = 7
check_dispute_timeouts = process_dispute_auto_resolution


@celery_app.task(
    name="app.tasks.milestone_tasks.check_milestone_timeouts",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
)
def check_milestone_timeouts(self):
    """
    Periodic task that auto-approves milestones delivered more than 7 days ago.
    Run via Celery beat every 6 hours.
    """

    async def _run():
        try:
            await connect_prisma()
            result = await _auto_approve_stale_milestones()
            return result
        except Exception as exc:
            logger.error(f"Milestone timeout check task failed: {exc}", exc_info=True)
            raise self.retry(exc=exc)
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_run())


async def _auto_approve_stale_milestones() -> dict:
    """
    Core async logic for milestone auto-approval.
    Separated from the Celery task wrapper for testability.

    Delegates the financial decision/escrow release to the authoritative
    MilestoneService implementation (single source of truth for money moves).
    """
    from app.core.prisma import prisma

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=MILESTONE_AUTO_APPROVE_DAYS)

    stale_milestones = await prisma.contractmilestone.find_many(
        where={
            "status": "DELIVERED",
            "deliveredAt": {"lt": cutoff},
        },
        include={"contract": True},
    )

    approved_count = 0
    for milestone in stale_milestones:
        try:
            from app.services.milestone_service import MilestoneService

            claimed = await MilestoneService._auto_approve_milestone(milestone)
            if claimed:
                approved_count += 1
        except Exception as e:
            logger.error(
                f"Failed to auto-approve milestone #{milestone.id} (relayed to MilestoneService): {e}"
            )

    # Emit metrics
    total_pending = await prisma.contractmilestone.count(where={"status": "PENDING"})
    total_delivered = await prisma.contractmilestone.count(
        where={"status": "DELIVERED"}
    )
    total_approved = await prisma.contractmilestone.count(where={"status": "APPROVED"})
    total_disputed = await prisma.contractmilestone.count(where={"status": "DISPUTED"})

    result = {
        "auto_approved": approved_count,
        "checked": len(stale_milestones),
        "metrics": {
            "pending": total_pending,
            "delivered": total_delivered,
            "approved": total_approved,
            "disputed": total_disputed,
        },
    }

    logger.info(
        f"Milestone auto-approval complete: "
        f"{approved_count} auto-approved out of {len(stale_milestones)} stale milestones. "
        f"Current state: {total_pending} pending, {total_delivered} delivered, "
        f"{total_approved} approved, {total_disputed} disputed."
    )

    return result


__all__ = [
    "MILESTONE_AUTO_APPROVE_DAYS",
    "DISPUTE_AUTO_RESOLVE_DAYS",
    "check_milestone_timeouts",
    "check_dispute_timeouts",
    "process_dispute_auto_resolution",
    "_auto_approve_stale_milestones",
    "_auto_resolve_disputes",
]
