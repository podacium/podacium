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
