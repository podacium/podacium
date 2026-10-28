"""
TamWheel Sovereign Ethical Agentic Venture OS — Startup Reels Router.
Pillar 6 / Phase 3 Expansion: 9:16 vertical video discovery feed,
swipe-to-diligence data drawer payloads, and 15-second audio AMA recording queue.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_active_user
from app.services.reels_service import startup_reels_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reels", tags=["Startup Reels & Swipe-to-Diligence"])


class AudioAmaSubmitRequest(BaseModel):
    audioUrl: str = Field(..., description="URL of the recorded voice note")
    durationSec: float = Field(..., ge=1.0, le=15.0, description="Duration of audio question in seconds (max 15s)")
    questionText: Optional[str] = Field(None, description="Optional transcription or short title")


class AudioAmaAnswerRequest(BaseModel):
    answerAudioUrl: Optional[str] = Field(None, description="URL of founder's voice reply")
    answerText: Optional[str] = Field(None, description="Founder's textual reply")


@router.get("", response_model=List[Dict[str, Any]])
@router.get("/", response_model=List[Dict[str, Any]])
async def list_startup_reels(limit: int = Query(10, ge=1, le=50)):
    """
    Retrieves the 9:16 vertical video pitch discovery feed with FactGuard verification tags.
    """
    return startup_reels_service.list_reels(limit=limit)


@router.get("/{reel_id}", response_model=Dict[str, Any])
async def get_startup_reel(reel_id: str):
    """
    Retrieves a single startup reel item.
    """
    reel = startup_reels_service.get_reel(reel_id)
    if not reel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reel '{reel_id}' not found",
        )
    return reel


@router.get("/{reel_id}/diligence", response_model=Dict[str, Any])
async def get_swipe_to_diligence_drawer(reel_id: str):
    """
    Returns the translucent glassmorphic diligence drawer data payload
    for instantaneous inspection during video playback without audio interruption.
    """
    drawer = startup_reels_service.get_diligence_drawer(reel_id)
    if not drawer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reel '{reel_id}' not found",
        )
    return drawer


@router.post("/{reel_id}/ama", response_model=Dict[str, Any])
async def submit_audio_ama_question(
    reel_id: str,
    req: AudioAmaSubmitRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Submits a 15-second maximum audio AMA question into the founder's response queue.
    """
    username = getattr(current_user, "fullName", None) or getattr(current_user, "email", f"Backer-{current_user.id}")
    try:
        return startup_reels_service.submit_audio_ama(
            reel_id=reel_id,
            user_id=current_user.id,
            username=username,
            audio_url=req.audioUrl,
            duration_sec=req.durationSec,
            question_text=req.questionText,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{reel_id}/ama", response_model=List[Dict[str, Any]])
async def list_reel_audio_amas(reel_id: str):
    """
    Lists submitted and answered audio AMA questions for a startup reel.
    """
    return startup_reels_service.list_reel_amas(reel_id)


@router.post("/ama/{ama_id}/answer", response_model=Dict[str, Any])
async def answer_audio_ama_question(
    ama_id: str,
    req: AudioAmaAnswerRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Founder answers an audio AMA question from a prospective investor.
    """
    try:
        return startup_reels_service.answer_audio_ama(
            ama_id=ama_id,
            founder_id=current_user.id,
            answer_audio_url=req.answerAudioUrl,
            answer_text=req.answerText,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
