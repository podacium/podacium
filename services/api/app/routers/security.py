"""Security settings and session management router."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.schemas.security import (
    PasswordChangeRequest,
    PasswordChangeResponse,
    SecuritySettingsResponse,
    SecuritySettingsUpdate,
    DeviceListResponse,
    DeviceResponse,
)
from app.services.security_service import security_service
from app.services.device_fingerprint_service import (
    get_user_devices,
    remove_device,
    get_device_by_fingerprint,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/security", tags=["Security"])


class LegacyChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


@router.post(
    "/change-password",
    response_model=PasswordChangeResponse,
    status_code=status.HTTP_200_OK,
)
async def change_password(
    request: LegacyChangePasswordRequest,
    current_user=Depends(get_current_user),
):
    """Change the user's password and revoke active sessions for security."""
    try:
        pw_request = PasswordChangeRequest(
            currentPassword=request.old_password,
            newPassword=request.new_password,
            confirmPassword=request.new_password,
        )
        return await security_service.change_password(current_user.id, pw_request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Password change error for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password",
        )


@router.get("/settings", response_model=SecuritySettingsResponse)
async def get_security_settings(
    current_user=Depends(get_current_user),
):
    """Get security preferences for current user."""
    return await security_service.get_security_settings(current_user.id)


@router.put("/settings", response_model=SecuritySettingsResponse)
async def update_security_settings(
    body: SecuritySettingsUpdate,
    current_user=Depends(get_current_user),
):
    """Update security preferences for current user."""
    return await security_service.update_security_settings(current_user.id, body)


@router.get("/sessions", response_model=DeviceListResponse)
async def list_sessions(
    request: Request,
    current_user=Depends(get_current_user),
):
    """List active sessions / devices for the current user."""
    devices = await get_user_devices(current_user.id)
    raw_fp = request.headers.get("X-Fingerprint", "")
    current_id = None
    if raw_fp:
        import hashlib

        fp_hash = hashlib.sha256(raw_fp.encode()).hexdigest()
        current = await get_device_by_fingerprint(current_user.id, fp_hash)
        if current:
            current_id = current.get("id")
    return DeviceListResponse(devices=devices, current_device_id=current_id)


@router.delete("/sessions/{session_id}", response_model=DeviceResponse)
async def revoke_session(
    session_id: int,
    current_user=Depends(get_current_user),
):
    """Revoke a specific active session / device."""
    try:
        await remove_device(current_user.id, session_id)
        return DeviceResponse(id=session_id, is_trusted=None, is_primary=None)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/sessions", status_code=status.HTTP_200_OK)
async def revoke_all_sessions(
    current_user=Depends(get_current_user),
):
    """Revoke all active sessions and invalidate tokens for current user."""
    from app.core.prisma import prisma
    from app.core.security import add_user_to_blocklist

    await prisma.userdevice.update_many(
        where={"userId": current_user.id, "isActive": True},
        data={"isActive": False},
    )
    await add_user_to_blocklist(current_user.id)
    return {"message": "All sessions revoked successfully"}
