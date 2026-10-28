"""
TamWheel Sovereign Ethical Agentic Venture OS — Backer Squads (الشلل الاستثمارية) Router.
Exposes endpoints for:
1. Squad formation and member management (3–25 members, Section 14.1).
2. Collaborative Diligence Canvas (sticky notes, risk pins, conviction votes).
3. Diaspora-to-Wilaya Anchoring (Paris/Montreal expat paired with local cousin).
4. Consensus Threshold Voting and +15% Squad Synergy XP bonus.
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_optional
from app.services.backer_squads import (
    backer_squads_engine,
    BackerSquad,
    SquadMember,
    SquadRole,
    DiligenceCanvas,
    DiligenceStickyNote,
    DiligenceRiskPin,
    DiligenceConvictionVote,
    DiasporaAnchoringPair,
    SquadConsensusVote,
    RiskCategory,
    RiskSeverity,
    VoteChoice,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/squads", tags=["Backer Squads (الشلل الاستثمارية)"])


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class CreateSquadRequest(BaseModel):
    name: str
    description: str
    leader_id: str
    leader_name: str
    leader_email: str
    wilaya: int = Field(default=16, ge=1, le=58)
    is_diaspora: bool = False
    diaspora_location: Optional[str] = None
    initial_pool_deposit_dzd: float = Field(default=0.0, ge=0.0)


class InviteMemberRequest(BaseModel):
    user_id: str
    name: str
    email: str
    role: SquadRole = SquadRole.BACKER
    wilaya: int = Field(default=16, ge=1, le=58)
    is_diaspora: bool = False
    diaspora_location: Optional[str] = None


class DepositFundsRequest(BaseModel):
    amount_dzd: float = Field(..., gt=0.0)


class AddStickyNoteRequest(BaseModel):
    author_id: str
    author_name: str
    content: str
    color: str = "#FEF08A"
    pos_x: float = 0.0
    pos_y: float = 0.0


class AddRiskPinRequest(BaseModel):
    author_id: str
    author_name: str
    category: RiskCategory
    severity: RiskSeverity
    claim_reference: str
    risk_summary: str
    mitigation_suggested: Optional[str] = None
    pos_x: float = 0.0
    pos_y: float = 0.0


class SubmitConvictionVoteRequest(BaseModel):
    member_id: str
    member_name: str
    conviction_score: float = Field(..., ge=0.0, le=100.0)
    thesis_summary: str


class CreateDiasporaPairRequest(BaseModel):
    diaspora_member_id: str
    diaspora_member_name: str
    diaspora_city: str
    wilaya_member_id: str
    wilaya_member_name: str
    local_wilaya: int = Field(..., ge=1, le=58)
    verification_notes: str


class ProposePooledAllocationRequest(BaseModel):
    startup_id: str
    startup_name: str
    allocation_amount_dzd: float = Field(..., gt=0.0)
    consensus_threshold_pct: float = Field(default=60.0, ge=50.0, le=100.0)


class CastVoteRequest(BaseModel):
    member_id: str
    choice: VoteChoice


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/create",
    response_model=BackerSquad,
    summary="Create a new Backer Squad",
    description="Initializes a collaborative investment squad with a 3–25 member limit.",
)
async def create_backer_squad(
    req: CreateSquadRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> BackerSquad:
    try:
        return backer_squads_engine.create_squad(
            name=req.name,
            description=req.description,
            leader_id=req.leader_id,
            leader_name=req.leader_name,
            leader_email=req.leader_email,
            wilaya=req.wilaya,
            is_diaspora=req.is_diaspora,
            diaspora_location=req.diaspora_location,
            initial_pool_deposit_dzd=req.initial_pool_deposit_dzd,
        )
    except Exception as e:
        logger.error(f"Error creating backer squad: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/{squad_id}",
    response_model=BackerSquad,
    summary="Get Backer Squad details",
)
async def get_backer_squad(
    squad_id: str,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> BackerSquad:
    squad = backer_squads_engine.get_squad(squad_id)
    if not squad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Squad '{squad_id}' not found.")
    return squad


@router.post(
    "/{squad_id}/invite",
    response_model=BackerSquad,
    summary="Invite member to Backer Squad",
)
@router.post(
    "/{squad_id}/members",
    response_model=BackerSquad,
    summary="Add member to Backer Squad",
)
async def invite_squad_member(
    squad_id: str,
    req: InviteMemberRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> BackerSquad:
    try:
        return backer_squads_engine.invite_member(
            squad_id=squad_id,
            user_id=req.user_id,
            name=req.name,
            email=req.email,
            role=req.role,
            wilaya=req.wilaya,
            is_diaspora=req.is_diaspora,
            diaspora_location=req.diaspora_location,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error inviting member to squad {squad_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{squad_id}/deposit",
    summary="Deposit funds into squad pooled balance",
)
async def deposit_to_squad_pool(
    squad_id: str,
    req: DepositFundsRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> Dict[str, Any]:
    try:
        squad = backer_squads_engine.deposit_pooled_funds(squad_id, req.amount_dzd)
        return {"squad_id": squad_id, "new_pooled_balance_dzd": squad.pooled_balance_dzd}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# -----------------------------------------------------------------------------
# COLLABORATIVE CANVAS ENDPOINTS
# -----------------------------------------------------------------------------

@router.get(
    "/{squad_id}/canvas/{startup_id}",
    response_model=DiligenceCanvas,
    summary="Get collaborative diligence canvas for a startup",
)
async def get_squad_canvas(
    squad_id: str,
    startup_id: str,
    startup_name: str = "Venture Target",
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> DiligenceCanvas:
    try:
        return backer_squads_engine.get_or_create_canvas(squad_id, startup_id, startup_name)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.post(
    "/{squad_id}/canvas/{startup_id}/sticky-note",
    response_model=DiligenceCanvas,
    summary="Add sticky note to diligence canvas",
)
@router.post(
    "/{squad_id}/canvas/{startup_id}/sticky-notes",
    response_model=DiligenceCanvas,
    summary="Add sticky note to diligence canvas (plural)",
)
async def add_canvas_sticky_note(
    squad_id: str,
    startup_id: str,
    req: AddStickyNoteRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> DiligenceCanvas:
    try:
        backer_squads_engine.add_sticky_note(
            squad_id=squad_id,
            startup_id=startup_id,
            author_id=req.author_id,
            author_name=req.author_name,
            content=req.content,
            color=req.color,
            pos_x=req.pos_x,
            pos_y=req.pos_y,
        )
        return backer_squads_engine.get_or_create_canvas(squad_id, startup_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/{squad_id}/canvas/{startup_id}/risk-pin",
    response_model=DiligenceCanvas,
    summary="Drop risk pin on diligence canvas",
)
@router.post(
    "/{squad_id}/canvas/{startup_id}/risk-pins",
    response_model=DiligenceCanvas,
    summary="Drop risk pin on diligence canvas (plural)",
)
async def add_canvas_risk_pin(
    squad_id: str,
    startup_id: str,
    req: AddRiskPinRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> DiligenceCanvas:
    try:
        backer_squads_engine.add_risk_pin(
            squad_id=squad_id,
            startup_id=startup_id,
            author_id=req.author_id,
            author_name=req.author_name,
            category=req.category,
            severity=req.severity,
            claim_reference=req.claim_reference,
            risk_summary=req.risk_summary,
            mitigation_suggested=req.mitigation_suggested,
            pos_x=req.pos_x,
            pos_y=req.pos_y,
        )
        return backer_squads_engine.get_or_create_canvas(squad_id, startup_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/{squad_id}/canvas/{startup_id}/conviction-vote",
    response_model=DiligenceCanvas,
    summary="Submit individual conviction score to canvas",
)
@router.post(
    "/{squad_id}/canvas/{startup_id}/conviction-votes",
    response_model=DiligenceCanvas,
    summary="Submit individual conviction score to canvas (plural)",
)
async def submit_canvas_conviction_vote(
    squad_id: str,
    startup_id: str,
    req: SubmitConvictionVoteRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> DiligenceCanvas:
    try:
        backer_squads_engine.submit_conviction_vote(
            squad_id=squad_id,
            startup_id=startup_id,
            member_id=req.member_id,
            member_name=req.member_name,
            conviction_score=req.conviction_score,
            thesis_summary=req.thesis_summary,
        )
        return backer_squads_engine.get_or_create_canvas(squad_id, startup_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/{squad_id}/canvas/{startup_id}/diaspora-pair",
    response_model=DiligenceCanvas,
    summary="Pair diaspora expat with local Wilaya ground auditor",
)
@router.post(
    "/{squad_id}/canvas/{startup_id}/diaspora-pairs",
    response_model=DiligenceCanvas,
    summary="Pair diaspora expat with local Wilaya ground auditor (plural)",
)
async def pair_diaspora_to_wilaya(
    squad_id: str,
    startup_id: str,
    req: CreateDiasporaPairRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> DiligenceCanvas:
    try:
        backer_squads_engine.create_diaspora_pair(
            squad_id=squad_id,
            startup_id=startup_id,
            diaspora_id=req.diaspora_member_id,
            diaspora_name=req.diaspora_member_name,
            diaspora_city=req.diaspora_city,
            wilaya_id=req.wilaya_member_id,
            wilaya_name=req.wilaya_member_name,
            wilaya_code=req.local_wilaya,
            notes=req.verification_notes,
        )
        return backer_squads_engine.get_or_create_canvas(squad_id, startup_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# -----------------------------------------------------------------------------
# CONSENSUS VOTING ENDPOINTS
# -----------------------------------------------------------------------------

@router.post(
    "/{squad_id}/proposals",
    response_model=SquadConsensusVote,
    summary="Propose pooled investment allocation for consensus voting",
)
async def propose_squad_allocation(
    squad_id: str,
    req: ProposePooledAllocationRequest,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SquadConsensusVote:
    try:
        return backer_squads_engine.propose_pooled_allocation(
            squad_id=squad_id,
            startup_id=req.startup_id,
            startup_name=req.startup_name,
            allocation_amount_dzd=req.allocation_amount_dzd,
            consensus_threshold_pct=req.consensus_threshold_pct,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/proposals/{proposal_id}/vote",
    response_model=SquadConsensusVote,
    summary="Cast consensus vote on squad proposal",
)
@router.post(
    "/{squad_id}/votes/{proposal_id}/cast",
    response_model=SquadConsensusVote,
    summary="Cast consensus vote on squad proposal (squad scoped)",
)
async def cast_squad_proposal_vote(
    proposal_id: str,
    req: CastVoteRequest,
    squad_id: Optional[str] = None,
    current_user: Optional[Any] = Depends(get_current_user_optional),
) -> SquadConsensusVote:
    try:
        return backer_squads_engine.cast_vote(
            proposal_id=proposal_id,
            member_id=req.member_id,
            choice=req.choice,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
