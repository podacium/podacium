import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status

from app.core.prisma import prisma
from app.generated.prisma import enums as p_enums
from app.schemas.payment import PaymentPurpose, PaymentGateway, PaymentInitiateRequest

logger = logging.getLogger(__name__)


class PodaPointsService:
    """Manages PodaPoints lifecycle — purchase, spend, expiry, balance check."""

    MIN_PURCHASE = 200
    MAX_PURCHASE = 20000
    EXPIRY_DAYS = 365

    FEATURE_PRICES = {
        "project_post": 200,
        "featured_project_7d": 500,
        "freelancer_boost": 200,
        "freelancer_featured_7d": 500,
        "skill_passport": 500,
    }

    async def get_balance(self, user_id: int) -> int:
        wallet = await prisma.wallet.find_unique(where={"userId": user_id})
        if not wallet:
            return 0
        return wallet.podaPoints

    async def check_balance(self, user_id: int, required_points: int) -> bool:
        balance = await self.get_balance(user_id)
        return balance >= required_points

    async def purchase_points(
        self,
        user_id: int,
        amount_dzd: int,
    ) -> Dict[str, Any]:
        if amount_dzd < self.MIN_PURCHASE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum purchase is {self.MIN_PURCHASE} PodaPoints ({self.MIN_PURCHASE} DZD)",
            )
        if amount_dzd > self.MAX_PURCHASE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum purchase is {self.MAX_PURCHASE} PodaPoints ({self.MAX_PURCHASE} DZD)",
            )

        from app.services.wallet_service import wallet_service

        wallet = await wallet_service.ensure_user_wallet(user_id)

        from app.core.config import setting
        from app.services.payment_service import payment_service

        origin = setting.FRONTEND_URL or "http://localhost:3000"

        request = PaymentInitiateRequest(
            user_id=user_id,
            amount=amount_dzd,
            currency="DZD",
            purpose=PaymentPurpose.PODAPOINT_PURCHASE,
            gateway=PaymentGateway.CHARGILY,
            success_url=f"{origin}/billing?success=true",
            failure_url=f"{origin}/billing?failure=true",
            metadata={
                "wallet_id": wallet.id,
                "poda_points": amount_dzd,
                "type": "poda_points_purchase",
            },
        )

        response = await payment_service.initiate_payment(request)

        return {
            "checkout_url": response.checkout_url,
            "transaction_id": response.id,
            "poda_points": amount_dzd,
        }

    async def spend_points(
        self,
        user_id: int,
        feature_key: str,
        reference_id: Optional[str] = None,
        quantity: int = 1,
        tx=None,
    ) -> Dict[str, Any]:
        """Debit PodaPoints for a feature.

        Invariants:
        * ``amount`` on the ledger row is always a positive magnitude; direction is
          carried by ``type`` (see ``WalletService.audit_wallet_ledger``).
        * The balance is read *after* the row lock, never before, so concurrent
          spends cannot both decrement from the same stale baseline.
        * Pass an existing ``tx`` to make the spend atomic with whatever the caller
          does next (the feature grant). A spend that commits on its own is money
          lost if the grant then fails.
        * Returns ``transaction_id`` so callers can link the entitlement to the
          exact ledger row instead of guessing at the latest one.

        🔒 Raises ValueError for non-positive quantities.
        """
        if feature_key not in self.FEATURE_PRICES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown feature: {feature_key}",
            )
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
            raise ValueError(f"Quantity must be a positive integer, got {quantity!r}")

        unit_price = self.FEATURE_PRICES[feature_key]
        total_price = unit_price * quantity

        async def _run(t):
            # Lock first, then read — otherwise the balance below is a torn read.
            await t.execute_raw(
                'SELECT id FROM "Wallet" WHERE "userId" = $1 FOR UPDATE', user_id
            )
            wallet = await t.wallet.find_unique(where={"userId": user_id})
            if not wallet:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Wallet not found",
                )
            if not wallet.isActive:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.wallet.wallet_not_active",
                )

            # Spend against *available* balance so encumbered funds cannot be
            # double-spent (pending payouts / escrow holds / two-phase holds).
            from app.services.wallet_service import wallet_service

            available = await wallet_service.get_available_balance(wallet.id, tx=t)
            if available < total_price:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Insufficient PodaPoints. Required: {total_price}, Available: {available}",
                )

            new_balance = wallet.podaPoints - total_price
            previous_balance = wallet.podaPoints
            updated = await t.wallet.update(
                where={"id": wallet.id},
                data={"podaPoints": new_balance},
            )

            ledger_row = await t.wallettransaction.create(
                data={
                    "walletId": wallet.id,
                    "amount": total_price,
                    "previousBalance": previous_balance,
                    "newBalance": updated.podaPoints,
                    "type": "SPEND",
                    "purpose": p_enums.PaymentPurpose.FEATURE_PURCHASE,
                    "referenceId": reference_id,
                    "description": f"Spent {total_price} PodaPoints on {quantity}x {feature_key}",
                }
            )

            return {
                "feature": feature_key,
                "price": total_price,
                "quantity": quantity,
                "remaining_balance": updated.podaPoints,
                "transaction_id": ledger_row.id,
            }

        if tx is not None:
            return await _run(tx)
        async with prisma.tx() as t:
            return await _run(t)

    async def get_transactions(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        wallet = await prisma.wallet.find_unique(where={"userId": user_id})
        if not wallet:
            return []

        transactions = await prisma.wallettransaction.find_many(
            where={"walletId": wallet.id},
            order={"createdAt": "desc"},
            take=limit,
            skip=offset,
        )

        return [
            {
                "id": t.id,
                "amount": t.amount,
                "previous_balance": t.previousBalance,
                "new_balance": t.newBalance,
                "type": t.type,
                "purpose": t.purpose.value if t.purpose else None,
                "reference_id": t.referenceId,
                "description": t.description,
                "created_at": t.createdAt.isoformat() if t.createdAt else None,
            }
            for t in transactions
        ]

    async def expire_old_points(
        self,
        now: Optional[datetime] = None,
        limit: int = 500,
    ) -> Dict[str, Any]:
        """Expire points purchased more than ``EXPIRY_DAYS`` ago.

        Previously this method queried ``type="TOP_UP"`` (written only by a dead
        code path) while every live purchase writes ``type="CREDIT"``, so it
        matched nothing even if it had been scheduled. It is now driven by
        ``Credit``/``TOP_UP``/``REFUND`` rows, is idempotent per source row
        (``referenceId = "expiry:<source_id>"``), and mutates the balance inside
        a row-locked transaction.

        Expiry is capped at the wallet's current balance: points that were
        already spent are not expired twice.
        """
        current = now or datetime.now(timezone.utc)
        cutoff = current - timedelta(days=self.EXPIRY_DAYS)

        credit_rows = await prisma.wallettransaction.find_many(
            where={
                "type": {"in": ["CREDIT", "TOP_UP", "REFUND"]},
                "createdAt": {"lt": cutoff},
            },
            order={"createdAt": "asc"},
            take=limit,
        )

        expired_wallets = 0
        expired_points = 0

        for credit in credit_rows:
            amount = abs(credit.amount)
            if amount <= 0:
                continue

            marker = f"expiry:{credit.id}"

            async with prisma.tx() as tx:
                await tx.execute_raw(
                    'SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE',
                    credit.walletId,
                )
                # Idempotency check *after* the lock: two concurrent sweepers
                # serialize on the wallet row, so the loser sees the EXPIRY row
                # the winner committed instead of expiring the credit twice.
                already = await tx.wallettransaction.find_first(
                    where={"type": "EXPIRY", "referenceId": marker}
                )
                if already:
                    continue

                wallet = await tx.wallet.find_unique(where={"id": credit.walletId})
                if not wallet or wallet.podaPoints <= 0:
                    continue

                expire_amount = min(amount, wallet.podaPoints)
                new_balance = wallet.podaPoints - expire_amount

                await tx.wallettransaction.create(
                    data={
                        "walletId": wallet.id,
                        "amount": expire_amount,
                        "previousBalance": wallet.podaPoints,
                        "newBalance": new_balance,
                        "type": "EXPIRY",
                        "purpose": p_enums.PaymentPurpose.REFUND,
                        "referenceId": marker,
                        "description": (
                            f"Expired {expire_amount} PodaPoints "
                            f"(source credit #{credit.id}, purchased over "
                            f"{self.EXPIRY_DAYS} days ago)"
                        ),
                    }
                )
                await tx.wallet.update(
                    where={"id": wallet.id}, data={"podaPoints": new_balance}
                )

            expired_wallets += 1
            expired_points += expire_amount
            logger.info(
                f"Expired {expire_amount} PodaPoints from wallet {credit.walletId} "
                f"(source credit #{credit.id})"
            )

        return {
            "expired_wallets": expired_wallets,
            "expired_points": expired_points,
            "scanned_credits": len(credit_rows),
        }


poda_points_service = PodaPointsService()
