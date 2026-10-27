"""Device fingerprinting and security management API endpoints.

Integrates with the device fingerprinting service for registration,
trust management, security event history, and admin device management.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request

from app.core.auth import get_current_user
from app.core.rbac import require_permissions
from app.schemas.security import (
    DeviceListResponse,
    DeviceResponse,
    DeviceTrustToggleRequest,
    SecurityEventResponse,
    EscrowEligibilityResponse,
)
from app.services.device_fingerprint_service import (
    get_user_devices,
    get_device_stats,
    get_device_by_fingerprint,
    toggle_device_trust,
    set_primary_device,
    remove_device,
    get_security_events,
    check_escrow_eligibility,
    bypass_cooldown_with_2fa,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Device Fingerprinting"])


@router.get("/devices", response_model=DeviceListResponse)
async def list_devices(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """List all active devices for the current user."""
    devices = await get_user_devices(current_user.id)
    raw_fp = request.headers.get("X-Fingerprint", "")
    current_id = None
    if raw_fp:
        import hashlib

        fp_hash = hashlib.sha256(raw_fp.encode()).hexdigest()
        current = await get_device_by_fingerprint(current_user.id, fp_hash)
        if current:
            current_id = current["id"]
    return DeviceListResponse(
        devices=devices,
        current_device_id=current_id,
    )


@router.get("/devices/stats")
async def device_stats(
    current_user: dict = Depends(get_current_user),
):
    """Get device summary stats for dashboard stat cards."""
    return await get_device_stats(current_user.id)


@router.get("/devices/events", response_model=list[SecurityEventResponse])
async def list_security_events(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get recent security events for the current user."""
    events = await get_security_events(current_user.id, limit=limit)
    return [SecurityEventResponse(**e) for e in events]


@router.post("/devices/{device_id}/trust", response_model=DeviceResponse)
async def set_device_trust(
    device_id: int,
    body: DeviceTrustToggleRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Toggle the trusted status of a device.
    The frontend must complete 2FA verification before calling this.
    """
    try:
        result = await toggle_device_trust(current_user.id, device_id, body.is_trusted)
        return DeviceResponse(id=device_id, is_trusted=result["isTrusted"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/devices/current/trust", response_model=DeviceResponse)
async def trust_current_device(
    request: Request,
    body: DeviceTrustToggleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Trust or revoke trust for the current device (identified by fingerprint header)."""
    raw_fp = request.headers.get("X-Fingerprint", "")
    if not raw_fp:
        raise HTTPException(status_code=400, detail="No fingerprint header")
    import hashlib

    fp_hash = hashlib.sha256(raw_fp.encode()).hexdigest()
    device = await get_device_by_fingerprint(current_user.id, fp_hash)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    try:
        result = await toggle_device_trust(
            current_user.id, device["id"], body.is_trusted
        )
        return DeviceResponse(id=device["id"], is_trusted=result["isTrusted"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/devices/{device_id}/primary", response_model=DeviceResponse)
async def set_device_primary(
    device_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Set a device as the primary device. Unsets any existing primary."""
    try:
        await set_primary_device(current_user.id, device_id)
        return DeviceResponse(id=device_id, is_trusted=None, is_primary=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/devices/{device_id}", response_model=DeviceResponse)
async def delete_device(
    device_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Remove (soft-delete) a device.
    Primary devices cannot be removed.
    """
    try:
        await remove_device(current_user.id, device_id)
        return DeviceResponse(id=device_id, is_trusted=None, is_primary=None)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/devices/escrow-eligibility", response_model=EscrowEligibilityResponse)
async def get_escrow_eligibility(
    fingerprint_hash: str = Query(..., description="SHA-256 hashed fingerprint"),
    current_user: dict = Depends(get_current_user),
):
    """Check if the current device is allowed to perform escrow/payout actions."""
    result = await check_escrow_eligibility(current_user.id, fingerprint_hash)
    return EscrowEligibilityResponse(**result)


@router.post("/devices/cooldown-bypass", response_model=EscrowEligibilityResponse)
async def bypass_cooldown(
    fingerprint_hash: str = Query(..., description="SHA-256 hashed fingerprint"),
    current_user: dict = Depends(get_current_user),
):
    """Bypass device cooldown after successful 2FA verification."""
    result = await bypass_cooldown_with_2fa(current_user.id, fingerprint_hash)
    return EscrowEligibilityResponse(**result)


# ─── Admin Endpoints ──────────────────────────────────────────────────────────


@router.get("/admin/devices/{user_id}", response_model=DeviceListResponse)
async def admin_list_user_devices(
    user_id: int,
    _admin=Depends(require_permissions("security:devices:read")),
):
    """Admin: list all devices for a specific user."""
    devices = await get_user_devices(user_id)
    return DeviceListResponse(devices=devices, current_device_id=None)


@router.post("/admin/devices/{device_id}/override", response_model=DeviceResponse)
async def admin_override_device(
    device_id: int,
    body: DeviceTrustToggleRequest,
    _admin=Depends(require_permissions("security:devices:override")),
):
    """Admin: manually override device trust or active status."""
    from app.core.prisma import prisma

    update_data = {}
    if body.is_trusted is not None:
        update_data["isTrusted"] = body.is_trusted
    if body.is_active is not None:
        update_data["isActive"] = body.is_active
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    await prisma.userdevice.update(
        where={"id": device_id},
        data=update_data,
    )
    return DeviceResponse(id=device_id, is_trusted=body.is_trusted)


@router.get(
    "/admin/devices/{user_id}/events", response_model=list[SecurityEventResponse]
)
async def admin_list_user_events(
    user_id: int,
    limit: int = Query(50, ge=1, le=200),
    _admin=Depends(require_permissions("security:events:read")),
):
    """Admin: view security events for a user."""
    events = await get_security_events(user_id, limit=limit)
    return [SecurityEventResponse(**e) for e in events]
