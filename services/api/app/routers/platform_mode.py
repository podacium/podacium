"""
TamWheel Platform Mode Configuration Router.
Endpoints for viewing the 6-point statutory checklist and toggling between SIMULATION and LIVE modes.
"""

from fastapi import APIRouter, HTTPException, status
from app.services.platform_mode import (
    platform_mode_engine,
    PlatformModeState,
    ChecklistItem,
    VerifyChecklistRequest,
    ToggleModeRequest,
)

router = APIRouter(prefix="/admin/config/platform-mode", tags=["Platform Configuration"])


@router.get("", response_model=PlatformModeState)
def get_platform_mode_state():
    """Retrieve current platform mode (SIMULATION vs LIVE) and 6-point compliance checklist."""
    return platform_mode_engine.get_state()


@router.post("/verify-item", response_model=ChecklistItem)
def verify_checklist_item(req: VerifyChecklistRequest):
    """Verify one of the 6 statutory compliance prerequisites with proof hash."""
    try:
        return platform_mode_engine.verify_checklist_item(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/toggle", response_model=PlatformModeState)
def toggle_platform_mode(req: ToggleModeRequest):
    """
    Toggle platform mode between SIMULATION and LIVE.
    Transitioning to LIVE is strictly locked until all 6 requirements are verified.
    """
    try:
        return platform_mode_engine.toggle_mode(req)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
