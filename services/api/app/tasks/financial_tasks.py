import logging
from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma
from app.services.escrow_service import escrow_service
from app.services.subscription_billing_service import subscription_service


logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.financial_tasks.process_scheduled_escrow_releases",
    soft_time_limit=600,
    time_limit=900,
)
def process_scheduled_escrow_releases():
    """Periodic processing of scheduled escrow releases"""

    async def _do_process():
        try:
            await connect_prisma()
            await escrow_service.process_scheduled_releases()
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_process())


@celery_app.task(name="app.tasks.financial_tasks.expire_stale_poda_points")
def expire_stale_poda_points():
    """Daily sweep that expires PodaPoints older than the configured lifetime.

    ``PodaPointsService.expire_old_points`` was previously unreachable: nothing
    scheduled it, and the query it ran matched a transaction type the live code
    never writes. Points therefore never expired.
    """

    async def _do_expire():
        from app.services.poda_points_service import poda_points_service

        try:
            await connect_prisma()
            summary = await poda_points_service.expire_old_points()
            logger.info(f"PodaPoints expiry sweep finished: {summary}")
            return summary
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_do_expire())


@celery_app.task(name="app.tasks.financial_tasks.reconcile_payout_statuses")
def reconcile_payout_statuses():
    """Periodic reconciliation of payout statuses with gateway"""

    async def _do_reconcile():
        try:
            await connect_prisma()
            logger.info("Reconciling payout statuses...")
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_reconcile())


@celery_app.task(name="app.tasks.financial_tasks.process_subscription_renewals")
def process_subscription_renewals():
    """Process subscription renewals for subscriptions due within 24h"""

    async def _do_renewals():
        try:
            await connect_prisma()
            await subscription_service.process_renewals()
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_renewals())


@celery_app.task(name="app.tasks.financial_tasks.process_dunning_retries")
def process_dunning_retries():
    """Retry billing for subscriptions in grace period (Day 1, 3, 5 schedule)"""

    async def _do_dunning():
        try:
            await connect_prisma()
            await subscription_service.process_dunning_retries()
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_dunning())


@celery_app.task(name="app.tasks.financial_tasks.reconcile_pending_chargily_payments")
def reconcile_pending_chargily_payments():
    """Periodic reconciliation of pending Chargily payments older than 5 minutes"""

    async def _do_reconcile():
        from datetime import datetime, timezone, timedelta
        from app.core.prisma import prisma
        from app.services.payment_providers.chargily import chargily_client
        from app.services.billing_service import billing_service

        try:
            await connect_prisma()
            threshold = datetime.now(timezone.utc) - timedelta(minutes=5)
            pending_txs = await prisma.transaction.find_many(
                where={
                    "status": "PENDING",
                    "provider": "CHARGILY",
                    "createdAt": {"lte": threshold},
                },
                take=50,
            )

            for tx in pending_txs:
                if not tx.providerReference:
                    continue
                try:
                    checkout = await chargily_client.get_checkout(tx.providerReference)
                    if checkout and checkout.get("status") == "paid":
                        await billing_service.handle_successful_payment(
                            transaction_id=tx.id,
                            provider_reference=tx.providerReference,
                        )
                        logger.info(f"Reconciled transaction {tx.id} to PAID")
                except Exception as ex:
                    logger.warning(f"Failed to reconcile transaction {tx.id}: {ex}")
        finally:
            await disconnect_prisma()

    run_async_in_worker(_do_reconcile())
