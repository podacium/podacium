"""
TamWheel Sovereign Ethical Agentic Venture OS — Live Term Sheet Collaborative Room Router.
Phase 4 Expansion: Prime-time Shark Tank deal room negotiation, mutual electronic initials,
and Sovereign Haptic Khatm sealing.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_optional_current_user
from app.services.live_term_sheet_room import (
    live_term_sheet_engine,
    TermSheetStatus,
    PartyRole,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/arena/live-termsheet", tags=["Arena Live Term Sheet Negotiation"])


# -----------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------------

class OpenTermSheetRoomRequest(BaseModel):
    startup_id: Optional[str] = Field(None, description="Startup identifier")
    startup_name: Optional[str] = Field("TamWheel Venture", description="Startup name")
    founder_id: Optional[int] = Field(None, description="Founder user ID")
    founder_name: Optional[str] = Field("Founder", description="Founder display name")
    investor_id: Optional[int] = Field(None, description="Lead Shark user ID")
    investor_name: Optional[str] = Field("Lead Shark", description="Lead Shark display name")
    initial_valuation_dzd: Optional[int] = Field(50_000_000, ge=1_000_000, description="Pre-money valuation in DZD")
    initial_ticket_dzd: Optional[int] = Field(10_000_000, ge=500_000, description="Investment ticket size in DZD")


class UpdateTermsRequest(BaseModel):
    valuation_pre_money_dzd: Optional[int] = Field(None, ge=1_000_000, description="Pre-money valuation in DZD")
    ticket_size_dzd: Optional[int] = Field(None, ge=500_000, description="Ticket size in DZD")
    board_seats: Optional[Dict[str, int]] = Field(None, description="Board seats distribution")
    liquidation_preference: Optional[str] = Field(None, description="Liquidation preference clause text")
    sharia_covenants: Optional[List[str]] = Field(None, description="List of Sharia compliance covenants")
    actor_role: Optional[str] = Field("INVESTOR", description="FOUNDER or INVESTOR")


class InitialClauseRequest(BaseModel):
    party: str = Field(..., description="Party role: FOUNDER or INVESTOR")
    initials: str = Field(..., min_length=1, max_length=6, description="Electronic initials, e.g. 'AK' or 'RK'")


class SealKhatmRequest(BaseModel):
    reflection_hold_duration_sec: float = Field(
        ...,
        description="Physical slider hold duration in seconds (must be >= 3.0s)",
    )


# -----------------------------------------------------------------------------
# REST ENDPOINTS
# -----------------------------------------------------------------------------

@router.post("/rooms/{room_id}", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
@router.post("/rooms/{room_id}/termsheet", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def open_or_get_termsheet_room(
    room_id: str,
    req: Optional[OpenTermSheetRoomRequest] = None,
    current_user=Depends(get_optional_current_user),
):
    """
    Opens or retrieves a live collaborative Term Sheet room for the Shark Tank grilling session.
    """
    founder_id = (req.founder_id if req and req.founder_id else (current_user.id if current_user else 1))
    founder_name = (
        req.founder_name if req and req.founder_name
        else (current_user.full_name or current_user.email if current_user else "Founder")
    )

    session = live_term_sheet_engine.get_or_create_room(
        room_id=room_id,
        startup_id=req.startup_id if req else None,
        startup_name=req.startup_name if req else "TamWheel Venture",
        founder_id=founder_id,
        founder_name=founder_name,
        investor_id=req.investor_id if req else 999,
        investor_name=req.investor_name if req else "Lead Shark",
        initial_valuation_dzd=req.initial_valuation_dzd if req and req.initial_valuation_dzd else 50_000_000,
        initial_ticket_dzd=req.initial_ticket_dzd if req and req.initial_ticket_dzd else 10_000_000,
    )
    return session.get_state()


@router.get("/rooms/{room_id}", response_model=Dict[str, Any])
@router.get("/rooms/{room_id}/termsheet", response_model=Dict[str, Any])
async def get_termsheet_room_state(room_id: str):
    """Retrieves current live collaborative term sheet state."""
    session = live_term_sheet_engine.get_or_create_room(room_id=room_id)
    return session.get_state()


@router.patch("/rooms/{room_id}/terms", response_model=Dict[str, Any])
async def update_termsheet_parameters(
    room_id: str,
    req: UpdateTermsRequest,
    current_user=Depends(get_optional_current_user),
):
    """
    Live real-time adjustment of valuation, ticket size, governance board seats,
    liquidation preference, or Sharia compliance covenants.
    Resets clause initials and transitions status back to NEGOTIATING.
    """
    session = live_term_sheet_engine.get_or_create_room(room_id=room_id)
    actor_id = current_user.id if current_user else 1
    actor_name = current_user.full_name or current_user.email if current_user else "Participant"

    try:
        updated_state = session.update_terms(
            actor_id=actor_id,
            actor_name=actor_name,
            actor_role=req.actor_role or "INVESTOR",
            valuation_pre_money_dzd=req.valuation_pre_money_dzd,
            ticket_size_dzd=req.ticket_size_dzd,
            board_seats=req.board_seats,
            liquidation_preference=req.liquidation_preference,
            sharia_covenants=req.sharia_covenants,
        )
        return updated_state
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rooms/{room_id}/clauses/{clause_id}/initial", response_model=Dict[str, Any])
async def initial_termsheet_clause(
    room_id: str,
    clause_id: str,
    req: InitialClauseRequest,
    current_user=Depends(get_optional_current_user),
):
    """
    Electronically initials an individual term sheet clause.
    Both FOUNDER and INVESTOR must initial the clause for it to lock.
    """
    session = live_term_sheet_engine.get_or_create_room(room_id=room_id)
    user_id = current_user.id if current_user else 1
    username = current_user.full_name or current_user.email if current_user else req.party

    try:
        res = session.initial_clause(
            clause_id=clause_id,
            user_id=user_id,
            username=username,
            party=req.party,
            initials=req.initials,
        )
        return res
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rooms/{room_id}/initial-all", response_model=Dict[str, Any])
async def initial_all_termsheet_clauses(
    room_id: str,
    req: InitialClauseRequest,
    current_user=Depends(get_optional_current_user),
):
    """
    Applies electronic initials across all mandatory term sheet clauses for the designated party.
    """
    session = live_term_sheet_engine.get_or_create_room(room_id=room_id)
    user_id = current_user.id if current_user else 1
    username = current_user.full_name or current_user.email if current_user else req.party

    try:
        return session.initial_all_clauses(
            user_id=user_id,
            username=username,
            party=req.party,
            initials=req.initials,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rooms/{room_id}/seal-khatm", response_model=Dict[str, Any])
async def seal_termsheet_khatm_ceremony(
    room_id: str,
    req: SealKhatmRequest,
    current_user=Depends(get_optional_current_user),
):
    """
    Executes the Sovereign Haptic Khatm ceremony on a mutually locked term sheet:
    - Verifies term sheet state is MUTUALLY_LOCKED.
    - Strictly enforces mandatory 3-second ethical reflection slider.
    - Generates 80ms tactile pulse and acoustic bronze tone tokens.
    - Begins the statutory 72-hour cooling-off window.
    """
    session = live_term_sheet_engine.get_or_create_room(room_id=room_id)
    user_id = current_user.id if current_user else 1

    try:
        return session.trigger_khatm_ceremony(
            user_id=user_id,
            reflection_hold_duration_sec=req.reflection_hold_duration_sec,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/rooms/{room_id}/audit-log", response_model=List[Dict[str, Any]])
async def get_termsheet_audit_log(room_id: str):
    """Retrieves full audit log of all parameter adjustments and electronic initials."""
    session = live_term_sheet_engine.get_or_create_room(room_id=room_id)
    return session.get_audit_log()
