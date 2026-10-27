import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.core.rbac import require_permissions
from app.schemas.trending import (
    TrendingItem,
    TrendingResponse,
    CalculateTrendingResponse,
)
from app.services.trending_service import trending_service

router = APIRouter(prefix="/trending", tags=["Trending"])
logger = logging.getLogger(__name__)

VALID_ENTITY_TYPES = {"course", "project", "freelancer"}


@router.get("/{entity_type}", response_model=TrendingResponse)
async def get_trending(
    entity_type: str = Path(
        ..., description="Entity type: course, project, or freelancer"
    ),
    limit: int = Query(10, ge=1, le=50, description="Number of items to return"),
):
    if entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type '{entity_type}'. Must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}",
        )

    items = await trending_service.get_trending(entity_type, limit=limit)

    return TrendingResponse(
        entity_type=entity_type,
        items=[TrendingItem(**item) for item in items],
        calculated_at=datetime.now(timezone.utc),
    )


@router.post("/admin/trending/calculate", response_model=CalculateTrendingResponse)
async def calculate_trending(
    entity_type: str = Query(..., description="Entity type to recalculate"),
    admin=Depends(require_permissions("trending:recalculate")),
):
    if entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type '{entity_type}'. Must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}",
        )

    scores = await trending_service.calculate_trending(entity_type)

    return CalculateTrendingResponse(
        success=True,
        entity_type=entity_type,
        items_count=len(scores),
        message=f"Trending scores calculated for {len(scores)} {entity_type}(s)",
    )
