"""
TamWheel Sovereign Ethical Agentic Venture OS — Musharakah Mutanaqisah Engine.
Implements:
1. AAOIFI Shariah Standard No. 12 (Sharika/Musharakah) & Standard No. 9 (Ijarah).
2. Diminishing Partnership buyout schedules for asset/equipment venture financing (KhayraTech AgriTech, GPU servers, cold storage).
3. Sliding-scale rental calculations proportional to diminishing investor ownership share.
4. Early buyout / accelerated redemption calculations without penalty interest.
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & MODELS
# =============================================================================

class PaymentFrequency(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    SEMI_ANNUALLY = "SEMI_ANNUALLY"
    ANNUALLY = "ANNUALLY"


class AssetCategory(str, enum.Enum):
    AGRITECH_HARDWARE = "AGRITECH_HARDWARE"
    COLD_STORAGE_LOGISTICS = "COLD_STORAGE_LOGISTICS"
    COMPUTE_GPU_SERVERS = "COMPUTE_GPU_SERVERS"
    SOLAR_RENEWABLE_ENERGY = "SOLAR_RENEWABLE_ENERGY"
    MANUFACTURING_EQUIPMENT = "MANUFACTURING_EQUIPMENT"
    COMMERCIAL_VEHICLE = "COMMERCIAL_VEHICLE"


class BuyoutTranche(BaseModel):
    period_number: int = Field(..., ge=1, description="Period number (1 to N)")
    due_date_estimate_days: int = Field(..., description="Estimated day offset from agreement initiation")
    investor_ownership_pct_start: float = Field(..., description="Investor ownership fraction at start of period")
    founder_ownership_pct_start: float = Field(..., description="Founder ownership fraction at start of period")
    investor_asset_value_dzd: float = Field(..., description="Monetary value of investor share at start of period")
    rental_payment_dzd: float = Field(..., description="Ijarah rental payment on investor's remaining asset share")
    buyout_principal_dzd: float = Field(..., description="Unit principal paid to acquire investor units")
    total_period_payment_dzd: float = Field(..., description="Total cash outflow (Rental + Buyout)")
    investor_ownership_pct_end: float = Field(..., description="Investor ownership fraction at end of period")
    founder_ownership_pct_end: float = Field(..., description="Founder ownership fraction at end of period")
    cumulative_principal_paid_dzd: float = Field(..., description="Cumulative equity principal repurchased")
    remaining_investor_principal_dzd: float = Field(..., description="Remaining equity principal owed to investor")


class MusharakahScheduleRequest(BaseModel):
    venture_id: str = Field(..., description="Unique venture or startup ID")
    venture_name: str = Field(..., description="Venture display or legal name")
    asset_category: AssetCategory = Field(default=AssetCategory.AGRITECH_HARDWARE)
    asset_description: str = Field(..., min_length=5, description="Specification of the co-owned asset")
    total_asset_cost_dzd: float = Field(..., gt=0, description="Total purchase / deployment cost in DZD")
    investor_contribution_dzd: float = Field(..., gt=0, description="Capital deployed by investor (Mudarib/Sharika)")
    founder_contribution_dzd: float = Field(default=0.0, ge=0, description="Initial capital co-funded by founder")
    annual_rental_yield_pct: float = Field(..., ge=1.0, le=40.0, description="Annualized Ijarah lease rate (e.g. 12.0%)")
    tenor_months: int = Field(..., ge=3, le=120, description="Tenor of the diminishing partnership in months")
    payment_frequency: PaymentFrequency = Field(default=PaymentFrequency.MONTHLY)


class MusharakahScheduleResponse(BaseModel):
    schedule_id: str
    schedule_audit_hash: str = Field(..., description="SHA-256 seal of the schedule parameters")
    venture_id: str
    venture_name: str
    asset_category: AssetCategory
    asset_description: str
    total_asset_cost_dzd: float
    investor_contribution_dzd: float
    founder_contribution_dzd: float
    initial_investor_share_pct: float
    initial_founder_share_pct: float
    annual_rental_yield_pct: float
    tenor_months: int
    total_periods: int
    payment_frequency: PaymentFrequency
    total_rental_paid_dzd: float
    total_principal_paid_dzd: float
    total_cost_of_acquisition_dzd: float
    tranches: List[BuyoutTranche]
    sharia_standards_reference: str = "AAOIFI Shariah Standard No. 12 (Sharika) & No. 9 (Ijarah)"
    unilateral_promise_clause: str = (
        "Operates under a binding unilateral promise (Wa'd Mulzim) by the founder to purchase investor units "
        "periodically. In compliance with AAOIFI Standard No. 12 Clause 5/1, lease and buyout contracts remain distinct."
    )
    title_transfer_milestone: str = "100% full legal title vests automatically with founder upon final unit buyout payment."
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EarlyBuyoutCalculationRequest(BaseModel):
    schedule_response: MusharakahScheduleResponse
    current_period_completed: int = Field(..., ge=0, description="Last period number completed (0 if none)")
    early_buyout_discount_pct: float = Field(
        default=0.0,
        ge=0.0,
        le=15.0,
        description="Optional voluntary early settlement concession (Da' wa Ta'ajjal) offered by investor",
    )


class EarlyBuyoutCalculationResponse(BaseModel):
    venture_id: str
    asset_description: str
    current_period_completed: int
    current_investor_share_pct: float
    remaining_nominal_principal_dzd: float
    voluntary_concession_dzd: float
    lump_sum_buyout_amount_dzd: float
    rental_savings_dzd: float
    immediate_title_transfer_unlocked: bool
    sharia_note: str = (
        "Under AAOIFI Shariah Standard No. 12, voluntary discounting for early settlement (Da' wa Ta'ajjal) is permissible "
        "provided it is not conditioned at contract inception and mutually agreed upon at the time of early buyout."
    )


# =============================================================================
# MUSHARAKAH MUTANAQISAH ENGINE
# =============================================================================

class MusharakahMutanaqisahEngine:
    """
    Computes rigorous AAOIFI-compliant Diminishing Musharakah schedules and early buyouts.
    Features:
    - Periodic linear equity buyout of investor units.
    - Sliding-scale rental payments: Rent = Remaining Investor Principal * Periodic Lease Rate.
    - Full transparency between principal amortization and rental expense.
    """

    def _get_periods_per_year(self, freq: PaymentFrequency) -> int:
        if freq == PaymentFrequency.MONTHLY:
            return 12
        elif freq == PaymentFrequency.QUARTERLY:
            return 4
        elif freq == PaymentFrequency.SEMI_ANNUALLY:
            return 2
        elif freq == PaymentFrequency.ANNUALLY:
            return 1
        return 12

    def calculate_schedule(self, req: MusharakahScheduleRequest) -> MusharakahScheduleResponse:
        total_cost = req.total_asset_cost_dzd
        investor_cap = req.investor_contribution_dzd
        founder_cap = req.founder_contribution_dzd

        if investor_cap + founder_cap != total_cost:
            # Re-normalize if founder contribution was unspecified or partial
            if founder_cap == 0.0 and investor_cap <= total_cost:
                founder_cap = total_cost - investor_cap

        initial_inv_pct = (investor_cap / total_cost) * 100.0
        initial_fnd_pct = (founder_cap / total_cost) * 100.0

        periods_per_year = self._get_periods_per_year(req.payment_frequency)
        period_duration_months = 12 // periods_per_year
        total_periods = max(1, req.tenor_months // period_duration_months)

        periodic_rental_rate = (req.annual_rental_yield_pct / 100.0) / periods_per_year
        unit_principal_buyout = investor_cap / total_periods

        tranches: List[BuyoutTranche] = []
        current_investor_principal = investor_cap
        cumulative_principal = 0.0
        total_rental_paid = 0.0

        for p in range(1, total_periods + 1):
            inv_pct_start = (current_investor_principal / total_cost) * 100.0
            fnd_pct_start = 100.0 - inv_pct_start

            # Rental is strictly proportional to remaining investor asset value
            rental_dzd = current_investor_principal * periodic_rental_rate
            
            # Principal buyout for this period
            if p == total_periods:
                principal_dzd = current_investor_principal  # sweep rounding differences
            else:
                principal_dzd = min(unit_principal_buyout, current_investor_principal)

            total_payment = rental_dzd + principal_dzd
            current_investor_principal = max(0.0, current_investor_principal - principal_dzd)
            cumulative_principal += principal_dzd
            total_rental_paid += rental_dzd

            inv_pct_end = (current_investor_principal / total_cost) * 100.0
            fnd_pct_end = 100.0 - inv_pct_end
            due_days = p * period_duration_months * 30

            tranches.append(
                BuyoutTranche(
                    period_number=p,
                    due_date_estimate_days=due_days,
                    investor_ownership_pct_start=round(inv_pct_start, 4),
                    founder_ownership_pct_start=round(fnd_pct_start, 4),
                    investor_asset_value_dzd=round(current_investor_principal + principal_dzd, 2),
                    rental_payment_dzd=round(rental_dzd, 2),
                    buyout_principal_dzd=round(principal_dzd, 2),
                    total_period_payment_dzd=round(total_payment, 2),
                    investor_ownership_pct_end=round(inv_pct_end, 4),
                    founder_ownership_pct_end=round(fnd_pct_end, 4),
                    cumulative_principal_paid_dzd=round(cumulative_principal, 2),
                    remaining_investor_principal_dzd=round(current_investor_principal, 2),
                )
            )

        hasher = hashlib.sha256()
        canonical_raw = f"{req.venture_id}:{req.total_asset_cost_dzd}:{investor_cap}:{total_periods}:{total_rental_paid}"
        hasher.update(canonical_raw.encode("utf-8"))
        audit_hash = hasher.hexdigest()
        schedule_id = f"MM-SCHED-{req.venture_id[:6].upper()}-{audit_hash[:8].upper()}"

        return MusharakahScheduleResponse(
            schedule_id=schedule_id,
            schedule_audit_hash=audit_hash,
            venture_id=req.venture_id,
            venture_name=req.venture_name,
            asset_category=req.asset_category,
            asset_description=req.asset_description,
            total_asset_cost_dzd=round(total_cost, 2),
            investor_contribution_dzd=round(investor_cap, 2),
            founder_contribution_dzd=round(founder_cap, 2),
            initial_investor_share_pct=round(initial_inv_pct, 4),
            initial_founder_share_pct=round(initial_fnd_pct, 4),
            annual_rental_yield_pct=req.annual_rental_yield_pct,
            tenor_months=req.tenor_months,
            total_periods=total_periods,
            payment_frequency=req.payment_frequency,
            total_rental_paid_dzd=round(total_rental_paid, 2),
            total_principal_paid_dzd=round(cumulative_principal, 2),
            total_cost_of_acquisition_dzd=round(total_rental_paid + cumulative_principal, 2),
            tranches=tranches,
        )

    def calculate_early_buyout(self, req: EarlyBuyoutCalculationRequest) -> EarlyBuyoutCalculationResponse:
        sched = req.schedule_response
        completed_p = req.current_period_completed

        if completed_p >= sched.total_periods:
            return EarlyBuyoutCalculationResponse(
                venture_id=sched.venture_id,
                asset_description=sched.asset_description,
                current_period_completed=completed_p,
                current_investor_share_pct=0.0,
                remaining_nominal_principal_dzd=0.0,
                voluntary_concession_dzd=0.0,
                lump_sum_buyout_amount_dzd=0.0,
                rental_savings_dzd=0.0,
                immediate_title_transfer_unlocked=True,
            )

        if completed_p == 0:
            remaining_principal = sched.investor_contribution_dzd
            remaining_tranches = sched.tranches
            inv_share_pct = sched.initial_investor_share_pct
        else:
            last_tranche = sched.tranches[completed_p - 1]
            remaining_principal = last_tranche.remaining_investor_principal_dzd
            remaining_tranches = sched.tranches[completed_p:]
            inv_share_pct = last_tranche.investor_ownership_pct_end

        # Calculate avoided future rental payments
        future_rentals = sum(t.rental_payment_dzd for t in remaining_tranches)

        # Apply voluntary concession if any
        concession_dzd = remaining_principal * (req.early_buyout_discount_pct / 100.0)
        lump_sum = remaining_principal - concession_dzd

        return EarlyBuyoutCalculationResponse(
            venture_id=sched.venture_id,
            asset_description=sched.asset_description,
            current_period_completed=completed_p,
            current_investor_share_pct=round(inv_share_pct, 4),
            remaining_nominal_principal_dzd=round(remaining_principal, 2),
            voluntary_concession_dzd=round(concession_dzd, 2),
            lump_sum_buyout_amount_dzd=round(lump_sum, 2),
            rental_savings_dzd=round(future_rentals, 2),
            immediate_title_transfer_unlocked=True,
        )


musharakah_engine = MusharakahMutanaqisahEngine()
