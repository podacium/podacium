import logging
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.schemas.payment import (
    PayoutRequest,
    PayoutResponse,
    PaymentProvider,
    PaymentPurpose,
    PaymentStatus,
)
from app.services.wallet_service import wallet_service
from app.services.feature_gate import FeatureModeError
from app.core.config import setting, FinancialMode

logger = logging.getLogger(__name__)


def is_feature_based_mode() -> bool:
    return (
        getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
        != FinancialMode.LICENSED_PSP
    )


class PayoutService:
    """Service for processing withdrawals and payouts"""

    # Minimum and maximum payout amounts in cents
    MIN_PAYOUT = 1000  # 10 DZD
    MAX_PAYOUT = 100000  # 100,000 DZD

    # Payout processing fees by method (in cents)
    PAYOUT_FEES = {
        PaymentProvider.BANK_TRANSFER: 5,  # 5 DZD
        PaymentProvider.CASH: 0,  # No fee for cash
        PaymentProvider.CHARGILY: 5,  # 5 DZD
        PaymentProvider.OTHER: 10,  # 10 DZD
    }

    async def request_payout(self, request: PayoutRequest) -> PayoutResponse:
        """Request a payout from wallet"""
        if is_feature_based_mode():
            raise FeatureModeError()
        try:
            # Start transaction
            async with prisma.tx() as transaction:
                # ── Row-lock the wallet (P0) ──
                # `find_unique(..., for_update=True)` is NOT supported by the
                # generated Prisma client; use the same raw-SQL lock mechanism
                # as wallet_service._lock_wallet.
                locked = await transaction.query_raw(
                    'SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE',
                    request.wallet_id,
                )
                if not locked:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.payout.wallet_not_found",
                    )

                wallet = await transaction.wallet.find_unique(
                    where={"id": request.wallet_id}
                )

                if not wallet:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.payout.wallet_not_found",
                    )

                if not wallet.isActive:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.payout.wallet_not_active",
                    )

                # Validate amount
                await self._validate_payout_amount(request.amount)

                # Available balance is the wallet's spendable balance. There is
                # no separate holdBalance column in the current schema, so use
                # podaPoints directly.
                available_balance = wallet.podaPoints

                if available_balance < request.amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.insufficient_funds",
                    )

                # Calculate fee
                fee = self.PAYOUT_FEES.get(request.method, 100)
                total_debit = request.amount + fee

                if available_balance < total_debit:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.insufficient_funds",
                    )

                # Debit amount + fee from wallet (pass tx to avoid nested transaction)
                await wallet_service.debit_wallet(
                    wallet_id=request.wallet_id,
                    amount=total_debit,
                    purpose=PaymentPurpose.TRANSFER,
                    reference_id=None,
                    description=f"Payout request of {request.amount} via {request.method.value}",
                    tx=transaction,
                )

                # Generate reference
                short_id = uuid.uuid4().hex[:10].upper()
                reference = f"POUT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{wallet.id}-{short_id}"

                # Create payout request
                payout_data = {
                    "walletId": request.wallet_id,
                    "amount": request.amount,
                    "currency": wallet.currency,
                    "method": request.method.value,
                    "status": "PENDING",
                    "reference": reference,
                    "metadata": Json(
                        {
                            "fee": fee,
                            "total_debit": total_debit,
                            "bank_details": request.bank_account_details,
                            "requested_at": datetime.now(timezone.utc).isoformat(),
                            **(request.metadata or {}),
                        }
                    ),
                }

                payout = await transaction.payout.create(data=payout_data)

                # Create transaction record for the payout
                await transaction.transaction.create(
                    data={
                        "walletId": request.wallet_id,
                        "amount": request.amount,
                        "currency": wallet.currency,
                        "purpose": PaymentPurpose.TRANSFER.value,
                        "status": PaymentStatus.PENDING.value,
                        "provider": request.method.value,
                        "metadata": Json(
                            {"payout_id": payout.id, "fee": fee, "reference": reference}
                        ),
                    }
                )

                # Record platform revenue from fee (same tx context)
                await self._record_payout_fee(
                    fee, reference, wallet.currency, tx=transaction
                )

                logger.info(
                    f"Created payout request {payout.id} for wallet {request.wallet_id}"
                )

                return PayoutResponse.from_orm(payout)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create payout request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.payout.create_failed",
            )

    async def _validate_payout_amount(self, amount: int):
        """Validate payout amount"""
        if amount < self.MIN_PAYOUT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.payout.create_failed",
            )

        if amount > self.MAX_PAYOUT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.payout.create_failed",
            )

    async def _record_payout_fee(
        self, fee_dzd: int, reference: str, currency: str, tx=None
    ):
        """Record payout fee as platform revenue"""
        period_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        if period_start.month == 12:
            period_end = period_start.replace(year=period_start.year + 1, month=1)
        else:
            period_end = period_start.replace(month=period_start.month + 1)

        db = tx if tx is not None else prisma
        await db.platformrevenue.create(
            data={
                "source": "PAYOUT_FEE",
                "amount": fee_dzd,
                "currency": currency,
                "referenceId": reference,
                "periodStart": period_start,
                "periodEnd": period_end,
                "metadata": Json(
                    {
                        "type": "payout_processing_fee",
                        "recorded_at": datetime.now(timezone.utc).isoformat(),
                    }
                ),
            }
        )

    async def get_payout(self, payout_id: int) -> Optional[PayoutResponse]:
        """Get payout by ID"""
        payout = await prisma.payout.find_unique(
            where={"id": payout_id}, include={"wallet": True}
        )

        if payout:
            return PayoutResponse.from_orm(payout)
        return None

    async def get_wallet_payouts(
        self, wallet_id: int, limit: int = 50, offset: int = 0
    ) -> List[PayoutResponse]:
        """Get payout history for wallet"""
        payouts = await prisma.payout.find_many(
            where={"walletId": wallet_id},
            order={"requestedAt": "desc"},
            take=limit,
            skip=offset,
            include={"wallet": True},
        )

        return [PayoutResponse.from_orm(payout) for payout in payouts]

    async def get_user_payouts(
        self, user_id: int, limit: int = 50, offset: int = 0
    ) -> List[PayoutResponse]:
        """Get all payouts for user (through their wallets)"""
        # Get user's wallets
        wallets = await prisma.wallet.find_many(where={"userId": user_id})
        wallet_ids = [wallet.id for wallet in wallets]

        if not wallet_ids:
            return []

        payouts = await prisma.payout.find_many(
            where={"walletId": {"in": wallet_ids}},
            order={"requestedAt": "desc"},
            take=limit,
            skip=offset,
            include={"wallet": True},
        )

        return [PayoutResponse.from_orm(payout) for payout in payouts]

    async def get_organization_payouts(
        self, organization_id: int, limit: int = 50, offset: int = 0
    ) -> List[PayoutResponse]:
        """Get all payouts for organization"""
        # Get organization's wallet
        wallet = await prisma.wallet.find_unique(
            where={"organizationId": organization_id}
        )

        if not wallet:
            return []

        payouts = await prisma.payout.find_many(
            where={"walletId": wallet.id},
            order={"requestedAt": "desc"},
            take=limit,
            skip=offset,
            include={"wallet": True},
        )

        return [PayoutResponse.from_orm(payout) for payout in payouts]

    async def process_payout(
        self, payout_id: int, processor_notes: Optional[str] = None
    ) -> PayoutResponse:
        """Mark payout as processing (initiate actual bank transfer, etc.)

        Atomic claim: only a PENDING payout can be claimed by a worker
        (PENDING -> PROCESSING). A second worker observing the same payout
        sees 0 affected rows and receives a 409/400 — no double processing.
        """
        payout = await prisma.payout.find_unique(where={"id": payout_id})

        if not payout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="errors.payout.not_found"
            )

        now = datetime.now(timezone.utc)
        updated_many = await prisma.payout.update_many(
            where={"id": payout_id, "status": "PENDING"},
            data={
                "status": "PROCESSING",
                "processedAt": now,
            },
        )
        if updated_many == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="errors.payout.already_claimed",
            )

        updated = await prisma.payout.update(
            where={"id": payout_id},
            data={
                "metadata": Json(
                    {
                        **(payout.metadata or {}),
                        "processor_notes": processor_notes,
                        "processing_started_at": now.isoformat(),
                    }
                )
            },
        )

        # Update related transaction status
        await self._update_payout_transaction(payout_id, PaymentStatus.PENDING)

        logger.info(f"Marked payout {payout_id} as PROCESSING")

        return PayoutResponse.from_orm(updated)

    async def complete_payout(
        self, payout_id: int, external_reference: Optional[str] = None
    ) -> PayoutResponse:
        """Mark payout as completed.

        Atomic claim: only a PROCESSING payout can complete (PROCESSING ->
        COMPLETED). A concurrent worker/admin cannot complete the same payout
        twice, and a completed payout can never be observed as PENDING/PROCESSING.
        """
        payout = await prisma.payout.find_unique(where={"id": payout_id})

        if not payout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="errors.payout.not_found"
            )

        now = datetime.now(timezone.utc)
        updated_many = await prisma.payout.update_many(
            where={"id": payout_id, "status": "PROCESSING"},
            data={
                "status": "COMPLETED",
                "completedAt": now,
            },
        )
        if updated_many == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="errors.payout.already_claimed",
            )

        updated = await prisma.payout.update(
            where={"id": payout_id},
            data={
                "metadata": Json(
                    {
                        **(payout.metadata or {}),
                        "external_reference": external_reference,
                        "completed_at": now.isoformat(),
                    }
                )
            },
        )

        # Update related transaction status
        await self._update_payout_transaction(payout_id, PaymentStatus.COMPLETED)

        # Get wallet owner info for notification
        wallet = await prisma.wallet.find_unique(
            where={"id": payout.walletId}, include={"user": True, "organization": True}
        )

        # Send notification
        recipient_id = wallet.userId or (
            wallet.organization.ownerId if wallet.organization else None
        )
        if recipient_id:
            await self._send_payout_notification(recipient_id, payout)

        logger.info(f"Completed payout {payout_id}")
        return PayoutResponse.from_orm(updated)

    async def fail_payout(self, payout_id: int, failure_reason: str) -> PayoutResponse:
        """Mark payout as failed and refund wallet.

        Atomic: a payout is claimed for failure (PENDING|PROCESSING -> FAILED)
        with a conditional UPDATE inside a transaction. Two concurrent fail
        calls cannot both claim the same payout, so the wallet can never be
        refunded twice. The refund and the status transition commit together
        (all-or-nothing).
        """
        try:
            # Start transaction
            async with prisma.tx() as transaction:
                payout = await transaction.payout.find_unique(where={"id": payout_id})

                if not payout:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.payout.not_found",
                    )

                if payout.status == "COMPLETED":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.payout.cannot_fail_completed",
                    )

                # Atomic claim PENDING|PROCESSING -> FAILED.
                claimed = await transaction.payout.update_many(
                    where={
                        "id": payout_id,
                        "status": {"in": ["PENDING", "PROCESSING"]},
                    },
                    data={
                        "status": "FAILED",
                    },
                )
                if claimed == 0:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="errors.payout.already_claimed",
                    )

                # Refund amount + fee back to wallet (same transaction).
                total_amount = payout.amount + (payout.metadata or {}).get("fee", 0)

                await wallet_service.credit_wallet(
                    wallet_id=payout.walletId,
                    amount=total_amount,
                    purpose=PaymentPurpose.TRANSFER,
                    reference_id=str(payout_id),
                    description=f"Payout failure refund: {failure_reason}",
                    tx=transaction,
                )

                # Update payout status
                updated = await transaction.payout.update(
                    where={"id": payout_id},
                    data={
                        "metadata": Json(
                            {
                                **(payout.metadata or {}),
                                "failure_reason": failure_reason,
                                "failed_at": datetime.now(timezone.utc).isoformat(),
                                "refunded_amount": total_amount,
                            }
                        )
                    },
                )

                # Update related transaction status
                await self._update_payout_transaction(payout_id, PaymentStatus.FAILED)

                logger.info(f"Failed payout {payout_id}: {failure_reason}")

                # Send failure notification to wallet owner
                try:
                    wallet = await prisma.wallet.find_unique(
                        where={"id": payout.walletId},
                        include={"user": True, "organization": True},
                    )
                    recipient_id = wallet.userId or (
                        wallet.organization.ownerId if wallet.organization else None
                    )
                    if recipient_id:
                        from app.services.notification_service import (
                            NotificationService,
                        )
                        from app.schemas.notifications import (
                            NotificationCreate,
                            NotificationCategory,
                            NotificationPriority,
                            NotificationPayload,
                        )

                        await NotificationService.create_notification(
                            NotificationCreate(
                                userId=recipient_id,
                                type="PAYOUT_FAILED",
                                title="Payout Request Rejected",
                                body=f"Your payout request of {total_amount:.2f} {payout.currency} was rejected: {failure_reason}. The funds have been refunded to your wallet.",
                                category=NotificationCategory.BILLING,
                                priority=NotificationPriority.HIGH,
                                payload=NotificationPayload(
                                    entity_type="payout",
                                    entity_id=str(payout_id),
                                    action_url="/wallet/payouts",
                                    metadata={
                                        "payout_id": payout_id,
                                        "failure_reason": failure_reason,
                                    },
                                ),
                                data={
                                    "payout_id": payout_id,
                                    "action_url": "/wallet/payouts",
                                    "url": "/wallet/payouts",
                                },
                            )
                        )
                except Exception as notif_err:
                    logger.warning(
                        f"Failed to send payout rejection notification: {notif_err}"
                    )

                return PayoutResponse.from_orm(updated)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to mark payout as failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.payout.fail_process_failed",
            )

    async def _update_payout_transaction(self, payout_id: int, status: PaymentStatus):
        """Update transaction status for payout"""
        transactions = await prisma.transaction.find_many(
            where={"metadata": {"contains": {"payout_id": payout_id}}}
        )

        for transaction in transactions:
            await prisma.transaction.update(
                where={"id": transaction.id}, data={"status": status.value}
            )

    async def _send_payout_notification(self, user_id: int, payout):
        """Send notification about payout completion"""
        amount_dzd = payout.amount
        from app.services.notification_service import NotificationService
        from app.schemas.notifications import (
            NotificationCreate,
            NotificationCategory,
            NotificationPriority,
            NotificationPayload,
        )

        await NotificationService.create_notification(
            NotificationCreate(
                userId=user_id,
                type="PAYOUT_COMPLETED",
                title="Payout Completed",
                body=f"Your payout of {amount_dzd:.2f} {payout.currency} has been processed successfully.",
                category=NotificationCategory.BILLING,
                priority=NotificationPriority.NORMAL,
                payload=NotificationPayload(
                    entity_type="payout",
                    entity_id=str(payout.id),
                    action_url="/wallet/payouts",
                    metadata={
                        "payout_id": payout.id,
                        "amount": payout.amount,
                        "currency": payout.currency,
                    },
                ),
                data={
                    "payout_id": payout.id,
                    "amount": payout.amount,
                    "currency": payout.currency,
                    "method": payout.method,
                    "reference": payout.reference,
                    "action_url": "/wallet/payouts",
                    "url": "/wallet/payouts",
                },
            )
        )

    async def get_payout_stats(
        self,
        wallet_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get payout statistics"""
        where_clause: Dict[str, Any] = {}

        if wallet_id:
            where_clause["walletId"] = wallet_id

        if start_date or end_date:
            where_clause["requestedAt"] = {}
            if start_date:
                where_clause["requestedAt"]["gte"] = start_date
            if end_date:
                where_clause["requestedAt"]["lte"] = end_date

        # Get all payouts matching criteria
        payouts = await prisma.payout.find_many(where=where_clause)

        # Calculate statistics
        total_payouts = len(payouts)
        total_amount = sum(p.amount for p in payouts)
        total_fees = sum(p.metadata.get("fee", 0) for p in payouts if p.metadata)

        # Count by status
        status_counts: Dict[str, int] = {}
        for payout in payouts:
            status_counts[payout.status] = status_counts.get(payout.status, 0) + 1

        # Count by method
        method_counts: Dict[str, int] = {}
        for payout in payouts:
            method_counts[payout.method] = method_counts.get(payout.method, 0) + 1

        return {
            "total_payouts": total_payouts,
            "total_amount": total_amount,
            "total_fees": total_fees,
            "status_counts": status_counts,
            "method_counts": method_counts,
            "average_payout": total_amount / total_payouts if total_payouts > 0 else 0,
            "period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None,
            },
        }

    async def process_pending_payouts(self):
        """Process pending payouts (cron job)"""
        try:
            logger.info("Processing pending payouts...")

            # Find payouts pending for more than 1 hour
            one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
            pending_payouts = await prisma.payout.find_many(
                where={"status": "PENDING", "requestedAt": {"lte": one_hour_ago}},
                take=50,  # Process in batches
            )

            logger.info(f"Found {len(pending_payouts)} pending payouts to process")

            for payout in pending_payouts:
                try:
                    # Enforce Maker-Checker Dual-Control: Disbursements >= 100,000 DZD
                    # require human Maker-Checker authorization and must NEVER be auto-completed by cron
                    if payout.amount >= 100_000:
                        logger.info(
                            f"Payout {payout.id} ({payout.amount} DZD) exceeds Maker-Checker threshold; skipping automated cron completion."
                        )
                        continue

                    # Mark as processing
                    await self.process_payout(payout.id, "Automated batch processing")

                    # Collision-resistant UUID external reference
                    auto_ref = f"AUTO-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"
                    await self.complete_payout(payout.id, auto_ref)

                except HTTPException as http_exc:
                    # A state conflict (409) means another worker already claimed
                    # this payout — neither double-process nor fail it.
                    if http_exc.status_code in (400, 404, 409):
                        logger.info(
                            f"Payout {payout.id} already claimed/finalized elsewhere; skipping"
                        )
                        continue
                    raise
                except Exception as e:
                    logger.error(f"Failed to process payout {payout.id}: {str(e)}")
                    # Mark as failed
                    await self.fail_payout(
                        payout.id, f"Automated processing failed: {str(e)}"
                    )

            logger.info("Pending payouts processing completed")

        except Exception as e:
            logger.error(f"Failed to process pending payouts: {str(e)}")


# Singleton instance
payout_service = PayoutService()
