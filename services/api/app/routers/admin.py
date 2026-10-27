# services/api/app/routers/admin.py
"""Admin panel API endpoints for managing platform content and users."""

import asyncio
import logging
import math
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Any

from app.generated.prisma import enums as p_enums

from pydantic import BaseModel, Field
from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Query,
    UploadFile,
    File,
    Form,
    status,
    Request,
)

from app.core.rbac import require_permissions
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.services.audit_trail_service import AuditTrailService
from app.services.feature_flag_service import feature_flag_service
from app.schemas.admin import (
    AdminDashboardStats,
    AdminUserSummary,
    AdminUserDetail,
    AdminUserUpdate,
    AdminUserListResponse,
    AdminOrgSummary,
    AdminOrgListResponse,
    AdminPathCreate,
    AdminPathUpdate,
    AdminPathSummary,
    AdminPathListResponse,
    AdminPathModuleAdd,
    AdminPathModuleReorder,
    AdminModuleCreate,
    AdminModuleUpdate,
    AdminModuleSummary,
    AdminModuleListResponse,
    AdminBulkActionRequest,
    AdminBulkActionResponse,
    AdminLessonCreate,
    AdminLessonUpdate,
    AdminLessonReorderRequest,
    AdminQuizCreate,
    AdminQuizUpdate,
    AdminQuizQuestionCreate,
    AdminQuizQuestionUpdate,
    AdminAppealResolve,
    FeatureFlagCreate,
    FeatureFlagUpdate,
    FeatureFlagResponse,
    CreatePendingActionRequest,
    ApprovalDecisionRequest,
    PendingActionResponse,
)
from app.schemas.waitlist import (
    WaitlistAdminEntryResponse,
    WaitlistAdminStatsResponse,
    WaitlistReferralMilestoneResponse,
    WaitlistMilestoneCreate,
)
from fastapi.responses import StreamingResponse
import csv
import io

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)


# =============================================================================
# DASHBOARD
# =============================================================================


@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_dashboard_stats(admin=Depends(require_permissions("dashboard:read"))):
    """Get aggregate statistics for the admin dashboard."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    (
        total_users,
        active_users,
        total_orgs,
        total_paths,
        total_modules,
        published_modules,
        total_lessons,
        total_quizzes,
        total_enrollments,
        new_users,
        new_enrollments,
        total_revenue,
    ) = await asyncio.gather(
        prisma.user.count(where={"deletedAt": None}),
        prisma.user.count(where={"isActive": True, "deletedAt": None}),
        prisma.organization.count(where={"deletedAt": None}),
        prisma.path.count(where={"deletedAt": None}),
        prisma.module.count(where={"deletedAt": None}),
        prisma.module.count(where={"deletedAt": None, "featured": True}),
        prisma.lesson.count(where={"deletedAt": None}),
        prisma.quiz.count(where={"deletedAt": None}),
        prisma.enrollment.count(where={"deletedAt": None}),
        prisma.user.count(where={"createdAt": {"gte": month_start}, "deletedAt": None}),
        prisma.enrollment.count(
            where={"createdAt": {"gte": month_start}, "deletedAt": None}
        ),
        _get_total_revenue(),
        return_exceptions=True,
    )

    def safe(val, default=0):
        return val if not isinstance(val, Exception) else default

    return AdminDashboardStats(
        total_users=safe(total_users),
        active_users=safe(active_users),
        total_organizations=safe(total_orgs),
        total_paths=safe(total_paths),
        total_modules=safe(total_modules),
        published_modules=safe(published_modules),
        total_lessons=safe(total_lessons),
        total_quizzes=safe(total_quizzes),
        total_enrollments=safe(total_enrollments),
        new_users_this_month=safe(new_users),
        new_enrollments_this_month=safe(new_enrollments),
        total_revenue=safe(total_revenue, 0.0),
    )


async def _get_total_revenue() -> int:
    """Sum completed transaction amounts."""
    try:
        txns = await prisma.transaction.find_many(
            where={"status": "COMPLETED"},
        )
        return sum(t.amount for t in txns if t.amount)
    except Exception:
        return 0


# =============================================================================
# USER MANAGEMENT
# =============================================================================


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    admin=Depends(require_permissions("users:read")),
):
    """List users with pagination, search, and filters."""
    where: dict = {"deletedAt": None}
    if search:
        where["OR"] = [
            {"fullName": {"contains": search, "mode": "insensitive"}},
            {"email": {"contains": search, "mode": "insensitive"}},
        ]
    if role:
        where["role"] = role
    if is_active is not None:
        where["isActive"] = is_active

    total, users = await asyncio.gather(
        prisma.user.count(where=where),
        prisma.user.find_many(
            where=where,
            skip=(page - 1) * page_size,
            take=page_size,
            order={"createdAt": "desc"},
        ),
    )

    return AdminUserListResponse(
        users=[AdminUserSummary.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(
    user_id: int, admin=Depends(require_permissions("users:read"))
):
    """Get detailed user information."""
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollment_count, certificate_count = await asyncio.gather(
        prisma.enrollment.count(where={"userId": user_id}),
        prisma.certificate.count(where={"userId": user_id}),
    )

    data = {
        **user.__dict__,
        "enrollment_count": enrollment_count,
        "certificate_count": certificate_count,
    }
    return AdminUserDetail.model_validate(data)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    update: AdminUserUpdate,
    admin=Depends(require_permissions("users:write")),
):
    """Update user role or deactivation status."""
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Block self-demotion
    if user_id == admin.id and update.role is not None and update.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.admin.cannot_demote_self",
        )
    if user_id == admin.id and update.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.admin.cannot_deactivate_self",
        )

    # Clearance check: Cannot modify higher clearance administrator
    target_profile = await prisma.adminprofile.find_unique(where={"userId": user_id})
    current_profile = await prisma.adminprofile.find_unique(where={"userId": admin.id})
    is_super = (
        current_profile
        and current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
    )

    if target_profile and not is_super:
        if target_profile.clearanceLevel > (
            current_profile.clearanceLevel if current_profile else 0
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_modify_higher_clearance",
            )

    update_data: dict = {}
    if update.role is not None:
        update_data["role"] = update.role
    if update.is_deactivated is not None:
        update_data["isDeactivated"] = update.is_deactivated
        if update.is_deactivated:
            update_data["deactivatedAt"] = datetime.now(timezone.utc)
        else:
            update_data["deactivatedAt"] = None
    if update.is_active is not None:
        update_data["isActive"] = update.is_active
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await prisma.user.update(where={"id": user_id}, data=update_data)

    if update.is_deactivated or update.is_active is False:
        from app.core.security import add_user_to_blocklist

        await add_user_to_blocklist(user_id)

    # Cryptographic audit logging
    admin_profile_id = getattr(admin, "adminProfile", None)
    admin_profile_id = admin_profile_id.id if admin_profile_id else None
    await AuditTrailService.log_action(
        action="USER_UPDATE",
        domain="USERS",
        resource_type="User",
        resource_id=str(user_id),
        admin_profile_id=admin_profile_id,
        before_state={"role": user.role, "isActive": user.isActive},
        after_state={"role": updated.role, "isActive": updated.isActive},
        metadata={"updated_by": admin.id},
    )

    return {"success": True, "user_id": updated.id, "role": updated.role}


class ImpersonateUserRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


@router.post("/users/{user_id}/impersonate")
async def impersonate_user(
    user_id: int,
    req: ImpersonateUserRequest,
    admin=Depends(require_permissions("users:impersonate")),
):
    """
    Ephemeral Impersonation Engine ("Login-as-User" with Retool/Vanta Guardrails).
    - Restricted to SUPER_ADMIN with clearance >= 5.
    - Issues an ephemeral JWT with max TTL of 15 minutes.
    - Emits high-severity audit record: IMPERSONATION_STARTED.
    """
    admin_profile = await prisma.adminprofile.find_unique(where={"userId": admin.id})
    if (
        not admin_profile
        or admin_profile.department != p_enums.AdminDepartment.SUPER_ADMIN
        or admin_profile.clearanceLevel < 5
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "INSUFFICIENT_IMPERSONATION_CLEARANCE",
                "message": "User impersonation requires SUPER_ADMIN department with clearance level 5 or above.",
            },
        )

    target_user = await prisma.user.find_unique(where={"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    if target_user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot impersonate yourself")

    target_admin_profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id}
    )
    if target_admin_profile and target_admin_profile.clearanceLevel >= 5:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot impersonate a peer or higher clearance administrative account.",
        )

    impersonation_session_id = f"imp_{secrets.token_hex(8)}"
    actor_claim = {
        "id": admin.id,
        "email": admin.email,
        "role": getattr(admin, "role", "SUPER_ADMIN"),
        "reason": req.reason,
        "impersonation_session_id": impersonation_session_id,
    }

    from app.core.security import create_access_token_for_user

    ephemeral_token = create_access_token_for_user(
        user_id=target_user.id,
        role=target_user.role,
        actor=actor_claim,
        expires_delta=timedelta(minutes=15),
    )

    await AuditTrailService.log_action(
        actor_id=admin.id,
        impersonator_id=admin.id,
        action="IMPERSONATION_STARTED",
        domain="SECURITY",
        severity="HIGH",
        resource_type="User",
        resource_id=str(target_user.id),
        metadata={
            "targetEmail": target_user.email,
            "targetRole": target_user.role,
            "reason": req.reason,
            "impersonationSessionId": impersonation_session_id,
            "expiresInSeconds": 900,
        },
    )

    return {
        "access_token": ephemeral_token,
        "token_type": "bearer",
        "expires_in": 900,
        "target_user": {
            "id": target_user.id,
            "email": target_user.email,
            "fullName": target_user.fullName,
            "role": target_user.role,
        },
        "actor": actor_claim,
    }


# =============================================================================
# ORGANIZATION MANAGEMENT
# =============================================================================


@router.get("/organizations", response_model=AdminOrgListResponse)
async def list_organizations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    admin=Depends(require_permissions("orgs:read")),
):
    """List organizations with pagination and search."""
    where: dict = {"deletedAt": None}
    if search:
        where["name"] = {"contains": search, "mode": "insensitive"}

    total, orgs = await asyncio.gather(
        prisma.organization.count(where=where),
        prisma.organization.find_many(
            where=where,
            skip=(page - 1) * page_size,
            take=page_size,
            order={"createdAt": "desc"},
            include={"owner": True, "members": True},
        ),
    )

    summaries = []
    for org in orgs:
        data = {
            **org.__dict__,
            "owner_name": org.owner.fullName if org.owner else None,
            "member_count": len(org.members) if org.members else 0,
        }
        summaries.append(AdminOrgSummary.model_validate(data))

    return AdminOrgListResponse(
        organizations=summaries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/organizations/{org_id}")
async def get_organization_detail(
    org_id: int, admin=Depends(require_permissions("orgs:read"))
):
    """Get organization detail."""
    org = await prisma.organization.find_unique(
        where={"id": org_id},
        include={"owner": True, "members": True},
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "id": org.id,
        "name": org.name,
        "description": org.description,
        "country": org.country,
        "city": org.city,
        "sector": org.sector,
        "website": org.website,
        "createdAt": org.createdAt,
        "owner": {
            "id": org.owner.id,
            "fullName": org.owner.fullName,
            "email": org.owner.email,
        }
        if org.owner
        else None,
        "memberCount": len(org.members) if org.members else 0,
    }


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: int, admin=Depends(require_permissions("orgs:delete"))
):
    """Soft-delete an organization."""
    org = await prisma.organization.find_unique(where={"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await prisma.organization.update(
        where={"id": org_id}, data={"deletedAt": datetime.now(timezone.utc)}
    )
    await AuditTrailService.log_action(
        action="ORGANIZATION_DELETE",
        domain="USERS",
        resource_type="Organization",
        resource_id=str(org_id),
        metadata={"organization_name": org.name, "deleted_by": admin.id},
    )
    return {"success": True}


# =============================================================================
# PATH MANAGEMENT
# =============================================================================


@router.get("/paths", response_model=AdminPathListResponse)
async def list_paths(
    search: Optional[str] = None,
    admin=Depends(require_permissions("content:paths:read")),
):
    """List all paths with module count and enrollment count."""
    where: dict = {"deletedAt": None}
    if search:
        where["title"] = {"contains": search, "mode": "insensitive"}

    paths = await prisma.path.find_many(
        where=where,
        order={"createdAt": "desc"},
        include={"modules": True, "enrollments": True},
    )

    summaries = []
    for p in paths:
        data = {
            **p.__dict__,
            "module_count": len(p.modules) if p.modules else 0,
            "enrollment_count": len(p.enrollments) if p.enrollments else 0,
        }
        summaries.append(AdminPathSummary.model_validate(data))

    return AdminPathListResponse(paths=summaries, total=len(summaries))


@router.post("/paths", status_code=201)
async def create_path(
    path_data: AdminPathCreate,
    admin=Depends(require_permissions("content:paths:write")),
):
    """Create a new learning path."""
    path = await prisma.path.create(
        data={
            "id": path_data.id,
            "title": path_data.title,
            "description": path_data.description,
            "thumbnailUrl": path_data.thumbnail_url,
            "featured": path_data.featured,
            "price": Json(path_data.price) if path_data.price else None,
        }
    )
    return {"success": True, "id": path.id}


@router.get("/paths/{path_id}")
async def get_path_detail(
    path_id: str, admin=Depends(require_permissions("content:paths:read"))
):
    """Get path detail with its modules."""
    path = await prisma.path.find_unique(
        where={"id": path_id},
        include={
            "modules": {
                "include": {"module": True},
                "order": {"order": "asc"},
            },
            "enrollments": True,
        },
    )
    if not path:
        raise HTTPException(status_code=404, detail="Path not found")

    modules = []
    if path.modules:
        for pm in path.modules:
            if pm.module:
                modules.append(
                    {
                        "pathModuleId": pm.id,
                        "moduleId": pm.module.id,
                        "title": pm.module.title,
                        "level": pm.module.level,
                        "order": pm.order,
                        "totalLessons": pm.module.totalLessons,
                    }
                )

    return {
        "id": path.id,
        "title": path.title,
        "description": path.description,
        "thumbnailUrl": path.thumbnailUrl,
        "featured": path.featured,
        "price": path.price,
        "createdAt": path.createdAt,
        "updatedAt": path.updatedAt,
        "modules": modules,
        "enrollmentCount": len(path.enrollments) if path.enrollments else 0,
    }


@router.put("/paths/{path_id}")
async def update_path(
    path_id: str,
    update: AdminPathUpdate,
    admin=Depends(require_permissions("content:paths:write")),
):
    """Update a path."""
    path = await prisma.path.find_unique(where={"id": path_id})
    if not path:
        raise HTTPException(status_code=404, detail="Path not found")

    update_data: dict = {}
    if update.title is not None:
        update_data["title"] = update.title
    if update.description is not None:
        update_data["description"] = update.description
    if update.thumbnail_url is not None:
        update_data["thumbnailUrl"] = update.thumbnail_url
    if update.featured is not None:
        update_data["featured"] = update.featured
    if update.price is not None:
        update_data["price"] = Json(update.price)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await prisma.path.update(where={"id": path_id}, data=update_data)
    return {"success": True}


@router.delete("/paths/{path_id}")
async def delete_path(
    path_id: str, admin=Depends(require_permissions("content:paths:delete"))
):
    """Soft-delete a path."""
    path = await prisma.path.find_unique(where={"id": path_id})
    if not path:
        raise HTTPException(status_code=404, detail="Path not found")
    await prisma.path.update(
        where={"id": path_id}, data={"deletedAt": datetime.now(timezone.utc)}
    )
    return {"success": True}


@router.post("/paths/{path_id}/modules", status_code=201)
async def add_module_to_path(
    path_id: str,
    data: AdminPathModuleAdd,
    admin=Depends(require_permissions("content:paths:write")),
):
    """Add a module to a path."""
    path = await prisma.path.find_unique(where={"id": path_id})
    if not path:
        raise HTTPException(status_code=404, detail="Path not found")

    module = await prisma.module.find_unique(where={"id": data.module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get current max order
    order = data.order
    if order is None:
        existing = await prisma.pathmodule.find_many(where={"pathId": path_id})
        order = max((pm.order or 0 for pm in existing), default=0) + 1

    try:
        pm = await prisma.pathmodule.create(
            data={"pathId": path_id, "moduleId": data.module_id, "order": order}
        )
        from app.services.education_service import education_service

        await education_service.recalculate_path_duration(path_id)
        return {"success": True, "id": pm.id}
    except Exception:
        raise HTTPException(status_code=409, detail="Module already in path")


@router.delete("/paths/{path_id}/modules/{path_module_id}")
async def remove_module_from_path(
    path_id: str,
    path_module_id: int,
    admin=Depends(require_permissions("content:paths:write")),
):
    """Remove a module from a path."""
    path_module = await prisma.pathmodule.find_unique(where={"id": path_module_id})
    if not path_module or path_module.pathId != path_id:
        raise HTTPException(status_code=404, detail="Path module not found")

    await prisma.pathmodule.delete(where={"id": path_module_id})
    from app.services.education_service import education_service

    await education_service.recalculate_path_duration(path_id)
    return {"success": True}


@router.put("/paths/{path_id}/modules/reorder")
async def reorder_path_modules(
    path_id: str,
    data: AdminPathModuleReorder,
    admin=Depends(require_permissions("content:paths:write")),
):
    """Reorder modules within a path."""
    try:
        await education_service.reorder_path_modules(path_id, data.modules)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in admin reorder_path_modules: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =============================================================================
# MODULE / COURSE MANAGEMENT
# =============================================================================


@router.get("/modules", response_model=AdminModuleListResponse)
async def list_modules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    level: Optional[str] = None,
    featured: Optional[bool] = None,
    admin=Depends(require_permissions("content:courses:read")),
):
    """List modules with pagination, search, and filters."""
    where: dict = {"deletedAt": None}
    if search:
        where["title"] = {"contains": search, "mode": "insensitive"}
    if level:
        where["level"] = level
    if featured is not None:
        where["featured"] = featured

    total, modules = await asyncio.gather(
        prisma.module.count(where=where),
        prisma.module.find_many(
            where=where,
            skip=(page - 1) * page_size,
            take=page_size,
            order={"createdAt": "desc"},
            include={"instructor": True, "enrollments": True},
        ),
    )

    summaries = []
    for m in modules:
        data = {
            **m.__dict__,
            "instructor_name": m.instructor.fullName if m.instructor else None,
            "enrollment_count": len(m.enrollments) if m.enrollments else 0,
        }
        summaries.append(AdminModuleSummary.model_validate(data))

    return AdminModuleListResponse(
        modules=summaries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/modules", status_code=201)
async def create_module(
    module_data: AdminModuleCreate,
    admin=Depends(require_permissions("content:courses:write")),
):
    """Create a new module/course."""
    module = await prisma.module.create(
        data={
            "id": module_data.id,
            "title": module_data.title,
            "description": module_data.description,
            "fullDescription": module_data.full_description,
            "thumbnailUrl": module_data.thumbnail_url,
            "durationMinutes": module_data.duration_minutes,
            "estimatedEffort": module_data.estimated_effort,
            "totalLessons": module_data.total_lessons or 0,
            "level": module_data.level,
            "instructor": {"connect": {"id": module_data.instructor_id}}
            if module_data.instructor_id
            else None,
            "skills": module_data.skills,
            "tags": module_data.tags,
            "price": Json(module_data.price) if module_data.price else None,
            "featured": module_data.featured,
        }
    )
    return {"success": True, "id": module.id}


@router.get("/modules/{module_id}")
async def get_module_detail(
    module_id: str, admin=Depends(require_permissions("content:courses:read"))
):
    """Get module detail with lessons."""
    module = await prisma.module.find_unique(
        where={"id": module_id},
        include={
            "instructor": True,
            "lessons": {"where": {"deletedAt": None}, "order": {"order": "asc"}},
            "enrollments": True,
        },
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    lessons = []
    if module.lessons:
        for lesson in module.lessons:
            lessons.append(
                {
                    "id": lesson.id,
                    "title": lesson.title,
                    "order": lesson.order,
                    "type": lesson.type,
                    "durationMinutes": lesson.durationMinutes,
                    "difficulty": lesson.difficulty,
                    "hasVideo": bool(lesson.videoUrl),
                    "hasQuiz": lesson.quizId is not None,
                }
            )

    return {
        "id": module.id,
        "title": module.title,
        "description": module.description,
        "fullDescription": module.fullDescription,
        "thumbnailUrl": module.thumbnailUrl,
        "durationMinutes": module.durationMinutes,
        "estimatedEffort": module.estimatedEffort,
        "totalLessons": module.totalLessons,
        "level": module.level,
        "skills": module.skills,
        "tags": module.tags,
        "price": module.price,
        "featured": module.featured,
        "createdAt": module.createdAt,
        "updatedAt": module.updatedAt,
        "deletedAt": module.deletedAt,
        "lastUpdated": module.lastUpdated,
        "instructor": {
            "id": module.instructor.id,
            "fullName": module.instructor.fullName,
        }
        if module.instructor
        else None,
        "enrollmentCount": len(module.enrollments) if module.enrollments else 0,
        "lessons": lessons,
    }


@router.put("/modules/{module_id}")
async def update_module(
    module_id: str,
    update: AdminModuleUpdate,
    admin=Depends(require_permissions("content:courses:write")),
):
    """Update a module."""
    module = await prisma.module.find_unique(where={"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    update_data: dict = {}
    field_map = {
        "title": "title",
        "description": "description",
        "full_description": "fullDescription",
        "thumbnail_url": "thumbnailUrl",
        "duration_minutes": "durationMinutes",
        "estimated_effort": "estimatedEffort",
        "total_lessons": "totalLessons",
        "level": "level",
        "instructor_id": "instructorId",
        "skills": "skills",
        "tags": "tags",
        "featured": "featured",
    }
    for py_field, db_field in field_map.items():
        if py_field == "instructor_id":
            continue
        value = getattr(update, py_field, None)
        if value is not None:
            update_data[db_field] = value

    if update.instructor_id is not None:
        update_data["instructor"] = {"connect": {"id": update.instructor_id}}

    if update.price is not None:
        update_data["price"] = Json(update.price)

    update_data["lastUpdated"] = datetime.now(timezone.utc)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await prisma.module.update(where={"id": module_id}, data=update_data)
    return {"success": True}


@router.delete("/modules/{module_id}")
async def delete_module(
    module_id: str, admin=Depends(require_permissions("content:courses:bulk"))
):
    """Soft-delete a module."""
    module = await prisma.module.find_unique(where={"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    await prisma.module.update(
        where={"id": module_id}, data={"deletedAt": datetime.now(timezone.utc)}
    )
    return {"success": True}


@router.post("/modules/bulk-action", response_model=AdminBulkActionResponse)
async def bulk_module_action(
    data: AdminBulkActionRequest,
    admin=Depends(require_permissions("content:courses:bulk")),
):
    """Bulk publish/unpublish/delete modules."""
    from app.services.content_moderation_service import content_moderation_service

    result = await content_moderation_service.bulk_moderate_modules(
        admin_id=admin.id,
        ids=data.ids,
        action=data.action,
    )
    return AdminBulkActionResponse(
        success=result["success"],
        failed=result["failed"],
        errors=result["errors"],
    )


# =============================================================================
# LESSON MANAGEMENT
# =============================================================================


@router.get("/modules/{module_id}/lessons")
async def list_module_lessons(
    module_id: str, admin=Depends(require_permissions("content:courses:read"))
):
    """List lessons for a module, ordered by position."""
    module = await prisma.module.find_unique(where={"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    lessons = await prisma.lesson.find_many(
        where={"moduleId": module_id, "deletedAt": None},
        order={"order": "asc"},
    )

    return [
        {
            "id": l.id,
            "title": l.title,
            "description": l.description,
            "order": l.order,
            "type": l.type,
            "durationMinutes": l.durationMinutes,
            "difficulty": l.difficulty,
            "hasVideo": bool(l.videoUrl),
            "hasQuiz": l.quizId is not None,
            "createdAt": l.createdAt,
        }
        for l in lessons
    ]


@router.post("/modules/{module_id}/lessons", status_code=201)
async def create_lesson(
    module_id: str,
    lesson_data: AdminLessonCreate,
    admin=Depends(require_permissions("content:lessons:write")),
):
    """Create a new lesson in a module."""
    module = await prisma.module.find_unique(where={"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    lesson = await prisma.lesson.create(
        data={
            "id": lesson_data.id,
            "moduleId": module_id,
            "title": lesson_data.title,
            "description": lesson_data.description,
            "order": lesson_data.order,
            "durationMinutes": lesson_data.duration_minutes,
            "type": lesson_data.type,
            "videoUrl": lesson_data.video_url,
            "storageProvider": lesson_data.storage_provider,
            "transcript": lesson_data.transcript,
            "subtitlesPath": lesson_data.subtitles_path,
            "subtitlesLanguage": lesson_data.subtitles_language,
            "subtitlesEnabled": lesson_data.subtitles_enabled,
            "thumbnailUrl": lesson_data.thumbnail_url,
            "learningObjectives": lesson_data.learning_objectives,
            "keyTakeaways": lesson_data.key_takeaways,
            "instructorNotes": lesson_data.instructor_notes,
            "estimatedCompletionTime": lesson_data.estimated_completion_time,
            "difficulty": lesson_data.difficulty,
            "tags": lesson_data.tags,
            "relatedResources": Json(lesson_data.related_resources)
            if lesson_data.related_resources
            else None,
            "attachments": Json(lesson_data.attachments)
            if lesson_data.attachments
            else None,
        }
    )

    # Update module lesson count
    count = await prisma.lesson.count(where={"moduleId": module_id, "deletedAt": None})
    await prisma.module.update(where={"id": module_id}, data={"totalLessons": count})

    return {"success": True, "id": lesson.id}


@router.get("/lessons/{lesson_id}")
async def get_lesson_detail(
    lesson_id: str, admin=Depends(require_permissions("content:courses:read"))
):
    """Get lesson detail."""
    lesson = await prisma.lesson.find_unique(
        where={"id": lesson_id},
        include={"quiz": True},
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return {
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "moduleId": lesson.moduleId,
        "order": lesson.order,
        "type": lesson.type,
        "videoUrl": lesson.videoUrl,
        "storageProvider": lesson.storageProvider,
        "hlsPath": lesson.hlsPath,
        "transcodingStatus": lesson.transcodingStatus,
        "transcript": lesson.transcript,
        "subtitlesPath": lesson.subtitlesPath,
        "subtitlesLanguage": lesson.subtitlesLanguage,
        "subtitlesEnabled": lesson.subtitlesEnabled,
        "thumbnailUrl": lesson.thumbnailUrl,
        "learningObjectives": lesson.learningObjectives,
        "keyTakeaways": lesson.keyTakeaways,
        "instructorNotes": lesson.instructorNotes,
        "estimatedCompletionTime": lesson.estimatedCompletionTime,
        "difficulty": lesson.difficulty,
        "tags": lesson.tags,
        "relatedResources": lesson.relatedResources,
        "attachments": lesson.attachments,
        "createdAt": lesson.createdAt,
        "updatedAt": lesson.updatedAt,
        "hasQuiz": lesson.quiz is not None,
        "quizId": lesson.quiz.id if lesson.quiz else None,
    }


@router.put("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: str,
    update: AdminLessonUpdate,
    admin=Depends(require_permissions("content:lessons:write")),
):
    """Update a lesson."""
    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    update_data: dict = {}
    field_map = {
        "title": "title",
        "description": "description",
        "order": "order",
        "duration_minutes": "durationMinutes",
        "type": "type",
        "video_url": "videoUrl",
        "storage_provider": "storageProvider",
        "transcript": "transcript",
        "subtitles_path": "subtitlesPath",
        "subtitles_language": "subtitlesLanguage",
        "subtitles_enabled": "subtitlesEnabled",
        "thumbnail_url": "thumbnailUrl",
        "learning_objectives": "learningObjectives",
        "key_takeaways": "keyTakeaways",
        "instructor_notes": "instructorNotes",
        "estimated_completion_time": "estimatedCompletionTime",
        "difficulty": "difficulty",
        "tags": "tags",
    }
    for py_field, db_field in field_map.items():
        value = getattr(update, py_field, None)
        if value is not None:
            update_data[db_field] = value
    if update.related_resources is not None:
        update_data["relatedResources"] = Json(update.related_resources)
    if update.attachments is not None:
        update_data["attachments"] = Json(update.attachments)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await prisma.lesson.update(where={"id": lesson_id}, data=update_data)
    return {"success": True}


@router.post("/lessons/{lesson_id}/subtitles")
async def upload_lesson_subtitles(
    lesson_id: str,
    file: UploadFile = File(...),
    language: str = Form("ar"),
    user=Depends(require_permissions("content:lessons:write")),
):
    """Upload a WebVTT (.vtt) or SubRip (.srt) subtitle file for a lesson (with auto-conversion)."""
    import re
    from pathlib import Path
    from app.core.config import setting

    if not re.match(r"^[a-zA-Z0-9_-]+$", lesson_id):
        raise HTTPException(status_code=400, detail="Invalid lesson ID format")

    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    filename = (file.filename or "").lower()
    if not (filename.endswith(".vtt") or filename.endswith(".srt")):
        raise HTTPException(status_code=400, detail="File must be .vtt or .srt format")

    raw_bytes = await file.read()
    try:
        content_str = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        content_str = raw_bytes.decode("latin-1")

    # If file is SRT format, convert to WEBVTT format
    if filename.endswith(".srt") or not content_str.strip().startswith("WEBVTT"):
        vtt_lines = ["WEBVTT\n"]
        lines = content_str.replace("\r\n", "\n").split("\n")
        for line in lines:
            if "-->" in line:
                line = line.replace(",", ".")
            vtt_lines.append(line)
        vtt_content = "\n".join(vtt_lines).encode("utf-8")
    else:
        vtt_content = content_str.encode("utf-8")

    sub_dir = Path(setting.SUBTITLES_DIR).resolve()
    sub_dir.mkdir(parents=True, exist_ok=True)
    path = (sub_dir / f"{lesson_id}.vtt").resolve()
    if not path.is_relative_to(sub_dir):
        raise HTTPException(status_code=400, detail="Invalid target subtitle path")
    path.write_bytes(vtt_content)

    await prisma.lesson.update(
        where={"id": lesson_id},
        data={
            "subtitlesPath": f"subtitles/{lesson_id}.vtt",
            "subtitlesLanguage": language,
            "subtitlesEnabled": True,
        },
    )
    return {"success": True, "path": f"subtitles/{lesson_id}.vtt", "language": language}


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: str, admin=Depends(require_permissions("content:lessons:write"))
):
    """Soft-delete a lesson."""
    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await prisma.lesson.update(
        where={"id": lesson_id}, data={"deletedAt": datetime.now(timezone.utc)}
    )

    # Update module lesson count
    count = await prisma.lesson.count(
        where={"moduleId": lesson.moduleId, "deletedAt": None}
    )
    await prisma.module.update(
        where={"id": lesson.moduleId}, data={"totalLessons": count}
    )

    return {"success": True}


@router.put("/modules/{module_id}/lessons/reorder")
async def reorder_lessons(
    module_id: str,
    data: AdminLessonReorderRequest,
    admin=Depends(require_permissions("content:lessons:write")),
):
    """Reorder lessons within a module."""
    try:
        await education_service.reorder_module_lessons(module_id, data.lessons)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in admin reorder_lessons: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# =============================================================================
# QUIZ MANAGEMENT
# =============================================================================


@router.post("/lessons/{lesson_id}/quiz", status_code=201)
async def create_quiz_for_lesson(
    lesson_id: str,
    quiz_data: AdminQuizCreate,
    admin=Depends(require_permissions("content:quizzes:write")),
):
    """Create or replace a quiz for a lesson."""
    lesson = await prisma.lesson.find_unique(
        where={"id": lesson_id}, include={"quiz": True}
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    async with prisma.tx() as tx:
        # Update or create quiz (preserving historical student attempts)
        if lesson.quiz:
            quiz = await tx.quiz.update(
                where={"id": lesson.quiz.id},
                data={
                    "title": quiz_data.title,
                    "description": quiz_data.description,
                    "passingScore": quiz_data.passing_score,
                    "timeLimitMinutes": quiz_data.time_limit_minutes,
                    "retakeCooldownMinutes": quiz_data.retake_cooldown_minutes,
                    "allowRetake": quiz_data.allow_retake,
                    "shuffleQuestions": quiz_data.shuffle_questions,
                },
            )
            await tx.quizquestion.delete_many(where={"quizId": quiz.id})
        else:
            quiz = await tx.quiz.create(
                data={
                    "lessonId": lesson_id,
                    "title": quiz_data.title,
                    "description": quiz_data.description,
                    "passingScore": quiz_data.passing_score,
                    "timeLimitMinutes": quiz_data.time_limit_minutes,
                    "retakeCooldownMinutes": quiz_data.retake_cooldown_minutes,
                    "allowRetake": quiz_data.allow_retake,
                    "shuffleQuestions": quiz_data.shuffle_questions,
                }
            )

        # Create questions
        for i, q in enumerate(quiz_data.questions):
            await tx.quizquestion.create(
                data={
                    "quizId": quiz.id,
                    "question": q.question,
                    "questionType": q.question_type,
                    "options": Json(q.options) if q.options else None,
                    "correctAnswer": q.correct_answer,
                    "explanation": q.explanation,
                    "points": q.points,
                    "order": q.order if q.order else i,
                }
            )

        # Link quiz to lesson
        await tx.lesson.update(where={"id": lesson_id}, data={"quizId": quiz.id})

    await AuditTrailService.log_action(
        actor_id=admin.id,
        action="UPDATE_QUIZ" if lesson.quiz else "CREATE_QUIZ",
        domain="COURSE",
        resource_type="Quiz",
        resource_id=str(quiz.id),
        new_state={
            "lessonId": lesson_id,
            "title": quiz_data.title,
            "questionsCount": len(quiz_data.questions),
            "passingScore": quiz_data.passing_score,
        },
    )

    return {"success": True, "quizId": quiz.id}


@router.get("/quizzes/{quiz_id}")
async def get_quiz_detail(
    quiz_id: int, admin=Depends(require_permissions("content:courses:read"))
):
    """Get quiz detail with questions."""
    quiz = await prisma.quiz.find_unique(
        where={"id": quiz_id},
        include={
            "questions": {"where": {"deletedAt": None}, "order": {"order": "asc"}},
            "attempts": True,
        },
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = []
    for q in quiz.questions or []:
        questions.append(
            {
                "id": q.id,
                "quizId": q.quizId,
                "question": q.question,
                "questionType": q.questionType,
                "options": q.options,
                "correctAnswer": q.correctAnswer,
                "explanation": q.explanation,
                "points": q.points,
                "order": q.order,
                "createdAt": q.createdAt,
            }
        )

    return {
        "id": quiz.id,
        "lessonId": quiz.lessonId,
        "title": quiz.title,
        "description": quiz.description,
        "passingScore": quiz.passingScore,
        "timeLimitMinutes": quiz.timeLimitMinutes,
        "retakeCooldownMinutes": quiz.retakeCooldownMinutes,
        "allowRetake": quiz.allowRetake,
        "shuffleQuestions": quiz.shuffleQuestions,
        "createdAt": quiz.createdAt,
        "updatedAt": quiz.updatedAt,
        "questions": questions,
        "attemptCount": len(quiz.attempts) if quiz.attempts else 0,
    }


@router.get("/quizzes")
async def list_quizzes(admin=Depends(require_permissions("content:courses:read"))):
    """List all quizzes with stats."""
    quizzes = await prisma.quiz.find_many(
        where={"deletedAt": None},
        include={"lesson": True, "questions": True, "attempts": True},
        order={"createdAt": "desc"},
    )
    return [
        {
            "id": q.id,
            "title": q.title,
            "lessonId": q.lessonId,
            "lessonTitle": q.lesson.title if q.lesson else None,
            "passingScore": q.passingScore,
            "questionCount": len(q.questions) if q.questions else 0,
            "attemptCount": len(q.attempts) if q.attempts else 0,
            "createdAt": q.createdAt,
        }
        for q in quizzes
    ]


@router.put("/quizzes/{quiz_id}")
async def update_quiz(
    quiz_id: int,
    update: AdminQuizUpdate,
    admin=Depends(require_permissions("content:quizzes:write")),
):
    """Update quiz settings."""
    quiz = await prisma.quiz.find_unique(where={"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    update_data: dict = {}
    field_map = {
        "title": "title",
        "description": "description",
        "passing_score": "passingScore",
        "time_limit_minutes": "timeLimitMinutes",
        "retake_cooldown_minutes": "retakeCooldownMinutes",
        "allow_retake": "allowRetake",
        "shuffle_questions": "shuffleQuestions",
    }
    for py_field, db_field in field_map.items():
        value = getattr(update, py_field, None)
        if value is not None:
            update_data[db_field] = value

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await prisma.quiz.update(where={"id": quiz_id}, data=update_data)
    return {"success": True}


@router.delete("/quizzes/{quiz_id}")
async def delete_quiz(
    quiz_id: int, admin=Depends(require_permissions("content:quizzes:write"))
):
    """Delete a quiz and its questions."""
    quiz = await prisma.quiz.find_unique(where={"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    async with prisma.tx() as tx:
        # Unlink from lesson
        if quiz.lessonId:
            await tx.lesson.update(where={"id": quiz.lessonId}, data={"quizId": None})

        # Delete questions then soft-delete quiz
        await tx.quizquestion.delete_many(where={"quizId": quiz_id})
        await tx.quiz.update(
            where={"id": quiz_id}, data={"deletedAt": datetime.now(timezone.utc)}
        )

    await AuditTrailService.log_action(
        actor_id=admin.id,
        action="DELETE_QUIZ",
        domain="COURSE",
        resource_type="Quiz",
        resource_id=str(quiz_id),
        old_state={"title": quiz.title, "lessonId": quiz.lessonId},
    )

    return {"success": True}


@router.post("/quizzes/{quiz_id}/questions", status_code=201)
async def add_quiz_question(
    quiz_id: int,
    question_data: AdminQuizQuestionCreate,
    admin=Depends(require_permissions("content:quizzes:write")),
):
    """Add a question to a quiz."""
    quiz = await prisma.quiz.find_unique(where={"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    question = await prisma.quizquestion.create(
        data={
            "quizId": quiz_id,
            "question": question_data.question,
            "questionType": question_data.question_type,
            "options": Json(question_data.options) if question_data.options else None,
            "correctAnswer": question_data.correct_answer,
            "explanation": question_data.explanation,
            "points": question_data.points,
            "order": question_data.order,
        }
    )
    return {"success": True, "id": question.id}


@router.put("/questions/{question_id}")
async def update_question(
    question_id: int,
    update: AdminQuizQuestionUpdate,
    admin=Depends(require_permissions("content:quizzes:write")),
):
    """Update a quiz question."""
    question = await prisma.quizquestion.find_unique(where={"id": question_id})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    update_data: dict = {}
    field_map = {
        "question": "question",
        "question_type": "questionType",
        "correct_answer": "correctAnswer",
        "explanation": "explanation",
        "points": "points",
        "order": "order",
    }
    for py_field, db_field in field_map.items():
        value = getattr(update, py_field, None)
        if value is not None:
            update_data[db_field] = value
    if update.options is not None:
        update_data["options"] = Json(update.options)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await prisma.quizquestion.update(where={"id": question_id}, data=update_data)
    return {"success": True}


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: int, admin=Depends(require_permissions("content:quizzes:write"))
):
    """Soft-delete a quiz question."""
    question = await prisma.quizquestion.find_unique(where={"id": question_id})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await prisma.quizquestion.update(
        where={"id": question_id}, data={"deletedAt": datetime.now(timezone.utc)}
    )
    return {"success": True}


# =============================================================================
# FILE UPLOAD
# =============================================================================


@router.post("/upload")
async def admin_upload_file(
    file: UploadFile = File(...),
    category: str = Query("courses"),
    admin=Depends(require_permissions("video:upload")),
):
    """Upload a file (thumbnail or video) for admin use."""
    from app.services.file_service import file_service

    try:
        result = await file_service.save_file(file, admin.id, category)
        return {"success": True, "url": result.url, "filename": result.filename}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload-video-aws")
async def admin_upload_video_aws(
    file: UploadFile = File(...),
    lesson_id: str = Query(...),
    admin=Depends(require_permissions("video:upload")),
):
    """Upload video to AWS S3 and trigger HLS transcoding."""
    from app.services.aws_video_service import aws_video_service
    from app.tasks.video_tasks import check_transcode_status

    content = await file.read()
    result = await aws_video_service.upload_video(content, file.filename, lesson_id)
    raw_path = result["raw_path"]

    # Submit transcoding job
    job_id = aws_video_service.submit_transcode_job(raw_path, lesson_id)

    # Update lesson record
    await prisma.lesson.update(
        where={"id": lesson_id},
        data={
            "storageProvider": "aws",
            "rawPath": raw_path,
            "transcodingStatus": "processing",
        },
    )

    # Start polling task
    check_transcode_status.delay(job_id, lesson_id)

    return {
        "success": True,
        "raw_path": raw_path,
        "job_id": job_id,
        "status": "processing",
    }


@router.post("/migrate-video-to-aws")
async def admin_migrate_video_to_aws(
    lesson_id: str = Query(...),
    admin=Depends(require_permissions("video:migrate")),
):
    """Migrate a lesson's video from Supabase to AWS (async)."""
    from app.tasks.migrate_video_task import migrate_lesson_to_aws

    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if lesson.storageProvider == "aws":
        raise HTTPException(status_code=400, detail="Already on AWS")
    if not lesson.videoUrl:
        raise HTTPException(status_code=400, detail="No video to migrate")

    migrate_lesson_to_aws.delay(lesson_id)
    return {"success": True, "message": "Migration started", "lesson_id": lesson_id}


# =============================================================================
# FREELANCING APPEALS MANAGEMENT
# =============================================================================


@router.get("/appeals")
async def list_appeals(
    status: Optional[str] = None,
    admin=Depends(require_permissions("appeals:read")),
):
    """List review appeals for admin resolution."""
    where = {}
    if status:
        where["status"] = status

    appeals = await prisma.reviewappeal.find_many(
        where=where,
        order={"createdAt": "asc"},
        include={"appealer": True, "review": {"include": {"author": True}}},
    )

    return [
        {
            "id": a.id,
            "reviewId": a.reviewId,
            "appealerId": a.appealerId,
            "appealerName": a.appealer.fullName if a.appealer else "Unknown",
            "authorName": a.review.author.fullName
            if a.review and a.review.author
            else "Unknown",
            "reason": a.reason,
            "evidenceUrls": a.evidenceUrls,
            "status": a.status,
            "resolutionNotes": a.resolutionNotes,
            "resolvedAt": a.resolvedAt,
            "createdAt": a.createdAt,
        }
        for a in appeals
    ]


@router.post("/appeals/{appeal_id}/resolve")
async def resolve_appeal(
    appeal_id: int,
    resolve_data: AdminAppealResolve,
    request: Request,
    admin=Depends(require_permissions("appeals:resolve")),
):
    """Admin resolves an appeal, potentially redacting the review."""
    from app.services.freelancing_service import FreelanceService

    appeal = await prisma.reviewappeal.find_unique(where={"id": appeal_id})
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")

    review_status = "REDACTED" if resolve_data.status == "APPROVED" else "ACTIVE"

    async with prisma.tx() as tx:
        await tx.reviewappeal.update(
            where={"id": appeal_id},
            data={
                "status": resolve_data.status,
                "resolutionNotes": resolve_data.resolution_notes,
                "resolvedAt": datetime.now(timezone.utc),
                "resolvedById": admin.id,
            },
        )
        await tx.contractreview.update(
            where={"id": appeal.reviewId}, data={"status": review_status}
        )

    await AuditTrailService.log_action(
        actor_id=admin.id,
        action=f"APPEAL_{resolve_data.status}",
        domain="MODERATION",
        resource_type="ReviewAppeal",
        resource_id=str(appeal_id),
        old_state={"status": appeal.status},
        new_state={
            "status": resolve_data.status,
            "resolutionNotes": resolve_data.resolution_notes,
            "reviewStatus": review_status,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Recalculate the target's rating post appeal
    asyncio.create_task(FreelanceService.recalculate_user_rating(appeal.appealerId))

    return {"success": True, "status": resolve_data.status}


# =============================================================================
# ANALYTICS / REPORTS
# =============================================================================


@router.get("/analytics")
async def get_analytics(
    period: str = Query("30d", pattern="^(7d|30d|90d|12m)$"),
    admin=Depends(require_permissions("analytics:read")),
):
    """Get platform analytics with time-series data for charts."""
    now = datetime.now(timezone.utc)
    if period == "7d":
        start = now - timedelta(days=7)
        interval_days = 1
    elif period == "30d":
        start = now - timedelta(days=30)
        interval_days = 1
    elif period == "90d":
        start = now - timedelta(days=90)
        interval_days = 7
    else:  # 12m
        start = now - timedelta(days=365)
        interval_days = 30

    # Generate time buckets
    buckets = []
    cursor = start
    while cursor < now:
        buckets.append(cursor)
        cursor += timedelta(days=interval_days)

    # Fetch raw data
    users = await prisma.user.find_many(
        where={"createdAt": {"gte": start}, "deletedAt": None},
    )
    enrollments = await prisma.enrollment.find_many(
        where={"createdAt": {"gte": start}, "deletedAt": None},
    )
    transactions = await prisma.transaction.find_many(
        where={"createdAt": {"gte": start}, "status": "COMPLETED"},
    )

    # Bucket data
    user_series = []
    enrollment_series = []
    revenue_series = []
    for i, bucket_start in enumerate(buckets):
        bucket_end = buckets[i + 1] if i + 1 < len(buckets) else now
        label = (
            bucket_start.strftime("%b %d")
            if interval_days <= 7
            else bucket_start.strftime("%b %d")
        )
        user_series.append(
            {
                "date": label,
                "count": sum(
                    1 for u in users if bucket_start <= u.createdAt < bucket_end
                ),
            }
        )
        enrollment_series.append(
            {
                "date": label,
                "count": sum(
                    1 for e in enrollments if bucket_start <= e.createdAt < bucket_end
                ),
            }
        )
        revenue_series.append(
            {
                "date": label,
                "amount": sum(
                    t.amount
                    for t in transactions
                    if bucket_start <= t.createdAt < bucket_end
                ),
            }
        )

    # Top modules by enrollment
    top_modules = await prisma.module.find_many(
        where={"deletedAt": None},
        include={"enrollments": True},
        take=5,
        order={"createdAt": "desc"},
    )
    top_modules_data = sorted(
        [
            {"id": m.id, "title": m.title, "enrollments": len(m.enrollments)}
            for m in top_modules
        ],
        key=lambda x: x["enrollments"],
        reverse=True,
    )

    # Completion rate
    total_enrollments = await prisma.enrollment.count(where={"deletedAt": None})
    completed_enrollments = await prisma.enrollment.count(
        where={"completedAt": {"not": None}, "deletedAt": None}
    )
    completion_rate = round(
        (completed_enrollments / total_enrollments * 100)
        if total_enrollments > 0
        else 0,
        1,
    )

    return {
        "period": period,
        "user_growth": user_series,
        "enrollment_trends": enrollment_series,
        "revenue": revenue_series,
        "top_modules": top_modules_data,
        "completion_rate": completion_rate,
        "totals": {
            "new_users": len(users),
            "new_enrollments": len(enrollments),
            "revenue": sum(t.amount for t in transactions),
        },
    }


# =============================================================================
# ENROLLMENT MANAGEMENT
# =============================================================================


@router.get("/enrollments")
async def list_enrollments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    module_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    admin=Depends(require_permissions("enrollments:read")),
):
    """List all enrollments with filtering."""
    where: dict = {"deletedAt": None}
    if module_id:
        where["moduleId"] = module_id
    if status_filter == "completed":
        where["completedAt"] = {"not": None}
    elif status_filter == "active":
        where["completedAt"] = None
    if search:
        where["OR"] = [
            {"user": {"fullName": {"contains": search, "mode": "insensitive"}}},
            {"user": {"email": {"contains": search, "mode": "insensitive"}}},
            {"module": {"title": {"contains": search, "mode": "insensitive"}}},
        ]

    total = await prisma.enrollment.count(where=where)
    enrollments = await prisma.enrollment.find_many(
        where=where,
        include={"user": True, "module": True},
        skip=(page - 1) * page_size,
        take=page_size,
        order={"createdAt": "desc"},
    )

    return {
        "data": [
            {
                "id": e.id,
                "userId": e.userId,
                "userName": e.user.fullName if e.user else None,
                "userEmail": e.user.email if e.user else None,
                "moduleId": e.moduleId,
                "moduleTitle": e.module.title if e.module else None,
                "progress": e.progress,
                "completedAt": e.completedAt,
                "createdAt": e.createdAt,
            }
            for e in enrollments
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size),
    }


@router.post("/enrollments")
async def grant_enrollment(
    user_id: int = Query(...),
    module_id: str = Query(...),
    admin=Depends(require_permissions("enrollments:grant")),
):
    """Manually grant a user enrollment to a module."""
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    module = await prisma.module.find_unique(where={"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    existing = await prisma.enrollment.find_first(
        where={"userId": user_id, "moduleId": module_id, "deletedAt": None}
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already enrolled")

    enrollment = await prisma.enrollment.create(
        data={
            "userId": user_id,
            "moduleId": module_id,
            "progress": 0,
        }
    )
    await AuditTrailService.log_action(
        action="ENROLLMENT_GRANT",
        domain="EDUCATION",
        resource_type="Enrollment",
        resource_id=str(enrollment.id),
        metadata={"userId": user_id, "moduleId": module_id, "granted_by": admin.id},
    )
    return {"success": True, "enrollment_id": enrollment.id}


@router.delete("/enrollments/{enrollment_id}")
async def revoke_enrollment(
    enrollment_id: int, admin=Depends(require_permissions("enrollments:revoke"))
):
    """Revoke/soft-delete an enrollment."""
    enrollment = await prisma.enrollment.find_unique(where={"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await prisma.enrollment.update(
        where={"id": enrollment_id}, data={"deletedAt": datetime.now(timezone.utc)}
    )
    await AuditTrailService.log_action(
        action="ENROLLMENT_REVOKE",
        domain="EDUCATION",
        resource_type="Enrollment",
        resource_id=str(enrollment_id),
        metadata={"revoked_by": admin.id},
    )
    return {"success": True}


# =============================================================================
# ACTIVITY / AUDIT LOG
# =============================================================================


@router.get("/activity-log")
async def get_activity_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    domain: Optional[str] = None,
    action: Optional[str] = None,
    actor: Optional[str] = None,
    severity: Optional[str] = None,
    startDate: Optional[datetime] = None,
    endDate: Optional[datetime] = None,
    geoWilaya: Optional[int] = None,
    admin=Depends(require_permissions("audit:read")),
):
    """Get platform activity from cryptographic audit trail vault with rich multi-parameter filters."""
    from app.generated.prisma import enums as p_enums

    where: dict = {}
    has_explicit_filters = False

    if domain:
        domain_enum = getattr(p_enums.AdminPermissionDomain, domain.upper(), None)
        if domain_enum:
            where["domain"] = domain_enum
            has_explicit_filters = True
    if action:
        where["action"] = {"contains": action, "mode": "insensitive"}
        has_explicit_filters = True
    if severity:
        sev_enum = getattr(p_enums.AuditSeverity, severity.upper(), None)
        if sev_enum:
            where["severity"] = sev_enum
            has_explicit_filters = True
    if geoWilaya is not None:
        where["geoWilaya"] = geoWilaya
        has_explicit_filters = True
    if startDate or endDate:
        ts_filter: dict = {}
        if startDate:
            ts_filter["gte"] = startDate
        if endDate:
            ts_filter["lte"] = endDate
        where["timestamp"] = ts_filter
        has_explicit_filters = True
    if actor:
        has_explicit_filters = True
        try:
            actor_num = int(actor)
            where["OR"] = [
                {"adminProfileId": actor_num},
                {"impersonatorId": actor_num},
                {"adminProfile": {"userId": actor_num}},
            ]
        except ValueError:
            where["adminProfile"] = {
                "user": {
                    "OR": [
                        {"email": {"contains": actor, "mode": "insensitive"}},
                        {"fullName": {"contains": actor, "mode": "insensitive"}},
                    ]
                }
            }

    total, audit_records = await asyncio.gather(
        prisma.adminaudittrail.count(where=where),
        prisma.adminaudittrail.find_many(
            where=where,
            skip=(page - 1) * page_size,
            take=page_size,
            order={"sequenceNumber": "desc"},
            include={"adminProfile": {"include": {"user": True}}},
        ),
    )

    if total > 0 or has_explicit_filters:
        data = [
            {
                "id": str(r.id),
                "sequenceNumber": int(r.sequenceNumber),
                "type": r.action,
                "action": r.action,
                "actor": r.adminProfile.user.fullName
                if r.adminProfile and r.adminProfile.user
                else (r.adminProfile.title if r.adminProfile else "System"),
                "actorEmail": r.adminProfile.user.email
                if r.adminProfile and r.adminProfile.user
                else None,
                "actorId": r.adminProfile.user.id
                if r.adminProfile and r.adminProfile.user
                else None,
                "impersonatorId": r.impersonatorId,
                "detail": f"{r.resourceType} {r.resourceId or ''}".strip(),
                "resourceType": r.resourceType,
                "resourceId": r.resourceId,
                "domain": r.domain.name if hasattr(r.domain, "name") else str(r.domain),
                "status": r.status.name if hasattr(r.status, "name") else str(r.status),
                "severity": r.severity.name
                if hasattr(r.severity, "name")
                else str(r.severity),
                "ipAddress": r.ipAddress,
                "userAgent": r.userAgent,
                "geoCountry": r.geoCountry,
                "geoWilaya": r.geoWilaya,
                "sessionId": r.sessionId,
                "mfaVerified": r.mfaVerified,
                "beforeState": r.beforeState,
                "afterState": r.afterState,
                "metadata": r.metadata,
                "sha256Hash": r.sha256Hash,
                "previousHash": r.previousHash,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in audit_records
        ]
        return {
            "data": data,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": math.ceil(total / page_size) if total > 0 else 0,
        }

    # Fallback to aggregated activity feed if no audit trail entries exist yet
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=30)

    new_users = await prisma.user.find_many(
        where={"createdAt": {"gte": since}}, order={"createdAt": "desc"}, take=20
    )
    recent_enrollments = await prisma.enrollment.find_many(
        where={"createdAt": {"gte": since}},
        include={"user": True, "module": True},
        order={"createdAt": "desc"},
        take=20,
    )
    recent_transactions = await prisma.transaction.find_many(
        where={"createdAt": {"gte": since}},
        include={"user": True},
        order={"createdAt": "desc"},
        take=20,
    )

    activities = []
    for u in new_users:
        activities.append(
            {
                "type": "USER_REGISTERED",
                "actor": u.fullName,
                "detail": u.email,
                "timestamp": u.createdAt,
            }
        )
    for e in recent_enrollments:
        activities.append(
            {
                "type": "ENROLLMENT",
                "actor": e.user.fullName if e.user else "Unknown",
                "detail": e.module.title if e.module else "",
                "timestamp": e.createdAt,
            }
        )
    for t in recent_transactions:
        activities.append(
            {
                "type": "TRANSACTION",
                "actor": t.user.fullName if t.user else "Unknown",
                "detail": f"{t.amount} {t.currency}",
                "timestamp": t.createdAt,
            }
        )

    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    total = len(activities)
    start = (page - 1) * page_size
    paginated = activities[start : start + page_size]

    return {
        "data": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size),
    }


@router.get("/audit-trail/verify")
@router.get("/audit/verify-chain")
async def verify_audit_trail_chain(
    limit: int = Query(1000, ge=1, le=10000),
    admin=Depends(require_permissions("audit:read")),
):
    """Verify cryptographic HMAC-SHA256 linkage across historical records (NIST SP 800-53 Rev. 5 AU-9)."""
    start_time = datetime.now(timezone.utc)
    res = await AuditTrailService.verify_chain_integrity(limit=limit)
    return {
        **res,
        "algorithm": "HMAC-SHA256",
        "standard": "NIST SP 800-53 Rev. 5 (AU-9)",
        "verified_at": start_time.isoformat(),
    }


# =============================================================================
# GOVERNANCE & TWO-PERSON INTEGRITY (MAKER-CHECKER)
# =============================================================================


@router.get("/governance/pending-actions", response_model=List[PendingActionResponse])
async def list_governance_pending_actions(
    status: Optional[str] = Query("PENDING_APPROVAL"),
    admin=Depends(require_permissions("iam:roles:read")),
):
    """List administrative actions requiring dual approval."""
    from app.services.maker_checker_service import MakerCheckerService

    return await MakerCheckerService.list_pending_actions(status_filter=status)


@router.post("/governance/pending-actions")
async def create_governance_pending_action(
    body: CreatePendingActionRequest,
    admin=Depends(require_permissions("iam:roles:assign")),
):
    """Initiate a destructive action governed by Two-Person Integrity."""
    from app.services.maker_checker_service import MakerCheckerService

    return await MakerCheckerService.create_pending_action(
        initiator_id=admin.id,
        action_type=body.action_type,
        target_resource=body.target_resource,
        payload=body.payload,
        target_id=body.target_id,
        expires_in_hours=body.expires_in_hours,
    )


@router.post("/governance/pending-actions/{action_id}/approve")
async def approve_governance_pending_action(
    action_id: str,
    body: Optional[ApprovalDecisionRequest] = None,
    admin=Depends(require_permissions("iam:roles:assign")),
):
    """Approve and execute a pending action enforcing separation of duties (approver != initiator)."""
    from app.services.maker_checker_service import MakerCheckerService

    notes = body.notes if body else None
    return await MakerCheckerService.approve_and_execute(
        action_id=action_id,
        approver_id=admin.id,
        approval_notes=notes,
    )


@router.post("/governance/pending-actions/{action_id}/reject")
async def reject_governance_pending_action(
    action_id: str,
    body: ApprovalDecisionRequest,
    admin=Depends(require_permissions("iam:roles:assign")),
):
    """Reject a pending administrative action."""
    from app.services.maker_checker_service import MakerCheckerService

    if not body.rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rejectionReason is required to reject a pending action",
        )
    return await MakerCheckerService.reject(
        action_id=action_id,
        approver_id=admin.id,
        rejection_reason=body.rejection_reason,
    )


# =============================================================================
# PLATFORM SETTINGS
# =============================================================================


@router.get("/settings")
async def get_platform_settings(admin=Depends(require_permissions("infra:flags:read"))):
    """Get current platform settings."""
    settings = await prisma.platformsetting.find_many()
    return (
        {s.key: s.value for s in settings}
        if settings
        else {
            "maintenance_mode": "false",
            "registration_enabled": "true",
            "default_language": "en",
            "platform_commission_percent": "15",
            "max_file_size_mb": "100",
        }
    )


@router.put("/settings")
async def update_platform_settings(
    settings: dict, admin=Depends(require_permissions("infra:security:write"))
):
    """Update platform settings (key-value pairs)."""
    for key, value in settings.items():
        await prisma.platformsetting.upsert(
            where={"key": key},
            data={
                "create": {"key": key, "value": str(value)},
                "update": {"value": str(value)},
            },
        )
    await AuditTrailService.log_action(
        action="PLATFORM_SETTINGS_UPDATE",
        domain="SYSTEM",
        resource_type="PlatformSetting",
        metadata={"keys": list(settings.keys()), "updated_by": admin.id},
    )
    return {"success": True}


# =============================================================================
# SUBSCRIPTION TIER CONFIGURATION
# =============================================================================

_PRICING_CACHE_KEY = "pricing:subscription_tiers"


async def _invalidate_pricing_cache():
    """Invalidate the Redis pricing cache when admin changes tier configurations."""
    try:
        import redis.asyncio as aioredis
        from app.core.config import setting

        redis_url = setting.REDIS_URL
        if not redis_url:
            logger.warning(
                "REDIS_URL not configured — pricing cache invalidation skipped"
            )
            return
        r = aioredis.from_url(
            redis_url, decode_responses=True, socket_connect_timeout=2
        )
        try:
            # Delete all pricing cache keys
            keys = await r.keys("pricing:*")
            if keys:
                await r.delete(*keys)
            logger.info(f"Invalidated {len(keys)} pricing cache keys in Redis")
        finally:
            await r.close()
    except Exception as e:
        logger.warning(f"Pricing cache invalidation failed: {e}")


@router.get("/settings/subscription-tiers")
async def get_subscription_tiers(
    category: Optional[str] = Query(
        None, description="Filter by category: EDTECH or BI"
    ),
    admin=Depends(require_permissions("finance:rates:read")),
):
    """Get all subscription tier configurations."""
    where = {}
    if category:
        where["category"] = category.upper()
    tiers = await prisma.subscriptiontierconfig.find_many(
        where=where, order={"sortOrder": "asc"}
    )
    return tiers


@router.post("/settings/subscription-tiers")
async def create_subscription_tier(
    data: dict, admin=Depends(require_permissions("finance:tiers:write"))
):
    """Create a new subscription tier configuration."""
    tier = await prisma.subscriptiontierconfig.create(
        data={
            "plan": data["plan"],
            "category": data["category"],
            "name": data["name"],
            "description": data.get("description"),
            "price": data.get("price", 0),
            "billingCycle": data.get("billingCycle", "monthly"),
            "yearlyPrice": data.get("yearlyPrice"),
            "maxCourses": data.get("maxCourses"),
            "maxStorage": data.get("maxStorage"),
            "maxStudents": data.get("maxStudents"),
            "maxDatasets": data.get("maxDatasets"),
            "maxDashboards": data.get("maxDashboards"),
            "maxApiCalls": data.get("maxApiCalls"),
            "features": data.get("features"),
            "isActive": data.get("isActive", True),
            "sortOrder": data.get("sortOrder", 0),
            "trialDays": data.get("trialDays", 0),
            "metadata": data.get("metadata"),
        }
    )
    await _invalidate_pricing_cache()
    await AuditTrailService.log_action(
        action="SUBSCRIPTION_TIER_CREATE",
        domain="BILLING",
        resource_type="SubscriptionTierConfig",
        resource_id=str(tier.id),
        metadata={"plan": data["plan"], "created_by": admin.id},
    )
    return tier


@router.put("/settings/subscription-tiers/{tier_id}")
async def update_subscription_tier(
    tier_id: int,
    data: dict,
    admin=Depends(require_permissions("finance:tiers:write")),
):
    """Update a subscription tier configuration."""
    update_data = {}
    allowed_fields = [
        "name",
        "description",
        "price",
        "billingCycle",
        "yearlyPrice",
        "maxCourses",
        "maxStorage",
        "maxStudents",
        "maxDatasets",
        "maxDashboards",
        "maxApiCalls",
        "features",
        "isActive",
        "sortOrder",
        "trialDays",
        "metadata",
    ]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    tier = await prisma.subscriptiontierconfig.update(
        where={"id": tier_id}, data=update_data
    )
    await _invalidate_pricing_cache()
    await AuditTrailService.log_action(
        action="SUBSCRIPTION_TIER_UPDATE",
        domain="BILLING",
        resource_type="SubscriptionTierConfig",
        resource_id=str(tier_id),
        metadata={"updated_by": admin.id},
    )
    return tier


@router.delete("/settings/subscription-tiers/{tier_id}")
async def delete_subscription_tier(
    tier_id: int, admin=Depends(require_permissions("finance:tiers:write"))
):
    """Delete a subscription tier configuration."""
    await prisma.subscriptiontierconfig.delete(where={"id": tier_id})
    await _invalidate_pricing_cache()
    await AuditTrailService.log_action(
        action="SUBSCRIPTION_TIER_DELETE",
        domain="BILLING",
        resource_type="SubscriptionTierConfig",
        resource_id=str(tier_id),
        metadata={"deleted_by": admin.id},
    )
    return {"success": True}


# =============================================================================
# COMMISSION RATE CONFIGURATION
# =============================================================================


@router.get("/settings/commission-rates")
async def get_commission_rates(
    admin=Depends(require_permissions("finance:rates:read")),
):
    """Get all commission rate configurations."""
    rates = await prisma.commissionrateconfig.find_many(
        where={"isActive": True}, order={"tier": "asc"}
    )
    return rates


@router.post("/settings/commission-rates")
async def create_commission_rate(
    data: dict, admin=Depends(require_permissions("finance:rates:write"))
):
    """Create a new commission rate configuration."""
    # Deactivate existing rate for this tier
    try:
        await prisma.commissionrateconfig.update_many(
            where={"tier": data["tier"], "isActive": True},
            data={"isActive": False, "effectiveTo": datetime.now(timezone.utc)},
        )
    except Exception:
        pass

    rate = await prisma.commissionrateconfig.create(
        data={
            "tier": data["tier"],
            "commissionPercent": data["commissionPercent"],
            "minProject": data.get("minProject"),
            "maxProject": data.get("maxProject"),
            "isActive": True,
            "description": data.get("description"),
            "metadata": data.get("metadata"),
        }
    )
    await AuditTrailService.log_action(
        action="COMMISSION_RATE_CREATE",
        domain="BILLING",
        resource_type="CommissionRateConfig",
        resource_id=str(rate.id),
        metadata={"tier": data["tier"], "percent": data["commissionPercent"]},
    )
    return rate


@router.put("/settings/commission-rates/{rate_id}")
async def update_commission_rate(
    rate_id: int,
    data: dict,
    admin=Depends(require_permissions("finance:rates:write")),
):
    """Update a commission rate configuration."""
    update_data = {}
    allowed_fields = [
        "commissionPercent",
        "minProject",
        "maxProject",
        "isActive",
        "description",
        "metadata",
    ]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    rate = await prisma.commissionrateconfig.update(
        where={"id": rate_id}, data=update_data
    )
    await AuditTrailService.log_action(
        action="COMMISSION_RATE_UPDATE",
        domain="BILLING",
        resource_type="CommissionRateConfig",
        resource_id=str(rate_id),
        metadata={"updated_by": admin.id},
    )
    return rate


# =============================================================================
# PAYMENT GATEWAY CONFIGURATION
# =============================================================================


@router.get("/settings/payment-gateways")
async def get_payment_gateways(
    admin=Depends(require_permissions("finance:gateways:read")),
):
    """Get all payment gateway configurations with masked secrets."""
    gateways = await prisma.paymentgatewayconfig.find_many(order={"gateway": "asc"})
    sanitized = []
    for g in gateways:
        cfg = dict(g.config) if isinstance(g.config, dict) else {}
        masked_cfg = {}
        for k, v in cfg.items():
            k_lower = k.lower()
            if any(
                sec in k_lower
                for sec in ["secret", "key", "token", "password", "private"]
            ):
                if isinstance(v, str) and len(v) > 6:
                    masked_cfg[k] = v[:3] + "..." + v[-3:]
                else:
                    masked_cfg[k] = "******"
            else:
                masked_cfg[k] = v

        g_dict = g.model_dump() if hasattr(g, "model_dump") else g.dict()
        g_dict["config"] = masked_cfg
        sanitized.append(g_dict)
    return sanitized


@router.put("/settings/payment-gateways/{gateway_id}")
async def update_payment_gateway(
    gateway_id: int,
    data: dict,
    admin=Depends(require_permissions("finance:gateways:write")),
):
    """Update a payment gateway configuration, preserving existing secrets when masked."""
    update_data = {}
    allowed_fields = [
        "displayName",
        "isEnabled",
        "isDefault",
        "environment",
        "config",
        "supportedCurrencies",
        "minAmount",
        "maxAmount",
        "metadata",
    ]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    # Handle masked secrets preservation in config
    if "config" in update_data and isinstance(update_data["config"], dict):
        existing = await prisma.paymentgatewayconfig.find_unique(
            where={"id": gateway_id}
        )
        if existing and isinstance(existing.config, dict):
            merged_config = dict(existing.config)
            for k, v in update_data["config"].items():
                if isinstance(v, str) and ("..." in v or v == "******"):
                    continue
                merged_config[k] = v
            update_data["config"] = merged_config

    # If setting as default, unset other defaults
    if data.get("isDefault"):
        await prisma.paymentgatewayconfig.update_many(
            where={"isDefault": True}, data={"isDefault": False}
        )

    gateway = await prisma.paymentgatewayconfig.update(
        where={"id": gateway_id}, data=update_data
    )
    await AuditTrailService.log_action(
        action="PAYMENT_GATEWAY_UPDATE",
        domain="BILLING",
        resource_type="PaymentGatewayConfig",
        resource_id=str(gateway_id),
        metadata={"gateway": gateway.gateway, "updated_by": admin.id},
    )
    return gateway


# =============================================================================
# FEATURE FLAGS (using feature_flag_service with rollout support)
# =============================================================================


@router.get("/feature-flags", response_model=List[FeatureFlagResponse])
async def list_feature_flags(
    category: Optional[str] = Query(None),
    admin=Depends(require_permissions("infra:flags:read")),
):
    """List all feature flags with rollout configuration."""
    flags = await feature_flag_service.list_flags(category=category)
    return [
        FeatureFlagResponse(
            key=f.key,
            enabled=f.enabled,
            rollout_percentage=f.get_rollout_percentage(),
            target_user_ids=f.get_target_user_ids(),
            target_org_ids=f.get_target_org_ids(),
            metadata=f.metadata,
        )
        for f in flags
    ]


@router.get("/feature-flags/{flag_key}", response_model=FeatureFlagResponse)
async def get_feature_flag(
    flag_key: str, admin=Depends(require_permissions("infra:flags:read"))
):
    """Get a single feature flag by key."""
    flag = await feature_flag_service.get_flag(flag_key)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    return FeatureFlagResponse(
        key=flag.key,
        enabled=flag.enabled,
        rollout_percentage=flag.get_rollout_percentage(),
        target_user_ids=flag.get_target_user_ids(),
        target_org_ids=flag.get_target_org_ids(),
        metadata=flag.metadata,
    )


@router.post("/feature-flags", response_model=FeatureFlagResponse, status_code=201)
async def create_feature_flag(
    data: FeatureFlagCreate,
    admin=Depends(require_permissions("infra:flags:write")),
):
    """Create a new feature flag with rollout configuration."""
    flag = FeatureFlag(
        key=data.key,
        name=data.key,
        enabled=data.enabled,
        category="general",
        metadata={
            "rollout_percentage": data.rollout_percentage,
            "target_user_ids": data.target_user_ids,
            "target_org_ids": data.target_org_ids,
            **data.metadata,
        },
    )
    success = await feature_flag_service.set_flag(flag)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create feature flag")

    await AuditTrailService.log_action(
        action="FEATURE_FLAG_CREATE",
        domain="SYSTEM",
        resource_type="FeatureFlag",
        resource_id=data.key,
        metadata={"enabled": data.enabled, "created_by": admin.id},
    )

    return FeatureFlagResponse(
        key=flag.key,
        enabled=flag.enabled,
        rollout_percentage=flag.get_rollout_percentage(),
        target_user_ids=flag.get_target_user_ids(),
        target_org_ids=flag.get_target_org_ids(),
        metadata=flag.metadata,
    )


@router.put("/feature-flags/{flag_key}", response_model=FeatureFlagResponse)
async def update_feature_flag(
    flag_key: str,
    data: FeatureFlagUpdate,
    admin=Depends(require_permissions("infra:flags:write")),
):
    """Update a feature flag's rollout configuration."""
    flag = await feature_flag_service.get_flag(flag_key)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    # Update fields
    if data.enabled is not None:
        flag.enabled = data.enabled
    if data.rollout_percentage is not None:
        flag.metadata["rollout_percentage"] = data.rollout_percentage
    if data.target_user_ids is not None:
        flag.metadata["target_user_ids"] = data.target_user_ids
    if data.target_org_ids is not None:
        flag.metadata["target_org_ids"] = data.target_org_ids
    if data.metadata is not None:
        flag.metadata.update(data.metadata)

    success = await feature_flag_service.set_flag(flag)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update feature flag")

    await AuditTrailService.log_action(
        action="FEATURE_FLAG_UPDATE",
        domain="SYSTEM",
        resource_type="FeatureFlag",
        resource_id=flag_key,
        metadata={"enabled": flag.enabled, "updated_by": admin.id},
    )

    return FeatureFlagResponse(
        key=flag.key,
        enabled=flag.enabled,
        rollout_percentage=flag.get_rollout_percentage(),
        target_user_ids=flag.get_target_user_ids(),
        target_org_ids=flag.get_target_org_ids(),
        metadata=flag.metadata,
    )


@router.delete("/feature-flags/{flag_key}")
async def delete_feature_flag(
    flag_key: str, admin=Depends(require_permissions("infra:flags:write"))
):
    """Delete a feature flag."""
    success = await feature_flag_service.delete_flag(flag_key)
    if not success:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    await AuditTrailService.log_action(
        action="FEATURE_FLAG_DELETE",
        domain="SYSTEM",
        resource_type="FeatureFlag",
        resource_id=flag_key,
        metadata={"deleted_by": admin.id},
    )
    return {"success": True}


@router.post("/feature-flags/{flag_key}/test")
async def test_feature_flag(
    flag_key: str,
    user_id: Optional[int] = Query(None),
    org_id: Optional[int] = Query(None),
    admin=Depends(require_permissions("infra:flags:read")),
):
    """Test feature flag evaluation for a specific user/org."""
    enabled = await feature_flag_service.is_enabled(
        flag_key, user_id=user_id, org_id=org_id
    )
    return {
        "flag_key": flag_key,
        "enabled": enabled,
        "user_id": user_id,
        "org_id": org_id,
    }


# =============================================================================
# LEGACY SETTINGS FEATURE FLAGS (backward compatibility)
# =============================================================================


@router.get("/settings/feature-flags")
async def get_feature_flags_legacy(
    category: Optional[str] = Query(None),
    admin=Depends(require_permissions("infra:flags:read")),
):
    """Get all feature flags (legacy endpoint)."""
    where = {}
    if category:
        where["category"] = category
    flags = await prisma.featureflag.find_many(where=where, order={"category": "asc"})
    return flags


# =============================================================================
# PLATFORM LIMITS
# =============================================================================


@router.get("/settings/platform-limits")
async def get_platform_limits(
    category: Optional[str] = Query(None),
    admin=Depends(require_permissions("infra:flags:read")),
):
    """Get all platform limits."""
    where = {}
    if category:
        where["category"] = category
    limits = await prisma.platformlimitsconfig.find_many(
        where=where, order={"category": "asc"}
    )
    return limits


@router.put("/settings/platform-limits/{limit_id}")
async def update_platform_limit(
    limit_id: int,
    data: dict,
    admin=Depends(require_permissions("infra:limits:write")),
):
    """Update a platform limit."""
    update_data = {}
    allowed_fields = ["name", "description", "value", "unit", "category"]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    limit = await prisma.platformlimitsconfig.update(
        where={"id": limit_id}, data=update_data
    )
    await AuditTrailService.log_action(
        action="PLATFORM_LIMIT_UPDATE",
        domain="SYSTEM",
        resource_type="PlatformLimitsConfig",
        resource_id=str(limit_id),
        metadata={"fields": list(update_data.keys()), "updated_by": admin.id},
    )
    return limit


@router.post("/settings/platform-limits")
async def create_platform_limit(
    data: dict,
    admin=Depends(require_permissions("infra:limits:write")),
):
    """Create a new platform limit."""
    limit = await prisma.platformlimitsconfig.create(
        data={
            "key": data["key"],
            "name": data["name"],
            "description": data.get("description"),
            "value": data["value"],
            "unit": data.get("unit"),
            "category": data.get("category", "general"),
        }
    )
    await AuditTrailService.log_action(
        action="PLATFORM_LIMIT_CREATE",
        domain="SYSTEM",
        resource_type="PlatformLimitsConfig",
        resource_id=str(limit.id),
        metadata={"key": data["key"], "created_by": admin.id},
    )
    return limit


# =============================================================================
# NOTIFICATION CONFIGURATION
# =============================================================================


@router.get("/settings/notification-config")
async def get_notification_config(
    admin=Depends(require_permissions("infra:flags:read")),
):
    """Get notification channel configurations."""
    configs = await prisma.notificationconfig.find_many(order={"channel": "asc"})
    return configs


@router.put("/settings/notification-config/{config_id}")
async def update_notification_config(
    config_id: int,
    data: dict,
    admin=Depends(require_permissions("notifications:config:write")),
):
    """Update a notification channel configuration."""
    update_data = {}
    allowed_fields = [
        "isEnabled",
        "providerName",
        "config",
        "rateLimitPerHour",
        "metadata",
    ]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    config = await prisma.notificationconfig.update(
        where={"id": config_id}, data=update_data
    )
    await AuditTrailService.log_action(
        action="NOTIFICATION_CONFIG_UPDATE",
        domain="SYSTEM",
        resource_type="NotificationConfig",
        resource_id=str(config_id),
        metadata={"channel": config.channel, "updated_by": admin.id},
    )
    return config


# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================


@router.get("/settings/security")
async def get_security_config(
    admin=Depends(require_permissions("infra:flags:read")),
):
    """Get security configurations."""
    configs = await prisma.securityconfig.find_many(order={"category": "asc"})
    return configs


@router.put("/settings/security/{config_id}")
async def update_security_config(
    config_id: int,
    data: dict,
    admin=Depends(require_permissions("infra:security:write")),
):
    """Update a security configuration."""
    update_data = {}
    allowed_fields = ["name", "description", "value", "category"]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    config = await prisma.securityconfig.update(
        where={"id": config_id}, data=update_data
    )
    await AuditTrailService.log_action(
        action="SECURITY_CONFIG_UPDATE",
        domain="SECURITY",
        resource_type="SecurityConfig",
        resource_id=str(config_id),
        metadata={"key": config.key, "updated_by": admin.id},
    )
    return config


# =============================================================================
# SETTINGS OVERVIEW (aggregated)
# =============================================================================


@router.get("/settings/overview")
async def get_settings_overview(
    admin=Depends(require_permissions("dashboard:read")),
):
    """Get a summary of all platform configuration sections."""
    (
        general_settings,
        tier_count,
        commission_count,
        gateway_count,
        flag_count,
        limit_count,
        notification_count,
        security_count,
    ) = await asyncio.gather(
        prisma.platformsetting.find_many(),
        prisma.subscriptiontierconfig.count(),
        prisma.commissionrateconfig.count(where={"isActive": True}),
        prisma.paymentgatewayconfig.count(),
        prisma.featureflag.count(),
        prisma.platformlimitsconfig.count(),
        prisma.notificationconfig.count(),
        prisma.securityconfig.count(),
    )

    return {
        "general": {s.key: s.value for s in general_settings}
        if general_settings
        else {},
        "subscriptionTiers": tier_count,
        "commissionRates": commission_count,
        "paymentGateways": gateway_count,
        "featureFlags": flag_count,
        "platformLimits": limit_count,
        "notificationChannels": notification_count,
        "securityConfigs": security_count,
    }


# =============================================================================
# VIDEO SYSTEM SETTINGS MANAGEMENT
# =============================================================================


class VideoSettingsUpdateRequest(BaseModel):
    settings: Optional[dict] = Field(default_factory=dict)
    active_provider: Optional[str] = None
    free_provider: Optional[str] = None
    paid_provider: Optional[str] = None


@router.get("/settings/video")
async def get_admin_video_settings(
    admin=Depends(require_permissions("video:config:read")),
):
    """Retrieve video system settings with secret values masked, active providers (free & paid), and audit log."""
    from app.services.system_settings_service import system_settings_service

    settings = await system_settings_service.get_all_settings(category="video")
    active_provider = settings.get("video.active_provider", "bunny")
    free_provider = settings.get("video.free_provider", "youtube")
    paid_provider = settings.get("video.paid_provider", active_provider or "bunny")
    audit_logs = await system_settings_service.get_audit_logs(limit=20)

    return {
        "active_provider": active_provider,
        "free_provider": free_provider,
        "paid_provider": paid_provider,
        "settings": settings,
        "audit_logs": audit_logs,
    }


@router.post("/settings/video")
async def update_admin_video_settings(
    payload: VideoSettingsUpdateRequest,
    admin=Depends(require_permissions("video:config:write")),
):
    """Update video system settings, encrypting secrets and logging audit entries."""
    from app.services.system_settings_service import system_settings_service

    updated_keys = []
    admin_id = getattr(admin, "id", "admin")

    # Define secret keys that must be Fernet-encrypted
    secret_keys = {
        "video.bunny.api_key",
        "video.bunny.token_auth_key",
        "video.bunny.storage_password",
        "video.cloudflare.api_token",
        "video.aws.access_key_id",
        "video.aws.secret_access_key",
        "video.aws.cloudfront_private_key_path",
        "video.aws.cloudfront_key_pair_id",
        "video.youtube.access_token",
        "video.vimeo.access_token",
        "video.vimeo.client_secret",
        "video.dailymotion.api_key",
        "video.dailymotion.api_secret",
        "video.dailymotion.access_token",
    }

    # Free Provider update
    target_free = payload.free_provider or (
        payload.settings.get("video.free_provider") if payload.settings else None
    )
    if target_free:
        await system_settings_service.set_setting(
            key="video.free_provider",
            value=target_free.lower(),
            category="video",
            is_secret=False,
            description="Default video provider for free courses and free preview lessons",
            updated_by=admin_id,
        )
        updated_keys.append("video.free_provider")

    # Paid Provider update
    target_paid = (
        payload.paid_provider
        or payload.active_provider
        or (payload.settings.get("video.paid_provider") if payload.settings else None)
    )
    if target_paid:
        await system_settings_service.set_setting(
            key="video.paid_provider",
            value=target_paid.lower(),
            category="video",
            is_secret=False,
            description="Default video provider for paid core lessons (DRM/HLS)",
            updated_by=admin_id,
        )
        await system_settings_service.set_setting(
            key="video.active_provider",
            value=target_paid.lower(),
            category="video",
            is_secret=False,
            description="Active video infrastructure provider",
            updated_by=admin_id,
        )
        updated_keys.append("video.paid_provider")
        updated_keys.append("video.active_provider")

    settings_dict = payload.settings or {}
    for k, v in settings_dict.items():
        if k in ("video.active_provider", "video.free_provider", "video.paid_provider"):
            continue
        if v is not None and not str(v).startswith("••••••••"):
            is_sec = k in secret_keys
            await system_settings_service.set_setting(
                key=k,
                value=str(v),
                category="video",
                is_secret=is_sec,
                description=f"Video configuration setting for {k}",
                updated_by=admin_id,
            )
            updated_keys.append(k)

    await AuditTrailService.log_action(
        action="VIDEO_SETTINGS_UPDATE",
        domain="SYSTEM",
        resource_type="VideoSettings",
        resource_id="video",
        metadata={"updated_keys": updated_keys, "updated_by": admin.id},
    )

    return {
        "success": True,
        "updated_keys": updated_keys,
        "free_provider": target_free or "youtube",
        "paid_provider": target_paid or "bunny",
        "active_provider": target_paid or payload.active_provider,
    }


@router.post("/settings/video/test")
async def test_admin_video_provider(
    provider_name: str = Query(
        "aws",
        description="Provider to test: aws, bunny, cloudflare, youtube, vimeo, dailymotion",
    ),
    admin=Depends(require_permissions("video:test")),
):
    """Test connection and credentials for a specified video provider strategy."""
    from app.services.video.factory import VideoProviderFactory

    try:
        provider = VideoProviderFactory.get_provider(provider_name)
        result = await provider.test_connection()
        if isinstance(result, dict) and "provider" not in result:
            result["provider"] = provider_name
        return result
    except Exception as e:
        logger.error(f"Error testing provider {provider_name}: {e}")
        return {
            "success": False,
            "provider": provider_name,
            "error": str(e),
        }


@router.post("/settings/video/migrate-lesson/{lesson_id}")
async def migrate_lesson_video(
    lesson_id: str,
    target_provider: Optional[str] = Query(
        None, description="Target provider name (e.g. bunny, cloudflare, aws)"
    ),
    admin=Depends(require_permissions("video:migrate")),
):
    """Migrate a lesson's video asset to the target provider strategy non-destructively."""
    from app.services.video.migration_service import video_migration_service

    try:
        res = await video_migration_service.migrate_lesson_video(
            lesson_id=lesson_id,
            target_provider_name=target_provider,
        )
        await AuditTrailService.log_action(
            action="VIDEO_MIGRATE_LESSON",
            domain="EDUCATION",
            resource_type="Lesson",
            resource_id=lesson_id,
            metadata={"target_provider": target_provider, "admin_id": admin.id},
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error migrating lesson '{lesson_id}': {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to migrate lesson video: {e}"
        )


# =============================================================================
# WAITLIST MANAGEMENT
# =============================================================================


@router.get("/waitlist", response_model=dict)
async def list_waitlist(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "createdAt",
    sort_order: str = "desc",
    admin=Depends(require_permissions("waitlist:read")),
):
    where: dict = {}
    if status:
        where["status"] = status
    if search:
        where["OR"] = [
            {"fullName": {"contains": search, "mode": "insensitive"}},
            {"email": {"contains": search, "mode": "insensitive"}},
        ]
    if date_from:
        where.setdefault("createdAt", {})
        where["createdAt"]["gte"] = datetime.fromisoformat(date_from)
    if date_to:
        where.setdefault("createdAt", {})
        where["createdAt"]["lte"] = datetime.fromisoformat(date_to)

    order_map = {
        "createdAt": "createdAt",
        "friendsReferredCount": "friendsReferredCount",
    }
    order_field = order_map.get(sort_by, "createdAt")

    total = await prisma.waitlistentry.count(where=where)
    entries = await prisma.waitlistentry.find_many(
        where=where,
        order={order_field: sort_order},
        skip=(page - 1) * per_page,
        take=per_page,
    )

    result = []
    for e in entries:
        referrals_count = await prisma.waitlistentry.count(where={"referredById": e.id})
        result.append(
            WaitlistAdminEntryResponse(
                id=e.id,
                fullName=e.fullName,
                email=e.email,
                referralCode=e.referralCode,
                friendsReferredCount=e.friendsReferredCount,
                status=e.status,
                createdAt=e.createdAt,
                metadata=e.metadata if isinstance(e.metadata, dict) else {},
                convertedToUserId=e.convertedToUserId,
                convertedAt=e.convertedAt,
                referralsCount=referrals_count,
            )
        )

    return {
        "data": [r.model_dump(mode="json") for r in result],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


@router.get("/waitlist/stats", response_model=WaitlistAdminStatsResponse)
async def get_waitlist_stats(
    admin=Depends(require_permissions("waitlist:read")),
):
    total = await prisma.waitlistentry.count()
    pending = await prisma.waitlistentry.count(where={"status": "PENDING"})
    verified = await prisma.waitlistentry.count(where={"status": "VERIFIED"})
    converted = await prisma.waitlistentry.count(where={"status": "CONVERTED"})
    bounced = await prisma.waitlistentry.count(where={"status": "BOUNCED"})
    unsubscribed = await prisma.waitlistentry.count(where={"status": "UNSUBSCRIBED"})

    conversion_rate = (converted / total * 100) if total > 0 else 0.0

    agg = await prisma.query_raw(
        'SELECT COALESCE(AVG("friendsReferredCount"), 0) as avg_ref FROM "WaitlistEntry"'
    )
    avg_ref = float(agg[0]["avg_ref"]) if agg else 0.0

    hourly = await prisma.query_raw(
        """
        SELECT date_trunc('hour', "createdAt") as hour, COUNT(*) as count
        FROM "WaitlistEntry"
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY hour
        ORDER BY hour ASC
        """
    )
    hourly_data = (
        [{"hour": str(r["hour"]), "count": r["count"]} for r in hourly]
        if hourly
        else []
    )

    return WaitlistAdminStatsResponse(
        totalEntries=total,
        pendingCount=pending,
        verifiedCount=verified,
        convertedCount=converted,
        bouncedCount=bounced,
        unsubscribedCount=unsubscribed,
        conversionRate=round(conversion_rate, 2),
        avgReferrals=round(avg_ref, 2),
        hourlySignups=hourly_data,
    )


@router.get("/waitlist/{entry_id}", response_model=WaitlistAdminEntryResponse)
async def get_waitlist_entry(
    entry_id: int,
    admin=Depends(require_permissions("waitlist:read")),
):
    entry = await prisma.waitlistentry.find_unique(where={"id": entry_id})
    if not entry:
        raise HTTPException(404, detail={"message": "Entry not found"})
    referrals_count = await prisma.waitlistentry.count(where={"referredById": entry.id})
    return WaitlistAdminEntryResponse(
        id=entry.id,
        fullName=entry.fullName,
        email=entry.email,
        referralCode=entry.referralCode,
        friendsReferredCount=entry.friendsReferredCount,
        status=entry.status,
        createdAt=entry.createdAt,
        metadata=entry.metadata if isinstance(entry.metadata, dict) else {},
        convertedToUserId=entry.convertedToUserId,
        convertedAt=entry.convertedAt,
        referralsCount=referrals_count,
    )


@router.patch("/waitlist/{entry_id}", response_model=dict)
async def update_waitlist_entry(
    entry_id: int,
    body: dict,
    admin=Depends(require_permissions("users:write")),
):
    entry = await prisma.waitlistentry.find_unique(where={"id": entry_id})
    if not entry:
        raise HTTPException(404, detail={"message": "Entry not found"})
    allowed = {"status"}
    update_data = {k: v for k, v in body.items() if k in allowed}
    if not update_data:
        raise HTTPException(400, detail={"message": "No valid fields to update"})
    if "status" in update_data:
        valid_statuses = {"PENDING", "VERIFIED", "CONVERTED", "BOUNCED", "UNSUBSCRIBED"}
        if update_data["status"] not in valid_statuses:
            raise HTTPException(400, detail={"message": "Invalid status"})
    await prisma.waitlistentry.update(where={"id": entry_id}, data=update_data)
    await AuditTrailService.log_action(
        action="WAITLIST_ENTRY_UPDATE",
        domain="USERS",
        resource_type="WaitlistEntry",
        resource_id=str(entry_id),
        metadata={"updates": update_data, "updated_by": admin.id},
    )
    return {"ok": True}


@router.delete("/waitlist/{entry_id}", response_model=dict)
async def delete_waitlist_entry(
    entry_id: int,
    admin=Depends(require_permissions("users:write")),
):
    entry = await prisma.waitlistentry.find_unique(where={"id": entry_id})
    if not entry:
        raise HTTPException(404, detail={"message": "Entry not found"})
    await prisma.waitlistentry.update(
        where={"id": entry_id},
        data={"status": "UNSUBSCRIBED"},
    )
    await AuditTrailService.log_action(
        action="WAITLIST_ENTRY_DELETE",
        domain="USERS",
        resource_type="WaitlistEntry",
        resource_id=str(entry_id),
        metadata={"email": entry.email, "deleted_by": admin.id},
    )
    return {"ok": True}


@router.get("/waitlist/export/csv")
async def export_waitlist_csv(
    admin=Depends(require_permissions("waitlist:export")),
):
    entries = await prisma.waitlistentry.find_many(
        order={"createdAt": "desc"},
    )

    def _sanitize_csv_cell(val: Any) -> str:
        s = "" if val is None else str(val)
        if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
            return f"'{s}"
        return s

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "fullName",
            "email",
            "referralCode",
            "friendsReferredCount",
            "status",
            "locale",
            "createdAt",
            "convertedAt",
        ]
    )
    for e in entries:
        writer.writerow(
            [
                _sanitize_csv_cell(e.fullName),
                _sanitize_csv_cell(e.email),
                _sanitize_csv_cell(e.referralCode),
                e.friendsReferredCount,
                _sanitize_csv_cell(e.status),
                _sanitize_csv_cell(e.locale),
                str(e.createdAt),
                str(e.convertedAt) if e.convertedAt else "",
            ]
        )
    output.seek(0)
    await AuditTrailService.log_action(
        action="WAITLIST_EXPORT_CSV",
        domain="USERS",
        resource_type="WaitlistEntry",
        resource_id="export",
        metadata={"count": len(entries), "exported_by": admin.id},
    )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=waitlist_export.csv"},
    )


@router.get(
    "/waitlist/milestones", response_model=list[WaitlistReferralMilestoneResponse]
)
async def list_milestones(
    admin=Depends(require_permissions("waitlist:read")),
):
    milestones = await prisma.waitlistreferralmilestone.find_many(
        order={"position": "asc"}
    )
    return [WaitlistReferralMilestoneResponse.model_validate(m) for m in milestones]


@router.post("/waitlist/milestones", response_model=WaitlistReferralMilestoneResponse)
async def create_milestone(
    body: WaitlistMilestoneCreate,
    admin=Depends(require_permissions("users:write")),
):
    milestone = await prisma.waitlistreferralmilestone.create(data=body.model_dump())
    await AuditTrailService.log_action(
        action="WAITLIST_MILESTONE_CREATE",
        domain="USERS",
        resource_type="WaitlistReferralMilestone",
        resource_id=str(milestone.id),
        metadata={"title": milestone.title, "created_by": admin.id},
    )
    return WaitlistReferralMilestoneResponse.model_validate(milestone)


@router.delete("/waitlist/milestones/{milestone_id}", response_model=dict)
async def delete_milestone(
    milestone_id: int,
    admin=Depends(require_permissions("users:write")),
):
    existing = await prisma.waitlistreferralmilestone.find_unique(
        where={"id": milestone_id}
    )
    if not existing:
        raise HTTPException(404, detail={"message": "Milestone not found"})
    await prisma.waitlistreferralmilestone.delete(where={"id": milestone_id})
    await AuditTrailService.log_action(
        action="WAITLIST_MILESTONE_DELETE",
        domain="USERS",
        resource_type="WaitlistReferralMilestone",
        resource_id=str(milestone_id),
        metadata={"title": existing.title, "deleted_by": admin.id},
    )
    return {"ok": True}


# ── Promo Code Admin ───────────────────────────────────────────────────────


class AdminPromoCodeCreate(BaseModel):
    code: str
    description: Optional[str] = None
    discount_type: str = "PERCENTAGE"
    discount_value: int
    min_purchase_amount: Optional[int] = None
    max_redemptions: int = 100
    max_usages_per_user: Optional[int] = None
    expires_at: Optional[str] = None
    applicable_plans: Optional[list[str]] = None


@router.get("/promo-codes")
async def admin_list_promo_codes(
    include_inactive: bool = False,
    admin=Depends(require_permissions("finance:rates:read")),
):
    from app.services.promo_code_service import promo_code_service

    codes = await promo_code_service.list_promo_codes(include_inactive=include_inactive)
    return {"promo_codes": [c.model_dump() for c in codes]}


@router.post("/promo-codes", status_code=201)
async def admin_create_promo_code(
    body: AdminPromoCodeCreate,
    admin=Depends(require_permissions("finance:rates:write")),
):
    from app.services.promo_code_service import promo_code_service, PromoCodeError
    from datetime import datetime

    expires_at = None
    if body.expires_at:
        try:
            expires_at = datetime.fromisoformat(body.expires_at)
        except ValueError:
            raise HTTPException(400, detail="Invalid expires_at format, use ISO 8601")

    try:
        promo = await promo_code_service.create_promo_code(
            code=body.code,
            discount_type=body.discount_type,
            discount_value=body.discount_value,
            description=body.description,
            min_purchase_amount=body.min_purchase_amount,
            max_redemptions=body.max_redemptions,
            max_usages_per_user=body.max_usages_per_user,
            expires_at=expires_at,
            applicable_plans=body.applicable_plans,
        )
        data = promo.model_dump()
        data["createdAt"] = data["createdAt"].isoformat()
        data["updatedAt"] = data["updatedAt"].isoformat()
        if data.get("expiresAt"):
            data["expiresAt"] = data["expiresAt"].isoformat()

        await AuditTrailService.log_action(
            action="PROMO_CODE_CREATE",
            domain="BILLING",
            resource_type="PromoCode",
            resource_id=body.code,
            metadata={
                "discount_type": body.discount_type,
                "discount_value": body.discount_value,
                "created_by": admin.id,
            },
        )
        return {"promo_code": data}
    except PromoCodeError as e:
        raise HTTPException(400, detail=e.message)


@router.delete("/promo-codes/{code}")
async def admin_deactivate_promo_code(
    code: str,
    admin=Depends(require_permissions("finance:rates:write")),
):
    from app.services.promo_code_service import promo_code_service, PromoCodeError

    try:
        await promo_code_service.deactivate_promo_code(code)
        await AuditTrailService.log_action(
            action="PROMO_CODE_DEACTIVATE",
            domain="BILLING",
            resource_type="PromoCode",
            resource_id=code,
            metadata={"deactivated_by": admin.id},
        )
        return {"ok": True, "code": code}
    except PromoCodeError as e:
        raise HTTPException(404, detail=e.message)
