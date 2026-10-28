"""
TamWheel Sovereign Ethical Agentic Venture OS — Founder Digital HQ Router.
Pillar 6 / Phase 3 Expansion: 2.5D Isometric RPG Digital HQ inspection and telemetry.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.services.digital_hq_engine import digital_hq_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hq", tags=["Founder Digital HQ 2.5D RPG"])


class XpRecordRequest(BaseModel):
    trigger: str = Field(..., description="Telemetry event trigger (e.g. FINANCIAL_RECONCILIATION, PATENT_RECEIPT)")
    customXp: Optional[int] = Field(None, ge=1, description="Optional custom XP amount")
    proof: Optional[str] = Field(None, description="Verifiable proof description or transaction hash")


@router.get("/startups/{startup_id}", response_model=Dict[str, Any])
async def get_startup_digital_hq(startup_id: str):
    """
    Retrieves the 2.5D Digital HQ RPG state for a startup:
    Tier Level (1-5), Visual Skin, Total XP, progress to next tier, and unlocked perks.
    """
    return digital_hq_engine.get_hq_profile(startup_id)


@router.get("/startups/{startup_id}/rooms/{room_name}", response_model=Dict[str, Any])
async def inspect_isometric_room(startup_id: str, room_name: str):
    """
    Inspects an interactive isometric room inside the startup's Digital HQ:
    - server_room: Code velocity, uptime, tech stack, API latency
    - legal_safe: NDA VDR, CNRC, INAPI patent status, bylaws
    - war_room: 60-second video pitch, strategy milestones
    - finance_dept: ARR/MRR, burn rate, runway, GMV, unit economics
    """
    hq = digital_hq_engine.get_or_create_hq(startup_id)
    try:
        return hq.get_room_inspector(room_name)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/startups/{startup_id}/xp", response_model=Dict[str, Any])
async def record_telemetry_xp(
    startup_id: str,
    req: XpRecordRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Awards verifiable XP to a startup's Digital HQ based on authenticated telemetry.
    """
    event = digital_hq_engine.record_xp_event(
        startup_id=startup_id,
        trigger=req.trigger,
        custom_xp=req.customXp,
        proof=req.proof,
    )
    return {
        "status": "XP_AWARDED",
        "event": event,
        "updatedHq": digital_hq_engine.get_hq_profile(startup_id),
    }
