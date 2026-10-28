"""
TamWheel Sovereign Ethical Agentic Venture OS — Syndicate Deal Engine.
Implements:
1. AngelList-Style Venture Syndicate SPV Management:
   - Lead investor syndicate creation with minimum allocation tickets, closing deadlines, and pass-through back-office setup fee accounting.
2. Automated Multi-Tier Carry Waterfall Calculator:
   - Tier 1: 100% Return of LP Invested Capital.
   - Tier 2: Preferred Return Hurdle (6-8% annualized compounding).
   - Tier 3: 20% Carried Interest split into 15% to Syndicate Lead and 5% platform carry to TamWheel, with remaining 80% to LPs.
   - Computes MOIC, net IRR, and per-member distribution ledger.
3. Pro-Rata Rights & Anti-Dilution Calculator:
   - Models investor participation in subsequent priced rounds (Series A/B) to preserve equity ownership.
   - Generates automated Capital Call Notices for SPV limited partners.
"""

from __future__ import annotations

import enum
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class SPVStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    CLOSING = "CLOSING"
    FUNDED = "FUNDED"
    DISSOLVED = "DISSOLVED"


# =============================================================================
# SCHEMAS & DATA MODELS
# =============================================================================

class SyndicateMember(BaseModel):
    member_id: str
    full_name: str
    email: str
    pledged_amount_dzd: float = Field(..., gt=0)
    is_lead: bool = False
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SyndicateSPV(BaseModel):
    spv_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    startup_name: str
    deal_round: str = "Series Seed"
    target_raise_dzd: float = Field(..., gt=0)
    min_allocation_dzd: float = Field(default=500_000.0, ge=100_000.0)
    lead_investor_id: str
    lead_name: str
    lead_carry_pct: float = Field(default=15.0, ge=0.0, le=30.0)
    platform_carry_pct: float = Field(default=5.0, ge=0.0, le=10.0)
    hurdle_rate_pct: float = Field(default=7.0, ge=0.0, le=15.0, description="Annual preferred return hurdle")
    backoffice_setup_fee_dzd: float = Field(default=150_000.0, ge=0.0, description="Pass-through legal/filing fee under Law 22-09")
    closing_deadline: datetime
    status: SPVStatus = SPVStatus.OPEN
    members: List[SyndicateMember] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def total_pledged_dzd(self) -> float:
        return sum(m.pledged_amount_dzd for m in self.members)

    @property
    def net_invested_capital_dzd(self) -> float:
        return max(0.0, self.total_pledged_dzd - self.backoffice_setup_fee_dzd)


class CarryWaterfallRequest(BaseModel):
    exit_proceeds_dzd: float = Field(..., gt=0, description="Total exit or dividend distribution proceeds in DZD")
    total_invested_capital_dzd: float = Field(..., gt=0, description="Initial total LP capital deployed")
    hurdle_rate_pct: float = Field(default=7.0, ge=0.0, description="Annual preferred return hurdle percentage")
    holding_period_years: float = Field(default=4.0, gt=0.0, description="Investment duration in years")
    lead_carry_pct: float = Field(default=15.0, ge=0.0, le=30.0)
    platform_carry_pct: float = Field(default=5.0, ge=0.0, le=10.0)
    members: Optional[List[SyndicateMember]] = None


class MemberPayout(BaseModel):
    member_id: str
    full_name: str
    is_lead: bool
    initial_pledge_dzd: float
    capital_return_dzd: float
    preferred_return_dzd: float
    residual_profit_dzd: float
    lead_carry_earned_dzd: float = 0.0
    total_distribution_dzd: float
    moic: float


class CarryWaterfallResult(BaseModel):
    exit_proceeds_dzd: float
    total_invested_capital_dzd: float
    holding_period_years: float
    hurdle_rate_pct: float

    # Tier 1: Capital Return
    tier1_capital_returned_dzd: float
    tier1_shortfall_dzd: float

    # Tier 2: Preferred Return Hurdle
    tier2_hurdle_target_dzd: float
    tier2_preferred_return_paid_dzd: float

    # Tier 3: Profit & Carry Split
    tier3_distributable_profit_dzd: float
    lead_carry_amount_dzd: float
    platform_carry_amount_dzd: float
    lp_residual_profit_dzd: float

    # Summary Totals
    total_lp_payout_dzd: float
    total_lead_payout_dzd: float
    total_platform_payout_dzd: float
    lp_blended_moic: float
    lp_net_annual_irr_pct: float
    per_member_ledger: List[MemberPayout] = Field(default_factory=list)


class ProRataCalculationRequest(BaseModel):
    current_shares_held: int = Field(..., gt=0)
    total_pre_round_shares: int = Field(..., gt=0)
    new_round_pre_money_dzd: float = Field(..., gt=0)
    new_round_target_raise_dzd: float = Field(..., gt=0)
    option_pool_expansion_pct: float = Field(default=0.0, ge=0.0, le=25.0)
    syndicate_members: Optional[List[SyndicateMember]] = None


class CapitalCallNotice(BaseModel):
    notice_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    round_name: str = "Series A Financing"
    total_pro_rata_check_dzd: float
    payment_deadline_days: int = 10
    payment_instructions: str
    per_member_allocations: Dict[str, float]


class ProRataCalculationResult(BaseModel):
    current_ownership_pct: float
    new_round_pre_money_dzd: float
    new_round_post_money_dzd: float
    new_round_target_raise_dzd: float
    share_price_new_round_dzd: float

    # Pro-Rata Exercise Scenario
    pro_rata_investment_required_dzd: float
    new_shares_to_acquire: int
    total_shares_post_exercise: int
    post_round_ownership_with_prorata_pct: float

    # Non-Exercise Scenario (Dilution)
    post_round_ownership_without_prorata_pct: float
    dilution_loss_pct: float

    # Option Pool Impact
    effective_dilution_with_pool_pct: float
    capital_call_notice: CapitalCallNotice


# =============================================================================
# SYNDICATE DEAL ENGINE
# =============================================================================

class SyndicateDealEngine:
    """
    Engine for AngelList-style venture syndicates:
    - SPV formation and member allocation tracking.
    - Mathematical 3-tier carry waterfall calculator with hurdle rate.
    - Pro-rata rights and subsequent round anti-dilution modeling.
    """

    def __init__(self):
        self._spvs: Dict[str, SyndicateSPV] = {}

    def create_syndicate(
        self,
        startup_name: str,
        deal_round: str,
        target_raise_dzd: float,
        min_allocation_dzd: float,
        lead_investor_id: str,
        lead_name: str,
        lead_carry_pct: float = 15.0,
        platform_carry_pct: float = 5.0,
        hurdle_rate_pct: float = 7.0,
        backoffice_setup_fee_dzd: float = 150_000.0,
        closing_days: int = 30,
    ) -> SyndicateSPV:
        """
        Creates a new AngelList-style SPV syndicate.
        """
        from datetime import timedelta
        closing_deadline = datetime.now(timezone.utc) + timedelta(days=closing_days)

        spv = SyndicateSPV(
            startup_name=startup_name,
            deal_round=deal_round,
            target_raise_dzd=target_raise_dzd,
            min_allocation_dzd=min_allocation_dzd,
            lead_investor_id=lead_investor_id,
            lead_name=lead_name,
            lead_carry_pct=lead_carry_pct,
            platform_carry_pct=platform_carry_pct,
            hurdle_rate_pct=hurdle_rate_pct,
            backoffice_setup_fee_dzd=backoffice_setup_fee_dzd,
            closing_deadline=closing_deadline,
            status=SPVStatus.OPEN,
        )
        self._spvs[spv.spv_id] = spv
        logger.info(f"Created Syndicate SPV {spv.spv_id} for startup '{startup_name}' by Lead {lead_name}")
        return spv

    def get_syndicate(self, spv_id: str) -> Optional[SyndicateSPV]:
        return self._spvs.get(spv_id)

    def add_member_pledge(
        self,
        spv_id: str,
        member_id: str,
        full_name: str,
        email: str,
        amount_dzd: float,
        is_lead: bool = False,
    ) -> SyndicateSPV:
        """
        Adds or updates a pledge allocation in the SPV.
        """
        spv = self._spvs.get(spv_id)
        if not spv:
            raise ValueError(f"Syndicate SPV '{spv_id}' not found.")

        if amount_dzd < spv.min_allocation_dzd and not is_lead:
            raise ValueError(
                f"Pledged amount {amount_dzd:,.0f} DZD is below minimum ticket {spv.min_allocation_dzd:,.0f} DZD."
            )

        # Check existing member
        existing = next((m for m in spv.members if m.member_id == member_id), None)
        if existing:
            existing.pledged_amount_dzd += amount_dzd
        else:
            member = SyndicateMember(
                member_id=member_id,
                full_name=full_name,
                email=email,
                pledged_amount_dzd=amount_dzd,
                is_lead=is_lead,
            )
            spv.members.append(member)

        return spv

    def calculate_waterfall(self, req: CarryWaterfallRequest) -> CarryWaterfallResult:
        """
        Executes multi-tier carry waterfall calculation:
        Tier 1: 100% Capital Repayment to LPs
        Tier 2: Preferred Return Hurdle (e.g. 7% per annum compounding)
        Tier 3: Carried Interest split: 15% Lead, 5% Platform, 80% LPs
        """
        E = req.exit_proceeds_dzd
        C = req.total_invested_capital_dzd
        h = req.hurdle_rate_pct / 100.0
        T = req.holding_period_years
        lead_carry_rate = req.lead_carry_pct / 100.0
        platform_carry_rate = req.platform_carry_pct / 100.0
        total_carry_rate = lead_carry_rate + platform_carry_rate

        # -------------------------------------------------------------------------
        # TIER 1: Return of Invested Capital
        # -------------------------------------------------------------------------
        t1_capital_returned = min(E, C)
        t1_shortfall = max(0.0, C - E)
        rem1 = max(0.0, E - C)

        # -------------------------------------------------------------------------
        # TIER 2: Preferred Return Hurdle
        # -------------------------------------------------------------------------
        # Compound hurdle target
        t2_hurdle_target = C * (math.pow(1.0 + h, T) - 1.0) if h > 0 else 0.0
        t2_preferred_paid = min(rem1, t2_hurdle_target)
        rem2 = max(0.0, rem1 - t2_hurdle_target)

        # -------------------------------------------------------------------------
        # TIER 3: Carried Interest & Residual Profits
        # -------------------------------------------------------------------------
        distributable_profit = rem2
        lead_carry = distributable_profit * lead_carry_rate
        platform_carry = distributable_profit * platform_carry_rate
        lp_residual_profit = distributable_profit - lead_carry - platform_carry

        # Totals
        total_lp_payout = t1_capital_returned + t2_preferred_paid + lp_residual_profit
        total_platform_payout = platform_carry
        total_lead_payout = lead_carry  # Pure carry (lead gets additional LP payout if they co-invested)

        # Performance Ratios
        lp_blended_moic = round(total_lp_payout / C, 3) if C > 0 else 1.0

        # Annualized net IRR
        if lp_blended_moic > 0 and T > 0:
            net_irr = round((math.pow(lp_blended_moic, 1.0 / T) - 1.0) * 100.0, 2)
        else:
            net_irr = -100.0

        # -------------------------------------------------------------------------
        # PER-MEMBER DISTRIBUTION LEDGER
        # -------------------------------------------------------------------------
        member_ledger: List[MemberPayout] = []
        if req.members and len(req.members) > 0:
            total_members_pledge = sum(m.pledged_amount_dzd for m in req.members)
            scale = C / max(total_members_pledge, 1.0)

            for m in req.members:
                effective_pledge = m.pledged_amount_dzd * scale
                lp_share = effective_pledge / max(C, 1.0)

                m_t1 = t1_capital_returned * lp_share
                m_t2 = t2_preferred_paid * lp_share
                m_t3 = lp_residual_profit * lp_share
                m_lead_carry = lead_carry if m.is_lead else 0.0

                m_total = m_t1 + m_t2 + m_t3 + m_lead_carry
                m_moic = round(m_total / max(effective_pledge, 1.0), 3)

                member_ledger.append(
                    MemberPayout(
                        member_id=m.member_id,
                        full_name=m.full_name,
                        is_lead=m.is_lead,
                        initial_pledge_dzd=round(m.pledged_amount_dzd, 2),
                        capital_return_dzd=round(m_t1, 2),
                        preferred_return_dzd=round(m_t2, 2),
                        residual_profit_dzd=round(m_t3, 2),
                        lead_carry_earned_dzd=round(m_lead_carry, 2),
                        total_distribution_dzd=round(m_total, 2),
                        moic=m_moic,
                    )
                )

        return CarryWaterfallResult(
            exit_proceeds_dzd=round(E, 2),
            total_invested_capital_dzd=round(C, 2),
            holding_period_years=T,
            hurdle_rate_pct=req.hurdle_rate_pct,
            tier1_capital_returned_dzd=round(t1_capital_returned, 2),
            tier1_shortfall_dzd=round(t1_shortfall, 2),
            tier2_hurdle_target_dzd=round(t2_hurdle_target, 2),
            tier2_preferred_return_paid_dzd=round(t2_preferred_paid, 2),
            tier3_distributable_profit_dzd=round(distributable_profit, 2),
            lead_carry_amount_dzd=round(lead_carry, 2),
            platform_carry_amount_dzd=round(platform_carry, 2),
            lp_residual_profit_dzd=round(lp_residual_profit, 2),
            total_lp_payout_dzd=round(total_lp_payout, 2),
            total_lead_payout_dzd=round(total_lead_payout, 2),
            total_platform_payout_dzd=round(total_platform_payout, 2),
            lp_blended_moic=lp_blended_moic,
            lp_net_annual_irr_pct=net_irr,
            per_member_ledger=member_ledger,
        )

    def calculate_pro_rata(self, req: ProRataCalculationRequest) -> ProRataCalculationResult:
        """
        Calculates exact pro-rata rights, required capital, share issuance,
        and dilution comparison for subsequent priced financing rounds.
        """
        current_ownership = (req.current_shares_held / req.total_pre_round_shares)
        pre_money = req.new_round_pre_money_dzd
        raise_target = req.new_round_target_raise_dzd
        post_money = pre_money + raise_target

        # Share price of new round = Pre-money / pre-round shares
        share_price = pre_money / float(req.total_pre_round_shares)

        # Pro-rata check to maintain exact ownership %
        # Check = Current Ownership * Target Raise
        pro_rata_check = current_ownership * raise_target
        new_shares_to_buy = int(round(pro_rata_check / share_price)) if share_price > 0 else 0

        # Total new shares issued in round = Raise / share_price
        total_new_shares = int(round(raise_target / share_price)) if share_price > 0 else 0
        total_post_shares = req.total_pre_round_shares + total_new_shares

        # Ownership if exercised
        post_shares_if_exercised = req.current_shares_held + new_shares_to_buy
        post_ownership_with_prorata = (post_shares_if_exercised / total_post_shares) * 100.0

        # Ownership if skipped (dilution)
        post_ownership_without_prorata = (req.current_shares_held / total_post_shares) * 100.0
        dilution_delta = (current_ownership * 100.0) - post_ownership_without_prorata

        # Option pool impact: if company expands option pool by X% prior to round
        pool_pct = req.option_pool_expansion_pct / 100.0
        dilution_with_pool = post_ownership_without_prorata * (1.0 - pool_pct)

        # Capital call breakdown per syndicate member
        member_allocations: Dict[str, float] = {}
        if req.syndicate_members:
            total_member_shares = sum(m.pledged_amount_dzd for m in req.syndicate_members)
            for m in req.syndicate_members:
                share_ratio = m.pledged_amount_dzd / max(total_member_shares, 1.0)
                member_allocations[m.member_id] = round(pro_rata_check * share_ratio, 2)

        capital_call = CapitalCallNotice(
            total_pro_rata_check_dzd=round(pro_rata_check, 2),
            payment_deadline_days=10,
            payment_instructions=(
                "Remit funds via SATIM/Edahabia interbank transfer to the SPAS Escrow Holding Account "
                "with reference: PRO-RATA-SERIES-A-TAMWHEEL."
            ),
            per_member_allocations=member_allocations,
        )

        return ProRataCalculationResult(
            current_ownership_pct=round(current_ownership * 100.0, 2),
            new_round_pre_money_dzd=pre_money,
            new_round_post_money_dzd=post_money,
            new_round_target_raise_dzd=raise_target,
            share_price_new_round_dzd=round(share_price, 2),
            pro_rata_investment_required_dzd=round(pro_rata_check, 2),
            new_shares_to_acquire=new_shares_to_buy,
            total_shares_post_exercise=post_shares_if_exercised,
            post_round_ownership_with_prorata_pct=round(post_ownership_with_prorata, 2),
            post_round_ownership_without_prorata_pct=round(post_ownership_without_prorata, 2),
            dilution_loss_pct=round(dilution_delta, 2),
            effective_dilution_with_pool_pct=round(dilution_with_pool, 2),
            capital_call_notice=capital_call,
        )


syndicate_deal_engine = SyndicateDealEngine()
