"""
TamWheel Sovereign Ethical Agentic Venture OS — Programmatic Sharia & AI Dealmaker Swarm Router.
Exposes endpoints for:
1. AAOIFI Sharia Compliance Screening (`/sharia/screen`)
2. Official Cryptographic Sharia Certificate Generation (`/sharia/certificate`)
3. Tathir (Financial Purification) Assessment (`/sharia/tathir/calculate`)
4. Dynamic Proof-of-Contribution Istihaq Calculation (`/sharia/istihaq/calculate`)
5. Multi-Agent AI Due Diligence Swarm Analysis (`/swarm/analyze`)
6. Autonomous AI-to-AI Dealmaking & MAUT Term Sheet Negotiation (`/swarm/negotiate`)
"""

import logging
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
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
# SHARIA SCREENING & TATHIR ENDPOINTS
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
    """
    Run automated Sharia screening on startup financial metrics and business activity.
    """
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
    """
    Generate cryptographically verifiable Sharia Certificate.
    """
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
    """
    Assess required Tathir purification amount and distribution guidelines.
    """
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
    """
    Compute dynamic sweat-equity allocations and legal warrants from verified milestone deliverables.
    """
    try:
        return istihaq_engine.calculate_istihaq(req)
    except Exception as e:
        logger.error(f"Error during Istihaq calculation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Istihaq calculation failed: {str(e)}",
        )


# =============================================================================
# MULTI-AGENT SWARM DUE DILIGENCE & DEALMAKING ENDPOINTS
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
    """
    Perform comprehensive multi-agent AI due diligence and tournament ranking on a startup.
    """
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
    """
    Simulate automated dealmaking negotiation between founder and investor personas.
    """
    try:
        return dealmaker_swarm.negotiate_term_sheet(req)
    except Exception as e:
        logger.error(f"Error during swarm negotiation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Swarm negotiation failed: {str(e)}",
        )
