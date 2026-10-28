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
# 6. MULTI-AGENT SWARM DUE DILIGENCE & DEALMAKING ENDPOINTS
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
