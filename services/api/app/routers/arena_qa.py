"""
TamWheel Sovereign Ethical Agentic Venture OS — Arena Live Investor Q&A Router.
Phase 4 Expansion: Real-time question submission, watch party upvoting,
priority queue weighted ranking, moderation, and stage promotion for Shark Tank grilling rounds.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_active_user, get_optional_current_user
from app.services.arena_qa_engine import arena_qa_engine, QuestionState, AcademyTier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/arena/qa", tags=["Arena Live Investor Q&A"])


# -----------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------------

class QuestionSubmitRequest(BaseModel):
    startup_id: str = Field(..., description="Target startup identifier")
    content: str = Field(..., min_length=3, max_length=500, description="Grilling question text")
    academy_tier: Optional[str] = Field("NONE", description="Author Darija Academy tier (BRONZE, SILVER, GOLD, ESE_ORAN_FELLOW)")
    reputation_weight: Optional[float] = Field(1.0, ge=0.1, le=10.0, description="Author verified reputation multiplier")
    slide_reference: Optional[int] = Field(None, ge=0, description="Associated pitch deck slide index")
    category: Optional[str] = Field("UNIT_ECONOMICS", description="Category: SHARIA_COMPLIANCE, UNIT_ECONOMICS, TECH_STACK, MARKET_TAM, TRACTION")
    auto_moderate: Optional[bool] = Field(True, description="Whether automated safety checks approve directly")


class QuestionModerateRequest(BaseModel):
    approved: bool = Field(..., description="True to approve, False to flag/reject")
    reason: Optional[str] = Field(None, max_length=255, description="Moderation rationale if rejected")


class QuestionAnswerRequest(BaseModel):
    answer_notes: Optional[str] = Field(None, max_length=1000, description="Summary of founder's on-stage answer")


# -----------------------------------------------------------------------------
# REST ENDPOINTS
# -----------------------------------------------------------------------------

@router.post("/rooms/{room_id}/questions", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def submit_question(
    room_id: str,
    req: QuestionSubmitRequest,
    current_user=Depends(get_optional_current_user),
):
    """
    Submits a live question during the Shark Tank pitch grilling round.
    Calculates initial priority score with Academy tier bonus and automated safety scans.
    """
    user_id = current_user.id if current_user else 1
    username = current_user.full_name or current_user.email if current_user else "Investor"

    try:
        question = arena_qa_engine.submit_question(
            room_id=room_id,
            startup_id=req.startup_id,
            author_id=user_id,
            author_name=username,
            content=req.content,
            academy_tier=req.academy_tier or "NONE",
            reputation_weight=req.reputation_weight or 1.0,
            slide_reference=req.slide_reference,
            category=req.category or "UNIT_ECONOMICS",
            auto_moderate=bool(req.auto_moderate),
        )
        return question.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting arena question: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit question")


@router.get("/rooms/{room_id}/questions", response_model=List[Dict[str, Any]])
async def list_questions(
    room_id: str,
    state: Optional[str] = Query(None, description="Filter by state (e.g. SUBMITTED, MODERATED_APPROVED, PROMOTED_TO_STAGE)"),
    sort_by: str = Query("priority_score", description="Sort by priority_score, upvotes, or recent"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Lists questions in the moderation and priority queue, ranked by priority score or upvotes.
    """
    return arena_qa_engine.list_questions(
        room_id=room_id,
        state=state,
        sort_by=sort_by,
        limit=limit,
    )


@router.post("/rooms/{room_id}/questions/{question_id}/upvote", response_model=Dict[str, Any])
async def upvote_question(
    room_id: str,
    question_id: str,
    current_user=Depends(get_optional_current_user),
):
    """
    Upvotes a live grilling question. Dynamically recalculates weighted priority score:
    Score = Upvotes * 1.0 + Academy Tier Bonus * 2.0 + Reputation Weight * 1.5
    """
    user_id = current_user.id if current_user else 1

    try:
        question = arena_qa_engine.upvote_question(room_id=room_id, question_id=question_id, user_id=user_id)
        return question.to_dict()
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found in room")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rooms/{room_id}/questions/{question_id}/moderate", response_model=Dict[str, Any])
async def moderate_question(
    room_id: str,
    question_id: str,
    req: QuestionModerateRequest,
    current_user=Depends(get_optional_current_user),
):
    """
    Moderator endpoint to approve or flag/reject a submitted question.
    """
    mod_id = current_user.id if current_user else 1

    try:
        question = arena_qa_engine.moderate_question(
            room_id=room_id,
            question_id=question_id,
            approved=req.approved,
            moderator_id=mod_id,
            reason=req.reason,
        )
        return question.to_dict()
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found in room")


@router.post("/rooms/{room_id}/questions/{question_id}/promote", response_model=Dict[str, Any])
async def promote_question_to_stage(
    room_id: str,
    question_id: str,
):
    """
    Promotes an approved question onto the live stage screen for founder grilling.
    """
    try:
        question = arena_qa_engine.promote_to_stage(room_id=room_id, question_id=question_id)
        return question.to_dict()
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found in room")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rooms/{room_id}/questions/{question_id}/answer", response_model=Dict[str, Any])
async def answer_question(
    room_id: str,
    question_id: str,
    req: Optional[QuestionAnswerRequest] = None,
):
    """
    Marks an on-stage question as answered by the founder and records answer notes.
    """
    notes = req.answer_notes if req else None
    try:
        question = arena_qa_engine.answer_question(room_id=room_id, question_id=question_id, answer_notes=notes)
        return question.to_dict()
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found in room")


@router.post("/rooms/{room_id}/questions/{question_id}/archive", response_model=Dict[str, Any])
async def archive_question(
    room_id: str,
    question_id: str,
):
    """
    Moves an answered or completed question into the ARCHIVED state.
    """
    try:
        question = arena_qa_engine.archive_question(room_id=room_id, question_id=question_id)
        return question.to_dict()
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found in room")


@router.get("/rooms/{room_id}/stage", response_model=Optional[Dict[str, Any]])
async def get_active_stage_question(room_id: str):
    """
    Retrieves the currently spotlighted question being grilled live on stage.
    """
    return arena_qa_engine.get_active_stage_question(room_id)
