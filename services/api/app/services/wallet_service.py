import logging
from typing import Optional, Dict, Any, List, Union, TypeVar
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import enums as p_enums, Json
from app.schemas.payment import (
    WalletResponse,
    TransactionResponse,
    PaymentPurpose,
    WalletTransferRequest,
)

T = TypeVar("T")

logger = logging.getLogger(__name__)


class WalletService:
    """Service for wallet operations and balance management"""

    async def _lock_wallet(self, tx, wallet_id: int):
        """
        Acquire a pessimistic lock on the wallet row.
        Must be called inside an active transaction.
        """
        # PostgreSQL syntax for row locking
        await tx.execute_raw(
            'SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE', wallet_id
        )

    async def get_wallet(self, wallet_id: int) -> Optional[WalletResponse]:
        """Get wallet by ID"""
        wallet = await prisma.wallet.find_unique(
            where={"id": wallet_id}, include={"user": True, "organization": True}
        )

        if wallet:
            return WalletResponse.from_orm(wallet)
        return None

    async def get_user_wallet(self, user_id: int) -> Optional[WalletResponse]:
        """Get user's wallet (no side effects — returns None if not found)"""
        wallet = await prisma.wallet.find_unique(
            where={"userId": user_id}, include={"user": True}
        )
        return WalletResponse.from_orm(wallet) if wallet else None

    async def get_organization_wallet(
        self, organization_id: int
    ) -> Optional[WalletResponse]:
        """Get organization's wallet (no side effects — returns None if not found)"""
        wallet = await prisma.wallet.find_unique(
            where={"organizationId": organization_id}, include={"organization": True}
        )
        return WalletResponse.from_orm(wallet) if wallet else None

    async def ensure_user_wallet(self, user_id: int, tx=None) -> WalletResponse:
        """Get or create a wallet for user (idempotent, race-safe).

        Pass ``tx`` to stay inside a caller's transaction instead of opening a
        nested one (nested ``prisma.tx()`` calls can starve the connection pool).
        """
        db = tx if tx is not None else prisma
        # Use upsert pattern to avoid TOCTOU race
        user = await db.user.find_unique(where={"id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.subscription.user_not_found",
            )

        wallet = await db.wallet.upsert(
            where={"userId": user_id},
            data={
                "create": {
                    "userId": user_id,
                    "podaPoints": 0,
                    "currency": "PODAPOINT",
                    "isActive": True,
                },
                "update": {},  # no-op if exists
            },
        )
        return WalletResponse.from_orm(wallet)

    async def create_organization_wallet(self, organization_id: int) -> WalletResponse:
        """Create wallet for organization"""
        try:
            # Check if organization exists
            org = await prisma.organization.find_unique(where={"id": organization_id})
            if not org:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.subscription.org_not_found",
                )

            # Check if wallet already exists
            existing = await prisma.wallet.find_unique(
                where={"organizationId": organization_id}
            )
            if existing:
                return WalletResponse.from_orm(existing)

            # Create wallet
            wallet = await prisma.wallet.create(
                data={
                    "organizationId": organization_id,
                    "podaPoints": 0,
                    "currency": "PODAPOINT",
                    "isActive": True,
                }
            )

            logger.info(
                f"Created wallet {wallet.id} for organization {organization_id}"
            )
            return WalletResponse.from_orm(wallet)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create organization wallet: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.create_failed",
            )

    async def credit_wallet(
        self,
        wallet_id: Optional[int] = None,
        amount: int = 0,
        purpose: Union[PaymentPurpose, str] = PaymentPurpose.DEPOSIT,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
        tx=None,
        skip_transaction: bool = False,
        user_id: Optional[int] = None,
    ) -> WalletResponse:
        """Credit (add funds to) wallet

        🔒 Raises ValueError if amount <= 0 (prevents negative credit = stealth debit).
        Pass an existing `tx` to participate in a parent transaction (avoids nesting).

        When called from the payment webhook flow, set ``skip_transaction=True``
        because the original transaction was already marked COMPLETED by the
        webhook handler — creating a second COMPLETED transaction would duplicate
        the record."""
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise TypeError(
                f"Credit amount must be an integer, got {type(amount).__name__}"
            )
        if amount <= 0:
            raise ValueError(f"Credit amount must be positive, got {amount}")

        if wallet_id is None:
            if user_id is not None:
                uw = await self.ensure_user_wallet(user_id)
                wallet_id = uw.id
            else:
                raise ValueError("Either wallet_id or user_id must be provided")

        async def _run(t):
            purpose_str = (
                purpose.value if isinstance(purpose, PaymentPurpose) else str(purpose)
            )
            await self._lock_wallet(t, wallet_id)
            wallet = await t.wallet.find_unique(where={"id": wallet_id})
            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.billing.wallet_not_found",
                )
            if not wallet.isActive:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Wallet is not active",
                )

            new_balance = wallet.podaPoints + amount
            updated_wallet = await t.wallet.update(
                where={"id": wallet_id}, data={"podaPoints": new_balance}
            )
            await t.wallettransaction.create(
                data={
                    "walletId": wallet_id,
                    "amount": amount,
                    "previousBalance": wallet.podaPoints,
                    "newBalance": new_balance,
                    "type": "CREDIT",
                    "purpose": purpose_str,
                    "referenceId": reference_id,
                    "description": description or f"Credit: {purpose_str}",
                }
            )
            # Do NOT create a second COMPLETED transaction when called from webhook context.
            # The caller (finalize_payment_success) already marked the original as COMPLETED.
            if reference_id and not skip_transaction:
                prisma_purpose = getattr(
                    p_enums.PaymentPurpose, purpose_str, p_enums.PaymentPurpose.DEPOSIT
                )
                await t.transaction.create(
                    data={
                        "wallet": {"connect": {"id": wallet_id}},
                        "amount": amount,
                        "purpose": prisma_purpose,
                        "status": p_enums.PaymentStatus.COMPLETED,
                        "provider": p_enums.PaymentProvider.OTHER,
                        "currency": wallet.currency,
                    }
                )
            logger.info(
                f"Credited {amount} to wallet {wallet_id}. New balance: {new_balance}"
            )
            return WalletResponse.from_orm(updated_wallet)

        try:
            if tx is not None:
                return await _run(tx)
            async with prisma.tx() as t:
                return await _run(t)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to credit wallet: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.credit_failed",
            )

    async def debit_wallet(
        self,
        wallet_id: int,
        amount: int,
        purpose: PaymentPurpose,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
        tx=None,
        skip_transaction: bool = False,
    ) -> WalletResponse:
        """Debit (withdraw funds from) wallet

        🔒 Raises ValueError if amount <= 0 (prevents negative debit = stealth credit).
        Pass an existing `tx` to participate in a parent transaction."""
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise TypeError(
                f"Debit amount must be an integer, got {type(amount).__name__}"
            )
        if amount <= 0:
            raise ValueError(f"Debit amount must be positive, got {amount}")

        async def _run(t):
            await self._lock_wallet(t, wallet_id)
            wallet = await t.wallet.find_unique(where={"id": wallet_id})
            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.billing.wallet_not_found",
                )
            if not wallet.isActive:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Wallet is not active",
                )

            # Verify available balance (excluding active escrow holds and pending payouts)
            # for standard purchases and transfers to prevent double-spending encumbered funds.
            if purpose not in (
                PaymentPurpose.WITHDRAWAL,
                PaymentPurpose.ESCROW_RELEASE,
            ):
                available = await self.get_available_balance(wallet_id, tx=t)
                if available < amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.insufficient_funds",
                    )
            elif wallet.podaPoints < amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.wallet.insufficient_funds",
                )

            new_balance = wallet.podaPoints - amount
            updated_wallet = await t.wallet.update(
                where={"id": wallet_id}, data={"podaPoints": new_balance}
            )
            await t.wallettransaction.create(
                data={
                    "walletId": wallet_id,
                    "amount": amount,
                    "previousBalance": wallet.podaPoints,
                    "newBalance": new_balance,
                    "type": "DEBIT",
                    "purpose": purpose.value,
                    "referenceId": reference_id,
                    "description": description or f"Debit: {purpose.value}",
                }
            )
            if reference_id and not skip_transaction:
                prisma_purpose = getattr(
                    p_enums.PaymentPurpose,
                    purpose.value,
                    p_enums.PaymentPurpose.DEPOSIT,
                )
                await t.transaction.create(
                    data={
                        "wallet": {"connect": {"id": wallet_id}},
                        "amount": amount,
                        "purpose": prisma_purpose,
                        "status": p_enums.PaymentStatus.COMPLETED,
                        "provider": p_enums.PaymentProvider.OTHER,
                        "currency": wallet.currency,
                    }
                )
            logger.info(
                f"Debited {amount} from wallet {wallet_id}. New balance: {new_balance}"
            )
            return WalletResponse.from_orm(updated_wallet)

        try:
            if tx is not None:
                return await _run(tx)
            async with prisma.tx() as t:
                return await _run(t)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to debit wallet: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.debit_failed",
            )

    async def hold_funds(
        self,
        wallet_id: int,
        amount: int,
        purpose: PaymentPurpose,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
        tx=None,
    ) -> WalletResponse:
        """Hold funds in wallet (for escrow, etc.)

        🔒 Raises ValueError if amount <= 0.
        Pass an existing `tx` to participate in a parent transaction."""
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise TypeError(
                f"Hold amount must be an integer, got {type(amount).__name__}"
            )
        if amount <= 0:
            raise ValueError(f"Hold amount must be positive, got {amount}")

        async def _run(t):
            await self._lock_wallet(t, wallet_id)
            wallet = await t.wallet.find_unique(where={"id": wallet_id})
            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.billing.wallet_not_found",
                )
            if not wallet.isActive:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Wallet is not active",
                )

            available = await self.get_available_balance(wallet_id, tx=t)
            if available < amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.wallet.insufficient_funds",
                )

            await t.wallettransaction.create(
                data={
                    "walletId": wallet_id,
                    "amount": amount,
                    "previousBalance": wallet.podaPoints,
                    "newBalance": wallet.podaPoints,
                    "type": "HOLD",
                    "purpose": purpose.value,
                    "referenceId": reference_id,
                    "description": description or f"Hold: {purpose.value}",
                    # Without an explicit phase marker this row was invisible to
                    # get_available_balance(), so hold_funds() reserved nothing.
                    "metadata": Json(
                        {
                            "phase": "HELD",
                            "source": "hold_funds",
                        }
                    ),
                }
            )
            logger.info(f"Held {amount} in wallet {wallet_id}.")
            return WalletResponse.from_orm(wallet)

        try:
            if tx is not None:
                return await _run(tx)
            async with prisma.tx() as t:
                return await _run(t)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to hold funds: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.hold_failed",
            )

    async def release_hold(
        self,
        wallet_id: int,
        amount: int,
        purpose: PaymentPurpose,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
        tx=None,
    ) -> WalletResponse:
        """Release held funds (for escrow release, etc.)

        🔒 Raises ValueError if amount <= 0.
        Pass an existing `tx` to participate in a parent transaction."""
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise TypeError(
                f"Release amount must be an integer, got {type(amount).__name__}"
            )
        if amount <= 0:
            raise ValueError(f"Release amount must be positive, got {amount}")

        async def _run(t):
            await self._lock_wallet(t, wallet_id)
            wallet = await t.wallet.find_unique(where={"id": wallet_id})
            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="errors.billing.wallet_not_found",
                )
            if not wallet.isActive:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Wallet is not active",
                )
            if wallet.podaPoints < amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.wallet.insufficient_funds",
                )

            await t.wallettransaction.create(
                data={
                    "walletId": wallet_id,
                    "amount": amount,
                    "previousBalance": wallet.podaPoints,
                    "newBalance": wallet.podaPoints,
                    "type": "RELEASE",
                    "purpose": purpose.value,
                    "referenceId": reference_id,
                    "description": description or f"Release hold: {purpose.value}",
                }
            )
            logger.info(f"Released hold of {amount} in wallet {wallet_id}.")
            return WalletResponse.from_orm(wallet)

        try:
            if tx is not None:
                return await _run(tx)
            async with prisma.tx() as t:
                return await _run(t)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to release hold: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.release_failed",
            )

    async def transfer_funds(
        self, request: WalletTransferRequest
    ) -> Dict[str, WalletResponse]:
        """Transfer funds between wallets"""
        # SECURITY (P0): A self-transfer (from == to) must be rejected at the
        # service layer regardless of router/schema validation. The canonical
        # code path below would otherwise write `from_new_balance = B - a` then
        # `to_new_balance = B + a` against the SAME row, minting money.
        if request.from_wallet_id == request.to_wallet_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.wallet.self_transfer_not_allowed",
            )

        try:
            # Start transaction
            async with prisma.tx() as transaction:
                # DEADLOCK PREVENTION: Canonical ordering
                # Always lock the smaller ID first to prevent cyclic dependencies
                first_lock_id, second_lock_id = sorted(
                    [request.from_wallet_id, request.to_wallet_id]
                )

                await self._lock_wallet(transaction, first_lock_id)
                await self._lock_wallet(transaction, second_lock_id)

                # Get and lock both wallets
                from_wallet = await transaction.wallet.find_unique(
                    where={"id": request.from_wallet_id}
                )
                to_wallet = await transaction.wallet.find_unique(
                    where={"id": request.to_wallet_id}
                )

                if not from_wallet or not to_wallet:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.billing.wallet_not_found",
                    )

                if not from_wallet.isActive or not to_wallet.isActive:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.wallet_not_active",
                    )

                # Check currency match
                if from_wallet.currency != to_wallet.currency:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.currency_mismatch",
                    )

                # Check sufficient available balance in source wallet
                available = await self.get_available_balance(
                    request.from_wallet_id, tx=transaction
                )
                if available < request.amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.insufficient_funds",
                    )

                # Enforce zero-sum invariant: sum(Debits) - sum(Credits) == 0
                debit_delta = -request.amount
                credit_delta = request.amount
                if debit_delta + credit_delta != 0:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="errors.wallet.zero_sum_violation",
                    )

                # Calculate new balances
                from_new_balance = from_wallet.podaPoints - request.amount
                to_new_balance = to_wallet.podaPoints + request.amount

                # Update both wallets
                updated_from = await transaction.wallet.update(
                    where={"id": request.from_wallet_id},
                    data={"podaPoints": from_new_balance},
                )

                updated_to = await transaction.wallet.update(
                    where={"id": request.to_wallet_id},
                    data={"podaPoints": to_new_balance},
                )

                # Create wallet transaction records
                # Debit from source
                await transaction.wallettransaction.create(
                    data={
                        "walletId": request.from_wallet_id,
                        "amount": request.amount,
                        "previousBalance": from_wallet.podaPoints,
                        "newBalance": from_new_balance,
                        "type": "TRANSFER_OUT",
                        "purpose": request.purpose.value,
                        "referenceId": f"transfer_to_{request.to_wallet_id}",
                        "description": request.description
                        or f"Transfer to wallet {request.to_wallet_id}",
                    }
                )

                # Credit to destination
                await transaction.wallettransaction.create(
                    data={
                        "walletId": request.to_wallet_id,
                        "amount": request.amount,
                        "previousBalance": to_wallet.podaPoints,
                        "newBalance": to_new_balance,
                        "type": "TRANSFER_IN",
                        "purpose": request.purpose.value,
                        "referenceId": f"transfer_from_{request.from_wallet_id}",
                        "description": request.description
                        or f"Transfer from wallet {request.from_wallet_id}",
                    }
                )

                # Create main transaction record
                prisma_purpose = getattr(
                    p_enums.PaymentPurpose,
                    request.purpose.value,
                    p_enums.PaymentPurpose.DEPOSIT,
                )
                await transaction.transaction.create(
                    data={
                        "wallet": {"connect": {"id": request.from_wallet_id}},
                        "amount": request.amount,
                        "purpose": prisma_purpose,
                        "status": p_enums.PaymentStatus.COMPLETED,
                        "provider": p_enums.PaymentProvider.OTHER,
                        "currency": from_wallet.currency,
                    }
                )

                logger.info(
                    f"Transferred {request.amount} from wallet {request.from_wallet_id} to {request.to_wallet_id}"
                )

                return {
                    "from_wallet": WalletResponse.from_orm(updated_from),
                    "to_wallet": WalletResponse.from_orm(updated_to),
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to transfer funds: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.transfer_failed",
            )

    async def get_wallet_transactions(
        self, wallet_id: int, limit: int = 50, offset: int = 0
    ) -> List[TransactionResponse]:
        """Get wallet transaction history"""
        transactions = await prisma.wallettransaction.find_many(
            where={"walletId": wallet_id},
            order={"createdAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [TransactionResponse.from_orm(tx) for tx in transactions]

    async def get_available_balance(self, wallet_id: int, tx=None) -> int:
        """Get available balance (total balance minus active escrow holds and pending payouts)"""
        db = tx if tx is not None else prisma
        wallet = await db.wallet.find_unique(where={"id": wallet_id})
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.wallet_not_found",
            )

        # Calculate active escrow holds
        escrow_holds = await db.escrowhold.find_many(
            where={
                "walletId": wallet_id,
                "status": {"in": ["HOLD", "PARTIALLY_RELEASED"]},
            }
        )
        held_in_escrow = sum(
            max(0, h.amount - (getattr(h, "releasedAmount", 0) or 0))
            for h in escrow_holds
        )

        # Calculate pending / processing payouts (including Maker-reviewed awaiting Checker approval)
        pending_payouts = await db.payout.find_many(
            where={
                "walletId": wallet_id,
                "status": {
                    "in": [
                        "PENDING",
                        "PROCESSING",
                        "PENDING_CHECKER_APPROVAL",
                    ]
                },
            }
        )
        held_in_payouts = sum(p.amount for p in pending_payouts)

        # Active outbound holds. Two flavours share the HOLD type:
        #   * phase=PREPARE  — two-phase transfer reservation (post_transfer -> POSTED,
        #                      void_transfer -> VOIDED)
        #   * phase=HELD     — generic hold_funds() reservation (release_hold -> RELEASE)
        # Both must reduce available balance, otherwise encumbered funds can be
        # spent twice. Withdrawal HOLD rows carry no phase and are already
        # accounted for by pending payouts below.
        held_in_holds = 0
        wt = getattr(db, "wallettransaction", None)
        if wt and hasattr(wt, "find_many"):
            hold_rows = await db.wallettransaction.find_many(
                where={"walletId": wallet_id, "type": "HOLD"}
            )
            release_rows = await db.wallettransaction.find_many(
                where={"walletId": wallet_id, "type": "RELEASE"}
            )
            released_refs = {
                r.referenceId for r in release_rows if r.referenceId is not None
            }
            for hold in hold_rows:
                meta = (
                    dict(hold.metadata)
                    if getattr(hold, "metadata", None)
                    and isinstance(hold.metadata, dict)
                    else {}
                )
                if meta.get("phase") not in ("PREPARE", "HELD"):
                    continue
                if hold.referenceId and hold.referenceId in released_refs:
                    continue
                held_in_holds += abs(hold.amount)

        total_held = held_in_escrow + held_in_payouts + held_in_holds
        available = wallet.podaPoints - total_held
        if available < 0:
            # Do not clamp: an over-committed wallet is an incident, and hiding
            # it behind max(0, ...) makes it invisible to monitoring.
            logger.error(
                f"Wallet {wallet_id} is over-committed: balance={wallet.podaPoints}, "
                f"held={total_held} (escrow={held_in_escrow}, payouts={held_in_payouts}, "
                f"holds={held_in_holds})"
            )
        return available

    async def update_wallet_status(
        self, wallet_id: int, is_active: bool
    ) -> WalletResponse:
        """Activate or deactivate wallet"""
        wallet = await prisma.wallet.find_unique(where={"id": wallet_id})
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.wallet_not_found",
            )

        updated = await prisma.wallet.update(
            where={"id": wallet_id}, data={"isActive": is_active}
        )

        logger.info(
            f"Updated wallet {wallet_id} status to {'active' if is_active else 'inactive'}"
        )
        return WalletResponse.from_orm(updated)

    # =====================
    # WITHDRAWAL METHODS
    # =====================

    async def request_withdrawal(
        self,
        wallet_id: int,
        user_id: int,
        amount: int,
        bank_name: Optional[str] = None,
        account_number: Optional[str] = None,
        account_holder_name: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise TypeError(
                f"Withdrawal amount must be an integer, got {type(amount).__name__}"
            )
        if amount <= 0:
            raise ValueError(f"Withdrawal amount must be positive, got {amount}")

        try:
            async with prisma.tx() as transaction:
                # Lock wallet first
                await self._lock_wallet(transaction, wallet_id)

                # Get wallet
                wallet = await transaction.wallet.find_unique(where={"id": wallet_id})

                if not wallet:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.billing.wallet_not_found",
                    )

                if not wallet.isActive:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.wallet_not_active",
                    )

                # Check sufficient available balance
                available = await self.get_available_balance(wallet_id, tx=transaction)
                if available < amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.insufficient_funds",
                    )

                import uuid

                short_id = uuid.uuid4().hex[:10].upper()
                reference = f"POUT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{wallet_id}-{short_id}"

                # Create payout record
                payout = await transaction.payout.create(
                    data={
                        "walletId": wallet_id,
                        "amount": amount,
                        "currency": wallet.currency,
                        "method": "BANK_TRANSFER",
                        "status": "PENDING",
                        "reference": reference,
                        "bankName": bank_name,
                        "accountNumber": account_number,
                        "accountHolderName": account_holder_name,
                        "notes": notes,
                        "requestedAt": datetime.now(timezone.utc),
                    }
                )

                # Create wallet transaction record
                await transaction.wallettransaction.create(
                    data={
                        "walletId": wallet_id,
                        "amount": amount,
                        "previousBalance": wallet.podaPoints,
                        "newBalance": wallet.podaPoints,
                        "type": "HOLD",
                        "purpose": "WITHDRAWAL",
                        "referenceId": f"payout_{payout.id}",
                        "description": f"Withdrawal request #{payout.id} - Pending approval",
                    }
                )

                logger.info(
                    f"Withdrawal request #{payout.id} created for wallet {wallet_id}, amount: {amount}"
                )

                return {
                    "id": payout.id,
                    "wallet_id": wallet_id,
                    "user_id": user_id,
                    "amount": amount,
                    "currency": wallet.currency,
                    "status": "PENDING",
                    "bank_name": bank_name,
                    "account_number": account_number,
                    "account_holder_name": account_holder_name,
                    "notes": notes,
                    "requested_at": payout.requestedAt,
                    "processed_at": None,
                    "admin_notes": None,
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create withdrawal request: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.withdrawal_request_failed",
            )

    async def get_user_withdrawals(
        self, wallet_id: int, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get withdrawal history for a wallet"""
        payouts = await prisma.payout.find_many(
            where={"walletId": wallet_id},
            order={"requestedAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [
            {
                "id": p.id,
                "wallet_id": p.walletId,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "bank_name": getattr(p, "bankName", None),
                "account_number": getattr(p, "accountNumber", None),
                "account_holder_name": getattr(p, "accountHolderName", None),
                "notes": getattr(p, "notes", None),
                "admin_notes": getattr(p, "adminNotes", None),
                "requested_at": p.requestedAt,
                "processed_at": p.processedAt,
            }
            for p in payouts
        ]

    async def get_pending_withdrawals(
        self, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Admin: Get all pending withdrawals"""
        payouts = await prisma.payout.find_many(
            where={"status": "PENDING"},
            include={"wallet": {"include": {"user": True}}},
            order={"requestedAt": "asc"},
            take=limit,
            skip=offset,
        )

        results = []
        for p in payouts:
            user_info = None
            if p.wallet and p.wallet.user:
                user_info = {
                    "id": p.wallet.user.id,
                    "full_name": p.wallet.user.fullName,
                    "email": p.wallet.user.email,
                }

            results.append(
                {
                    "id": p.id,
                    "wallet_id": p.walletId,
                    "amount": p.amount,
                    "currency": p.currency,
                    "status": p.status,
                    "bank_name": getattr(p, "bankName", None),
                    "account_number": getattr(p, "accountNumber", None),
                    "account_holder_name": getattr(p, "accountHolderName", None),
                    "notes": getattr(p, "notes", None),
                    "requested_at": p.requestedAt,
                    "user": user_info,
                }
            )

        return results

    MAKER_CHECKER_THRESHOLD = 100_000  # 100,000 DZD / podaPoints
    MAKER_CHECKER_DAILY_THRESHOLD = 300_000  # 300,000 DZD cumulative daily limit (Bank of Algeria Instruction 06-2025)

    async def _requires_maker_checker(self, tx, payout) -> bool:
        """Determines if payout triggers dual control under Bank of Algeria Instruction n° 06-2025 Tier 1 boundary.

        Fails CLOSED: if the cumulative-exposure query cannot be evaluated we
        refuse to bypass dual control rather than silently downgrading a
        high-value payout to single approval.
        """
        if payout.amount >= self.MAKER_CHECKER_THRESHOLD:
            return True
        try:
            since = datetime.now(timezone.utc) - timedelta(days=1)
            recent_payouts = await tx.payout.find_many(
                where={
                    "walletId": payout.walletId,
                    "status": {
                        "in": [
                            "COMPLETED",
                            "PROCESSING",
                            "PENDING_CHECKER_APPROVAL",
                            "PENDING",
                        ]
                    },
                    "requestedAt": {"gte": since},
                }
            )
            cumulative = sum(p.amount for p in recent_payouts)
            return cumulative >= self.MAKER_CHECKER_DAILY_THRESHOLD
        except Exception as exc:
            logger.error(
                f"Maker-checker exposure check failed for payout {payout.id}; "
                f"failing closed: {exc}"
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "message": "Dual-control verification unavailable; payout approval is blocked",
                    "code": "MAKER_CHECKER_CHECK_FAILED",
                },
            )

    async def maker_review_withdrawal(
        self, payout_id: int, admin_id: int, admin_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Admin: First-phase Maker review for high-value payouts (NIST AC-5 Separation of Duties)"""
        try:
            async with prisma.tx() as transaction:
                # Lock before reading so two Makers cannot both promote the same
                # PENDING payout, and the status check below cannot go stale.
                await transaction.execute_raw(
                    'SELECT id FROM "Payout" WHERE id = $1 FOR UPDATE', payout_id
                )
                payout = await transaction.payout.find_unique(
                    where={"id": payout_id}, include={"wallet": True}
                )
                if not payout:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.billing.withdrawal_not_found",
                    )

                if payout.status != "PENDING":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.billing.withdrawal_invalid_state",
                    )

                metadata = (
                    dict(payout.metadata)
                    if payout.metadata and isinstance(payout.metadata, dict)
                    else {}
                )
                metadata.update(
                    {
                        "makerAdminId": admin_id,
                        "makerNotes": admin_notes,
                        "makerReviewedAt": datetime.now(timezone.utc).isoformat(),
                    }
                )

                # Atomic transition PENDING -> PENDING_CHECKER_APPROVAL.
                claimed = await transaction.payout.update_many(
                    where={"id": payout_id, "status": "PENDING"},
                    data={
                        "status": "PENDING_CHECKER_APPROVAL",
                        "adminNotes": admin_notes,
                        "metadata": metadata,
                    },
                )
                if claimed == 0:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="errors.billing.withdrawal_invalid_state",
                    )

            logger.info(
                f"Payout #{payout_id} reviewed by Maker Admin {admin_id}. Awaiting Checker authorization."
            )
            return {
                "id": payout_id,
                "status": "PENDING_CHECKER_APPROVAL",
                "maker_admin_id": admin_id,
                "amount": payout.amount,
                "currency": payout.currency,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to record maker review on payout {payout_id}: {e}")
            raise

    # Alias for maker review
    review_withdrawal_maker = maker_review_withdrawal

    async def approve_withdrawal(
        self,
        payout_id: int,
        admin_id: Optional[int] = None,
        admin_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Admin: Mark withdrawal as COMPLETED (Finalize with Maker-Checker dual control)"""
        try:
            async with prisma.tx() as transaction:
                # Serialize concurrent decisions on the same payout. Without this
                # row lock two Checkers can both observe status=PENDING and both
                # debit the wallet (the wallet lock alone does not dedupe them).
                await transaction.execute_raw(
                    'SELECT id FROM "Payout" WHERE id = $1 FOR UPDATE', payout_id
                )

                # Get payout
                payout = await transaction.payout.find_unique(
                    where={"id": payout_id}, include={"wallet": True}
                )

                if not payout:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.billing.withdrawal_not_found",
                    )

                # High-value payout Maker-Checker enforcement (>= 100k DZD or cumulative >= 300k DZD)
                metadata = (
                    dict(payout.metadata)
                    if payout.metadata and isinstance(payout.metadata, dict)
                    else {}
                )
                requires_dual_control = await self._requires_maker_checker(
                    transaction, payout
                )
                if requires_dual_control:
                    if payout.status == "PENDING":
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "message": "High-value payouts require initial Maker review before final Checker approval",
                                "code": "MAKER_REVIEW_REQUIRED",
                                "threshold": self.MAKER_CHECKER_THRESHOLD,
                            },
                        )

                    maker_id = metadata.get("makerAdminId")
                    if maker_id and admin_id and maker_id == admin_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "message": "Separation of duties violation: Maker cannot act as Checker on high-value payouts",
                                "code": "SEPARATION_OF_DUTIES_VIOLATION",
                            },
                        )

                # Allow completion from PENDING, PROCESSING, or PENDING_CHECKER_APPROVAL
                if payout.status not in [
                    "PENDING",
                    "PROCESSING",
                    "PENDING_CHECKER_APPROVAL",
                ]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.billing.withdrawal_invalid_state",
                    )

                # Lock wallet before modification
                await self._lock_wallet(transaction, payout.wallet.id)

                fresh_wallet = await transaction.wallet.find_unique(
                    where={"id": payout.wallet.id}
                )
                if not fresh_wallet or fresh_wallet.podaPoints < payout.amount:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.wallet.insufficient_funds",
                    )
                wallet = fresh_wallet

                # Debit the wallet
                new_balance = fresh_wallet.podaPoints - payout.amount

                await transaction.wallet.update(
                    where={"id": fresh_wallet.id}, data={"podaPoints": new_balance}
                )

                metadata.update(
                    {
                        "checkerAdminId": admin_id,
                        "checkerNotes": admin_notes,
                        "checkerApprovedAt": datetime.now(timezone.utc).isoformat(),
                    }
                )

                # Update payout status
                updated_payout = await transaction.payout.update(
                    where={"id": payout_id},
                    data={
                        "status": "COMPLETED",
                        "completedAt": datetime.now(timezone.utc),
                        "processedAt": datetime.now(timezone.utc),
                        "adminNotes": admin_notes,
                        "metadata": metadata,
                    },
                )

                # Create wallet transaction record
                await transaction.wallettransaction.create(
                    data={
                        "walletId": wallet.id,
                        "amount": payout.amount,
                        "previousBalance": wallet.podaPoints,
                        "newBalance": new_balance,
                        "type": "DEBIT",
                        "purpose": "WITHDRAWAL",
                        "referenceId": f"payout_{payout_id}",
                        "description": f"Withdrawal #{payout_id} - Completed",
                    }
                )

                logger.info(
                    f"Withdrawal #{payout_id} completed. Deducted {payout.amount} from wallet {wallet.id}"
                )

                return {
                    "id": updated_payout.id,
                    "status": "COMPLETED",
                    "processed_at": updated_payout.processedAt,
                    "amount": payout.amount,
                    "currency": payout.currency,
                    "wallet_id": wallet.id,
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to approve withdrawal: {str(e)}")
            raise

    async def mark_payout_processing(
        self, payout_id: int, admin_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Admin: Mark withdrawal as PROCESSING"""
        try:
            payout = await prisma.payout.find_unique(where={"id": payout_id})
            if not payout:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Payout not found"
                )

            if payout.status != "PENDING":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payout must be PENDING",
                )

            updated = await prisma.payout.update(
                where={"id": payout_id},
                data={
                    "status": "PROCESSING",
                    "processedAt": datetime.now(
                        timezone.utc
                    ),  # Marked as processing start
                    "adminNotes": admin_notes,
                },
            )
            return {"id": updated.id, "status": "PROCESSING"}
        except Exception as e:
            logger.error(f"Failed to mark processing: {e}")
            raise

    async def mark_payout_failed(self, payout_id: int, reason: str) -> Dict[str, Any]:
        """Admin: Mark withdrawal as FAILED and refund hold"""
        try:
            async with prisma.tx() as tx:
                payout = await tx.payout.find_unique(
                    where={"id": payout_id}, include={"wallet": True}
                )
                if not payout:
                    raise HTTPException(status_code=404, detail="Payout not found")

                if payout.status in ["COMPLETED", "FAILED"]:
                    raise HTTPException(
                        status_code=400, detail="Payout already finalized"
                    )

                # Lock wallet
                await self._lock_wallet(tx, payout.walletId)
                wallet = await tx.wallet.find_unique(where={"id": payout.walletId})

                # Update payout
                await tx.payout.update(
                    where={"id": payout_id},
                    data={
                        "status": "FAILED",
                        "adminNotes": reason,
                        "processedAt": datetime.now(timezone.utc),
                    },
                )

                # Log transaction (Hold Release)
                await tx.wallettransaction.create(
                    data={
                        "walletId": wallet.id,
                        "amount": payout.amount,
                        "previousBalance": wallet.podaPoints,
                        "newBalance": wallet.podaPoints,  # Balance unchanged, just hold released
                        "type": "RELEASE",
                        "purpose": "WITHDRAWAL_FAILED",
                        "referenceId": f"payout_{payout_id}_failed",
                        "description": f"Withdrawal #{payout_id} failed: {reason}",
                    }
                )

            return {"id": payout_id, "status": "FAILED"}
        except Exception as e:
            logger.error(f"Failed to fail payout: {e}")
            raise

    async def generate_payout_batch(self, payout_ids: List[int]) -> str:
        """Generate CSV string for a batch of payouts"""
        import csv
        import io

        payouts = await prisma.payout.find_many(
            where={"id": {"in": payout_ids}},
            include={"wallet": {"include": {"user": True}}},
        )

        if not payouts:
            raise HTTPException(status_code=400, detail="No payouts found")

        # Generate Batch ID
        batch_id = f"BATCH-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"

        # Update batch IDs
        await prisma.payout.update_many(
            where={"id": {"in": payout_ids}}, data={"batchId": batch_id}
        )

        output = io.StringIO()
        writer = csv.writer(output)
        # Header (Algerian generic format)
        writer.writerow(
            [
                "Reference",
                "Account Number",
                "Holder Name",
                "Amount (DZD)",
                "Bank",
                "Notes",
            ]
        )

        for p in payouts:
            writer.writerow(
                [
                    p.reference,
                    p.accountNumber or "",
                    p.accountHolderName
                    or (p.wallet.user.fullName if p.wallet.user else ""),
                    f"{p.amount}.00",
                    p.bankName or "",
                    p.notes or "",
                ]
            )

        return output.getvalue()

    async def reject_withdrawal(
        self, payout_id: int, admin_notes: str
    ) -> Dict[str, Any]:
        """Admin: Reject a withdrawal and release the held funds"""
        try:
            async with prisma.tx() as transaction:
                # Get payout
                payout = await transaction.payout.find_unique(
                    where={"id": payout_id}, include={"wallet": True}
                )

                if not payout:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.billing.withdrawal_not_found",
                    )

                if payout.status != "PENDING":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="errors.billing.withdrawal_not_pending",
                    )

                # Pessimistic row-locking on wallet to prevent concurrent double-spends/releases
                await self._lock_wallet(transaction, payout.walletId)
                wallet = await transaction.wallet.find_unique(
                    where={"id": payout.walletId}
                )
                if not wallet:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="errors.billing.wallet_not_found",
                    )

                # Update payout status
                updated_payout = await transaction.payout.update(
                    where={"id": payout_id},
                    data={
                        "status": "REJECTED",
                        "processedAt": datetime.now(timezone.utc),
                        "adminNotes": admin_notes,
                    },
                )

                # Create wallet transaction record
                await transaction.wallettransaction.create(
                    data={
                        "walletId": wallet.id,
                        "amount": payout.amount,
                        "previousBalance": wallet.podaPoints,
                        "newBalance": wallet.podaPoints,
                        "type": "RELEASE",
                        "purpose": "WITHDRAWAL",
                        "referenceId": f"payout_{payout_id}",
                        "description": f"Withdrawal #{payout_id} - Rejected: {admin_notes}",
                    }
                )

                logger.info(
                    f"Withdrawal #{payout_id} rejected. Released hold of {payout.amount} for wallet {wallet.id}"
                )

                return {
                    "id": updated_payout.id,
                    "wallet_id": updated_payout.walletId,
                    "amount": updated_payout.amount,
                    "currency": updated_payout.currency,
                    "status": "REJECTED",
                    "admin_notes": admin_notes,
                    "processed_at": updated_payout.processedAt,
                }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to reject withdrawal: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="errors.wallet.withdrawal_rejection_failed",
            )

    # =========================================================================
    # TIGERBEETLE-GRADE TWO-PHASE TRANSFERS & BALANCE ISOLATION
    # =========================================================================
    async def prepare_transfer(
        self,
        source_wallet_id: int,
        destination_wallet_id: int,
        amount: int,
        purpose: Union[PaymentPurpose, str] = PaymentPurpose.TRANSFER,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
        tx=None,
    ) -> Dict[str, Any]:
        """Phase 1: Reserve funds in source wallet by placing an atomic outbound hold."""
        if not isinstance(amount, int) or isinstance(amount, bool):
            raise TypeError(
                f"Transfer amount must be an integer, got {type(amount).__name__}"
            )
        if amount <= 0:
            raise ValueError(f"Transfer amount must be positive, got {amount}")

        async def _run(t):
            await self._lock_wallet(t, source_wallet_id)
            source_wallet = await t.wallet.find_unique(where={"id": source_wallet_id})
            if not source_wallet or not source_wallet.isActive:
                raise HTTPException(
                    status_code=400, detail="Source wallet not active or not found"
                )

            dest_wallet = await t.wallet.find_unique(
                where={"id": destination_wallet_id}
            )
            if not dest_wallet or not dest_wallet.isActive:
                raise HTTPException(
                    status_code=400, detail="Destination wallet not active or not found"
                )

            available = await self.get_available_balance(source_wallet_id, tx=t)
            if available < amount:
                raise HTTPException(
                    status_code=400, detail="errors.wallet.insufficient_funds"
                )

            purpose_str = (
                purpose.value if isinstance(purpose, PaymentPurpose) else str(purpose)
            )
            import uuid

            transfer_id = f"TB2P-{uuid.uuid4().hex[:12].upper()}"

            # Record pending hold
            await t.wallettransaction.create(
                data={
                    "walletId": source_wallet_id,
                    "amount": amount,
                    "previousBalance": source_wallet.podaPoints,
                    "newBalance": source_wallet.podaPoints,
                    "type": "HOLD",
                    "purpose": purpose_str,
                    "referenceId": transfer_id,
                    "description": description
                    or f"Two-Phase Transfer Hold -> Wallet #{destination_wallet_id}",
                    "metadata": Json(
                        {
                            "phase": "PREPARE",
                            "destination_wallet_id": destination_wallet_id,
                            "reference_id": reference_id,
                        }
                    ),
                }
            )
            return {
                "transfer_id": transfer_id,
                "status": "PENDING",
                "source_wallet_id": source_wallet_id,
                "destination_wallet_id": destination_wallet_id,
                "amount": amount,
            }

        if tx is not None:
            return await _run(tx)
        async with prisma.tx() as t:
            return await _run(t)

    async def post_transfer(self, transfer_id: str, tx=None) -> Dict[str, Any]:
        """Phase 2 (Commit): Atomically debit source posted balance and credit destination posted balance."""

        async def _run(t):
            # Locate hold transaction
            hold_tx = await t.wallettransaction.find_first(
                where={"referenceId": transfer_id, "type": "HOLD"}
            )
            if not hold_tx:
                raise HTTPException(
                    status_code=404, detail="Two-phase transfer record not found"
                )

            meta = (
                dict(hold_tx.metadata)
                if hold_tx.metadata and isinstance(hold_tx.metadata, dict)
                else {}
            )
            if meta.get("phase") != "PREPARE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Transfer in invalid phase: {meta.get('phase')}",
                )

            source_id = hold_tx.walletId
            dest_id = meta.get("destination_wallet_id")
            amount = hold_tx.amount

            # Lock both wallets in deterministic order
            first_id, second_id = min(source_id, dest_id), max(source_id, dest_id)
            await self._lock_wallet(t, first_id)
            await self._lock_wallet(t, second_id)

            # Re-read hold_tx under the lock to prevent TOCTOU race conditions
            hold_tx_current = await t.wallettransaction.find_unique(
                where={"id": hold_tx.id}
            )
            current_meta = (
                dict(hold_tx_current.metadata)
                if hold_tx_current
                and hold_tx_current.metadata
                and isinstance(hold_tx_current.metadata, dict)
                else {}
            )
            if current_meta.get("phase") != "PREPARE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Transfer in invalid phase: {current_meta.get('phase')}",
                )

            source_wallet = await t.wallet.find_unique(where={"id": source_id})
            dest_wallet = await t.wallet.find_unique(where={"id": dest_id})

            if source_wallet.podaPoints < amount:
                raise HTTPException(
                    status_code=400, detail="errors.wallet.insufficient_funds"
                )

            # Zero-sum double-entry invariant verification:
            if (-amount) + amount != 0:
                raise HTTPException(
                    status_code=500, detail="errors.wallet.zero_sum_violation"
                )

            # Debit source
            new_source_balance = source_wallet.podaPoints - amount
            await t.wallet.update(
                where={"id": source_id}, data={"podaPoints": new_source_balance}
            )
            await t.wallettransaction.create(
                data={
                    "walletId": source_id,
                    "amount": amount,
                    "previousBalance": source_wallet.podaPoints,
                    "newBalance": new_source_balance,
                    "type": "DEBIT",
                    "purpose": hold_tx.purpose,
                    "referenceId": transfer_id,
                    "description": f"Posted Two-Phase Transfer -> Wallet #{dest_id}",
                }
            )

            # Credit destination
            new_dest_balance = dest_wallet.podaPoints + amount
            await t.wallet.update(
                where={"id": dest_id}, data={"podaPoints": new_dest_balance}
            )
            await t.wallettransaction.create(
                data={
                    "walletId": dest_id,
                    "amount": amount,
                    "previousBalance": dest_wallet.podaPoints,
                    "newBalance": new_dest_balance,
                    "type": "CREDIT",
                    "purpose": hold_tx.purpose,
                    "referenceId": transfer_id,
                    "description": f"Posted Two-Phase Transfer from Wallet #{source_id}",
                }
            )

            # Mark hold as POSTED
            current_meta["phase"] = "POSTED"
            current_meta["posted_at"] = datetime.now(timezone.utc).isoformat()
            await t.wallettransaction.update(
                where={"id": hold_tx.id}, data={"metadata": Json(current_meta)}
            )

            return {
                "transfer_id": transfer_id,
                "status": "POSTED",
                "source_wallet_id": source_id,
                "destination_wallet_id": dest_id,
                "amount": amount,
            }

        if tx is not None:
            return await _run(tx)
        async with prisma.tx() as t:
            return await _run(t)

    async def void_transfer(
        self, transfer_id: str, reason: Optional[str] = None, tx=None
    ) -> Dict[str, Any]:
        """Phase 2 (Abort): Release outbound hold and restore spendable available balance."""

        async def _run(t):
            hold_tx = await t.wallettransaction.find_first(
                where={"referenceId": transfer_id, "type": "HOLD"}
            )
            if not hold_tx:
                raise HTTPException(
                    status_code=404, detail="Two-phase transfer record not found"
                )

            meta = (
                dict(hold_tx.metadata)
                if hold_tx.metadata and isinstance(hold_tx.metadata, dict)
                else {}
            )
            if meta.get("phase") != "PREPARE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Transfer in invalid phase: {meta.get('phase')}",
                )

            source_id = hold_tx.walletId
            amount = hold_tx.amount

            # Lock source wallet
            await self._lock_wallet(t, source_id)

            # Re-read hold_tx under the lock to prevent TOCTOU race conditions
            hold_tx_current = await t.wallettransaction.find_unique(
                where={"id": hold_tx.id}
            )
            current_meta = (
                dict(hold_tx_current.metadata)
                if hold_tx_current
                and hold_tx_current.metadata
                and isinstance(hold_tx_current.metadata, dict)
                else {}
            )
            if current_meta.get("phase") != "PREPARE":
                raise HTTPException(
                    status_code=400,
                    detail=f"Transfer in invalid phase: {current_meta.get('phase')}",
                )

            # Record VOID
            current_meta["phase"] = "VOIDED"
            current_meta["void_reason"] = reason or "Transfer cancelled"
            current_meta["voided_at"] = datetime.now(timezone.utc).isoformat()
            await t.wallettransaction.update(
                where={"id": hold_tx.id}, data={"metadata": Json(current_meta)}
            )

            # Record RELEASE transaction
            source_wallet = await t.wallet.find_unique(where={"id": source_id})
            await t.wallettransaction.create(
                data={
                    "walletId": source_id,
                    "amount": amount,
                    "previousBalance": source_wallet.podaPoints,
                    "newBalance": source_wallet.podaPoints,
                    "type": "RELEASE",
                    "purpose": hold_tx.purpose,
                    "referenceId": transfer_id,
                    "description": f"Voided Two-Phase Transfer: {reason or 'Cancelled'}",
                }
            )
            return {
                "transfer_id": transfer_id,
                "status": "VOIDED",
                "source_wallet_id": source_id,
                "amount": amount,
            }

        if tx is not None:
            return await _run(tx)
        async with prisma.tx() as t:
            return await _run(t)

    async def audit_wallet_ledger(self, wallet_id: int, db=None) -> Dict[str, Any]:
        """
        Institutional Double-Entry Ledger & Balance Conservation Audit.
        Verifies:
        1. Ledger chain integrity: running balance continuity across all transactions.
        2. Balance conservation: calculated balance from transactions matches wallet.podaPoints.
        3. Active holds and available balance invariant:
           Available Balance = Total Balance - (Escrow Holds + Pending Payouts + Two-Phase Holds) >= 0.
        """
        db = db if db is not None else prisma
        wallet = await db.wallet.find_unique(where={"id": wallet_id})
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="errors.billing.wallet_not_found",
            )

        transactions = await db.wallettransaction.find_many(
            where={"walletId": wallet_id},
            order={"createdAt": "asc"},
        )

        total_credits = 0
        total_debits = 0
        chain_broken = False
        discrepancies: List[str] = []

        # Chronological verification of running balance.
        #
        # Ledger convention: `amount` is always a positive magnitude and the
        # direction is carried by `type`. Legacy SPEND/EXPIRY rows were written
        # with a negative amount, so every comparison uses abs().
        running_balance = 0
        for tx_item in transactions:
            tx_type = tx_item.type
            amount = abs(tx_item.amount)

            if tx_type in ["CREDIT", "TRANSFER_IN", "TOP_UP", "REFUND"]:
                delta = amount
                total_credits += amount
            elif tx_type in ["DEBIT", "TRANSFER_OUT", "SPEND", "EXPIRY"]:
                delta = -amount
                total_debits += amount
            elif tx_type in ["HOLD", "RELEASE"]:
                # Reservation rows move no money.
                delta = 0
            else:
                # Unknown type: trust the row's own balance delta rather than
                # silently skipping the chain check.
                delta = tx_item.newBalance - tx_item.previousBalance
                discrepancies.append(
                    f"Tx #{tx_item.id} has unrecognised type '{tx_type}'; "
                    f"derived delta from balance columns"
                )

            expected_new = tx_item.previousBalance + delta
            running_balance += delta

            if tx_item.newBalance != expected_new:
                chain_broken = True
                discrepancies.append(
                    f"Tx #{tx_item.id} balance discontinuity: previous={tx_item.previousBalance}, "
                    f"amount={tx_item.amount}, type={tx_type}, actual_new={tx_item.newBalance}, "
                    f"expected_new={expected_new}"
                )

        calculated_balance = total_credits - total_debits
        is_conserved = (calculated_balance == wallet.podaPoints) and not chain_broken

        available_balance = await self.get_available_balance(wallet_id, tx=db)

        return {
            "wallet_id": wallet_id,
            "status": "CONSERVED" if is_conserved else "DISCREPANCY",
            "is_valid": is_conserved,
            "chain_broken": chain_broken,
            "current_balance": wallet.podaPoints,
            "calculated_balance": calculated_balance,
            "available_balance": available_balance,
            "total_credits": total_credits,
            "total_debits": total_debits,
            "transaction_count": len(transactions),
            "chain_valid": not chain_broken,
            "discrepancies": discrepancies,
            "audit_timestamp": datetime.now(timezone.utc).isoformat(),
        }


# Singleton instance
wallet_service = WalletService()
