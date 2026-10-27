import logging
import uuid
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel
from datetime import datetime, timezone

from app.core.config import setting, FinancialMode

from app.core.auth import get_current_active_user
from app.schemas.payment import (
    WalletResponse,
    WalletTransferRequest,
    TransactionResponse,
    PaymentPurpose,
)
from app.services.wallet_service import wallet_service
from app.services.poda_points_service import poda_points_service
from app.services.feature_service import feature_service
from app.services.audit_trail_service import AuditTrailService
from app.core.rbac import require_permissions
from app.core.banking_validators import validate_algerian_rib
from app.core.prisma import prisma
from app.generated.prisma import Json

router = APIRouter(prefix="/wallets", tags=["wallets"])
logger = logging.getLogger(__name__)

# Manual balance adjustments are capped below WalletService.MAKER_CHECKER_THRESHOLD
# (100,000) so a single operator can never move a high-value amount without the
# dual-control payout path.
MAX_ADMIN_ADJUSTMENT = 50_000
MIN_ADJUSTMENT_REASON_LENGTH = 10


@router.get("/me", response_model=WalletResponse)
async def get_my_wallet(current_user=Depends(get_current_active_user)):
    """Get current user's wallet (auto-creates if missing)"""
    try:
        wallet = await wallet_service.ensure_user_wallet(current_user.id)
        return wallet

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user wallet: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_wallet",
        )


@router.get("/organization/{org_id}", response_model=WalletResponse)
async def get_organization_wallet(
    org_id: int, current_user=Depends(get_current_active_user)
):
    """Get organization wallet"""
    try:
        # Check organization membership or admin access
        membership = await prisma.organizationmember.find_first(
            where={"organizationId": org_id, "userId": current_user.id}
        )

        if not membership and current_user.role not in ["ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_org_wallet",
            )

        wallet = await wallet_service.get_organization_wallet(org_id)

        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.org_wallet_not_found",
            )

        return wallet

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get organization wallet: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_wallet",
        )


@router.get("/{wallet_id}", response_model=WalletResponse)
async def get_wallet(wallet_id: int, current_user=Depends(get_current_active_user)):
    """Get wallet by ID"""
    try:
        wallet = await wallet_service.get_wallet(wallet_id)

        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.wallet_not_found",
            )

        # Check authorization
        if (
            wallet.user_id
            and wallet.user_id != current_user.id
            and current_user.role not in ["ADMIN"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_wallet",
            )

        if wallet.organization_id:
            # Check organization membership
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": wallet.organization_id,
                    "userId": current_user.id,
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this wallet",
                )

        return wallet

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get wallet: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_wallet",
        )


@router.get("/me/transactions", response_model=List[TransactionResponse])
async def get_my_transactions(
    limit: int = 50, offset: int = 0, current_user=Depends(get_current_active_user)
):
    """Get current user's wallet transactions"""
    try:
        # Get user's wallet
        wallet = await wallet_service.get_user_wallet(current_user.id)

        if not wallet:
            return []

        transactions = await wallet_service.get_wallet_transactions(
            wallet.id, limit, offset
        )

        return transactions

    except Exception as e:
        logger.error(f"Failed to get user transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_transactions",
        )


@router.get("/{wallet_id}/transactions", response_model=List[TransactionResponse])
async def get_wallet_transactions(
    wallet_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_active_user),
):
    """Get transactions for a specific wallet"""
    try:
        wallet = await wallet_service.get_wallet(wallet_id)

        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found"
            )

        # Check authorization
        if (
            wallet.user_id
            and wallet.user_id != current_user.id
            and current_user.role not in ["ADMIN"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_transactions",
            )

        if wallet.organization_id:
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": wallet.organization_id,
                    "userId": current_user.id,
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_transactions",
                )

        transactions = await wallet_service.get_wallet_transactions(
            wallet_id, limit, offset
        )

        return transactions

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get wallet transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_transactions",
        )


@router.post("/transfer")
async def transfer_funds(
    request: WalletTransferRequest, current_user=Depends(get_current_active_user)
):
    """Transfer funds between wallets.

    Disabled in NON_CUSTODIAL mode: PodaPoints are documented as
    non-transferable utility credits, and wallet-to-wallet movement is the
    behaviour that makes a closed-loop credit look like a payment instrument.
    """
    if (
        getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
        == FinancialMode.NON_CUSTODIAL
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.billing.custodial_transfers_disabled",
        )
    try:
        # Verify source wallet belongs to user
        from_wallet = await wallet_service.get_wallet(request.from_wallet_id)

        if not from_wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.source_wallet_not_found",
            )

        # Check authorization for source wallet
        if (
            from_wallet.user_id
            and from_wallet.user_id != current_user.id
            and current_user.role not in ["ADMIN"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.billing.not_authorized_transfer",
            )

        if from_wallet.organization_id:
            # Check if user has transfer permission in organization
            membership = await prisma.organizationmember.find_first(
                where={
                    "organizationId": from_wallet.organization_id,
                    "userId": current_user.id,
                    "role": {"in": ["OWNER", "ADMIN", "FINANCE"]},
                }
            )
            if not membership and current_user.role not in ["ADMIN"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_org_transfer",
                )

        # SECURITY (P0): destination wallet must also be owned/controlled by the
        # caller (or an organization the caller manages), unless ADMIN. This
        # prevents both self-transfer minting and moving funds into wallets the
        # caller does not control.
        to_wallet = await wallet_service.get_wallet(request.to_wallet_id)
        if not to_wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.destination_wallet_not_found",
            )
        if current_user.role != "ADMIN":
            if to_wallet.user_id and to_wallet.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="errors.billing.not_authorized_destination_wallet",
                )
            if to_wallet.organization_id:
                membership = await prisma.organizationmember.find_first(
                    where={
                        "organizationId": to_wallet.organization_id,
                        "userId": current_user.id,
                        "role": {"in": ["OWNER", "ADMIN", "FINANCE"]},
                    }
                )
                if not membership:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="errors.billing.not_authorized_destination_wallet",
                    )

        # Execute transfer
        result = await wallet_service.transfer_funds(request)

        return {
            "success": True,
            "transfer_id": f"transfer_{request.from_wallet_id}_to_{request.to_wallet_id}",
            "from_wallet": result["from_wallet"],
            "to_wallet": result["to_wallet"],
            "amount": request.amount,
            "purpose": request.purpose.value,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to transfer funds: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_transfer",
        )


@router.get("/me/balance/available")
async def get_available_balance(current_user=Depends(get_current_active_user)):
    """Get available balance (balance minus holds)"""
    try:
        wallet = await wallet_service.get_user_wallet(current_user.id)

        if not wallet:
            return {"available_balance": 0}

        available = await wallet_service.get_available_balance(wallet.id)

        return {
            "wallet_id": wallet.id,
            "total_balance": wallet.podaPoints,
            "hold_balance": 0,
            "available_balance": available,
        }

    except Exception as e:
        logger.error(f"Failed to get available balance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_balance",
        )


@router.post("/deposit")
async def deposit_to_wallet(
    amount: int,
    description: Optional[str] = None,
    current_user=Depends(get_current_active_user),
):
    """Initiate deposit to wallet.

    Disabled in NON_CUSTODIAL mode — the platform does not hold customer fiat.
    PodaPoints are bought through POST /wallets/poda-points/purchase, which is
    a plain product sale routed through Chargily.
    """
    if (
        getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
        == FinancialMode.NON_CUSTODIAL
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.billing.custodial_deposits_disabled",
        )
    try:
        if amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.billing.amount_must_be_positive",
            )

        # Get or create user wallet
        wallet = await wallet_service.ensure_user_wallet(current_user.id)

        # Create payment request for deposit - USE MOCK FOR TESTING
        from app.schemas.payment import (
            PaymentInitiateRequest,
            PaymentGateway,
            PaymentPurpose,
        )
        from app.services.payment_service import payment_service

        payment_request = PaymentInitiateRequest(
            user_id=current_user.id,
            amount=amount,
            currency="DZD",
            purpose=PaymentPurpose.DEPOSIT,
            gateway=PaymentGateway.CHARGILY,
            success_url=f"{setting.FRONTEND_URL}/wallet/deposit/success",
            failure_url=f"{setting.FRONTEND_URL}/wallet/deposit/failure",
            metadata={
                "wallet_id": wallet.id,
                "deposit_description": description,
                "user_id": current_user.id,
            },
        )

        # Initiate payment
        payment = await payment_service.initiate_payment(payment_request)

        return {"deposit_initiated": True, "payment": payment, "wallet_id": wallet.id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initiate deposit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_initiate_deposit",
        )


# Admin endpoints
@router.get("/admin/all", response_model=List[WalletResponse])
async def admin_get_all_wallets(
    user_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    min_balance: Optional[int] = None,
    max_balance: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    admin=Depends(require_permissions("finance:wallets:read")),
):
    """Admin: Get all wallets (requires finance:wallets:read)"""
    try:
        where_clause: dict[str, Any] = {}

        if user_id:
            where_clause["userId"] = user_id

        if organization_id:
            where_clause["organizationId"] = organization_id

        if is_active is not None:
            where_clause["isActive"] = is_active

        if min_balance is not None or max_balance is not None:
            where_clause["podaPoints"] = {}
            if min_balance is not None:
                where_clause["podaPoints"]["gte"] = min_balance
            if max_balance is not None:
                where_clause["podaPoints"]["lte"] = max_balance

        wallets = await prisma.wallet.find_many(
            where=where_clause,
            include={"user": True, "organization": True},
            order={"createdAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [WalletResponse.from_orm(wallet) for wallet in wallets]

    except Exception as e:
        logger.error(f"Admin failed to get wallets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_wallets_list",
        )


@router.get("/admin/summary")
async def admin_wallet_summary(
    admin=Depends(require_permissions("finance:wallets:read")),
):
    """Admin: platform-wide wallet aggregates.

    The billing console used to render hardcoded balances (18,450,000 DZD etc.)
    under a compliance badge. This endpoint supplies the real numbers so the
    console cannot display invented money.

    All three pillars are expressed in PodaPoints, which the platform keeps at
    1:1 with DZD for reporting; payouts are requested and recorded in the same
    unit (see ``WalletService.request_withdrawal``).
    """
    wallets = await prisma.wallet.find_many(where={"isActive": True})
    total_points = sum(wallet.podaPoints or 0 for wallet in wallets)

    escrow_holds = await prisma.escrowhold.find_many(
        where={"status": {"in": ["HOLD", "PARTIALLY_RELEASED"]}}
    )
    held_in_escrow = sum(
        max(0, hold.amount - (getattr(hold, "releasedAmount", 0) or 0))
        for hold in escrow_holds
    )

    pending_payouts = await prisma.payout.find_many(
        where={"status": {"in": ["PENDING", "PENDING_CHECKER_APPROVAL"]}}
    )
    pending_payouts_total = sum(payout.amount for payout in pending_payouts)

    return {
        "currency": "PODAPOINT",
        "wallet_count": len(wallets),
        "total_poda_points": total_points,
        "held_in_escrow_points": held_in_escrow,
        "pending_payouts_points": pending_payouts_total,
        "pending_payout_count": len(pending_payouts),
        "available_poda_points": total_points - held_in_escrow - pending_payouts_total,
    }


@router.post("/admin/{wallet_id}/adjust")
async def admin_adjust_wallet_balance(
    wallet_id: int,
    adjustment: int,
    reason: str,
    idempotency_key: Optional[str] = None,
    admin=Depends(require_permissions("finance:wallets:adjust")),
):
    """Admin: Adjust wallet balance (manual correction).

    Guard rails added because this endpoint mints/destroys points directly:
      * requires the granular ``finance:wallets:adjust`` permission (was: any
        user with the legacy ``role == "ADMIN"`` flag);
      * capped below the maker-checker threshold so no single administrator can
        move a high-value amount alone;
      * a meaningful reason is mandatory;
      * replayable ``idempotency_key`` so a double-submit cannot double-credit.
    """
    if adjustment == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="adjustment must be non-zero",
        )
    if abs(adjustment) > MAX_ADMIN_ADJUSTMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Adjustment exceeds the single-operator cap",
                "code": "ADJUSTMENT_EXCEEDS_CAP",
                "cap": MAX_ADMIN_ADJUSTMENT,
            },
        )
    if len((reason or "").strip()) < MIN_ADJUSTMENT_REASON_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "reason must be at least " f"{MIN_ADJUSTMENT_REASON_LENGTH} characters"
            ),
        )

    reference_id = (
        f"ADMIN_ADJUST_{admin.id}_{idempotency_key}"
        if idempotency_key
        else f"ADMIN_ADJUST_{admin.id}_{uuid.uuid4().hex}"
    )

    try:
        async with prisma.tx() as tx:
            # Lock the wallet before the idempotency lookup so a replayed key
            # cannot slip between the check and the mutation.
            await tx.execute_raw(
                'SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE', wallet_id
            )
            wallet = await tx.wallet.find_unique(where={"id": wallet_id})

            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found"
                )

            # Idempotency: a replayed key returns the original outcome instead of
            # applying the adjustment a second time.
            if idempotency_key:
                existing = await tx.wallettransaction.find_first(
                    where={"referenceId": reference_id}
                )
                if existing:
                    return {
                        "success": True,
                        "idempotent_replay": True,
                        "wallet_id": wallet_id,
                        "adjustment": adjustment,
                        "previous_balance": existing.previousBalance,
                        "new_balance": existing.newBalance,
                        "reason": reason,
                    }

            previous_balance = wallet.podaPoints

            if adjustment > 0:
                # Credit wallet
                updated = await wallet_service.credit_wallet(
                    wallet_id=wallet_id,
                    amount=adjustment,
                    purpose=PaymentPurpose.TRANSFER,
                    reference_id=reference_id,
                    description=f"Admin adjustment: {reason}",
                    tx=tx,
                    # A correction is not a sale: don't write a COMPLETED
                    # Transaction row that revenue reports would count.
                    skip_transaction=True,
                )
            else:
                # Debit wallet (absolute value)
                updated = await wallet_service.debit_wallet(
                    wallet_id=wallet_id,
                    amount=abs(adjustment),
                    purpose=PaymentPurpose.TRANSFER,
                    reference_id=reference_id,
                    description=f"Admin adjustment: {reason}",
                    tx=tx,
                    skip_transaction=True,
                )

            # Log admin action inside the same transaction: an adjustment that
            # commits without its audit row is unauditable.
            await tx.auditlog.create(
                data={
                    "actorId": admin.id,
                    "eventType": "WALLET_BALANCE_ADJUSTMENT",
                    "entityType": "Wallet",
                    "entityId": str(wallet_id),
                    "metadata": Json(
                        {
                            "adjustment": adjustment,
                            "reason": reason,
                            "reference_id": reference_id,
                            "previous_balance": previous_balance,
                            "new_balance": updated.poda_points,
                        }
                    ),
                    "createdAt": datetime.now(timezone.utc),
                }
            )

        return {
            "success": True,
            "wallet_id": wallet_id,
            "adjustment": adjustment,
            "previous_balance": previous_balance,
            "new_balance": updated.poda_points,
            "reason": reason,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to adjust wallet balance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_adjust",
        )


@router.post("/admin/{wallet_id}/status")
async def admin_update_wallet_status(
    wallet_id: int,
    is_active: bool,
    admin=Depends(require_permissions("finance:wallets:adjust")),
):
    """Admin: Activate or deactivate wallet"""
    try:
        await wallet_service.update_wallet_status(wallet_id, is_active)

        # Log admin action
        await prisma.auditlog.create(
            data={
                "actorId": admin.id,
                "eventType": "WALLET_STATUS_UPDATE",
                "entityType": "Wallet",
                "entityId": str(wallet_id),
                "metadata": Json({"is_active": is_active}),
                "createdAt": datetime.now(timezone.utc),
            }
        )

        return {
            "success": True,
            "wallet_id": wallet_id,
            "is_active": is_active,
            "message": f"Wallet {'activated' if is_active else 'deactivated'}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to update wallet status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_update_status",
        )


# =====================
# WITHDRAWAL ENDPOINTS
# =====================


@router.post("/withdraw")
async def request_withdrawal(
    amount: int,
    bank_name: Optional[str] = None,
    account_number: Optional[str] = None,
    account_holder_name: Optional[str] = None,
    notes: Optional[str] = None,
    current_user=Depends(get_current_active_user),
):
    """Request withdrawal from wallet - requires admin approval"""
    if (
        getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
        == FinancialMode.NON_CUSTODIAL
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.billing.custodial_withdrawals_disabled",
        )
    try:
        # Validate minimum amount (1000 DZD)
        if amount < 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.billing.minimum_withdrawal_amount",
            )

        # Get user's wallet
        wallet = await wallet_service.get_user_wallet(current_user.id)

        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.wallet_not_found",
            )

        # Validate Algerian RIB if account number is provided
        if account_number:
            is_valid_rib, rib_err, rib_info = validate_algerian_rib(account_number)
            if not is_valid_rib:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.billing.invalid_algerian_rib",
                )
            if rib_info and not bank_name:
                bank_name = rib_info.bank_name

        # Create withdrawal request
        result = await wallet_service.request_withdrawal(
            wallet_id=wallet.id,
            user_id=current_user.id,
            amount=amount,
            bank_name=bank_name,
            account_number=account_number,
            account_holder_name=account_holder_name,
            notes=notes,
        )

        return {
            "success": True,
            "message": "Withdrawal request submitted for approval",
            "withdrawal": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to request withdrawal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.withdrawal_request_failed",
        )


@router.get("/me/withdrawals")
async def get_my_withdrawals(
    limit: int = 50, offset: int = 0, current_user=Depends(get_current_active_user)
):
    """Get current user's withdrawal history"""
    try:
        wallet = await wallet_service.get_user_wallet(current_user.id)
        if not wallet:
            return []

        withdrawals = await wallet_service.get_user_withdrawals(
            wallet.id, limit, offset
        )
        return withdrawals

    except Exception as e:
        logger.error(f"Failed to get user withdrawals: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_withdrawals",
        )


# Admin withdrawal management endpoints
@router.get("/admin/withdrawals")
async def admin_get_withdrawals(
    status_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    admin=Depends(require_permissions("finance:payouts:read")),
):
    """Admin: Get all pending withdrawals"""
    try:
        withdrawals = await wallet_service.get_pending_withdrawals(limit, offset)
        return {
            "withdrawals": withdrawals,
            "total": len(withdrawals),
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        logger.error(f"Admin failed to get withdrawals: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.failed_to_get_withdrawals",
        )


@router.post("/admin/withdrawals/{payout_id}/maker-review")
async def admin_maker_review_withdrawal(
    payout_id: int,
    admin_notes: Optional[str] = None,
    admin=Depends(require_permissions("finance:payouts:approve")),
):
    """Admin: Maker review phase for high-value payouts (SoD Dual Control)"""
    try:
        result = await wallet_service.maker_review_withdrawal(
            payout_id=payout_id, admin_id=admin.id, admin_notes=admin_notes
        )

        # Cryptographic Audit Vault Logging
        await AuditTrailService.log_action(
            actor_id=admin.id,
            action="WITHDRAWAL_MAKER_REVIEWED",
            domain="FINANCE",
            resource_type="Payout",
            resource_id=str(payout_id),
            metadata={
                "status": "PENDING_CHECKER_APPROVAL",
                "admin_notes": admin_notes,
                "amount": result["amount"],
            },
        )

        return {
            "success": True,
            "message": "Withdrawal marked as reviewed by Maker. Awaiting Checker authorization.",
            "withdrawal": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed maker review for withdrawal {payout_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.withdrawal_maker_review_failed",
        )


@router.post("/admin/withdrawals/{payout_id}/approve")
async def admin_approve_withdrawal(
    payout_id: int,
    admin_notes: Optional[str] = None,
    admin=Depends(require_permissions("finance:payouts:approve")),
):
    """Admin: Approve a withdrawal request with cryptographic audit logging and SoD verification"""
    try:
        result = await wallet_service.approve_withdrawal(
            payout_id=payout_id, admin_id=admin.id, admin_notes=admin_notes
        )

        # Cryptographic Audit Vault Logging
        await AuditTrailService.log_action(
            actor_id=admin.id,
            action="WITHDRAWAL_APPROVED",
            domain="FINANCE",
            resource_type="Payout",
            resource_id=str(payout_id),
            metadata={
                "status": "COMPLETED",
                "admin_notes": admin_notes,
                "amount": result["amount"],
            },
        )

        return {
            "success": True,
            "message": "Withdrawal approved and processed",
            "withdrawal": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to approve withdrawal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.withdrawal_approval_failed",
        )


@router.post("/admin/withdrawals/{payout_id}/reject")
async def admin_reject_withdrawal(
    payout_id: int,
    admin_notes: str,
    admin=Depends(require_permissions("finance:payouts:reject")),
):
    """Admin: Reject a withdrawal request with cryptographic audit logging"""
    if not admin_notes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.billing.rejection_reason_required",
        )

    try:
        result = await wallet_service.reject_withdrawal(payout_id, admin_notes)

        # Cryptographic Audit Vault Logging
        await AuditTrailService.log_action(
            actor_id=admin.id,
            action="WITHDRAWAL_REJECTED",
            domain="FINANCE",
            resource_type="Payout",
            resource_id=str(payout_id),
            metadata={
                "status": "REJECTED",
                "admin_notes": admin_notes,
                "amount": result["amount"],
            },
        )

        return {"success": True, "message": "Withdrawal rejected", "withdrawal": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin failed to reject withdrawal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="errors.billing.withdrawal_rejection_failed",
        )


# ── PodaPoints endpoints ──────────────────────────────────────────────────────


@router.get("/me/balance")
async def get_poda_points_balance(current_user=Depends(get_current_active_user)):
    """Get current user's PodaPoints balance"""
    balance = await poda_points_service.get_balance(current_user.id)
    return {"poda_points": balance}


@router.post("/poda-points/purchase")
async def purchase_poda_points(
    amount: int = Body(..., ge=200, le=20000, embed=True),
    current_user=Depends(get_current_active_user),
):
    """Purchase PodaPoints — redirects to Chargily checkout"""
    result = await poda_points_service.purchase_points(current_user.id, amount)
    return result


class SpendPodaPointsRequest(BaseModel):
    feature_key: str
    reference_id: Optional[str] = None
    quantity: int = 1


@router.post("/poda-points/spend")
async def spend_poda_points(
    req: SpendPodaPointsRequest,
    current_user=Depends(get_current_active_user),
):
    """Spend PodaPoints on a platform feature.

    Accepts a JSON body (the web client always sent one; the old query-parameter
    signature rejected it with 422) and delegates to the same atomic
    debit-plus-grant path as ``POST /features/purchase`` so points can never be
    burned without the feature being delivered.
    """
    try:
        return await feature_service.purchase_with_points(
            current_user.id,
            req.feature_key,
            reference_id=req.reference_id,
            quantity=req.quantity,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
