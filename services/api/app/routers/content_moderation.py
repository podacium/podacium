"""
Content Moderation Router — Draft/Publish workflow endpoints.

Instructor endpoints:
  - POST /education/modules/{id}/submit-review
  - GET  /education/modules/my-drafts

Admin endpoints:
  - GET  /admin/modules/pending-review
  - GET  /admin/modules/{id}/review-detail
  - POST /admin/modules/{id}/approve
  - POST /admin/modules/{id}/reject
  - POST /admin/modules/{id}/unpublish
  - POST /admin/modules/{id}/restore
  - POST /admin/modules/bulk-approve
  - POST /admin/modules/bulk-reject
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.core.auth import get_current_user
from app.core.rbac import require_permissions
from app.services.content_moderation_service import content_moderation_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Content Moderation"])


# ─── Request/Response Schemas ─────────────────────────────────────────────────


class RejectModuleRequest(BaseModel):
    """Request body for rejecting a module."""

    reason: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Reason for rejection. Must be constructive feedback (10-2000 chars).",
        examples=[
            "The content needs more practical examples and the video quality in lesson 3 is too low."
        ],
    )


class UnpublishModuleRequest(BaseModel):
    """Optional request body for unpublishing with a reason."""

    reason: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional reason for unpublishing.",
    )


class BulkApproveRequest(BaseModel):
    """Request body for bulk-approving modules."""

    module_ids: List[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of module IDs to approve (max 50 at once).",
    )

    @field_validator("module_ids")
    @classmethod
    def validate_ids(cls, v):
        if len(v) > 50:
            raise ValueError("Cannot bulk-approve more than 50 modules at once")
        if len(set(v)) != len(v):
            raise ValueError("Duplicate module IDs are not allowed")
        return v


class BulkRejectRequest(BaseModel):
    """Request body for bulk-rejecting modules."""

    module_ids: List[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of module IDs to reject.",
    )
    reason: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Shared rejection reason for all modules.",
    )

    @field_validator("module_ids")
    @classmethod
    def validate_ids(cls, v):
        if len(v) > 50:
            raise ValueError("Cannot bulk-reject more than 50 modules at once")
        return v


# ─── Instructor Endpoints ─────────────────────────────────────────────────────


@router.post(
    "/education/modules/{module_id}/submit-review",
    summary="Submit module for admin review",
    description=(
        "Instructor submits their module for admin approval. "
        "Module must be in DRAFT status with at least one lesson, "
        "a title (≥3 chars), and a description (≥10 chars)."
    ),
    responses={
        200: {"description": "Module submitted successfully"},
        400: {"description": "Module doesn't meet submission requirements"},
        403: {"description": "Not the module owner or not an instructor"},
        404: {"description": "Module not found"},
    },
)
async def submit_module_for_review(
    module_id: str,
    current_user=Depends(get_current_user),
):
    """Submit a module for admin review. Only the owning instructor can do this."""
    if current_user.role not in ("INSTRUCTOR", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.instructor_required",
        )

    return await content_moderation_service.submit_for_review(
        module_id=module_id,
        instructor_id=current_user.id,
    )


@router.get(
    "/education/modules/my-drafts",
    summary="Get instructor's own modules",
    description=(
        "Returns all modules owned by the current instructor. "
        "Optionally filter by status (DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED)."
    ),
    responses={
        200: {"description": "Paginated list of instructor's modules"},
        403: {"description": "Not an instructor"},
    },
)
async def get_my_drafts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by status: DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED",
        pattern="^(DRAFT|IN_REVIEW|PUBLISHED|ARCHIVED)$",
    ),
    current_user=Depends(get_current_user),
):
    """Get all modules belonging to the current instructor."""
    if current_user.role not in ("INSTRUCTOR", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.auth.instructor_required",
        )

    return await content_moderation_service.get_instructor_drafts(
        instructor_id=current_user.id,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
    )


# ─── Admin Endpoints ──────────────────────────────────────────────────────────


@router.get(
    "/admin/modules/pending-review",
    summary="List modules awaiting review",
    description="Admin-only. Returns all modules with status IN_REVIEW, ordered by submission date (oldest first).",
    responses={
        200: {"description": "Paginated list of modules pending review"},
        403: {"description": "Not an admin"},
    },
)
async def get_pending_review(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin=Depends(require_permissions("content:review:read")),
):
    """Get all modules pending admin review."""
    return await content_moderation_service.get_pending_review(
        page=page,
        page_size=page_size,
    )


@router.get(
    "/admin/modules/{module_id}/review-detail",
    summary="Get full module detail for review",
    description="Admin-only. Returns complete module information including lessons, instructor profile, and completeness score.",
    responses={
        200: {"description": "Full module detail for review"},
        403: {"description": "Not an admin"},
        404: {"description": "Module not found"},
    },
)
async def get_module_review_detail(
    module_id: str,
    admin=Depends(require_permissions("content:review:read")),
):
    """Get detailed module information for admin review."""
    return await content_moderation_service.get_module_review_detail(module_id)


@router.post(
    "/admin/modules/{module_id}/approve",
    summary="Approve a module for publication",
    description="Admin approves a module. Transitions from IN_REVIEW to PUBLISHED. Also publishes all draft lessons.",
    responses={
        200: {"description": "Module approved and published"},
        400: {"description": "Module is not in IN_REVIEW status"},
        403: {"description": "Not an admin"},
        404: {"description": "Module not found"},
    },
)
async def approve_module(
    module_id: str,
    admin=Depends(require_permissions("content:review:decide")),
):
    """Approve a module and publish it."""
    return await content_moderation_service.approve_module(
        module_id=module_id,
        admin_id=admin.id,
    )


@router.post(
    "/admin/modules/{module_id}/reject",
    summary="Reject a module",
    description="Admin rejects a module with constructive feedback. Transitions from IN_REVIEW back to DRAFT.",
    responses={
        200: {"description": "Module rejected with reason"},
        400: {"description": "Module not in IN_REVIEW status or reason too short"},
        403: {"description": "Not an admin"},
        404: {"description": "Module not found"},
    },
)
async def reject_module(
    module_id: str,
    body: RejectModuleRequest,
    admin=Depends(require_permissions("content:review:decide")),
):
    """Reject a module and send it back to the instructor with feedback."""
    return await content_moderation_service.reject_module(
        module_id=module_id,
        admin_id=admin.id,
        reason=body.reason,
    )


@router.post(
    "/admin/modules/{module_id}/unpublish",
    summary="Unpublish a module",
    description="Admin takes down a published module. Transitions from PUBLISHED to ARCHIVED.",
    responses={
        200: {"description": "Module unpublished"},
        400: {"description": "Module is not in PUBLISHED status"},
        403: {"description": "Not an admin"},
        404: {"description": "Module not found"},
    },
)
async def unpublish_module(
    module_id: str,
    body: Optional[UnpublishModuleRequest] = None,
    admin=Depends(require_permissions("content:courses:bulk")),
):
    """Unpublish (archive) a currently published module."""
    return await content_moderation_service.unpublish_module(
        module_id=module_id,
        admin_id=admin.id,
        reason=body.reason if body else None,
    )


@router.post(
    "/admin/modules/{module_id}/restore",
    summary="Restore an archived module",
    description="Admin restores an archived module back to DRAFT status for re-editing.",
    responses={
        200: {"description": "Module restored to DRAFT"},
        400: {"description": "Module is not in ARCHIVED status"},
        403: {"description": "Not an admin"},
        404: {"description": "Module not found"},
    },
)
async def restore_module(
    module_id: str,
    admin=Depends(require_permissions("content:courses:write")),
):
    """Restore an archived module back to DRAFT."""
    return await content_moderation_service.restore_module(
        module_id=module_id,
        admin_id=admin.id,
    )


@router.post(
    "/admin/modules/bulk-approve",
    summary="Bulk approve modules",
    description="Approve multiple modules at once. Modules not in IN_REVIEW status are skipped.",
    responses={
        200: {"description": "Bulk operation results"},
        403: {"description": "Not an admin"},
    },
)
async def bulk_approve_modules(
    body: BulkApproveRequest,
    admin=Depends(require_permissions("content:courses:bulk")),
):
    """Approve multiple modules at once."""
    return await content_moderation_service.bulk_approve(
        module_ids=body.module_ids,
        admin_id=admin.id,
    )


@router.post(
    "/admin/modules/bulk-reject",
    summary="Bulk reject modules",
    description="Reject multiple modules with the same reason. Modules not in IN_REVIEW status are skipped.",
    responses={
        200: {"description": "Bulk operation results"},
        403: {"description": "Not an admin"},
    },
)
async def bulk_reject_modules(
    body: BulkRejectRequest,
    admin=Depends(require_permissions("content:courses:bulk")),
):
    """Reject multiple modules with a shared reason."""
    return await content_moderation_service.bulk_reject(
        module_ids=body.module_ids,
        admin_id=admin.id,
        reason=body.reason,
    )
