"""
Cross-pillar flywheel router for Podacium BI.
Syncs data from Education and Freelancing into BI datasets.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.prisma import prisma


router = APIRouter(prefix="/flywheel", tags=["BI - Cross-Pillar Flywheel"])


class FlywheelSyncRequest(BaseModel):
    """Request to sync cross-pillar data"""
    days_back: int = Field(90, ge=1, le=365, description="Days of history to sync")
    name: Optional[str] = Field(None, max_length=200, description="Dataset name")
    organization_id: Optional[int] = None


class FlywheelSyncResponse(BaseModel):
    """Flywheel sync response"""
    success: bool
    message: Optional[str] = None
    record_count: int = 0
    sync_summary: Optional[dict] = None
    dataset_id: Optional[str] = None


@router.post(
    "/sync",
    response_model=FlywheelSyncResponse,
    status_code=status.HTTP_200_OK,
)
async def sync_cross_pillar_data(
    request: FlywheelSyncRequest,
    current_user=Depends(get_current_user),
):
    """
    Sync data from Education and Freelancing pillars into a BI dataset.
    
    This pulls:
    - Course completions and certificates (Education)
    - Contract completions and payments (Freelancing)
    - Wallet transactions
    
    And creates a unified dataset for BI analytics.
    """
    try:
        from app.services.bi_services.flywheel_service import FlywheelService

        # Determine org ID
        org_id = request.organization_id or getattr(current_user, "primaryOrganizationId", None)
        if not org_id:
            memberships = await prisma.organizationmember.find_many(
                where={"userId": current_user.id}, take=1
            )
            org_id = memberships[0].organizationId if memberships else None

        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization ID is required for flywheel sync.",
            )

        result = await FlywheelService.create_flywheel_dataset(
            organization_id=org_id,
            user_id=current_user.id,
            days_back=request.days_back,
            name=request.name,
        )

        if not result.get("success"):
            return FlywheelSyncResponse(
                success=False,
                message=result.get("message", "No data to sync."),
                record_count=0,
            )

        dataset = result.get("dataset", {})
        return FlywheelSyncResponse(
            success=True,
            message=f"Successfully synced {result['record_count']} records from cross-pillar data.",
            record_count=result["record_count"],
            sync_summary=result.get("sync_summary"),
            dataset_id=dataset.get("dataset_id"),
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Flywheel sync failed: {str(e)}",
        )


@router.get(
    "/preview",
    status_code=status.HTTP_200_OK,
)
async def preview_cross_pillar_data(
    days_back: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user),
):
    """
    Preview cross-pillar data without creating a dataset.
    Shows what data would be synced from Education and Freelancing.
    """
    try:
        from app.services.bi_services.flywheel_service import FlywheelService

        org_id = getattr(current_user, "primaryOrganizationId", None)
        if not org_id:
            memberships = await prisma.organizationmember.find_many(
                where={"userId": current_user.id}, take=1
            )
            org_id = memberships[0].organizationId if memberships else None

        result = await FlywheelService.sync_all_pillars(
            organization_id=org_id or 0,
            user_id=current_user.id,
            days_back=days_back,
        )

        return {
            "success": True,
            "preview": result["records"][:20],  # First 20 for preview
            "total_records": result["record_count"],
            "breakdown": result["breakdown"],
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preview failed: {str(e)}",
        )
