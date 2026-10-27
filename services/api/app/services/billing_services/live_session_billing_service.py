"""Live Session Billing Service — post-payment access granting and refunds."""

import logging
from datetime import datetime, timezone

from app.core.prisma import prisma
from app.services.billing_services.billing_core_service import is_price_verified
from app.services.live_session_service import book_session, REPLAY_EXPIRY_DAYS

logger = logging.getLogger(__name__)


class LiveSessionBillingService:
    async def grant_access(self, transaction_id: int) -> None:
        transaction = await prisma.transaction.find_unique(where={"id": transaction_id})
        if not transaction or not transaction.userId:
            logger.warning(f"grant_access: invalid transaction {transaction_id}")
            return

        user_id = transaction.userId
        metadata = transaction.metadata or {}

        # Reject transactions without server price verification.
        if not is_price_verified(metadata):
            logger.error(
                f"BLOCKED live session grant: transaction {transaction_id} lacks "
                f"server price verification marker."
            )
            return

        session_id = metadata.get("live_session_id")

        if not session_id:
            logger.error(
                f"Live session purchase missing session_id in metadata for tx {transaction_id}"
            )
            return

        try:
            session = await prisma.livesession.find_unique(where={"id": session_id})
            if not session:
                logger.error(
                    f"Live session {session_id} not found for tx {transaction_id}"
                )
                return

            await book_session(
                session_id=session_id,
                user_id=user_id,
                transaction_id=transaction_id,
            )

            if session.priceAmount:
                replay_expires = datetime.now(timezone.utc).replace(
                    hour=23, minute=59, second=59, microsecond=0
                )
                from datetime import timedelta

                replay_expires += timedelta(days=REPLAY_EXPIRY_DAYS)

                await prisma.livesession.update(
                    where={"id": session_id},
                    data={
                        "replayExpiresAt": replay_expires,
                    },
                )

            logger.info(
                f"Live session access granted: user={user_id} session={session_id} tx={transaction_id}"
            )

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
                        user_id=user_id,
                        type="live_session_booked",
                        title="Live Session Booked",
                        body=f"You have successfully booked access to '{session.title}'.",
                        category=NotificationCategory.EDUCATION,
                        priority=NotificationPriority.HIGH,
                        payload=NotificationPayload(
                            entity_type="live_session",
                            entity_id=str(session_id),
                            action_url=f"/live/{session_id}",
                            metadata={
                                "session_id": session_id,
                                "session_title": session.title,
                            },
                        ),
                        data={
                            "session_id": session_id,
                            "session_title": session.title,
                            "action_url": f"/live/{session_id}",
                        },
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to send booking notification: {e}")

        except Exception as e:
            logger.error(
                f"Failed to grant live session access for tx {transaction_id}: {e}"
            )

    async def process_refund(self, transaction_id: int) -> None:
        """
        Process a refund for a completed live-session purchase.

        INVARIANT: ``refundProcessed`` on the booking is only ever set to true
        inside the SAME transaction that actually moves money (wallet credit)
        and flips the purchase transaction to REFUNDED. If any step fails, the
        whole transaction rolls back, so a refund can never be marked complete
        without actually being performed.

        Idempotency: only a transaction in COMPLETED state can be claimed for
        refund (atomic conditional update). A second/duplicate call observes a
        non-COMPLETED status and is a no-op, so a booking can never receive two
        refunds.
        """
        transaction = await prisma.transaction.find_unique(where={"id": transaction_id})
        if not transaction:
            return

        if transaction.status != "COMPLETED":
            logger.info(
                f"Refund skipped for non-completed transaction {transaction_id} (status={transaction.status})"
            )
            return

        try:
            async with prisma.tx() as tx:
                # Atomic claim: exactly one worker can transition COMPLETED -> REFUNDED.
                updated = await tx.transaction.update_many(
                    where={"id": transaction_id, "status": "COMPLETED"},
                    data={
                        "status": "REFUNDED",
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )
                if updated == 0:
                    logger.info(
                        f"Transaction {transaction_id} already refunded/finalized; skipping"
                    )
                    return

                # Perform the actual refund: credit the buyer's wallet. A live-
                # session purchase transaction may not carry walletId even when
                # it was paid from a wallet, so resolve the buyer's wallet from
                # the transaction's owner. This is the internal refund mechanism
                # (Chargily has no refund API).
                if transaction.userId:
                    from app.services.wallet_service import wallet_service

                    wallet = await wallet_service.ensure_user_wallet(transaction.userId)
                    await wallet_service.credit_wallet(
                        wallet_id=wallet.id,
                        amount=transaction.amount,
                        purpose="LIVE_SESSION_REFUND",
                        reference_id=str(transaction.id),
                        description=f"Refund for live session booking (transaction {transaction_id})",
                        tx=tx,
                    )

                booking = await tx.livesessionbooking.find_unique(
                    where={"transactionId": transaction_id}
                )
                if booking and not booking.refundProcessed:
                    now = datetime.now(timezone.utc)
                    await tx.livesessionbooking.update(
                        where={"id": booking.id},
                        data={
                            "status": "cancelled",
                            "cancelledAt": now,
                            "deletedAt": now,
                            "refundProcessed": True,
                        },
                    )

            logger.info(
                f"Live session refund processed for transaction {transaction_id}"
            )
        except Exception as e:
            logger.error(
                f"Live session refund FAILED for transaction {transaction_id}: {e}",
                exc_info=True,
            )
            raise


live_session_billing_service = LiveSessionBillingService()
