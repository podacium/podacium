"""
Public shared insight endpoints — no authentication required.
Anyone with a valid share token can view the snapshot data.
"""

from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.prisma import prisma

router = APIRouter(prefix="/shared", tags=["Shared Insights"])


@router.get("/{token}")
async def get_shared_insight(
    token: str,
    locale: Optional[str] = Query(None, description="Override locale (en, fr, ar)"),
):
    """
    Get a publicly shared BI insight by token.
    No authentication required — anyone with the link can view it.
    Tokens expire after 7 days.
    """
    shared = await prisma.sharedinsight.find_unique(where={"token": token})
    if not shared:
        raise HTTPException(status_code=404, detail="Shared insight not found")

    # Check expiration
    if shared.expiresAt and shared.expiresAt < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This shared insight has expired")

    # Resolve locale: query param > stored locale > default
    resolved_locale = locale or shared.locale

    if shared.type == "health":
        from app.services.bi_services.health_score_service import HealthScoreService

        result = await HealthScoreService.calculate_health_score(
            organization_id=shared.organizationId,
            locale=resolved_locale,
        )
        result["shared_token"] = token
        result["shared_at"] = shared.createdAt.isoformat()
        return result

    raise HTTPException(status_code=400, detail=f"Unsupported share type: {shared.type}")
