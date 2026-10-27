"""
Embedded BI Router
Provides JWT token generation for embedding BI dashboards and widgets securely via SSO/iframe.
"""

import time
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user, verify_organization_access
from app.core.security import create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/embed", tags=["Embedded BI Analytics"])

class EmbedTokenRequest(BaseModel):
    dashboardId: Optional[int] = Field(None, description="Target dashboard ID to embed")
    datasetId: Optional[int] = Field(None, description="Target dataset ID to embed")
    organizationId: Optional[int] = Field(None, description="Organization ID")
    allowedDomains: List[str] = Field(default_factory=list, description="White-listed parent domains for CSP frame-ancestors")
    ttlMinutes: int = Field(15, ge=1, le=1440, description="Token lifetime in minutes")

class EmbedTokenResponse(BaseModel):
    embedToken: str
    expiresAt: int
    dashboardId: Optional[int]
    datasetId: Optional[int]
    organizationId: int
    allowedDomains: List[str]

@router.post("/token", response_model=EmbedTokenResponse)
async def generate_embed_token(
    request: EmbedTokenRequest,
    current_user=Depends(get_current_user),
):
    """Generate a signed JWT embed token for embedding BI dashboards securely."""
    org_id = await verify_organization_access(request.organizationId, current_user)
    
    from app.core.prisma import prisma
    if request.dashboardId:
        db = await prisma.dashboard.find_unique(where={"id": request.dashboardId})
        if not db or db.organizationId != org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="errors.bi.unauthorized_dashboard")

    if request.datasetId:
        ds = await prisma.dataset.find_unique(where={"id": request.datasetId})
        if not ds or ds.organizationId != org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="errors.bi.unauthorized_dataset")

    expires_at = int(time.time()) + (request.ttlMinutes * 60)
    
    payload = {
        "sub": str(current_user.id),
        "organization_id": org_id,
        "dashboard_id": request.dashboardId,
        "dataset_id": request.datasetId,
        "allowed_domains": request.allowedDomains,
        "type": "embed_token",
        "exp": expires_at,
    }
    
    # Audit log entry
    from app.services.bi_services.audit_service import BIAuditService
    await BIAuditService.log_action(
        user_id=current_user.id,
        organization_id=org_id,
        action="GENERATE_EMBED_TOKEN",
        resource_type="dashboard" if request.dashboardId else "dataset",
        resource_id=str(request.dashboardId or request.datasetId or "all"),
        details={"allowed_domains": request.allowedDomains, "ttl_minutes": request.ttlMinutes},
    )

    # Create signed token
    embed_token = create_access_token(payload)
    
    return EmbedTokenResponse(
        embedToken=embed_token,
        expiresAt=expires_at,
        dashboardId=request.dashboardId,
        datasetId=request.datasetId,
        organizationId=org_id,
        allowedDomains=request.allowedDomains,
    )
