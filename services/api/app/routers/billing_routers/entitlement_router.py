from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from app.core.auth import get_current_active_user
from app.services.billing_services.entitlement_service import entitlement_service

router = APIRouter(prefix="/billing/entitlements", tags=["Entitlements"])

@router.get("/check")
async def check_access(
    type: str, 
    resource: Optional[str] = "", 
    current_user = Depends(get_current_active_user)
):
    """
    Authoritative check: can the current user access this resource?
    Used by frontend and other services.
    """
    has_access = await entitlement_service.has_entitlement(
        user_id=current_user.id,
        entitlement_type=type,
        resource_id=resource
    )
    
    if not has_access:
        return {"access": False, "message": "Access denied. Active subscription or purchase required."}
    
    return {"access": True}

@router.post("/admin/grant")
async def manual_grant(
    user_id: int,
    type: str,
    resource: Optional[str] = "",
    days: Optional[int] = 30,
    current_user = Depends(get_current_active_user)
):
    """
    Admin-only: Manually grant access (e.g. for BI pillar).
    """
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")

    from datetime import datetime, timedelta, timezone
    expiry = datetime.now(timezone.utc) + timedelta(days=days) if days else None
    
    await entitlement_service.grant_entitlement(
        user_id=user_id,
        entitlement_type=type,
        resource_id=resource,
        source_type="admin_grant",
        source_id=str(current_user.id),
        expires_at=expiry
    )
    
    return {"status": "granted", "expires_at": expiry}
