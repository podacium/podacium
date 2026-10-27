import logging
from datetime import datetime, timezone
from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma, prisma
from app.generated.prisma import Json
from app.services.wallet_service import wallet_service
from app.schemas.payment import PaymentStatus, PaymentPurpose
from typing import Any

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run a coroutine on the worker's persistent event loop.

    Prisma is connected on that loop in ``worker_process_init``; creating a
    fresh loop per task could make the client's health check or disconnect
    block forever.
    """
    return run_async_in_worker(coro)


@celery_app.task(
    name="app.tasks.refund_tasks.process_refund",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
def process_refund(self, refund_tx_id: int):
    """Process a refund: credit the user's wallet and mark transactions."""
    return _run_async(_do_refund(self, refund_tx_id))


async def _do_refund(self, refund_tx_id: int) -> dict[str, Any]:
    try:
        await connect_prisma()

        refund_tx = await prisma.transaction.find_unique(
            where={"id": refund_tx_id}, include={"user": True}
        )
        if not refund_tx:
            logger.error(f"Refund transaction {refund_tx_id} not found")
            return {"status": "error", "message": "Refund transaction not found"}

        if refund_tx.purpose != "REFUND":
            logger.error(
                f"Transaction {refund_tx_id} is not a refund (purpose={refund_tx.purpose})"
            )
            return {"status": "error", "message": "Not a refund transaction"}

        if refund_tx.status != "PENDING":
            logger.info(
                f"Refund {refund_tx_id} already processed (status={refund_tx.status})"
            )
            return {"status": "skipped", "message": "Already processed"}

        original_tx_id = refund_tx.parentTransactionId
        if not original_tx_id:
            logger.error(f"Refund {refund_tx_id} has no parent transaction")
            return {"status": "error", "message": "No parent transaction"}

        original_tx = await prisma.transaction.find_unique(where={"id": original_tx_id})
        if not original_tx:
            logger.error(f"Original transaction {original_tx_id} not found")
            return {"status": "error", "message": "Original transaction not found"}

        async with prisma.tx() as tx:
            # Atomic claim PENDING -> COMPLETED. The status check above is only a
            # fast path; two concurrent workers would both pass it and both
            # credit the wallet. Only one can win this CAS.
            claimed = await tx.transaction.update_many(
                where={"id": refund_tx_id, "status": PaymentStatus.PENDING.value},
                data={
                    "status": PaymentStatus.COMPLETED.value,
                    "updatedAt": datetime.now(timezone.utc),
                },
            )
            if claimed == 0:
                logger.info(
                    f"Refund {refund_tx_id} claimed by another worker; skipping"
                )
                return {"status": "skipped", "message": "Already claimed"}

            if refund_tx.userId:
                # Stay inside the caller's transaction: crediting on a separate
                # connection let the wallet change commit even when the status
                # flip rolled back.
                wallet = await wallet_service.ensure_user_wallet(
                    refund_tx.userId, tx=tx
                )
                await wallet_service.credit_wallet(
                    wallet_id=wallet.id,
                    amount=refund_tx.amount,
                    purpose=PaymentPurpose.REFUND,
                    reference_id=str(refund_tx.id),
                    description=f"Refund for transaction #{original_tx_id}",
                    tx=tx,
                )

            await tx.transaction.update(
                where={"id": original_tx_id},
                data={
                    "status": PaymentStatus.REFUNDED.value,
                    "updatedAt": datetime.now(timezone.utc),
                },
            )

        # Revoke entitlements granted by the original transaction
        try:
            from app.services.billing_services.entitlement_service import (
                entitlement_service,
            )

            revoked = await entitlement_service.revoke_entitlements_by_source(
                source_id=str(original_tx_id),
                user_id=refund_tx.userId,
            )
            if revoked:
                logger.info(
                    f"Revoked entitlements for original transaction {original_tx_id}"
                )
        except Exception as ex:
            logger.warning(
                f"Failed to revoke entitlements for tx {original_tx_id}: {ex}"
            )

        logger.info(
            f"Refund {refund_tx_id} processed: "
            f"credited {refund_tx.amount} to user {refund_tx.userId}, "
            f"original tx {original_tx_id} marked REFUNDED"
        )

        if refund_tx.userId:
            try:
                from app.services.email_service import email_service

                user = await prisma.user.find_unique(where={"id": refund_tx.userId})
                if user and user.email:
                    await email_service.send_refund_confirmation_email(
                        email=user.email,
                        name=user.fullName or "Customer",
                        amount=f"{(refund_tx.amount or 0):.2f} {refund_tx.currency or 'DZD'}",
                        transaction_id=str(original_tx_id),
                        refund_id=str(refund_tx_id),
                        user_id=user.id,
                    )
            except Exception as ex:
                logger.warning(
                    f"Failed to send refund email for tx {refund_tx_id}: {ex}"
                )

        return {
            "status": "completed",
            "refund_tx_id": refund_tx_id,
            "original_tx_id": original_tx_id,
            "amount": refund_tx.amount,
        }

    except Exception as e:
        logger.error(
            f"Refund processing failed for {refund_tx_id}: {str(e)}", exc_info=True
        )
        try:
            await prisma.transaction.update(
                where={"id": refund_tx_id},
                data={
                    "status": PaymentStatus.FAILED.value,
                    "updatedAt": datetime.now(timezone.utc),
                    "metadata": Json(
                        {
                            **(refund_tx.metadata or {}),
                            "refund_error": str(e),
                            "failed_at": datetime.now(timezone.utc).isoformat(),
                        }
                    ),
                },
            )
        except Exception:
            pass
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))
    finally:
        await disconnect_prisma()
