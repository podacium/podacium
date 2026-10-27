from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from app.core.prisma import prisma
from app.generated.prisma import Json
from app.schemas.billing_schemas.base import PaymentPurpose
from app.schemas.payment import FreelancerTier, CommissionCalculation
from app.services.feature_gate import FeatureModeError
from app.core.config import setting, FinancialMode

from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)


def is_feature_based_mode() -> bool:
    return (
        getattr(setting, "FINANCIAL_MODE", FinancialMode.NON_CUSTODIAL)
        != FinancialMode.LICENSED_PSP
    )


def quantize_poda_points(value: Decimal | float | int) -> int:
    """Exact financial point quantization using ROUND_HALF_UP (Bank of Algeria Reg 25-02)."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class CommissionService:
    """
    Handles freelancing and education commission calculations and escrow releases.
    Authoritative logic for the "Commission Loop".
    """

    # Freelancing commission rates by freelancer tier (as decimals)
    # Must match scripts/seed_platform_config.py commission rates.
    DEFAULT_COMMISSION_RATES = {
        FreelancerTier.NEW: 0.0,  # 0% (First 3 projects)
        FreelancerTier.STANDARD: 0.10,  # 10%
        FreelancerTier.PRO: 0.08,  # 8%
        FreelancerTier.ENTERPRISE: 0.07,  # 7%
    }

    # ── Education commission rates ──────────────────────────────────────────
    # Model: 30K DZD upfront (contract-level) + 20% per-sale instructor royalty.
    #   COURSE_PURCHASE / PATH_PURCHASE:  platform 80%, instructor 20%
    #   STUDENT_SUBSCRIPTION / BI_SUBSCRIPTION: platform 100% (instructor already paid upfront)
    EDUCATION_COMMISSION_RATES = {
        PaymentPurpose.COURSE_PURCHASE: 0.80,  # 80% to platform
        PaymentPurpose.PATH_PURCHASE: 0.80,  # 80% to platform
        PaymentPurpose.STUDENT_SUBSCRIPTION: 1.0,  # 100% — all to platform
        PaymentPurpose.BI_SUBSCRIPTION: 1.0,  # 100% — all to platform
    }

    async def calculate_commission_rate(
        self, user_id: int, purpose: PaymentPurpose, resource_id: Optional[str] = None
    ) -> float:
        if is_feature_based_mode():
            raise FeatureModeError()
        # 1. Handle Education/Pillar Commissions
        if purpose in self.EDUCATION_COMMISSION_RATES:
            return self.EDUCATION_COMMISSION_RATES[purpose]

        # 2. Handle Freelancing Commissions (Tier-based)
        if purpose in [PaymentPurpose.CONTRACT_PAYMENT]:
            tier, rate = await self._calculate_tier_and_rate(user_id)
            return rate

        # Default fallback
        return 0.10

    async def calculate_commission(
        self, amount: int, freelancer_tier: FreelancerTier, purpose: PaymentPurpose
    ) -> CommissionCalculation:
        rate = self._get_commission_rate(freelancer_tier, purpose)
        d_amount = Decimal(str(amount))
        d_rate = Decimal(str(rate))
        commission = quantize_poda_points(d_amount * d_rate)
        net_amount = amount - commission

        return CommissionCalculation(
            amount=amount,
            freelancer_tier=freelancer_tier,
            commission_rate=rate,
            commission=commission,
            net_amount=net_amount,
        )

    def _get_commission_rate(
        self, freelancer_tier: FreelancerTier, purpose: PaymentPurpose
    ) -> float:
        """Helper to get rate from mapping."""
        if purpose in self.EDUCATION_COMMISSION_RATES:
            return self.EDUCATION_COMMISSION_RATES[purpose]
        return self.DEFAULT_COMMISSION_RATES.get(freelancer_tier, 0.10)

    async def release_escrow(self, contract_id: int, tx=None):
        if is_feature_based_mode():
            raise FeatureModeError()
        """
        Releases escrow funds, calculates commission, and credits freelancer.
        Accepts optional `tx` to participate in a parent transaction (avoids nesting).
        """
        try:
            contract = await prisma.contract.find_unique(
                where={"id": contract_id},
                include={
                    "freelancer": True,
                    "transactions": {
                        "where": {"purpose": "CONTRACT_ESCROW", "status": "COMPLETED"}
                    },
                },
            )
            if not contract:
                raise ValueError(f"Contract {contract_id} not found")

            existing_calc = await prisma.commissioncalculation.find_first(
                where={"contractId": contract_id}
            )
            if existing_calc:
                logger.warning(
                    f"Commission already calculated for contract {contract_id}"
                )
                return

            escrow_tx = contract.transactions[0] if contract.transactions else None
            if not escrow_tx:
                raise ValueError(
                    f"No completed escrow transaction for contract {contract_id}"
                )

            freelancer_id = contract.freelancerId
            if not freelancer_id:
                raise ValueError(f"Contract {contract_id} has no freelancer")

            tier, rate = await self._calculate_tier_and_rate(freelancer_id)

            gross_amount = escrow_tx.amount
            commission_amount = quantize_poda_points(
                Decimal(str(gross_amount)) * Decimal(str(rate))
            )
            net_amount = gross_amount - commission_amount

            async def _run(t):
                calc = await t.commissioncalculation.create(
                    data={
                        "contractId": contract_id,
                        "grossAmount": gross_amount,
                        "commissionRate": rate,
                        "commission": commission_amount,
                        "netAmount": net_amount,
                        "freelancerTier": tier.value,
                        "tierJustification": {
                            "reason": "Escrow release",
                            "rate_applied": rate,
                            "tier_snapshot": tier.value,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                )

                await t.transaction.update(
                    where={"id": escrow_tx.id},
                    data={"commission": commission_amount, "netAmount": net_amount},
                )

                from app.services.wallet_service import wallet_service

                wallet = await t.wallet.find_unique(where={"userId": freelancer_id})
                if not wallet:
                    wallet = await t.wallet.create(
                        data={
                            "userId": freelancer_id,
                            "podaPoints": 0,
                            "currency": "PODAPOINT",
                            "isActive": True,
                        }
                    )

                await wallet_service.credit_wallet(
                    wallet_id=wallet.id,
                    amount=net_amount,
                    purpose=PaymentPurpose.CONTRACT_ESCROW,
                    reference_id=str(contract_id),
                    description=f"Escrow release for contract {contract_id}",
                    tx=t,
                )

                # Update freelancer profile
                await t.freelancerprofile.update_many(
                    where={"userId": freelancer_id},
                    data={
                        "completedProjects": {"increment": 1},
                        "totalEarned": {"increment": net_amount},
                        "platformFee": {"increment": commission_amount},
                    },
                )

                await t.auditlog.create(
                    data={
                        "eventType": "commission_applied",
                        "entityType": "commission_calculation",
                        "entityId": str(calc.id),
                        "actorId": freelancer_id,
                        "amount": net_amount,
                        "currency": "DZD",
                        "metadata": Json(
                            {
                                "contract_id": contract_id,
                                "commission_amount": commission_amount,
                                "rate": rate,
                            }
                        ),
                    }
                )

            if tx is not None:
                await _run(tx)
            else:
                async with prisma.tx() as t:
                    await _run(t)

            logger.info(
                f"Commission released for contract {contract_id}. Net: {net_amount} DZD."
            )
            return True

        except Exception as e:
            logger.error(f"Failed to release escrow: {str(e)}")
            raise

    async def _calculate_tier_and_rate(
        self, freelancer_id: int
    ) -> Tuple[FreelancerTier, float]:
        if is_feature_based_mode():
            raise FeatureModeError()
        """
        Determines the commission tier based on performance.
        Rules:
        NEW: 0% (First 3 projects)
        STANDARD: 10% (After 3 projects)
        PRO: 8% (Advanced users)
        ENTERPRISE: 7% (Long-run experts)
        """
        profile = await prisma.freelancerprofile.find_unique(
            where={"userId": freelancer_id}
        )
        completed_projects = profile.completedProjects if profile else 0
        total_earned = profile.totalEarned if profile else 0

        if completed_projects > 50 or total_earned > 500000:
            return FreelancerTier.ENTERPRISE, 0.07
        elif completed_projects > 10 or total_earned > 100000:
            return FreelancerTier.PRO, 0.08
        elif completed_projects > 3 or total_earned > 10000:
            return FreelancerTier.STANDARD, 0.10
        else:
            return FreelancerTier.NEW, 0.0

    async def update_freelancer_tier(self, freelancer_id: int) -> FreelancerTier:
        """Authoritative tier update logic."""
        tier, rate = await self._calculate_tier_and_rate(freelancer_id)

        await prisma.freelancerprofile.update(
            where={"userId": freelancer_id},
            data={"tier": tier.value, "commissionRate": rate},
        )
        return tier

    async def record_commission(self, transaction_id: int, commission_amount: int):
        """Records commission into the PlatformRevenue table."""
        transaction = await prisma.transaction.find_unique(where={"id": transaction_id})
        if not transaction:
            return

        await prisma.platformrevenue.create(
            data={
                "source": "COMMISSION",
                "amount": commission_amount,
                "currency": "DZD",
                "referenceId": str(transaction_id),
                "periodStart": datetime.now(timezone.utc).replace(
                    day=1, hour=0, minute=0, second=0, microsecond=0
                ),
                "periodEnd": datetime.now(timezone.utc).replace(
                    day=1, hour=0, minute=0, second=0, microsecond=0
                ),
                "metadata": {
                    "transaction_id": transaction_id,
                    "purpose": transaction.purpose,
                },
            }
        )


commission_service = CommissionService()
