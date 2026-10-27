"""
TamWheel Sovereign Ethical Agentic Venture OS — Programmatic Sharia & Istihaq Engine.
Implements:
1. AAOIFI Shariah Standard No. 21 Financial Ratio & Sector Screening.
2. Dynamic Proof-of-Contribution (Istihaq) Sweat-Equity Allocation & Vesting Calculator.
"""

from __future__ import annotations

import enum
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS & CONSTANTS
# =============================================================================

class ShariaVerdict(str, enum.Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    QUESTIONABLE = "QUESTIONABLE"


class ProhibitedSector(str, enum.Enum):
    ALCOHOL = "ALCOHOL"
    GAMBLING = "GAMBLING"
    CONVENTIONAL_FINANCE = "CONVENTIONAL_FINANCE"
    PORK = "PORK"
    ADULT_ENTERTAINMENT = "ADULT_ENTERTAINMENT"
    TOBACCO = "TOBACCO"
    WEAPONS = "WEAPONS"
    SPECULATIVE_DERIVATIVES = "SPECULATIVE_DERIVATIVES"


class MilestoneType(str, enum.Enum):
    CODE_PULL_REQUEST = "CODE_PULL_REQUEST"
    SECURITY_AUDIT = "SECURITY_AUDIT"
    AI_DATASET_LABELING = "AI_DATASET_LABELING"
    ARCHITECTURE_DESIGN = "ARCHITECTURE_DESIGN"
    REGULATORY_FILING = "REGULATORY_FILING"
    GROWTH_MARKETING = "GROWTH_MARKETING"


class VerificationStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    PENDING_REVIEW = "PENDING_REVIEW"
    REJECTED = "REJECTED"


# AAOIFI Standard 21 Benchmarks
AAOIFI_MAX_DEBT_RATIO = 0.33            # Debt / Market Cap < 33%
AAOIFI_MAX_INTEREST_DEPOSITS_RATIO = 0.33 # Cash + Interest-bearing deposits / Market Cap < 33%
AAOIFI_MAX_NON_PERMISSIBLE_REVENUE = 0.05 # Non-halal revenue / Total revenue < 5%

# Type multipliers for sweat equity labor valuation
MILESTONE_TYPE_MULTIPLIERS = {
    MilestoneType.CODE_PULL_REQUEST: 1.25,
    MilestoneType.SECURITY_AUDIT: 1.50,
    MilestoneType.AI_DATASET_LABELING: 1.10,
    MilestoneType.ARCHITECTURE_DESIGN: 1.35,
    MilestoneType.REGULATORY_FILING: 1.30,
    MilestoneType.GROWTH_MARKETING: 1.05,
}


# =============================================================================
# SCHEMAS FOR SHARIA SCREENING
# =============================================================================

class FinancialStatement(BaseModel):
    total_assets_dzd: float = Field(..., ge=0, description="Total balance sheet assets in DZD")
    market_cap_dzd: Optional[float] = Field(None, ge=0, description="Market cap or fair implied valuation in DZD")
    total_debt_dzd: float = Field(0.0, ge=0, description="Total interest-bearing debt in DZD")
    interest_bearing_deposits_dzd: float = Field(0.0, ge=0, description="Cash and interest-bearing deposits in DZD")
    total_revenue_dzd: float = Field(..., ge=0, description="Gross annualized revenue in DZD")
    non_permissible_revenue_dzd: float = Field(0.0, ge=0, description="Revenue derived from non-compliant sources in DZD")
    business_sectors: List[str] = Field(default_factory=list, description="Primary and secondary industry sectors")
    business_description: str = Field(default="", description="Executive summary of operations and products")


class RatioScreenResult(BaseModel):
    metric_name: str
    ratio: float
    threshold: float
    passed: bool
    description: str


class ShariaScreeningResult(BaseModel):
    is_compliant: bool
    verdict: ShariaVerdict
    standards_reference: str = "AAOIFI Shariah Standard No. 21"
    debt_to_market_cap_ratio: float
    interest_bearing_deposits_ratio: float
    non_permissible_revenue_ratio: float
    ratio_screens: List[RatioScreenResult]
    prohibited_sectors_detected: List[str]
    purification_required_dzd: float
    purification_percentage: float
    screening_notes: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SCHEMAS FOR ISTIHAQ SWEAT EQUITY
# =============================================================================

class MilestoneDeliverable(BaseModel):
    milestone_id: str
    contributor_id: str
    title: str
    milestone_type: MilestoneType = MilestoneType.CODE_PULL_REQUEST
    complexity_weight: float = Field(default=1.0, ge=0.5, le=10.0, description="Effort/complexity multiplier (1-10)")
    estimated_labor_value_dzd: float = Field(..., gt=0, description="Estimated fiat market value of labor in DZD")
    verification_status: VerificationStatus = VerificationStatus.PENDING_REVIEW
    proof_hash: Optional[str] = Field(None, description="Cryptographic SHA256 proof or Git commit hash")
    evidence_url: Optional[str] = Field(None, description="GitHub PR, Figma link, or audit report URL")
    verified_by: Optional[str] = Field(None, description="Oracle node or reviewer identity")


class IstihaqCalculationRequest(BaseModel):
    startup_id: str
    post_money_valuation_dzd: float = Field(..., gt=0, description="Startup valuation base in DZD")
    total_tokenized_shares: int = Field(default=1_000_000, gt=0, description="Total authorized cap-table shares")
    sweat_equity_pool_pct: float = Field(default=10.0, gt=0, le=50.0, description="Max S4E pool reservation %")
    allocated_shares_so_far: int = Field(default=0, ge=0, description="Shares already issued from S4E pool")
    milestones: List[MilestoneDeliverable]


class MilestoneAllocation(BaseModel):
    milestone_id: str
    title: str
    milestone_type: MilestoneType
    status: VerificationStatus
    labor_value_dzd: float
    adjusted_labor_value_dzd: float
    shares_allocated: int
    vested_shares: int
    unvested_shares: int
    equity_pct: float
    proof_hash: Optional[str]


class LegalWarrantPayload(BaseModel):
    warrant_id: str
    warrant_hash: str
    startup_id: str
    total_shares: int
    beneficial_holder: str
    legal_structure: str = "SPAS Nominee Cap-Table (Law 22-09)"
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IstihaqCalculationResult(BaseModel):
    startup_id: str
    post_money_valuation_dzd: float
    share_price_dzd: float
    total_shares_allocated: int
    equity_percentage_earned: float
    monetary_equivalent_dzd: float
    vested_shares: int
    unvested_shares: int
    sweat_equity_pool_cap_shares: int
    remaining_pool_shares: int
    pool_utilization_pct: float
    milestones_summary: List[MilestoneAllocation]
    warrant_issuance: LegalWarrantPayload
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SHARIA & ISTIHAQ ENGINE IMPLEMENTATION
# =============================================================================

class ShariaEngine:
    """
    Core computational engine for AAOIFI Sharia screening and Istihaq sweat equity.
    """

    PROHIBITED_KEYWORDS = {
        ProhibitedSector.ALCOHOL: ["alcohol", "wine", "beer", "brewery", "liquor", "distillery"],
        ProhibitedSector.GAMBLING: ["casino", "gambling", "betting", "lottery", "poker", "wagering"],
        ProhibitedSector.CONVENTIONAL_FINANCE: ["commercial bank", "usury", "interest lending", "payday loan", "conventional insurance"],
        ProhibitedSector.PORK: ["pork", "swine", "bacon", "ham processing"],
        ProhibitedSector.ADULT_ENTERTAINMENT: ["pornography", "adult entertainment", "escort"],
        ProhibitedSector.TOBACCO: ["tobacco", "cigarettes", "vaping", "nicotine"],
        ProhibitedSector.WEAPONS: ["firearms", "munitions", "offensive weapon", "missile", "cluster bomb"],
        ProhibitedSector.SPECULATIVE_DERIVATIVES: ["binary options", "cfd leverage", "naked shorting"],
    }

    def screen_financials(self, stmt: FinancialStatement) -> ShariaScreeningResult:
        """
        Executes comprehensive AAOIFI Shariah Standard No. 21 financial and qualitative screening.
        """
        notes: List[str] = []
        prohibited_detected: List[str] = []

        # 1. Qualitative Business Activity / Sector Screening
        combined_text = (
            " ".join(stmt.business_sectors) + " " + stmt.business_description
        ).lower()

        for sector, keywords in self.PROHIBITED_KEYWORDS.items():
            for kw in keywords:
                if kw in combined_text:
                    if sector.value not in prohibited_detected:
                        prohibited_detected.append(sector.value)
                        notes.append(f"Prohibited sector flagged: {sector.value} due to keyword '{kw}'.")

        # 2. Denominator Selection (Market Cap preferred, fall back to Total Assets)
        denominator = stmt.market_cap_dzd if (stmt.market_cap_dzd and stmt.market_cap_dzd > 0) else stmt.total_assets_dzd
        if denominator <= 0:
            denominator = max(stmt.total_revenue_dzd, 1.0)

        # 3. Financial Ratio 1: Debt to Market Cap / Assets
        debt_ratio = stmt.total_debt_dzd / denominator
        debt_passed = debt_ratio < AAOIFI_MAX_DEBT_RATIO
        notes.append(
            f"Debt ratio: {debt_ratio:.2%} vs max threshold {AAOIFI_MAX_DEBT_RATIO:.0%} "
            f"({'PASSED' if debt_passed else 'FAILED'})."
        )

        # 4. Financial Ratio 2: Cash & Interest-Bearing Deposits
        deposit_ratio = stmt.interest_bearing_deposits_dzd / denominator
        deposit_passed = deposit_ratio < AAOIFI_MAX_INTEREST_DEPOSITS_RATIO
        notes.append(
            f"Interest-bearing deposits ratio: {deposit_ratio:.2%} vs max threshold "
            f"{AAOIFI_MAX_INTEREST_DEPOSITS_RATIO:.0%} ({'PASSED' if deposit_passed else 'FAILED'})."
        )

        # 5. Financial Ratio 3: Non-Permissible Revenue
        revenue_base = stmt.total_revenue_dzd if stmt.total_revenue_dzd > 0 else 1.0
        revenue_ratio = stmt.non_permissible_revenue_dzd / revenue_base
        revenue_passed = revenue_ratio < AAOIFI_MAX_NON_PERMISSIBLE_REVENUE
        notes.append(
            f"Non-permissible revenue ratio: {revenue_ratio:.2%} vs max threshold "
            f"{AAOIFI_MAX_NON_PERMISSIBLE_REVENUE:.0%} ({'PASSED' if revenue_passed else 'FAILED'})."
        )

        # 6. Purification (Tathir) Calculation
        purification_required = float(stmt.non_permissible_revenue_dzd)
        purification_pct = revenue_ratio * 100.0
        if purification_required > 0:
            notes.append(
                f"Tathir (Purification) required: {purification_required:,.2f} DZD must be cleansed to approved charity."
            )

        # 7. Final Verdict
        has_prohibited_core_sector = len(prohibited_detected) > 0
        ratios_all_passed = debt_passed and deposit_passed and revenue_passed

        if has_prohibited_core_sector or not ratios_all_passed:
            is_compliant = False
            verdict = ShariaVerdict.NON_COMPLIANT
        else:
            # Check for borderline questionable zone (e.g. debt between 30% and 33% or revenue between 4% and 5%)
            is_borderline = (
                (debt_ratio >= 0.30)
                or (deposit_ratio >= 0.30)
                or (revenue_ratio >= 0.04)
            )
            if is_borderline:
                is_compliant = True
                verdict = ShariaVerdict.QUESTIONABLE
                notes.append("Verdict is QUESTIONABLE / BORDERLINE: Ratios are near upper AAOIFI limits.")
            else:
                is_compliant = True
                verdict = ShariaVerdict.COMPLIANT

        ratio_screens = [
            RatioScreenResult(
                metric_name="Debt to Market Cap",
                ratio=round(debt_ratio, 4),
                threshold=AAOIFI_MAX_DEBT_RATIO,
                passed=debt_passed,
                description="Total interest-bearing debt divided by market cap or total assets",
            ),
            RatioScreenResult(
                metric_name="Interest-Bearing Cash & Deposits",
                ratio=round(deposit_ratio, 4),
                threshold=AAOIFI_MAX_INTEREST_DEPOSITS_RATIO,
                passed=deposit_passed,
                description="Cash and interest-bearing investments divided by market cap or total assets",
            ),
            RatioScreenResult(
                metric_name="Non-Permissible Revenue",
                ratio=round(revenue_ratio, 4),
                threshold=AAOIFI_MAX_NON_PERMISSIBLE_REVENUE,
                passed=revenue_passed,
                description="Tainted or non-halal income divided by gross revenue",
            ),
        ]

        return ShariaScreeningResult(
            is_compliant=is_compliant,
            verdict=verdict,
            debt_to_market_cap_ratio=round(debt_ratio, 4),
            interest_bearing_deposits_ratio=round(deposit_ratio, 4),
            non_permissible_revenue_ratio=round(revenue_ratio, 4),
            ratio_screens=ratio_screens,
            prohibited_sectors_detected=prohibited_detected,
            purification_required_dzd=round(purification_required, 2),
            purification_percentage=round(purification_pct, 4),
            screening_notes=notes,
        )

    def calculate_istihaq(self, req: IstihaqCalculationRequest) -> IstihaqCalculationResult:
        """
        Calculates dynamic Istihaq proof-of-contribution sweat equity vesting.
        Links verified milestone deliverables to tokenized cap-table shares and produces legal warrants.
        """
        share_price = req.post_money_valuation_dzd / req.total_tokenized_shares
        pool_cap_shares = int(req.total_tokenized_shares * (req.sweat_equity_pool_pct / 100.0))
        remaining_pool_shares = max(0, pool_cap_shares - req.allocated_shares_so_far)

        allocations: List[MilestoneAllocation] = []
        total_new_shares = 0
        total_vested_shares = 0
        total_unvested_shares = 0
        total_labor_value_dzd = 0.0

        for m in req.milestones:
            multiplier = MILESTONE_TYPE_MULTIPLIERS.get(m.milestone_type, 1.0)
            complexity_factor = 1.0 + ((m.complexity_weight - 1.0) * 0.08)
            adjusted_value = m.estimated_labor_value_dzd * multiplier * complexity_factor

            # Only VERIFIED deliverables convert into equity shares
            if m.verification_status == VerificationStatus.VERIFIED:
                shares = int(adjusted_value / share_price) if share_price > 0 else 0
                
                # Check pool bounds
                if total_new_shares + shares > remaining_pool_shares:
                    shares = max(0, remaining_pool_shares - total_new_shares)

                # Milestone completion vests 80% immediately, 20% subject to 90-day retention lock
                vested = int(shares * 0.80)
                unvested = shares - vested

                total_new_shares += shares
                total_vested_shares += vested
                total_unvested_shares += unvested
                total_labor_value_dzd += adjusted_value
                eq_pct = (shares / req.total_tokenized_shares) * 100.0
            else:
                shares = 0
                vested = 0
                unvested = 0
                eq_pct = 0.0

            allocations.append(
                MilestoneAllocation(
                    milestone_id=m.milestone_id,
                    title=m.title,
                    milestone_type=m.milestone_type,
                    status=m.verification_status,
                    labor_value_dzd=round(m.estimated_labor_value_dzd, 2),
                    adjusted_labor_value_dzd=round(adjusted_value, 2),
                    shares_allocated=shares,
                    vested_shares=vested,
                    unvested_shares=unvested,
                    equity_pct=round(eq_pct, 4),
                    proof_hash=m.proof_hash,
                )
            )

        updated_remaining_pool = max(0, remaining_pool_shares - total_new_shares)
        pool_utilization = (
            ((req.allocated_shares_so_far + total_new_shares) / pool_cap_shares) * 100.0
            if pool_cap_shares > 0
            else 0.0
        )
        total_equity_pct = (total_new_shares / req.total_tokenized_shares) * 100.0
        monetary_equivalent = total_new_shares * share_price

        # Generate cryptographic legal warrant payload
        beneficiary = req.milestones[0].contributor_id if req.milestones else "ANONYMOUS_CONTRIBUTOR"
        warrant_id = f"WRNT-{req.startup_id[:8].upper()}-{hashlib.md5(f'{beneficiary}:{total_new_shares}'.encode()).hexdigest()[:8].upper()}"
        
        hasher = hashlib.sha256()
        hasher.update(f"{warrant_id}:{req.startup_id}:{beneficiary}:{total_new_shares}:{total_equity_pct}".encode())
        warrant_hash = hasher.hexdigest()

        warrant_issuance = LegalWarrantPayload(
            warrant_id=warrant_id,
            warrant_hash=warrant_hash,
            startup_id=req.startup_id,
            total_shares=total_new_shares,
            beneficial_holder=beneficiary,
        )

        return IstihaqCalculationResult(
            startup_id=req.startup_id,
            post_money_valuation_dzd=req.post_money_valuation_dzd,
            share_price_dzd=round(share_price, 4),
            total_shares_allocated=total_new_shares,
            equity_percentage_earned=round(total_equity_pct, 4),
            monetary_equivalent_dzd=round(monetary_equivalent, 2),
            vested_shares=total_vested_shares,
            unvested_shares=total_unvested_shares,
            sweat_equity_pool_cap_shares=pool_cap_shares,
            remaining_pool_shares=updated_remaining_pool,
            pool_utilization_pct=round(pool_utilization, 2),
            milestones_summary=allocations,
            warrant_issuance=warrant_issuance,
        )


sharia_engine = ShariaEngine()
