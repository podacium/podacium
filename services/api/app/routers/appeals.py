"""
Platform-Wide Polymorphic Appeals Router.
Supports appeals for Reviews, Course Rejections, Account Bans, and Wallet Freezes.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.core.rbac import require_permissions
from app.generated.prisma import enums as p_enums
from app.services.audit_trail_service import AuditTrailService

logger = logging.getLogger("podacium.appeals")

router = APIRouter(tags=["Appeals"])
admin_router = APIRouter(prefix="/admin/appeals", tags=["Admin Appeals"])


class CreateAppealRequest(BaseModel):
    targetType: p_enums.PlatformAppealTargetType
    targetId: str
    reason: str = Field(..., min_length=10, max_length=5000)
    evidenceUrls: List[str] = Field(default_factory=list)


class ResolveAppealRequest(BaseModel):
    status: str
    resolutionNotes: Optional[str] = None
    resolution_notes: Optional[str] = None  # Snake case compatibility


class AppealResponse(BaseModel):
    id: int
    targetType: str
    targetId: str
    appealerId: int
    appealerName: Optional[str] = None
    appealerEmail: Optional[str] = None
    reason: str
    evidenceUrls: List[str]
    status: str
    resolutionNotes: Optional[str] = None
    resolvedById: Optional[int] = None
    resolvedByName: Optional[str] = None
    resolvedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


# ---------------------------------------------------------------------------
# Public User Endpoints: /api/appeals
# ---------------------------------------------------------------------------


@router.post(
    "/appeals", response_model=AppealResponse, status_code=status.HTTP_201_CREATED
)
async def submit_platform_appeal(
    data: CreateAppealRequest,
    current_user=Depends(get_current_active_user),
):
    """Submit a polymorphic appeal with proof/evidence attachments."""
    # Check if target exists and is valid based on targetType
    if data.targetType == p_enums.PlatformAppealTargetType.REVIEW:
        try:
            review_id = int(data.targetId)
            review = await prisma.contractreview.find_unique(where={"id": review_id})
            if not review:
                raise HTTPException(status_code=404, detail="Review not found")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid review ID format")
    elif data.targetType == p_enums.PlatformAppealTargetType.COURSE_REJECTION:
        module = await prisma.module.find_unique(where={"id": data.targetId})
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
    elif data.targetType == p_enums.PlatformAppealTargetType.ACCOUNT_BAN:
        pass
    elif data.targetType == p_enums.PlatformAppealTargetType.WALLET_FREEZE:
        pass

    # Prevent duplicate pending appeals for the same target by same user
    existing = await prisma.platformappeal.find_first(
        where={
            "appealerId": current_user.id,
            "targetType": data.targetType,
            "targetId": data.targetId,
            "status": p_enums.PlatformAppealStatus.PENDING,
        }
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending appeal for this resource.",
        )

    appeal = await prisma.platformappeal.create(
        data={
            "targetType": data.targetType,
            "targetId": data.targetId,
            "appealerId": current_user.id,
            "reason": data.reason,
            "evidenceUrls": data.evidenceUrls,
            "status": p_enums.PlatformAppealStatus.PENDING,
        },
        include={"appealer": True},
    )

    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="PLATFORM_APPEAL_SUBMITTED",
        domain="SUPPORT",
        resource_type="PlatformAppeal",
        resource_id=str(appeal.id),
        metadata={
            "targetType": data.targetType.name,
            "targetId": data.targetId,
            "evidenceCount": len(data.evidenceUrls),
        },
    )

    return AppealResponse(
        id=appeal.id,
        targetType=appeal.targetType.name,
        targetId=appeal.targetId,
        appealerId=appeal.appealerId,
        appealerName=appeal.appealer.fullName if appeal.appealer else None,
        appealerEmail=appeal.appealer.email if appeal.appealer else None,
        reason=appeal.reason,
        evidenceUrls=appeal.evidenceUrls,
        status=appeal.status.name,
        resolutionNotes=appeal.resolutionNotes,
        resolvedById=appeal.resolvedById,
        resolvedAt=appeal.resolvedAt,
        createdAt=appeal.createdAt,
        updatedAt=appeal.updatedAt,
    )


@router.get("/appeals/me", response_model=List[AppealResponse])
async def list_my_appeals(current_user=Depends(get_current_active_user)):
    """List current user's submitted appeals."""
    appeals = await prisma.platformappeal.find_many(
        where={"appealerId": current_user.id},
        order={"createdAt": "desc"},
        include={"appealer": True, "resolver": True},
    )
    return [
        AppealResponse(
            id=a.id,
            targetType=a.targetType.name,
            targetId=a.targetId,
            appealerId=a.appealerId,
            appealerName=a.appealer.fullName if a.appealer else None,
            appealerEmail=a.appealer.email if a.appealer else None,
            reason=a.reason,
            evidenceUrls=a.evidenceUrls,
            status=a.status.name,
            resolutionNotes=a.resolutionNotes,
            resolvedById=a.resolvedById,
            resolvedByName=a.resolver.fullName if a.resolver else None,
            resolvedAt=a.resolvedAt,
            createdAt=a.createdAt,
            updatedAt=a.updatedAt,
        )
        for a in appeals
    ]


# ---------------------------------------------------------------------------
# Admin Endpoints: /admin/appeals
# ---------------------------------------------------------------------------


@admin_router.get("", response_model=List[Dict[str, Any]])
async def list_admin_appeals(
    targetType: Optional[str] = Query(None, alias="target_type"),
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    admin=Depends(require_permissions("appeals:read")),
):
    """Admin: List platform appeals with targetType, status, and date filtering."""
    where: Dict[str, Any] = {}
    if status and status != "ALL":
        status_enum = getattr(p_enums.PlatformAppealStatus, status.upper(), None)
        if status_enum:
            where["status"] = status_enum
    if targetType and targetType != "ALL":
        target_enum = getattr(
            p_enums.PlatformAppealTargetType, targetType.upper(), None
        )
        if target_enum:
            where["targetType"] = target_enum
    if start_date or end_date:
        date_filter: Dict[str, Any] = {}
        if start_date:
            date_filter["gte"] = start_date
        if end_date:
            date_filter["lte"] = end_date
        where["createdAt"] = date_filter

    platform_appeals = await prisma.platformappeal.find_many(
        where=where,
        order={"createdAt": "desc"},
        include={"appealer": True, "resolver": True},
    )

    results = []
    for a in platform_appeals:
        results.append(
            {
                "id": a.id,
                "targetType": a.targetType.name,
                "targetId": a.targetId,
                "appealerId": a.appealerId,
                "appealerName": a.appealer.fullName if a.appealer else "Unknown",
                "appealerEmail": a.appealer.email if a.appealer else "Unknown",
                "reason": a.reason,
                "evidenceUrls": a.evidenceUrls,
                "status": a.status.name,
                "resolutionNotes": a.resolutionNotes,
                "resolvedById": a.resolvedById,
                "resolvedByName": a.resolver.fullName if a.resolver else None,
                "resolvedAt": a.resolvedAt.isoformat() if a.resolvedAt else None,
                "createdAt": a.createdAt.isoformat(),
            }
        )

    # Include legacy ReviewAppeal if not filtered out
    if not targetType or targetType in ("REVIEW", "ALL"):
        review_where: Dict[str, Any] = {}
        if status and status != "ALL":
            mapped_status = (
                "APPROVED" if status.upper() == "ACCEPTED" else status.upper()
            )
            rev_status = getattr(p_enums.AppealStatus, mapped_status, None)
            if rev_status:
                review_where["status"] = rev_status
        review_appeals = await prisma.reviewappeal.find_many(
            where=review_where,
            order={"createdAt": "desc"},
            include={"appealer": True, "review": {"include": {"author": True}}},
        )
        for r in review_appeals:
            results.append(
                {
                    "id": r.id,
                    "targetType": "REVIEW",
                    "targetId": str(r.reviewId),
                    "reviewId": r.reviewId,
                    "appealerId": r.appealerId,
                    "appealerName": r.appealer.fullName if r.appealer else "Unknown",
                    "authorName": r.review.author.fullName
                    if r.review and r.review.author
                    else "Unknown",
                    "reason": r.reason,
                    "evidenceUrls": r.evidenceUrls,
                    "status": "ACCEPTED"
                    if r.status.name == "APPROVED"
                    else r.status.name,
                    "resolutionNotes": r.resolutionNotes,
                    "resolvedAt": r.resolvedAt.isoformat() if r.resolvedAt else None,
                    "createdAt": r.createdAt.isoformat(),
                }
            )

    return results


@admin_router.patch("/{id}/resolve")
@admin_router.post("/{id}/resolve")
async def resolve_platform_appeal(
    id: int,
    data: ResolveAppealRequest,
    admin=Depends(require_permissions("appeals:resolve")),
):
    """Super Admin / Moderator resolution with mandatory cryptographic audit log emission."""
    now = datetime.now(timezone.utc)
    notes = data.resolutionNotes or data.resolution_notes or ""
    clean_status = data.status.upper()
    if clean_status == "APPROVED":
        clean_status = "ACCEPTED"

    # Check if PlatformAppeal
    appeal = await prisma.platformappeal.find_unique(where={"id": id})
    if appeal:
        status_enum = getattr(
            p_enums.PlatformAppealStatus,
            clean_status,
            p_enums.PlatformAppealStatus.ACCEPTED
            if clean_status in ("ACCEPTED", "APPROVED")
            else p_enums.PlatformAppealStatus.REJECTED,
        )
        before_state = {"status": appeal.status.name}
        await prisma.platformappeal.update(
            where={"id": id},
            data={
                "status": status_enum,
                "resolutionNotes": notes,
                "resolvedById": admin.id,
                "resolvedAt": now,
            },
        )

        # Automated restoration for accepted appeals
        if status_enum == p_enums.PlatformAppealStatus.ACCEPTED:
            if appeal.targetType == p_enums.PlatformAppealTargetType.REVIEW:
                try:
                    await prisma.contractreview.update(
                        where={"id": int(appeal.targetId)},
                        data={"status": "REDACTED"},
                    )
                except Exception:
                    pass
            elif appeal.targetType == p_enums.PlatformAppealTargetType.ACCOUNT_BAN:
                try:
                    await prisma.user.update(
                        where={"id": int(appeal.targetId)},
                        data={"isBanned": False, "isActive": True},
                    )
                except Exception:
                    pass

        await AuditTrailService.log_action(
            actor_id=admin.id,
            action=f"PLATFORM_APPEAL_{status_enum.name}",
            domain="SUPPORT",
            resource_type="PlatformAppeal",
            resource_id=str(id),
            before_state=before_state,
            after_state={"status": status_enum.name, "notes": notes},
        )
        return {
            "success": True,
            "message": f"Appeal {id} resolved to {status_enum.name}",
        }

    # Fallback to legacy ReviewAppeal
    review_appeal = await prisma.reviewappeal.find_unique(where={"id": id})
    if review_appeal:
        rev_status = (
            p_enums.AppealStatus.APPROVED
            if clean_status in ("APPROVED", "ACCEPTED")
            else p_enums.AppealStatus.REJECTED
        )
        review_state = (
            "REDACTED" if rev_status == p_enums.AppealStatus.APPROVED else "ACTIVE"
        )

        async with prisma.tx() as tx:
            await tx.reviewappeal.update(
                where={"id": id},
                data={
                    "status": rev_status,
                    "resolutionNotes": notes,
                    "resolvedAt": now,
                    "resolvedById": admin.id,
                },
            )
            await tx.contractreview.update(
                where={"id": review_appeal.reviewId},
                data={"status": review_state},
            )

        await AuditTrailService.log_action(
            actor_id=admin.id,
            action=f"APPEAL_{rev_status.name}",
            domain="MODERATION",
            resource_type="ReviewAppeal",
            resource_id=str(id),
            before_state={"status": review_appeal.status.name},
            after_state={"status": rev_status.name, "reviewStatus": review_state},
        )
        return {
            "success": True,
            "message": f"Review Appeal {id} resolved to {rev_status.name}",
        }

    raise HTTPException(status_code=404, detail="Appeal not found")
