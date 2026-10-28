"""
TamWheel Sovereign Ethical Agentic Venture OS — Programmatic Sharia & Istihaq Engine Gateway.
Consolidates and re-exports:
- ShariaComplianceEngine from app.services.sharia_compliance
- IstihaqEngine from app.services.istihaq_engine
Preserves 100% backward compatibility for all existing imports and tests.
"""

from __future__ import annotations

from typing import List, Optional

# Re-export Sharia screening & Tathir schemas and constants
from app.services.sharia_compliance import (
    ShariaVerdict,
    ProhibitedSector,
    AAOIFI_MAX_DEBT_RATIO,
    AAOIFI_MAX_INTEREST_DEPOSITS_RATIO,
    AAOIFI_MAX_NON_PERMISSIBLE_REVENUE,
    FinancialStatement,
    RatioScreenResult,
    TathirAssessment,
    ShariaScreeningResult,
    ShariaCertificate,
    ShariaComplianceEngine,
    sharia_compliance_engine,
)

# Re-export Istihaq & Bounty schemas and constants
from app.services.istihaq_engine import (
    MilestoneType,
    VerificationStatus,
    BountyStatus,
    ExpertRoleTier,
    MIN_BSA_AIR_EQUITY_PCT,
    MAX_BSA_AIR_EQUITY_PCT,
    MILESTONE_TYPE_MULTIPLIERS,
    REQUIRED_EXPERT_REVIEWS,
    MINIMUM_COMPOSITE_SCORE_FOR_PASS,
    ExpertReview,
    BountySubmission,
    BSAAirWarrantCertificate,
    S4EBounty,
    MilestoneDeliverable,
    MilestoneAllocation,
    LegalWarrantPayload,
    IstihaqCalculationRequest,
    IstihaqCalculationResult,
    IstihaqEngine,
    istihaq_engine,
)


class ShariaEngine:
    """
    Unified gateway for Sharia Compliance Screening and Istihaq Calculations.
    Delegates to sharia_compliance_engine and istihaq_engine.
    """

    def __init__(self) -> None:
        self.compliance_engine = sharia_compliance_engine
        self.istihaq_engine = istihaq_engine

    def screen_financials(self, statement: FinancialStatement) -> ShariaScreeningResult:
        return self.compliance_engine.screen_financials(statement)

    def calculate_tathir(
        self,
        total_revenue_dzd: float,
        non_permissible_revenue_dzd: float,
        dividend_amount_dzd: float = 0.0,
        total_shares: int = 0,
        shares_held: int = 0,
    ) -> TathirAssessment:
        return self.compliance_engine.calculate_tathir(
            total_revenue_dzd=total_revenue_dzd,
            non_permissible_revenue_dzd=non_permissible_revenue_dzd,
            dividend_amount_dzd=dividend_amount_dzd,
            total_shares=total_shares,
            shares_held=shares_held,
        )

    def generate_certificate(
        self,
        startup_id: str,
        startup_name: str,
        statement: FinancialStatement,
    ) -> ShariaCertificate:
        return self.compliance_engine.generate_certificate(startup_id, startup_name, statement)

    def calculate_istihaq(self, req: IstihaqCalculationRequest) -> IstihaqCalculationResult:
        return self.istihaq_engine.calculate_istihaq(req)


sharia_engine = ShariaEngine()
