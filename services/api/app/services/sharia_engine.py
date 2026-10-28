"""
TamWheel Sovereign Ethical Agentic Venture OS — Programmatic Sharia & Istihaq Engine Gateway.
Consolidates and re-exports:
- ShariaComplianceEngine from app.services.sharia_compliance
- IstihaqEngine from app.services.istihaq_engine
- MusharakahMutanaqisahEngine from app.services.musharakah_engine
- MicroSukukRevenueShareEngine from app.services.sukuk_engine
- TathirCharityRoutingService from app.services.tathir_routing
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

# Re-export Musharakah Mutanaqisah
from app.services.musharakah_engine import (
    PaymentFrequency,
    AssetCategory,
    BuyoutTranche,
    MusharakahScheduleRequest,
    MusharakahScheduleResponse,
    EarlyBuyoutCalculationRequest,
    EarlyBuyoutCalculationResponse,
    MusharakahMutanaqisahEngine,
    musharakah_engine,
)

# Re-export Micro-Sukuk
from app.services.sukuk_engine import (
    SukukContractType,
    SukukStatus,
    SukukDistributionEntry,
    IssueSukukRequest,
    SukukIssuance,
    RecordDistributionRequest,
    MicroSukukRevenueShareEngine,
    sukuk_engine,
)

# Re-export Tathir Charity Routing
from app.services.tathir_routing import (
    CharitySector,
    AccreditedCharity,
    TathirDisbursementRequest,
    TathirReceipt,
    TathirCharityRoutingService,
    tathir_routing_service,
)

# Re-export AAOIFI FAS 9 Zakat Engine
from app.services.zakat_engine import (
    ZakatCalculationMethod,
    YearType,
    NisabBenchmark,
    InvestorType,
    WorkingCapitalAssetsInput,
    WorkingCapitalLiabilitiesInput,
    InvestedCapitalComponentsInput,
    CompanyZakatRequest,
    CompanyZakatAssessment,
    InvestorZakatRequest,
    InvestorZakatAssessment,
    NisabEvaluation,
    ZakatEngine,
    zakat_engine,
)

# Re-export AAOIFI Standard No. 8 Murabaha Engine
from app.services.murabaha_engine import (
    MurabahaStage,
    MurabahaAssetCategory,
    PossessionType,
    AmortizationFrequency,
    InstallmentStatus,
    InstallmentTranche,
    MurabahaPurchaseOrderRequest,
    GoodsPossessionConfirmationRequest,
    MurabahaSaleExecutionRequest,
    RecordInstallmentPaymentRequest,
    ApplyLatePenaltyRequest,
    MurabahaFacility,
    MurabahaEngine,
    murabaha_engine,
)


class ShariaEngine:
    """
    Unified gateway for Sharia Compliance Screening, Istihaq Calculations,
    Musharakah Buyouts, Micro-Sukuk Revenue Sharing, Tathir Charity Routing,
    AAOIFI FAS 9 Zakat Calculations, and AAOIFI Standard No. 8 Murabaha Facilities.
    """

    def __init__(self) -> None:
        self.compliance_engine = sharia_compliance_engine
        self.istihaq_engine = istihaq_engine
        self.musharakah_engine = musharakah_engine
        self.sukuk_engine = sukuk_engine
        self.tathir_routing = tathir_routing_service
        self.zakat_engine = zakat_engine
        self.murabaha_engine = murabaha_engine

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

    def calculate_company_zakat(self, req: CompanyZakatRequest) -> CompanyZakatAssessment:
        return self.zakat_engine.calculate_company_zakat(req)

    def calculate_investor_zakat(self, req: InvestorZakatRequest) -> InvestorZakatAssessment:
        return self.zakat_engine.calculate_investor_zakat(req)

    def evaluate_nisab(
        self,
        zakat_base_dzd: float,
        benchmark: NisabBenchmark = NisabBenchmark.GOLD_85G,
        custom_gold_price: Optional[float] = None,
        custom_silver_price: Optional[float] = None,
    ) -> NisabEvaluation:
        return self.zakat_engine.evaluate_nisab(
            zakat_base_dzd=zakat_base_dzd,
            benchmark=benchmark,
            custom_gold_price=custom_gold_price,
            custom_silver_price=custom_silver_price,
        )


sharia_engine = ShariaEngine()
