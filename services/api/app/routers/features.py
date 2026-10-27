import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_active_user
from app.services.feature_service import feature_service

router = APIRouter(prefix="/features", tags=["features"])
logger = logging.getLogger(__name__)


class PurchaseFeatureRequest(BaseModel):
    feature_key: str
    reference_id: Optional[str] = None
    quantity: int = 1


@router.get("")
async def list_features():
    features = []
    for key, cfg in feature_service.FEATURE_CONFIG.items():
        features.append({"key": key, "price": cfg["price"], "type": cfg["type"]})
    return {"features": features}


@router.post("/purchase")
async def purchase_feature(
    req: PurchaseFeatureRequest,
    current_user=Depends(get_current_active_user),
):
    """Buy a feature with PodaPoints.

    All validation (purchasability, price consistency, quantity bounds) happens
    before any points are debited, and the debit + grant share one database
    transaction — see ``FeatureService.purchase_with_points``.
    """
    try:
        return await feature_service.purchase_with_points(
            current_user.id,
            req.feature_key,
            reference_id=req.reference_id,
            quantity=req.quantity,
        )
    except ValueError as exc:
        # int() on a non-numeric reference_id, or a bad quantity.
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/check/project-post")
async def check_project_post(current_user=Depends(get_current_active_user)):
    availability = await feature_service.check_project_post_available(current_user.id)
    return availability


@router.get("/my-purchases")
async def get_my_active_features(current_user=Depends(get_current_active_user)):
    active = await feature_service.get_active_features(current_user.id)
    return {"active_features": active}
