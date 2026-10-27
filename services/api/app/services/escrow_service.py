import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import enums as p_enums, Json
from app.schemas.payment import (
    EscrowHoldResponse,
    EscrowReleaseRequest,
    PaymentPurpose,
    FreelancerTier,
)
from app.services.wallet_service import wallet_service
from app.services.billing_services.commission_service import commission_service
from app.services.feature_gate import FeatureModeError
from app.core.config import setting, FinancialMode

logger = logging.getLogger(__name__)


def is_feature_based_mode() -> bool:
    return (
        getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
        != FinancialMode.LICENSED_PSP
    )


class EscrowService:
    """Service for managing escrow holds and releases"""

    async def create_escrow_hold(
        self, contract_id: int, client_wallet_id: int, amount: int, tx=None
    ) -> EscrowHoldResponse:
        """Create escrow hold for contract payment"""
        if is_feature_based_mode():
            raise FeatureModeError()
        try:
            # TRANSACTION: All-or-nothing — pessimistic lock on wallet, hold funds, create record, update contract
            async def _run(t):
                # Pessimistic row-lock on client wallet: SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE
                await wallet_service._lock_wallet(t, client_wallet_id)

                # Re-validate contract under lock
                contract = await t.contract.find_unique(
                    where={"id": contract_id},
                    include={
                        "client": True,
                        "freelancer": True,
                        "freelancerProfile": True,
                    },
                )

                if not contract:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.billing.contract_not_found",
                    )

                if contract.status != "ACTIVE":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.create_failed",
                    )

                # Check if escrow already exists
                existing_hold = await t.escrowhold.find_unique(
                    where={"contractId": contract_id}
                )

                if existing_hold:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.create_failed",
                    )

                # Verify client wallet belongs to contract client
                client_wallet = await t.wallet.find_unique(
                    where={"id": client_wallet_id}
                )

                if not client_wallet or client_wallet.userId != contract.clientId:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.create_failed",
                    )

                # Verify amount matches contract
                if amount != contract.amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.create_failed",
                    )

                # Hold funds in client's wallet
                await wallet_service.hold_funds(
                    wallet_id=client_wallet_id,
                    amount=amount,
                    purpose=PaymentPurpose.CONTRACT_ESCROW,
                    reference_id=str(contract_id),
                    description=f"Escrow hold for contract {contract_id}",
                    tx=t,
                )

                # Calculate commission
                freelancer_tier = (
                    FreelancerTier(contract.freelancerProfile.tier)
                    if contract.freelancerProfile
                    else FreelancerTier.NEW
                )
                commission_calc = await commission_service.calculate_commission(
                    amount=amount,
                    freelancer_tier=freelancer_tier,
                    purpose=PaymentPurpose.CONTRACT_ESCROW,
                )

                # Create escrow hold record
                escrow_hold = await t.escrowhold.create(
                    data={
                        "contractId": contract_id,
                        "walletId": client_wallet_id,
                        "amount": amount,
                        "currency": contract.currency,
                        "status": "HOLD",
                        "releaseConditions": Json(
                            {
                                "client_id": contract.clientId,
                                "freelancer_id": contract.freelancerId,
                                "commission_calculation": commission_calc.dict(),
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ),
                    }
                )

                # Update contract with escrow reference
                await t.contract.update(
                    where={"id": contract_id},
                    data={
                        "escrowHoldId": escrow_hold.id,
                        "commission": commission_calc.commission,
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )
                return escrow_hold

            if tx is not None:
                escrow_hold = await _run(tx)
            else:
                async with prisma.tx() as t:
                    escrow_hold = await _run(t)

            logger.info(
                f"Created escrow hold {escrow_hold.id} for contract {contract_id}"
            )

            return EscrowHoldResponse.from_orm(escrow_hold)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create escrow hold: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.escrow.create_failed",
            )

    async def release_escrow(
        self,
        request: EscrowReleaseRequest,
        step_up_token: Optional[str] = None,
        approver_user_id: Optional[int] = None,
        is_automated: bool = False,
    ) -> Dict[str, Any]:
        """Release escrow funds to freelancer using the unified commission service."""
        if is_feature_based_mode():
            raise FeatureModeError()
        try:
            # 1. Fetch escrow hold and contract details
            escrow_hold = await prisma.escrowhold.find_unique(
                where={"contractId": request.contract_id}, include={"contract": True}
            )

            if not escrow_hold:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.escrow.hold_not_found",
                )

            if escrow_hold.status not in ["HOLD", "PARTIALLY_RELEASED"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.escrow.release_failed",
                )

            # High-value escrow disbursement check (> 100,000 DZD)
            release_amount = request.amount
            if not is_automated and (
                release_amount > 100_000 or escrow_hold.amount > 100_000
            ):
                if not step_up_token:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "code": "STEP_UP_REQUIRED",
                            "message": "High-value escrow disbursement exceeding 100,000 DZD requires cryptographic step-up verification.",
                            "amount": release_amount,
                            "thresholdDzd": 100000,
                        },
                    )
                from app.core.security import verify_token

                token_payload = verify_token(step_up_token)
                if not token_payload or token_payload.get("type") != "step_up":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "code": "INVALID_STEP_UP_TOKEN",
                            "message": "Invalid or expired cryptographic step-up token for high-value disbursement.",
                        },
                    )
                if approver_user_id and token_payload.get("sub") != str(
                    approver_user_id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="errors.auth.step_up_user_mismatch",
                    )

            # TRANSACTION: Lock EscrowHold row, validate remaining balance, acquire canonical wallet locks, and release
            async with prisma.tx() as tx:
                # Row-lock EscrowHold via SELECT ... FOR UPDATE
                locked = await tx.query_raw(
                    'SELECT id FROM "EscrowHold" WHERE id = $1 FOR UPDATE',
                    escrow_hold.id,
                )
                if not locked:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.hold_lock_failed",
                    )
                locked_hold = await tx.escrowhold.find_unique(
                    where={"id": escrow_hold.id}
                )
                if not locked_hold or locked_hold.status not in [
                    "HOLD",
                    "PARTIALLY_RELEASED",
                ]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.already_releasing_or_released",
                    )

                # Validate release_amount <= remaining_balance on EscrowHold
                released_so_far = locked_hold.releasedAmount or 0
                remaining_balance = locked_hold.amount - released_so_far
                if release_amount <= 0 or release_amount > remaining_balance:
                    raise ValueError(
                        f"Release amount {release_amount} exceeds remaining escrow balance "
                        f"{remaining_balance} for contract {request.contract_id}"
                    )

                # Find freelancer wallet for canonical deadlock-free lock acquisition
                contract = await tx.contract.find_unique(
                    where={"id": request.contract_id}
                )
                freelancer_wallet = None
                if contract and contract.freelancerId:
                    freelancer_wallet = await tx.wallet.find_unique(
                        where={"userId": contract.freelancerId}
                    )
                    if not freelancer_wallet:
                        freelancer_wallet = await tx.wallet.create(
                            data={
                                "userId": contract.freelancerId,
                                "currency": locked_hold.currency,
                                "podaPoints": 0,
                            }
                        )

                # DEADLOCK PREVENTION: Canonical lock acquisition order across wallets BEFORE fund mutations
                if freelancer_wallet:
                    first_lock, second_lock = sorted(
                        [locked_hold.walletId, freelancer_wallet.id]
                    )
                    await wallet_service._lock_wallet(tx, first_lock)
                    if first_lock != second_lock:
                        await wallet_service._lock_wallet(tx, second_lock)
                else:
                    await wallet_service._lock_wallet(tx, locked_hold.walletId)

                # Delegate to commission service, passing tx to avoid nested transaction
                success = await commission_service.release_escrow(
                    request.contract_id, tx=tx
                )

                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.release_failed",
                    )

                # Release client's hold balance
                await wallet_service.release_hold(
                    wallet_id=locked_hold.walletId,
                    amount=release_amount,
                    purpose=PaymentPurpose.CONTRACT_ESCROW,
                    reference_id=str(locked_hold.contractId),
                    description=f"Release escrow hold for contract {locked_hold.contractId}",
                    tx=tx,
                )

                new_released = released_so_far + release_amount
                new_status = (
                    "RELEASED"
                    if new_released >= locked_hold.amount
                    else "PARTIALLY_RELEASED"
                )

                # Mark as fully or partially released
                updated_escrow = await tx.escrowhold.update(
                    where={"id": locked_hold.id},
                    data={
                        "status": new_status,
                        "releasedAmount": new_released,
                        "releasedAt": datetime.now(timezone.utc)
                        if new_status == "RELEASED"
                        else None,
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )

            logger.info(
                f"Released {release_amount} from escrow {escrow_hold.id} for contract {request.contract_id} "
                f"(total: {new_released}/{locked_hold.amount})"
            )

            return {
                "success": True,
                "escrow_hold": EscrowHoldResponse.from_orm(updated_escrow),
                "message": "Escrow released successfully",
            }

        except HTTPException:
            raise
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Failed to release escrow: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.escrow.release_failed",
            )

    async def refund_escrow(
        self, contract_id: int, refund_reason: str
    ) -> Dict[str, Any]:
        """Refund escrow funds back to client"""
        if is_feature_based_mode():
            raise FeatureModeError()
        try:
            # Start transaction
            async with prisma.tx() as transaction:
                # Get escrow hold
                escrow_hold = await transaction.escrowhold.find_unique(
                    where={"contractId": contract_id}
                )

                if not escrow_hold:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.escrow.hold_not_found",
                    )

                if escrow_hold.status not in ["HOLD", "DISPUTED"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.escrow.refund_failed",
                    )

                # Release hold
                await wallet_service.release_hold(
                    wallet_id=escrow_hold.walletId,
                    amount=escrow_hold.amount,
                    purpose=PaymentPurpose.REFUND,
                    reference_id=str(escrow_hold.id),
                    description=f"Escrow refund for contract {contract_id}: {refund_reason}",
                )

                # Update escrow status
                existing_cond = (
                    dict(escrow_hold.releaseConditions)
                    if escrow_hold.releaseConditions
                    and isinstance(escrow_hold.releaseConditions, dict)
                    else {}
                )
                existing_cond.update(
                    {
                        "refund_reason": refund_reason,
                        "refunded_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
                updated_escrow = await transaction.escrowhold.update(
                    where={"id": escrow_hold.id},
                    data={
                        "status": "REFUNDED",
                        "refundedAt": datetime.now(timezone.utc),
                        "updatedAt": datetime.now(timezone.utc),
                        "releaseConditions": Json(existing_cond),
                    },
                )

                # Update contract status
                await transaction.contract.update(
                    where={"id": contract_id},
                    data={
                        "status": "CANCELLED",
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )

                # Create transaction record
                transaction_record = await transaction.transaction.create(
                    data={
                        "contractId": contract_id,
                        "walletId": escrow_hold.walletId,
                        "amount": escrow_hold.amount,
                        "currency": escrow_hold.currency,
                        "purpose": p_enums.PaymentPurpose.CONTRACT_ESCROW_REFUND,
                        "status": p_enums.PaymentStatus.COMPLETED,
                        "provider": p_enums.PaymentProvider.OTHER,
                        "metadata": {
                            "escrow_hold_id": escrow_hold.id,
                            "refund_reason": refund_reason,
                        },
                    }
                )

                logger.info(
                    f"Refunded {escrow_hold.amount} from escrow {escrow_hold.id} for contract {contract_id}"
                )

                return {
                    "escrow_hold": EscrowHoldResponse.from_orm(updated_escrow),
                    "refund_amount": escrow_hold.amount,
                    "transaction_id": transaction_record.id,
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to refund escrow: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.escrow.refund_failed",
            )

    async def dispute_escrow(
        self, contract_id: int, dispute_reason: str, disputed_by: str
    ) -> EscrowHoldResponse:
        """Dispute escrow (freeze funds for review)"""
        if is_feature_based_mode():
            raise FeatureModeError()
        escrow_hold = await prisma.escrowhold.find_unique(
            where={"contractId": contract_id}
        )

        if not escrow_hold:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.escrow.hold_not_found",
            )

        if escrow_hold.status != "HOLD":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.escrow.hold_not_found",
            )

        existing_cond = (
            dict(escrow_hold.releaseConditions)
            if escrow_hold.releaseConditions
            and isinstance(escrow_hold.releaseConditions, dict)
            else {}
        )
        existing_cond.update(
            {
                "dispute_reason": dispute_reason,
                "disputed_by": disputed_by,
                "disputed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        updated = await prisma.escrowhold.update(
            where={"id": escrow_hold.id},
            data={
                "status": "DISPUTED",
                "updatedAt": datetime.now(timezone.utc),
                "releaseConditions": Json(existing_cond),
            },
        )

        # Update contract status
        await prisma.contract.update(
            where={"id": contract_id},
            data={"status": "DISPUTED", "updatedAt": datetime.now(timezone.utc)},
        )

        logger.info(f"Disputed escrow {escrow_hold.id} for contract {contract_id}")
        return EscrowHoldResponse.from_orm(updated)

    async def resolve_dispute(
        self,
        contract_id: int,
        resolution: str,
        release_to_freelancer: bool,
        resolution_details: str,
    ) -> Dict[str, Any]:
        """Resolve escrow dispute"""
        if is_feature_based_mode():
            raise FeatureModeError()
        escrow_hold = await prisma.escrowhold.find_unique(
            where={"contractId": contract_id}
        )

        if not escrow_hold:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.escrow.hold_not_found",
            )

        if escrow_hold.status != "DISPUTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.escrow.hold_not_found",
            )

        if release_to_freelancer:
            # Release to freelancer
            result = await self.release_escrow(
                EscrowReleaseRequest(
                    contract_id=contract_id,
                    amount=escrow_hold.amount,
                    description=f"Dispute resolution: {resolution} - {resolution_details}",
                ),
                is_automated=True,
            )
        else:
            # Refund to client
            result = await self.refund_escrow(
                contract_id=contract_id,
                refund_reason=f"Dispute resolution: {resolution} - {resolution_details}",
            )

        # Log dispute resolution
        await prisma.auditlog.create(
            data={
                "eventType": "ESCROW_DISPUTE_RESOLVED",
                "entityType": "EscrowHold",
                "entityId": str(escrow_hold.id),
                "metadata": Json(
                    {
                        "resolution": resolution,
                        "release_to_freelancer": release_to_freelancer,
                        "resolution_details": resolution_details,
                    }
                ),
                "createdAt": datetime.now(timezone.utc),
            }
        )

        return result

    async def get_escrow_hold(self, contract_id: int) -> Optional[EscrowHoldResponse]:
        """Get escrow hold by contract ID"""
        escrow_hold = await prisma.escrowhold.find_unique(
            where={"contractId": contract_id},
            include={"contract": True, "wallet": True},
        )

        if escrow_hold:
            return EscrowHoldResponse.from_orm(escrow_hold)
        return None

    async def get_active_escrows(
        self, wallet_id: Optional[int] = None, status: str = "HOLD"
    ) -> List[EscrowHoldResponse]:
        """Get active escrow holds"""
        where_clause: Dict[str, Any] = {"status": status}

        if wallet_id:
            where_clause["walletId"] = wallet_id

        escrows = await prisma.escrowhold.find_many(
            where=where_clause, include={"contract": True}, order={"createdAt": "desc"}
        )

        return [EscrowHoldResponse.from_orm(escrow) for escrow in escrows]

    async def schedule_auto_release(self, contract_id: int, days_from_now: int = 7):
        """Schedule automatic escrow release"""
        if is_feature_based_mode():
            raise FeatureModeError()
        escrow_hold = await prisma.escrowhold.find_unique(
            where={"contractId": contract_id}
        )

        if not escrow_hold:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.escrow.hold_not_found",
            )

        scheduled_release = datetime.now(timezone.utc) + timedelta(days=days_from_now)

        updated = await prisma.escrowhold.update(
            where={"id": escrow_hold.id},
            data={
                "scheduledReleaseAt": scheduled_release,
                "releaseConditions": {
                    "auto_release": True,
                    "days_after_contract_completion": days_from_now,
                    "scheduled_date": scheduled_release.isoformat(),
                },
                "updatedAt": datetime.now(timezone.utc),
            },
        )

        logger.info(
            f"Scheduled auto-release for escrow {escrow_hold.id} on {scheduled_release}"
        )
        return EscrowHoldResponse.from_orm(updated)

    async def process_scheduled_releases(self):
        """Process scheduled escrow releases (cron job)"""
        if is_feature_based_mode():
            return
        try:
            logger.info("Processing scheduled escrow releases...")

            now = datetime.now(timezone.utc)
            scheduled_escrows = await prisma.escrowhold.find_many(
                where={"status": "HOLD", "scheduledReleaseAt": {"lte": now}}
            )

            logger.info(f"Found {len(scheduled_escrows)} scheduled escrows to release")

            for escrow in scheduled_escrows:
                try:
                    # Auto-release full amount
                    await self.release_escrow(
                        EscrowReleaseRequest(
                            contract_id=escrow.contractId,
                            amount=escrow.amount,
                            description="Automatic release per scheduled date",
                        ),
                        is_automated=True,
                    )

                    logger.info(
                        f"Auto-released escrow {escrow.id} for contract {escrow.contractId}"
                    )

                except Exception as e:
                    logger.error(f"Failed to auto-release escrow {escrow.id}: {str(e)}")
                    # Update with error
                    existing_cond = (
                        dict(escrow.releaseConditions)
                        if escrow.releaseConditions
                        and isinstance(escrow.releaseConditions, dict)
                        else {}
                    )
                    existing_cond.update(
                        {
                            "auto_release_failed": True,
                            "auto_release_error": str(e),
                            "auto_release_attempted_at": now.isoformat(),
                        }
                    )
                    await prisma.escrowhold.update(
                        where={"id": escrow.id},
                        data={"releaseConditions": Json(existing_cond)},
                    )

            logger.info("Scheduled escrow releases processing completed")

        except Exception as e:
            logger.error(f"Failed to process scheduled releases: {str(e)}")


# Singleton instance
escrow_service = EscrowService()
