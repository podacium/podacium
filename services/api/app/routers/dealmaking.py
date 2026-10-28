"""
TamWheel Sovereign Ethical Agentic Venture OS — Dealmaking & Swarm Negotiation Router.
Exposes endpoints for:
1. Multi-Agent Swarm Due Diligence Analysis (`/dealmaking/analyze`)
2. Autonomous AI-to-AI MAUT Deal Negotiation (`/dealmaking/negotiate`)
3. Step-by-Step Negotiation Turn Inspection (`/dealmaking/negotiations/{session_id}/turns`)
4. Session Detail Retrieval (`/dealmaking/negotiations/{session_id}`)
5. Standardized Term Sheet Generation & Download (`/dealmaking/negotiations/{session_id}/termsheet`)
"""

import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.agent.dealmakers import (
    dealmaker_swarm_instance,
    StartupProfileInput,
    SwarmAnalysisResponse,
    AntiDilutionRatchet,
)
from app.services.maut_negotiation import (
    maut_negotiation_engine,
    DealOffer,
    NegotiationRound,
    NegotiationSessionResponse,
)
from app.services.syndicate_engine import (
    syndicate_deal_engine,
    SyndicateSPV,
    SyndicateMember,
    CarryWaterfallRequest,
    CarryWaterfallResult,
    ProRataCalculationRequest,
    ProRataCalculationResult,
)
from app.services.zopa_telemetry import (
    zopa_telemetry_generator,
    CompleteZOPATelemetryResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dealmaking", tags=["Dealmaker Swarm & MAUT Negotiation"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class StartNegotiationRequest(BaseModel):
    startup_name: str
    founder_ask: DealOffer
    investor_offer: DealOffer
    founder_reservation_val: Optional[float] = Field(
        default=None,
        description="Founder minimum walk-away pre-money valuation in DZD (BATNA floor)",
    )
    investor_reservation_val: Optional[float] = Field(
        default=None,
        description="Investor maximum pre-money valuation ceiling in DZD (BATNA ceiling)",
    )
    max_rounds: int = Field(
        default=10,
        ge=1,
        le=10,
        description="Maximum bilateral bargaining rounds (statutory ceiling: 10)",
    )


class TermSheetDownloadResponse(BaseModel):
    session_id: str
    startup_name: str
    format: str
    content: str
    equity_stake_pct: Optional[float] = None
    post_money_valuation_dzd: Optional[float] = None


class CreateSyndicateRequest(BaseModel):
    startup_name: str
    deal_round: str = "Series Seed"
    target_raise_dzd: float = Field(..., gt=0)
    min_allocation_dzd: float = Field(default=500_000.0, ge=100_000.0)
    lead_investor_id: str
    lead_name: str
    lead_carry_pct: float = Field(default=15.0, ge=0.0, le=30.0)
    platform_carry_pct: float = Field(default=5.0, ge=0.0, le=10.0)
    hurdle_rate_pct: float = Field(default=7.0, ge=0.0, le=15.0)
    backoffice_setup_fee_dzd: float = Field(default=150_000.0, ge=0.0)
    closing_days: int = Field(default=30, ge=1, le=120)


class JoinSyndicateRequest(BaseModel):
    member_id: str
    full_name: str
    email: str
    pledged_amount_dzd: float = Field(..., gt=0)
    is_lead: bool = False


# =============================================================================
# ROUTE HANDLERS
# =============================================================================

@router.post(
    "/analyze",
    response_model=SwarmAnalysisResponse,
    summary="Run 4-agent swarm due diligence analysis",
    description=(
        "Executes a multi-agent evaluation across Founder Co-Pilot (Al-Mu'assis), "
        "Due Diligence Analyst (Al-Muhaqqiq), Milestone & Escrow Agent (Al-Muqawil), "
        "and Tournament Referee (Al-Mizan). Computes the Al-Jadara Index (0-100), "
        "valuation sanity check, and risk flags."
    ),
)
async def analyze_startup_with_dealmaker_swarm(
    profile: StartupProfileInput,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SwarmAnalysisResponse:
    """
    Perform comprehensive 4-agent due diligence and tournament ranking on a startup.
    """
    try:
        return dealmaker_swarm_instance.analyze_startup(profile)
    except Exception as e:
        logger.error(f"Error during dealmaker swarm analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dealmaker swarm analysis failed: {str(e)}",
        )


@router.post(
    "/negotiate",
    response_model=NegotiationSessionResponse,
    summary="Initiate autonomous AI-to-AI MAUT deal negotiation",
    description=(
        "Simulates autonomous bilateral negotiation between Al-Mu'assis (Founder) and "
        "Al-Muhaqqiq (Investor) mediated by Al-Mizan (Referee). Evaluates 5 dimensions "
        "(Pre-Money Valuation, Investment Ticket, Equity %, Milestone Tranches, Governance) "
        "with polynomial concession pacing converging towards Nash Equilibrium within 10 rounds."
    ),
)
async def initiate_autonomous_negotiation(
    req: StartNegotiationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> NegotiationSessionResponse:
    """
    Launch autonomous multi-attribute deal negotiation between Founder and Investor agents.
    """
    try:
        return maut_negotiation_engine.negotiate(
            startup_name=req.startup_name,
            founder_ask=req.founder_ask,
            investor_offer=req.investor_offer,
            founder_res_val=req.founder_reservation_val,
            investor_res_val=req.investor_reservation_val,
            max_rounds=req.max_rounds,
        )
    except Exception as e:
        logger.error(f"Error during autonomous negotiation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Autonomous negotiation execution failed: {str(e)}",
        )


@router.get(
    "/negotiations/{session_id}",
    response_model=NegotiationSessionResponse,
    summary="Retrieve negotiation session details",
    description="Fetches full session state, final agreed vector, Nash score, and contract clauses.",
)
async def get_negotiation_session(
    session_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> NegotiationSessionResponse:
    """
    Get full negotiation session record by session_id.
    """
    session = maut_negotiation_engine.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Negotiation session '{session_id}' not found.",
        )

    return NegotiationSessionResponse(
        session_id=session.session_id,
        startup_name=session.startup_name,
        status=session.status,
        rounds_conducted=len(session.rounds),
        rounds_history=session.rounds,
        agreed_term_sheet=session.agreed_term_sheet,
        equity_stake_pct=session.equity_stake_pct,
        nash_product_score=session.nash_product_score,
        arbitration_recommendation=session.arbitration_recommendation,
        contract_clauses=session.contract_clauses,
        termsheet_markdown=session.termsheet_markdown,
        created_at=session.created_at,
    )


@router.get(
    "/negotiations/{session_id}/turns",
    response_model=List[NegotiationRound],
    summary="Step-by-step negotiation turn inspection",
    description=(
        "Returns chronological round-by-round turn data including founder offer, "
        "investor offer, utility score breakdown across 5 dimensions, ZOPA overlap, "
        "and referee observation remarks."
    ),
)
async def get_negotiation_turns(
    session_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> List[NegotiationRound]:
    """
    Step-by-step turn inspection endpoint for UI concession curve visualizations and audits.
    """
    session = maut_negotiation_engine.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Negotiation session '{session_id}' not found.",
        )
    return session.rounds


@router.get(
    "/negotiations/{session_id}/termsheet",
    summary="Download or view standardized Term Sheet",
    description="Retrieves the agreed Series Seed Term Sheet in Markdown or JSON format.",
)
async def get_negotiation_termsheet(
    session_id: str,
    format: str = Query("json", pattern="^(json|markdown)$"),
    current_user: Optional[Any] = Depends(get_current_user_optional),
):
    """
    Term Sheet download endpoint supporting Markdown and JSON formats.
    """
    session = maut_negotiation_engine.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Negotiation session '{session_id}' not found.",
        )

    if not session.termsheet_markdown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No ratified Term Sheet exists for session '{session_id}' (Status: {session.status.value}).",
        )

    if format == "markdown":
        return Response(
            content=session.termsheet_markdown,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="TermSheet_{session.startup_name.replace(" ", "_")}.md"'
            },
        )

    return TermSheetDownloadResponse(
        session_id=session.session_id,
        startup_name=session.startup_name,
        format=format,
        content=session.termsheet_markdown,
        equity_stake_pct=session.equity_stake_pct,
        post_money_valuation_dzd=session.agreed_term_sheet.post_money_valuation_dzd if session.agreed_term_sheet else None,
    )


# =============================================================================
# ZOPA TELEMETRY ENDPOINT
# =============================================================================

@router.get(
    "/negotiations/{session_id}/zopa-telemetry",
    response_model=CompleteZOPATelemetryResponse,
    summary="Get multi-dimensional ZOPA visual telemetry",
    description=(
        "Emits 2D valuation-ticket contour coordinates, 5D MAUT radar chart polygons, "
        "and 3D Nash product surface grid for frontend interactive negotiation visualization."
    ),
)
async def get_negotiation_zopa_telemetry(
    session_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> CompleteZOPATelemetryResponse:
    """
    Returns multi-dimensional ZOPA coordinates and contour envelopes.
    """
    session = maut_negotiation_engine.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Negotiation session '{session_id}' not found.",
        )

    try:
        return zopa_telemetry_generator.generate_telemetry(session)
    except Exception as e:
        logger.error(f"Error generating ZOPA telemetry for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate ZOPA telemetry: {str(e)}",
        )


# =============================================================================
# SYNDICATE DEAL ENGINE ENDPOINTS
# =============================================================================

@router.post(
    "/syndicate/create",
    response_model=SyndicateSPV,
    summary="Create AngelList-style venture syndicate SPV",
    description=(
        "Provisions a venture syndicate SPV with minimum ticket allocation, "
        "pass-through back-office fee accounting, and lead carry rights (15% lead, 5% platform)."
    ),
)
async def create_venture_syndicate(
    req: CreateSyndicateRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SyndicateSPV:
    """
    Create a new SPV syndicate for pooled venture investments.
    """
    try:
        return syndicate_deal_engine.create_syndicate(
            startup_name=req.startup_name,
            deal_round=req.deal_round,
            target_raise_dzd=req.target_raise_dzd,
            min_allocation_dzd=req.min_allocation_dzd,
            lead_investor_id=req.lead_investor_id,
            lead_name=req.lead_name,
            lead_carry_pct=req.lead_carry_pct,
            platform_carry_pct=req.platform_carry_pct,
            hurdle_rate_pct=req.hurdle_rate_pct,
            backoffice_setup_fee_dzd=req.backoffice_setup_fee_dzd,
            closing_days=req.closing_days,
        )
    except Exception as e:
        logger.error(f"Error creating syndicate SPV: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Syndicate creation failed: {str(e)}",
        )


@router.get(
    "/syndicate/{spv_id}",
    response_model=SyndicateSPV,
    summary="Get syndicate SPV details",
)
async def get_venture_syndicate(
    spv_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SyndicateSPV:
    """
    Retrieve SPV syndicate information by spv_id.
    """
    spv = syndicate_deal_engine.get_syndicate(spv_id)
    if not spv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Syndicate SPV '{spv_id}' not found.",
        )
    return spv


@router.post(
    "/syndicate/{spv_id}/join",
    response_model=SyndicateSPV,
    summary="Pledge allocation into syndicate SPV",
)
async def join_venture_syndicate(
    spv_id: str,
    req: JoinSyndicateRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SyndicateSPV:
    """
    Allow follower angels or syndicate lead to pledge capital allocation.
    """
    try:
        return syndicate_deal_engine.add_member_pledge(
            spv_id=spv_id,
            member_id=req.member_id,
            full_name=req.full_name,
            email=req.email,
            amount_dzd=req.pledged_amount_dzd,
            is_lead=req.is_lead,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Error joining syndicate {spv_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pledge allocation: {str(e)}",
        )


@router.post(
    "/syndicate/waterfall/calculate",
    response_model=CarryWaterfallResult,
    summary="Calculate 3-tier carry waterfall exit distribution",
    description=(
        "Distributes exit proceeds across Tier 1 (100% LP capital return), "
        "Tier 2 (Preferred return hurdle e.g. 7% annual compound), and "
        "Tier 3 (20% Carried interest: 15% to Lead, 5% to TamWheel, 80% to LPs)."
    ),
)
async def calculate_syndicate_waterfall(
    req: CarryWaterfallRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> CarryWaterfallResult:
    """
    Compute exit distribution waterfall, net MOIC, IRR, and member payout ledger.
    """
    try:
        return syndicate_deal_engine.calculate_waterfall(req)
    except Exception as e:
        logger.error(f"Error calculating carry waterfall: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Waterfall calculation failed: {str(e)}",
        )


@router.post(
    "/syndicate/prorata/calculate",
    response_model=ProRataCalculationResult,
    summary="Calculate pro-rata rights and generate capital call notice",
    description=(
        "Models pro-rata investment required to prevent dilution in subsequent priced rounds (Series A), "
        "compares ownership with vs. without exercise, and generates automated capital call notices."
    ),
)
async def calculate_syndicate_pro_rata(
    req: ProRataCalculationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> ProRataCalculationResult:
    """
    Compute pro-rata investment checks and generate LP capital call notices.
    """
    try:
        return syndicate_deal_engine.calculate_pro_rata(req)
    except Exception as e:
        logger.error(f"Error calculating pro-rata rights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pro-rata calculation failed: {str(e)}",
        )
