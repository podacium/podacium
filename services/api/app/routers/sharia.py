"""
TamWheel Sovereign Ethical Agentic Venture OS — Programmatic Sharia & AI Dealmaker Swarm Router.
Exposes endpoints for:
1. AAOIFI Sharia Compliance Screening (`/sharia/screen`)
2. Official Cryptographic Sharia Certificate Generation (`/sharia/certificate`)
3. Tathir (Financial Purification) Assessment (`/sharia/tathir/calculate`)
4. Tathir Charity Routing & Verifiable Receipts (`/sharia/tathir/charities`, `/sharia/tathir/disburse`, `/sharia/tathir/receipts/{id}`)
5. Diminishing Musharakah Schedules & Early Buyouts (`/sharia/musharakah/schedule`, `/sharia/musharakah/early-buyout`)
6. Fractional Micro-Sukuk Revenue Share Issuance & Distribution (`/sharia/sukuk/issue`, `/sharia/sukuk/{id}/distribute`)
7. Dynamic Proof-of-Contribution Istihaq Calculation (`/sharia/istihaq/calculate`)
8. Multi-Agent AI Due Diligence Swarm Analysis (`/swarm/analyze`)
9. Autonomous AI-to-AI Dealmaking & MAUT Term Sheet Negotiation (`/swarm/negotiate`)
"""

import logging
from typing import Optional, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.sharia_compliance import (
    sharia_compliance_engine,
    FinancialStatement,
    ShariaScreeningResult,
    ShariaCertificate,
    TathirAssessment,
)
from app.services.istihaq_engine import (
    istihaq_engine,
    IstihaqCalculationRequest,
    IstihaqCalculationResult,
)
from app.services.musharakah_engine import (
    musharakah_engine,
    MusharakahScheduleRequest,
    MusharakahScheduleResponse,
    EarlyBuyoutCalculationRequest,
    EarlyBuyoutCalculationResponse,
)
from app.services.sukuk_engine import (
    sukuk_engine,
    IssueSukukRequest,
    SukukIssuance,
    RecordDistributionRequest,
    SukukDistributionEntry,
)
from app.services.tathir_routing import (
    tathir_routing_service,
    AccreditedCharity,
    TathirDisbursementRequest,
    TathirReceipt,
)
from app.services.zakat_engine import (
    zakat_engine,
    CompanyZakatRequest,
    CompanyZakatAssessment,
    InvestorZakatRequest,
    InvestorZakatAssessment,
    NisabEvaluation,
    NisabBenchmark,
)
from app.services.murabaha_engine import (
    murabaha_engine,
    MurabahaPurchaseOrderRequest,
    GoodsPossessionConfirmationRequest,
    MurabahaSaleExecutionRequest,
    RecordInstallmentPaymentRequest,
    ApplyLatePenaltyRequest,
    MurabahaFacility,
)
from app.services.salam_engine import (
    salam_engine,
    SalamContractRequest,
    SalamInspectionRequest,
    ParallelSalamRequest,
    WikalahLiquidationRequest,
    SalamDelayRemedyRequest,
    SalamFacility,
)
from app.services.istisnaa_engine import (
    istisnaa_engine,
    IstisnaaContractRequest,
    WIPCertificationRequest,
    DisburseMilestoneRequest,
    ProvisionalAcceptanceRequest,
    DefectReportRequest,
    ResolveDefectRequest,
    FinalAcceptanceRequest,
    LiquidatedDamagesRequest,
    IstisnaaFacility,
    DefectClaim,
)
from app.services.dealmaker_swarm import (
    dealmaker_swarm,
    StartupProfileInput,
    SwarmAnalysisResponse,
    NegotiationRequest,
    NegotiationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# REQUEST SCHEMAS FOR SHARIA CERTIFICATE & TATHIR
# =============================================================================

class GenerateCertificateRequest(BaseModel):
    startup_id: str = Field(..., description="Unique startup ID")
    startup_name: str = Field(..., description="Startup name")
    financial_statement: FinancialStatement


class TathirCalculationRequest(BaseModel):
    total_revenue_dzd: float = Field(..., ge=0, description="Gross annualized revenue in DZD")
    non_permissible_revenue_dzd: float = Field(..., ge=0, description="Tainted/impermissible revenue in DZD")
    dividend_amount_dzd: float = Field(0.0, ge=0, description="Declared or projected dividend payout in DZD")
    total_shares: int = Field(0, ge=0, description="Total outstanding share count")
    shares_held: int = Field(0, ge=0, description="Investor specific shareholding count")


# =============================================================================
# 1. SHARIA SCREENING & TATHIR ENDPOINTS
# =============================================================================

@router.post(
    "/sharia/screen",
    response_model=ShariaScreeningResult,
    summary="Run programmatic AAOIFI Sharia compliance screen",
    description=(
        "Performs algorithmic AAOIFI Shariah Standard No. 21 screening: "
        "debt-to-market-cap (<33%), interest-bearing deposits (<33%), "
        "and non-permissible revenue (<5%), along with prohibited sector detection "
        "and required purification (Tathir) calculation."
    ),
)
async def screen_startup_sharia(
    statement: FinancialStatement,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> ShariaScreeningResult:
    """Run automated Sharia screening on startup financial metrics and business activity."""
    try:
        return sharia_compliance_engine.screen_financials(statement)
    except Exception as e:
        logger.error(f"Error during Sharia screening: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sharia screening calculation failed: {str(e)}",
        )


@router.post(
    "/sharia/certificate",
    response_model=ShariaCertificate,
    summary="Generate official Sharia Compliance Certificate with cryptographic seal",
    description=(
        "Evaluates the startup financials under AAOIFI Standard No. 21 and generates "
        "an official Sharia Certificate with canonical JSON SHA-256 audit hash and digital seal."
    ),
)
async def generate_sharia_certificate(
    req: GenerateCertificateRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> ShariaCertificate:
    """Generate cryptographically verifiable Sharia Certificate."""
    try:
        return sharia_compliance_engine.generate_certificate(
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            statement=req.financial_statement,
        )
    except Exception as e:
        logger.error(f"Error generating Sharia certificate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Certificate generation failed: {str(e)}",
        )


@router.post(
    "/sharia/tathir/calculate",
    response_model=TathirAssessment,
    summary="Calculate exact Tathir financial purification requirements",
    description=(
        "Calculates per-share and total dividend purification amounts for non-operating "
        "interest income or tainted revenues. Outlines Sharia Sadaqah distribution rulings "
        "and statutory tax non-deductibility principles under AAOIFI Standard 21."
    ),
)
async def calculate_tathir_purification(
    req: TathirCalculationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> TathirAssessment:
    """Assess required Tathir purification amount and distribution guidelines."""
    try:
        return sharia_compliance_engine.calculate_tathir(
            total_revenue_dzd=req.total_revenue_dzd,
            non_permissible_revenue_dzd=req.non_permissible_revenue_dzd,
            dividend_amount_dzd=req.dividend_amount_dzd,
            total_shares=req.total_shares,
            shares_held=req.shares_held,
        )
    except Exception as e:
        logger.error(f"Error calculating Tathir purification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tathir calculation failed: {str(e)}",
        )


# =============================================================================
# 2. TATHIR CHARITY ROUTING ENDPOINTS
# =============================================================================

@router.get(
    "/sharia/tathir/charities",
    response_model=List[AccreditedCharity],
    summary="List accredited Algerian public interest charities for Tathir",
    description="Returns pre-vetted Algerian charitable institutions eligible to receive purified funds.",
)
async def list_accredited_charities(
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[AccreditedCharity]:
    return tathir_routing_service.get_accredited_charities()


@router.post(
    "/sharia/tathir/disburse",
    response_model=TathirReceipt,
    summary="Disburse Tathir purification to an accredited charity",
    description="Routes cleansed impermissible income and generates a cryptographically verifiable donation receipt.",
)
async def disburse_tathir_purification(
    req: TathirDisbursementRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> TathirReceipt:
    try:
        return tathir_routing_service.disburse_purification(req)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/sharia/tathir/receipts/{receipt_id}",
    response_model=TathirReceipt,
    summary="Retrieve verified Tathir donation receipt",
    description="Fetch cryptographic receipt by receipt ID.",
)
async def get_tathir_receipt(
    receipt_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> TathirReceipt:
    receipt = tathir_routing_service.get_receipt(receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Receipt '{receipt_id}' not found.")
    return receipt


# =============================================================================
# 3. MUSHARAKAH MUTANAQISAH (DIMINISHING PARTNERSHIP) ENDPOINTS
# =============================================================================

@router.post(
    "/sharia/musharakah/schedule",
    response_model=MusharakahScheduleResponse,
    summary="Generate Diminishing Musharakah buyout & rental schedule",
    description=(
        "Calculates asset co-ownership buyout tranches under AAOIFI Standard No. 12 and No. 9. "
        "Separates unit principal buyouts from sliding-scale rental payments until 100% title transfers to founder."
    ),
)
async def generate_musharakah_schedule(
    req: MusharakahScheduleRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> MusharakahScheduleResponse:
    try:
        return musharakah_engine.calculate_schedule(req)
    except Exception as e:
        logger.error(f"Error generating Musharakah schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Musharakah calculation failed: {str(e)}",
        )


@router.post(
    "/sharia/musharakah/early-buyout",
    response_model=EarlyBuyoutCalculationResponse,
    summary="Calculate early buyout settlement under Da' wa Ta'ajjal",
    description="Computes immediate lump-sum buyout and avoided rental savings for accelerated asset ownership transfer.",
)
async def calculate_early_buyout(
    req: EarlyBuyoutCalculationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> EarlyBuyoutCalculationResponse:
    try:
        return musharakah_engine.calculate_early_buyout(req)
    except Exception as e:
        logger.error(f"Error calculating early buyout: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Early buyout calculation failed: {str(e)}",
        )


# =============================================================================
# 4. MICRO-SUKUK REVENUE SHARE ENDPOINTS
# =============================================================================

@router.post(
    "/sharia/sukuk/issue",
    response_model=SukukIssuance,
    status_code=status.HTTP_201_CREATED,
    summary="Issue fractional Micro-Sukuk revenue share certificates",
    description="Mints AAOIFI Standard No. 17 compliant Micro-Sukuk Al-Istithmar certificates tied to monthly gross revenue.",
)
async def issue_micro_sukuk(
    req: IssueSukukRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SukukIssuance:
    try:
        return sukuk_engine.issue_sukuk(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error issuing Sukuk: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/sharia/sukuk",
    response_model=List[SukukIssuance],
    summary="List active Micro-Sukuk issuances",
    description="Retrieve all active or offering Sukuk certificates.",
)
async def list_micro_sukuks(
    startup_id: Optional[str] = Query(None, description="Filter by startup ID"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[SukukIssuance]:
    return sukuk_engine.list_sukuk(startup_id=startup_id)


@router.get(
    "/sharia/sukuk/{sukuk_id}",
    response_model=SukukIssuance,
    summary="Get Micro-Sukuk issuance details",
    description="Fetch single Sukuk certificate with distribution history and audit seal.",
)
async def get_micro_sukuk_by_id(
    sukuk_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SukukIssuance:
    sukuk = sukuk_engine.get_sukuk(sukuk_id)
    if not sukuk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sukuk '{sukuk_id}' not found.")
    return sukuk


@router.post(
    "/sharia/sukuk/{sukuk_id}/distribute",
    response_model=SukukDistributionEntry,
    summary="Record periodic gross revenue distribution on Sukuk",
    description="Calculates periodic revenue share distribution per certificate and allocates Mudarib bonus if above hurdle.",
)
async def distribute_sukuk_revenue(
    sukuk_id: str,
    req: RecordDistributionRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SukukDistributionEntry:
    try:
        return sukuk_engine.record_distribution(sukuk_id, req)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sukuk '{sukuk_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =============================================================================
# 5. DYNAMIC ISTIHAQ SWEAT EQUITY ENDPOINT
# =============================================================================

@router.post(
    "/sharia/istihaq/calculate",
    response_model=IstihaqCalculationResult,
    summary="Calculate dynamic Istihaq sweat-equity vesting",
    description=(
        "Calculates dynamic milestone-based sweat-equity allocations under the Istihaq protocol. "
        "Verifies contribution proof, computes fair tokenized share allocation against post-money valuation, "
        "and generates cryptographic legal warrant payloads under SPAS Nominee governance (Law 22-09)."
    ),
)
async def calculate_istihaq_allocation(
    req: IstihaqCalculationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstihaqCalculationResult:
    """Compute dynamic sweat-equity allocations and legal warrants from verified milestone deliverables."""
    try:
        return istihaq_engine.calculate_istihaq(req)
    except Exception as e:
        logger.error(f"Error during Istihaq calculation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Istihaq calculation failed: {str(e)}",
        )


# =============================================================================
# 6. AAOIFI FAS 9 ALGORITHMIC ZAKAT ENGINE ENDPOINTS
# =============================================================================

@router.post(
    "/sharia/zakat/calculate/company",
    response_model=CompanyZakatAssessment,
    summary="Compute corporate Zakat under AAOIFI FAS 9",
    description=(
        "Executes algorithmic Zakat calculation using either the Net Asset (Working Capital) Method "
        "or the Net Invested Capital (Financing) Method, with DZD Nisab benchmarking and dual reconciliation."
    ),
)
async def calculate_company_zakat_endpoint(
    req: CompanyZakatRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> CompanyZakatAssessment:
    """Compute corporate zakat base, Hawl completion, Nisab threshold, and per-share zakat amount."""
    try:
        return zakat_engine.calculate_company_zakat(req)
    except Exception as e:
        logger.error(f"Error during company Zakat calculation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Zakat calculation failed: {str(e)}",
        )


@router.post(
    "/sharia/zakat/calculate/investor",
    response_model=InvestorZakatAssessment,
    summary="Compute individual or angel investor Zakat",
    description=(
        "Computes equity holder Zakat under AAOIFI Standard No. 35: long-term angel investors (Mustathmir) "
        "pay solely on proportional net zakatable working capital assets (excluding valuation markup), "
        "whereas short-term traders (Mudharib) pay on full fair market value."
    ),
)
async def calculate_investor_zakat_endpoint(
    req: InvestorZakatRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> InvestorZakatAssessment:
    """Calculate investor equity position zakat with anti-double taxation enforcement."""
    try:
        return zakat_engine.calculate_investor_zakat(req)
    except Exception as e:
        logger.error(f"Error during investor Zakat calculation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Investor Zakat calculation failed: {str(e)}",
        )


@router.get(
    "/sharia/zakat/nisab",
    response_model=NisabEvaluation,
    summary="Evaluate Nisab threshold in DZD",
    description="Evaluates whether a given wealth/asset amount in DZD exceeds the 85g gold or 595g silver Nisab threshold.",
)
async def evaluate_nisab_endpoint(
    zakat_base_dzd: float = Query(..., ge=0, description="Wealth or asset base in DZD"),
    benchmark: NisabBenchmark = Query(NisabBenchmark.GOLD_85G, description="GOLD_85G or SILVER_595G"),
    gold_price_per_gram_dzd: Optional[float] = Query(None, gt=0, description="Custom 24k gold price in DZD"),
    silver_price_per_gram_dzd: Optional[float] = Query(None, gt=0, description="Custom pure silver price in DZD"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> NisabEvaluation:
    """Evaluate Nisab reaching against gold or silver spot benchmarks in DZD."""
    return zakat_engine.evaluate_nisab(
        zakat_base_dzd=zakat_base_dzd,
        benchmark=benchmark,
        custom_gold_price=gold_price_per_gram_dzd,
        custom_silver_price=silver_price_per_gram_dzd,
    )


# =============================================================================
# 7. AAOIFI STANDARD NO. 8 AUTOMATED MURABAHA WORKING CAPITAL FACILITY
# =============================================================================

@router.post(
    "/sharia/murabaha/orders",
    response_model=MurabahaFacility,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate Murabaha purchase order (Stage 1: Promise)",
    description=(
        "Registers a client purchase order request with a binding unilateral purchase promise (Wa'd bi al-Shira') "
        "specifying third-party supplier, goods specifications, estimated cost, and agreed profit markup."
    ),
)
async def initiate_murabaha_order(
    req: MurabahaPurchaseOrderRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> MurabahaFacility:
    """Initiate a Murabaha working capital purchase order facility."""
    try:
        return murabaha_engine.initiate_purchase_order(req)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error creating Murabaha order: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Murabaha initiation failed: {str(e)}",
        )


@router.get(
    "/sharia/murabaha/orders",
    response_model=List[MurabahaFacility],
    summary="List Murabaha facilities",
)
async def list_murabaha_orders(
    startup_id: Optional[str] = Query(None, description="Filter by client startup ID"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[MurabahaFacility]:
    """Retrieve all or startup-specific Murabaha facilities."""
    return murabaha_engine.list_facilities(startup_id=startup_id)


@router.get(
    "/sharia/murabaha/orders/{order_id}",
    response_model=MurabahaFacility,
    summary="Get Murabaha facility details",
)
async def get_murabaha_order(
    order_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> MurabahaFacility:
    """Get single Murabaha facility by order ID."""
    facility = murabaha_engine.get_facility(order_id)
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Murabaha facility '{order_id}' not found.",
        )
    return facility


@router.post(
    "/sharia/murabaha/orders/{order_id}/acquire",
    response_model=MurabahaFacility,
    summary="Confirm financier goods acquisition (Stage 2: Qabd & Daman)",
    description=(
        "Confirms that the financier has purchased and acquired physical or constructive possession (Qabd) "
        "from the supplier, assuming risk of destruction (Daman) prior to execution of sale to client."
    ),
)
async def confirm_murabaha_goods_acquisition(
    order_id: str,
    req: GoodsPossessionConfirmationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> MurabahaFacility:
    """Record financier title acquisition, supplier invoice, and possession verification hash."""
    try:
        return murabaha_engine.confirm_goods_possession(order_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error acquiring Murabaha goods: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Possession confirmation failed: {str(e)}",
        )


@router.post(
    "/sharia/murabaha/orders/{order_id}/execute",
    response_model=MurabahaFacility,
    summary="Execute Murabaha sale contract (Stage 3: Bay' al-Murabaha)",
    description=(
        "Executes the formal Murabaha sale contract between financier and client, disclosing cost price, "
        "profit markup, and generating the equal installment amortization schedule (transitions to REPAYING)."
    ),
)
async def execute_murabaha_sale_contract(
    order_id: str,
    req: MurabahaSaleExecutionRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> MurabahaFacility:
    """Execute sale contract and generate equal installment schedule."""
    try:
        return murabaha_engine.execute_murabaha_sale(order_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error executing Murabaha sale: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Murabaha sale execution failed: {str(e)}",
        )


@router.post(
    "/sharia/murabaha/orders/{order_id}/pay",
    response_model=MurabahaFacility,
    summary="Record installment payment (Stage 4: Repayment)",
    description=(
        "Records payment for an installment tranche. Once all tranches are paid, facility transitions to COMPLETED."
    ),
)
async def record_murabaha_payment(
    order_id: str,
    req: RecordInstallmentPaymentRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> MurabahaFacility:
    """Record installment settlement."""
    try:
        return murabaha_engine.record_installment_payment(order_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error recording payment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment recording failed: {str(e)}",
        )


@router.post(
    "/sharia/murabaha/orders/{order_id}/late-penalty",
    response_model=TathirReceipt,
    summary="Apply late penalty and route directly to accredited charity",
    description=(
        "Enforces AAOIFI Standard No. 8 Clause 5/6: Delinquency penalty fees cannot be recognized as platform income. "
        "Late fees are channeled 100% to an accredited Algerian charity (Iltizam bi al-Tasadduq) generating an immutable TathirReceipt."
    ),
)
async def apply_murabaha_late_penalty(
    order_id: str,
    req: ApplyLatePenaltyRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> TathirReceipt:
    """Route late payment penalty to designated charity via Tathir clearing."""
    try:
        return murabaha_engine.apply_late_fee_to_charity(order_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error routing late penalty: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Charity penalty routing failed: {str(e)}",
        )


# =============================================================================
# 8. MULTI-AGENT SWARM DUE DILIGENCE & DEALMAKING ENDPOINTS
# =============================================================================

@router.post(
    "/swarm/analyze",
    response_model=SwarmAnalysisResponse,
    summary="Run multi-agent AI due diligence analysis",
    description=(
        "Executes a multi-agent evaluation across Founder Co-Pilot (Al-Mu'assis), "
        "Due Diligence Analyst (Al-Muhaqqiq), Milestone & Escrow Agent (Al-Muqawil), "
        "and Tournament Referee (Al-Mizan). Computes the Al-Jadara Index (0-100), "
        "valuation sanity check, and risk flags."
    ),
)
async def analyze_startup_with_swarm(
    profile: StartupProfileInput,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SwarmAnalysisResponse:
    """Perform comprehensive multi-agent AI due diligence and tournament ranking on a startup."""
    try:
        return dealmaker_swarm.analyze_startup(profile)
    except Exception as e:
        logger.error(f"Error during swarm due diligence: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Swarm analysis failed: {str(e)}",
        )


@router.post(
    "/swarm/negotiate",
    response_model=NegotiationResponse,
    summary="Simulate autonomous AI-to-AI term sheet negotiation",
    description=(
        "Simulates autonomous bilateral term sheet negotiation between Founder and Investor agents "
        "using Multi-Attribute Utility Theory (MAUT) and Nash Bargaining Solution along the Pareto frontier."
    ),
)
async def negotiate_term_sheet_with_swarm(
    req: NegotiationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> NegotiationResponse:
    """Simulate automated dealmaking negotiation between founder and investor personas."""
    try:
        return dealmaker_swarm.negotiate_term_sheet(req)
    except Exception as e:
        logger.error(f"Error during swarm negotiation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Swarm negotiation failed: {str(e)}",
        )


# =============================================================================
# 9. AAOIFI STANDARD NO. 9 SALAM AGRICULTURAL PRE-FINANCING ENDPOINTS
# =============================================================================

@router.post(
    "/sharia/salam/contracts",
    response_model=SalamFacility,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate Salam forward sale contract with advance capital disbursement",
    description=(
        "Executes a Sharia-compliant forward commodity pre-financing contract under AAOIFI Standard No. 9. "
        "Verifies immediate spot payment of advance capital (Ra's Mal al-Salam) and precise contractual "
        "specification of fungible goods in Dhimmah (quantity, quality standard, grade, delivery date and warehouse depot)."
    ),
)
async def create_salam_contract_endpoint(
    req: SalamContractRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SalamFacility:
    try:
        return salam_engine.create_salam_contract(req)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error initiating Salam contract: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Salam creation failed: {str(e)}")


@router.get(
    "/sharia/salam/contracts",
    response_model=List[SalamFacility],
    summary="List active Salam pre-financing facilities",
)
async def list_salam_contracts_endpoint(
    producer_id: Optional[str] = Query(None, description="Filter by agricultural producer ID"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[SalamFacility]:
    return salam_engine.list_facilities(producer_id=producer_id)


@router.get(
    "/sharia/salam/contracts/{contract_id}",
    response_model=SalamFacility,
    summary="Get Salam facility details",
)
async def get_salam_contract_endpoint(
    contract_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SalamFacility:
    facility = salam_engine.get_facility(contract_id)
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Salam contract '{contract_id}' not found.")
    return facility


@router.post(
    "/sharia/salam/contracts/{contract_id}/inspect",
    response_model=SalamFacility,
    summary="Record commodity delivery, laboratory grading, and physical inspection",
    description=(
        "Verifies physical delivery (Qabd & Taslim) at the designated warehouse depot. "
        "Applies AAOIFI Standard No. 9 rules: superior quality is accepted with no price surcharge; "
        "inferior quality may be rejected or accepted with negotiated Sharia price adjustment (Muqassah)."
    ),
)
async def inspect_salam_delivery_endpoint(
    contract_id: str,
    req: SalamInspectionRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SalamFacility:
    try:
        return salam_engine.inspect_delivery(contract_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error inspecting Salam delivery: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Delivery inspection failed: {str(e)}")


@router.post(
    "/sharia/salam/contracts/{contract_id}/parallel",
    response_model=SalamFacility,
    summary="Execute Parallel Salam (Salam Muwazi) for non-speculative liquidation",
    description=(
        "Executes an independent secondary forward sale under AAOIFI Standard No. 9 Clause 4/1. "
        "The parallel contract is strictly uncoupled from the primary contract to ensure non-bilateral risk independence."
    ),
)
async def execute_parallel_salam_endpoint(
    contract_id: str,
    req: ParallelSalamRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SalamFacility:
    try:
        return salam_engine.execute_parallel_salam(contract_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error executing Parallel Salam: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Parallel Salam execution failed: {str(e)}")


@router.post(
    "/sharia/salam/contracts/{contract_id}/wikalah",
    response_model=SalamFacility,
    summary="Liquidate commodity via agency sale (Wikalah bi al-Bay')",
    description="Authorizes commodity broker / agent to sell delivered goods at spot market price with an agreed fee.",
)
async def liquidate_salam_wikalah_endpoint(
    contract_id: str,
    req: WikalahLiquidationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SalamFacility:
    try:
        return salam_engine.liquidate_via_wikalah(contract_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error liquidating via Wikalah: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Wikalah liquidation failed: {str(e)}")


@router.post(
    "/sharia/salam/contracts/{contract_id}/delay-remedy",
    response_model=SalamFacility,
    summary="Apply Sharia delay remedy (respite for hardship or charity penalty for procrastination)",
    description=(
        "Enforces non-interest Sharia delay remedies under AAOIFI Standard No. 9: "
        "mandatory extension for genuine hardship (Mu'sir) per Qur'an 2:280, or 100% charity penalty routing (Tathir) "
        "for unjustified procrastination (Mumathil), or mutual dissolution (Iqalah)."
    ),
)
async def apply_salam_delay_remedy_endpoint(
    contract_id: str,
    req: SalamDelayRemedyRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SalamFacility:
    try:
        return salam_engine.apply_delay_remedy(contract_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error applying delay remedy: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Delay remedy failed: {str(e)}")


# =============================================================================
# 10. AAOIFI STANDARD NO. 10 ISTISNA'A MANUFACTURING & HARDWARE ENGINE ENDPOINTS
# =============================================================================

@router.post(
    "/sharia/istisnaa/contracts",
    response_model=IstisnaaFacility,
    status_code=status.HTTP_201_CREATED,
    summary="Create Istisna'a manufacturing progress financing contract",
    description=(
        "Registers a manufacturing / construction progress financing facility under AAOIFI Standard No. 10. "
        "Defines asset specifications (Al-Masnu'), milestone schedule, warranty retention fund (Kafalat al-Siyanah), "
        "and defect liability warranty period."
    ),
)
async def create_istisnaa_contract_endpoint(
    req: IstisnaaContractRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    try:
        return istisnaa_engine.create_istisnaa_contract(req)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error creating Istisna'a contract: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Istisna'a creation failed: {str(e)}")


@router.get(
    "/sharia/istisnaa/contracts",
    response_model=List[IstisnaaFacility],
    summary="List Istisna'a manufacturing facilities",
)
async def list_istisnaa_contracts_endpoint(
    startup_id: Optional[str] = Query(None, description="Filter by client startup ID"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[IstisnaaFacility]:
    return istisnaa_engine.list_facilities(startup_id=startup_id)


@router.get(
    "/sharia/istisnaa/contracts/{facility_id}",
    response_model=IstisnaaFacility,
    summary="Get Istisna'a facility details",
)
async def get_istisnaa_contract_endpoint(
    facility_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    facility = istisnaa_engine.get_facility(facility_id)
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Istisna'a facility '{facility_id}' not found.")
    return facility


@router.post(
    "/sharia/istisnaa/contracts/{facility_id}/wip/certify",
    response_model=IstisnaaFacility,
    summary="Certify Work-in-Progress (WIP) milestone by accredited engineer",
    description="Validates engineering inspection, technical audit, and progress percentage before milestone disbursement.",
)
async def certify_istisnaa_wip_endpoint(
    facility_id: str,
    req: WIPCertificationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    try:
        return istisnaa_engine.certify_wip_milestone(facility_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error certifying WIP milestone: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"WIP certification failed: {str(e)}")


@router.post(
    "/sharia/istisnaa/contracts/{facility_id}/milestones/disburse",
    response_model=IstisnaaFacility,
    summary="Disburse certified milestone tranche to manufacturer",
    description="Releases capital tranche for an engineer-certified milestone.",
)
async def disburse_istisnaa_milestone_endpoint(
    facility_id: str,
    req: DisburseMilestoneRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    try:
        return istisnaa_engine.disburse_milestone(facility_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error disbursing milestone: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Milestone disbursement failed: {str(e)}")


@router.post(
    "/sharia/istisnaa/contracts/{facility_id}/provisional-acceptance",
    response_model=IstisnaaFacility,
    summary="Grant provisional acceptance upon hardware delivery & activate Defect Liability Period",
    description="Confirms physical delivery and functional commissioning, activating the warranty retention fund (Kafalat al-Siyanah).",
)
async def provisional_acceptance_istisnaa_endpoint(
    facility_id: str,
    req: ProvisionalAcceptanceRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    try:
        return istisnaa_engine.grant_provisional_acceptance(facility_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error granting provisional acceptance: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Provisional acceptance failed: {str(e)}")


@router.post(
    "/sharia/istisnaa/contracts/{facility_id}/defects",
    response_model=DefectClaim,
    status_code=status.HTTP_201_CREATED,
    summary="Report latent defect claim during Defect Liability Period",
)
async def report_istisnaa_defect_endpoint(
    facility_id: str,
    req: DefectReportRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> DefectClaim:
    try:
        return istisnaa_engine.report_defect_claim(facility_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error reporting defect claim: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Defect reporting failed: {str(e)}")


@router.post(
    "/sharia/istisnaa/contracts/{facility_id}/defects/resolve",
    response_model=IstisnaaFacility,
    summary="Resolve defect claim (manufacturer repair or retention fund deduction)",
)
async def resolve_istisnaa_defect_endpoint(
    facility_id: str,
    req: ResolveDefectRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    try:
        return istisnaa_engine.resolve_defect_claim(facility_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error resolving defect claim: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Defect resolution failed: {str(e)}")


@router.post(
    "/sharia/istisnaa/contracts/{facility_id}/liquidated-damages",
    response_model=IstisnaaFacility,
    summary="Assess Sharia liquidated damages (Shart Jaza'i) for unexcused delay",
    description="Under AAOIFI Standard No. 10 Clause 3/6, liquidated damages are permissible strictly to cover verified actual direct loss.",
)
async def apply_istisnaa_liquidated_damages_endpoint(
    facility_id: str,
    req: LiquidatedDamagesRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    try:
        return istisnaa_engine.apply_liquidated_damages(facility_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error applying liquidated damages: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Liquidated damages assessment failed: {str(e)}")


@router.post(
    "/sharia/istisnaa/contracts/{facility_id}/final-acceptance",
    response_model=IstisnaaFacility,
    summary="Grant Final Acceptance Certificate & release warranty retention fund",
    description="Releases the remaining Kafalat al-Siyanah retention fund to the manufacturer once all warranty obligations are discharged.",
)
async def grant_istisnaa_final_acceptance_endpoint(
    facility_id: str,
    req: FinalAcceptanceRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> IstisnaaFacility:
    try:
        return istisnaa_engine.grant_final_acceptance(facility_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error granting final acceptance: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Final acceptance failed: {str(e)}")

