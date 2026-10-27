import logging
from fastapi import APIRouter, Request, HTTPException, status, BackgroundTasks
from app.services.payment_providers.chargily import chargily_client
from app.core.prisma import prisma
from app.generated.prisma import fields
from app.schemas.billing_schemas.base import PaymentStatus
import time as _time
from datetime import datetime, timezone
import json

router = APIRouter(prefix="/billing/webhooks", tags=["Billing Webhooks"])
logger = logging.getLogger(__name__)


@router.post("/chargily")
async def chargily_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Authoritative webhook handler for Chargily Pay V2.
    Follows Step 2 and 3 of the Economic Model plan.
    """
    # 1. Get raw body and signature
    body = await request.body()
    signature = request.headers.get("signature")

    if not signature:
        logger.warning("Missing signature in Chargily webhook")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature"
        )

    # 2. Verify signature
    if not await chargily_client.verify_webhook_signature(body, signature):
        logger.warning("Invalid signature in Chargily webhook")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature"
        )

    # 3. Parse data
    try:
        data = json.loads(body)
        logger.info(f"Received Chargily webhook: {data.get('type')}")

        # 4. Schedule processing via Celery with exponential backoff & DLQ (falls back to BackgroundTasks)
        try:
            from app.tasks.billing import process_webhook_event

            process_webhook_event.delay(data)
        except Exception as celery_err:
            logger.warning(
                f"Failed to dispatch webhook to Celery: {celery_err}; falling back to background_tasks"
            )
            background_tasks.add_task(process_chargily_event, data)

        return {"status": "accepted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing Chargily webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload"
        )


async def process_chargily_event(event: dict):
    """
    Processes the Chargily event and updates the source of truth.
    """
    event_type = event.get("type")
    event_data = event.get("data", {})
    checkout_id = event_data.get("id")

    if not checkout_id:
        logger.error("No checkout ID in webhook event data")
        return

    # 5. Idempotency & Transaction look up
    # Find transaction by provider reference
    transaction = await prisma.transaction.find_first(
        where={"providerReference": checkout_id}
    )

    if not transaction:
        # Try metadata if not found (fallback)
        metadata = event_data.get("metadata", {})
        transaction_id = metadata.get("transaction_id")
        if transaction_id:
            transaction = await prisma.transaction.find_unique(
                where={"id": int(transaction_id)}
            )

    if not transaction:
        logger.error(f"Transaction not found for checkout {checkout_id}")
        return

    # If already completed or failed, skip (idempotency)
    if transaction.status in [
        PaymentStatus.COMPLETED.value,
        PaymentStatus.FAILED.value,
    ]:
        logger.info(
            f"Transaction {transaction.id} already in final state: {transaction.status}"
        )
        return

    # 6. Finalize state
    if event_type == "checkout.paid":
        await finalize_payment_success(transaction, event_data)
    elif event_type in ["checkout.failed", "checkout.canceled", "checkout.expired"]:
        await finalize_payment_failure(transaction, event_data)


async def finalize_payment_success(transaction, event_data) -> bool:
    """Marks transaction as completed and triggers entitlements.

    SECURITY/CORRECTNESS (P1): returns True when this call transitioned the
    transaction PENDING -> COMPLETED, and False when it was already in a final
    state. The status guard is an atomic compare-and-set (update_many scoped to
    status=PENDING) so concurrent webhook deliveries can never both run — the
    loser of the race sees 0 updated rows and skips every side effect
    (entitlement grants, wallet credits, commissions, invoices).
    """
    _start = _time.monotonic()
    provider = getattr(transaction, "gateway", None) or getattr(
        transaction, "provider", "unknown"
    )
    try:
        from app.services.billing_services.education_service import (
            education_billing_service,
        )
        from app.services.billing_services.commission_service import commission_service
        from app.schemas.billing_schemas.base import PaymentPurpose

        purpose_val = transaction.purpose

        # Execute side-effects and status transition within the same atomic database transaction
        async with prisma.tx() as tx:
            # Atomic compare-and-set: claim PENDING -> COMPLETED. Two concurrent
            # deliveries of the same checkout cannot both win — the loser sees 0
            # rows updated and skips every side effect (wallet credit,
            # entitlements, commissions, invoices). If a side effect then fails,
            # the whole transaction rolls back, releasing the claim so the Celery
            # retry can redo it safely.
            claimed = await tx.transaction.update_many(
                where={
                    "id": transaction.id,
                    "status": PaymentStatus.PENDING.value,
                },
                data={
                    "status": PaymentStatus.COMPLETED.value,
                    "updatedAt": datetime.now(timezone.utc),
                    "providerData": fields.Json(event_data) if event_data else None,
                },
            )
            if claimed == 0:
                logger.info(
                    f"Transaction {transaction.id} already finalized; skipping side effects"
                )
                return False

            # 1. Grant Access for Education
            if purpose_val in [
                PaymentPurpose.COURSE_PURCHASE.value,
                PaymentPurpose.PATH_PURCHASE.value,
                PaymentPurpose.STUDENT_SUBSCRIPTION.value,
            ]:
                await education_billing_service.grant_entitlements(transaction.id)
                if transaction.subscriptionId:
                    from app.services.subscription_billing_service import (
                        subscription_service,
                    )

                    await subscription_service.handle_subscription_payment(transaction)

            # 2. Grant Access for BI
            elif purpose_val == PaymentPurpose.BI_SUBSCRIPTION.value:
                from app.services.billing_services.bi_billing_service import (
                    bi_billing_service,
                )

                await bi_billing_service.grant_bi_entitlements(transaction)
                if transaction.subscriptionId:
                    from app.services.subscription_billing_service import (
                        subscription_service,
                    )

                    await subscription_service.handle_subscription_payment(transaction)

            # 3. Wallet Deposit
            elif purpose_val == PaymentPurpose.DEPOSIT.value and transaction.walletId:
                from app.services.wallet_service import wallet_service

                await wallet_service.credit_wallet(
                    transaction.walletId,
                    transaction.amount,
                    transaction.purpose,
                    reference_id=str(transaction.id),
                    tx=tx,
                    skip_transaction=True,
                )

            # 4. Podapoint Purchase (wallet is linked via userId, not walletId)
            elif (
                purpose_val == PaymentPurpose.PODAPOINT_PURCHASE.value
                and transaction.userId
            ):
                from app.services.wallet_service import wallet_service

                wallet = await wallet_service.get_user_wallet(transaction.userId)
                if wallet:
                    await wallet_service.credit_wallet(
                        wallet.id,
                        transaction.amount,
                        transaction.purpose,
                        reference_id=str(transaction.id),
                        tx=tx,
                        skip_transaction=True,
                    )

            # 5. Escrow Funding
            elif (
                purpose_val == PaymentPurpose.CONTRACT_ESCROW.value
                and transaction.contractId
            ):
                from app.services.escrow_service import escrow_service

                await escrow_service.create_escrow_hold(
                    transaction.contractId,
                    transaction.walletId,
                    transaction.amount,
                    tx=tx,
                )

            # 6. Live Session Purchase
            elif purpose_val == PaymentPurpose.LIVE_SESSION_PURCHASE.value:
                from app.services.billing_services.live_session_billing_service import (
                    live_session_billing_service,
                )

                await live_session_billing_service.grant_access(transaction.id)

            # 7. Live Session Refund
            elif purpose_val == PaymentPurpose.LIVE_SESSION_REFUND.value:
                from app.services.billing_services.live_session_billing_service import (
                    live_session_billing_service,
                )

                await live_session_billing_service.process_refund(transaction.id)

            # Status was already claimed PENDING -> COMPLETED by the CAS at the
            # top of this transaction; nothing to flip here.

            # Create Audit Log in the same transaction
            await tx.auditlog.create(
                data={
                    "eventType": "payment_completed",
                    "entityType": "transaction",
                    "entityId": str(transaction.id),
                    "actorId": transaction.userId,
                    "amount": transaction.amount,
                    "currency": transaction.currency,
                    "metadata": fields.Json({"checkout_id": event_data.get("id")}),
                }
            )

        logger.info(
            f"Transaction {transaction.id} finalized as COMPLETED with all ledger side-effects persisted"
        )

        # Record Commission (non-critical — don't crash if this fails)
        try:
            rate = await commission_service.calculate_commission_rate(
                user_id=transaction.userId, purpose=transaction.purpose
            )
            commission = int(transaction.amount * rate)

            await prisma.transaction.update(
                where={"id": transaction.id},
                data={
                    "commission": commission,
                    "netAmount": transaction.amount - commission,
                },
            )

            # Also record a PlatformRevenue entry for financial reporting
            await commission_service.record_commission(
                transaction_id=transaction.id,
                commission_amount=commission,
            )
            logger.info(
                f"Commission recorded for transaction {transaction.id}: {commission}"
            )
        except Exception as e:
            logger.warning(f"Commission recording failed (non-critical): {e}")

        # Auto-generate invoice (non-critical)
        try:
            from app.services.invoice_service import invoice_service

            await invoice_service.generate_invoice(transaction.id)
        except Exception as inv_err:
            logger.warning(
                f"Invoice generation failed for tx {transaction.id}: {inv_err}"
            )

        try:
            from app.middleware.metrics import PAYMENT_DURATION, PAYMENT_ATTEMPT

            elapsed = _time.monotonic() - _start
            PAYMENT_DURATION.labels(provider=str(provider), status="completed").observe(
                elapsed
            )
            PAYMENT_ATTEMPT.labels(provider=str(provider), status="confirmed").inc()
        except Exception:
            pass

        return True
    except Exception as e:
        logger.error(
            f"Failed to finalize success for transaction {transaction.id}: {str(e)}"
        )
        try:
            from app.middleware.metrics import PAYMENT_DURATION, PAYMENT_ATTEMPT

            elapsed = _time.monotonic()
            PAYMENT_DURATION.labels(provider=str(provider), status="failed").observe(
                elapsed
            )
            PAYMENT_ATTEMPT.labels(provider=str(provider), status="failed").inc()
        except Exception:
            pass
        # Re-raise instead of swallowing: the transaction rolled back and is
        # still PENDING, so the Celery task must retry. Returning False here
        # marked the event PROCESSED and silently lost the payment.
        raise


async def finalize_payment_failure(transaction, event_data) -> bool:
    """Marks transaction as failed.

    Uses the same atomic compare-and-set as the success path so a failed /
    expired / canceled notification can never clobber a transaction that was
    already finalized (e.g. a late duplicate delivery).
    """
    _start = _time.monotonic()
    updated = await prisma.transaction.update_many(
        where={"id": transaction.id, "status": PaymentStatus.PENDING.value},
        data={
            "status": PaymentStatus.FAILED.value,
            "updatedAt": datetime.now(timezone.utc),
            "providerData": fields.Json(event_data) if event_data else None,
        },
    )
    if updated == 0:
        logger.info(
            f"Transaction {transaction.id} already in a final state; skipping failure finalization"
        )
        return False
    logger.info(f"Transaction {transaction.id} finalized as FAILED")
    try:
        from app.middleware.metrics import PAYMENT_DURATION, PAYMENT_ATTEMPT

        provider = getattr(transaction, "gateway", None) or getattr(
            transaction, "provider", "unknown"
        )
        elapsed = _time.monotonic() - _start
        PAYMENT_DURATION.labels(provider=str(provider), status="failed").observe(
            elapsed
        )
        PAYMENT_ATTEMPT.labels(provider=str(provider), status="failed").inc()
    except Exception:
        pass
    return True
