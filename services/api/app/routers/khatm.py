"""
TamWheel Sovereign Ethical Agentic Venture OS — Sovereign Haptic Khatm Router.
Pillar 6 / Phase 3 Expansion: Sovereign Wax Stamp ceremony,
mandatory 3-second ethical reflection slider, and statutory 72-hour cooling-off window.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.services.haptic_khatm import haptic_khatm_service, MANDATORY_REFLECTION_SECONDS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/khatm", tags=["Sovereign Haptic Khatm Ceremony"])


class SealPledgeRequest(BaseModel):
    startupId: str = Field(..., description="Target startup ID")
    amountDzd: int = Field(..., ge=5000, description="Pledge amount in Algerian Dinars (min 5,000 DZD)")
    reflectionHoldDurationSec: float = Field(
        ...,
        description=f"Physical hold duration on the slider in seconds (minimum {MANDATORY_REFLECTION_SECONDS}s)"
    )
    equitySharePct: Optional[float] = Field(None, description="Optional target equity percentage")


class CancelPledgeRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Optional reason for cooling-off cancellation")


@router.post("/seal", response_model=Dict[str, Any])
async def execute_haptic_khatm_ceremony(
    req: SealPledgeRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Executes the Sovereign Haptic Khatm ceremony:
    - Enforces mandatory 3-second ethical reflection slider.
    - Generates 80ms tactile pulse and acoustic bronze tone tokens.
    - Starts the statutory 72-hour cooling-off window.
    """
    try:
        return haptic_khatm_service.seal_pledge(
            user_id=current_user.id,
            startup_id=req.startupId,
            amount_dzd=req.amountDzd,
            reflection_hold_duration_sec=req.reflectionHoldDurationSec,
            equity_share_pct=req.equitySharePct,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{khatm_id}/cancel", response_model=Dict[str, Any])
async def cancel_pledge_during_cooling_off(
    khatm_id: str,
    req: Optional[CancelPledgeRequest] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Statutory 72-hour cooling-off cancellation.
    Returns 100% of invested funds, no questions asked, provided 72 hours have not elapsed.
    """
    reason = req.reason if req else None
    try:
        return haptic_khatm_service.cancel_during_cooling_off(
            khatm_id=khatm_id,
            user_id=current_user.id,
            reason=reason,
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{khatm_id}/finalize", response_model=Dict[str, Any])
async def finalize_khatm_pledge(khatm_id: str):
    """
    Permanently finalizes the allocation into the startup's cap table
    after the statutory 72-hour cooling-off window has elapsed.
    """
    try:
        return haptic_khatm_service.finalize_pledge(khatm_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{khatm_id}", response_model=Dict[str, Any])
async def get_khatm_status(khatm_id: str):
    """
    Retrieves current status, seal hash, and remaining cooling-off seconds.
    """
    pledge = haptic_khatm_service.get_pledge(khatm_id)
    if not pledge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Khatm pledge '{khatm_id}' not found",
        )
    return pledge
