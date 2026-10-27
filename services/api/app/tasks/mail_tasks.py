"""
Celery Background Tasks for Podacium Mail Suite.

Handles:
1. Periodic IMAP polling / delta sync for all active mail accounts.
2. Background synchronization of individual mail accounts.
3. Outbox delivery retries.
"""

import logging
from typing import Dict, Any

from celery import shared_task
from app.core.async_bridge import run_async_in_worker
from app.core.prisma import connect_prisma, disconnect_prisma, prisma

logger = logging.getLogger("podacium.tasks.mail")


@shared_task(
    bind=True,
    max_retries=0,
    soft_time_limit=300,
    time_limit=360,
    name="app.tasks.mail_tasks.sync_mail_account_task",
)
def sync_mail_account_task(self, account_id: str) -> Dict[str, Any]:
    """Syncs a single mail account with IMAP server."""
    from app.services.mail_suite_service import mail_suite_service

    async def _run() -> Dict[str, Any]:
        try:
            await connect_prisma()
            return await mail_suite_service.sync_account(account_id)
        except Exception as exc:
            logger.warning(f"Task failed syncing account {account_id}: {exc}")
            return {"status": "error", "message": str(exc)}
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_run())


@shared_task(
    soft_time_limit=120,
    time_limit=180,
    name="app.tasks.mail_tasks.sync_all_active_mail_accounts",
)
def sync_all_active_mail_accounts() -> Dict[str, Any]:
    """Periodic task: Triggers IMAP sync for all active mail accounts."""

    async def _run() -> Dict[str, Any]:
        try:
            await connect_prisma()
            accounts = await prisma.mailaccount.find_many(
                where={"status": "ACTIVE", "deletedAt": None}
            )
            count = 0
            for acc in accounts:
                # Expire stale per-account syncs instead of replaying them when
                # the worker recovers from an outage.
                sync_mail_account_task.apply_async(args=[acc.accountId], expires=900)
                count += 1
            return {"queued_accounts": count}
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_run())
