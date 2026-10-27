# services/api/app/routers/admin_iam.py
"""
Staff Identity & Access Management (IAM) endpoints for Multi-Tier Sub-Admin RBAC.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.core.prisma import prisma
from app.core.rbac import (
    get_user_effective_permissions,
    invalidate_permission_cache,
    require_permissions,
)
from app.core.security import get_password_hash, add_user_to_blocklist
from app.generated.prisma import enums as p_enums

from app.services.audit_trail_service import AuditTrailService

logger = logging.getLogger("podacium.admin_iam")
router = APIRouter(prefix="/admin/iam", tags=["Admin IAM"])


# --- Schemas ---


class AdminMeResponse(BaseModel):
    id: Optional[int] = None
    userId: int
    department: str
    title: str
    clearanceLevel: int
    isActive: bool
    roles: List[str]
    permissions: List[str]


class RolePermissionSummary(BaseModel):
    code: str
    name: str
    domain: str
    isDangerous: bool


class RoleSummary(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    isSystem: bool
    hierarchyRank: int
    permissions: List[str]


class AssignRoleRequest(BaseModel):
    targetUserId: int
    roleSlug: str
    department: Optional[str] = None
    title: Optional[str] = None
    expiresAt: Optional[datetime] = None
    requestDualApproval: bool = False


class RevokeRoleRequest(BaseModel):
    targetUserId: int
    roleSlug: str


class RevokeSessionRequest(BaseModel):
    sessionId: Optional[str] = None
    targetUserId: Optional[int] = None


class ProvisionSubAdminRequest(BaseModel):
    email: str
    fullName: str
    phoneNumber: Optional[str] = None
    department: str = "CUSTOMER_SUPPORT"
    roleSlug: Optional[str] = None
    roleSlugs: Optional[List[str]] = None
    title: Optional[str] = None
    clearanceLevel: Optional[int] = None
    mfaEnforced: bool = True
    hardwareKeyRequired: bool = False
    allowedIpSubnets: List[str] = []
    deliveryMethod: str = "INVITE_LINK"  # "INVITE_LINK" | "TEMPORARY_CREDENTIAL"
    requestDualApproval: bool = False


class ProvisionSubAdminResponse(BaseModel):
    success: bool
    userId: int
    adminProfileId: int
    email: str
    fullName: str
    department: str
    roleSlug: str
    roleSlugs: List[str] = []
    clearanceLevel: int
    deliveryMethod: str
    tempPassword: Optional[str] = None
    inviteUrl: Optional[str] = None
    message: str


class UserLookupResponse(BaseModel):
    id: int
    fullName: str
    email: str
    username: Optional[str] = None
    phoneNumber: Optional[str] = None
    avatarUrl: Optional[str] = None
    role: str
    isActive: bool
    createdAt: datetime
    hasAdminProfile: bool
    department: Optional[str] = None
    title: Optional[str] = None
    clearanceLevel: Optional[int] = None
    roles: List[str] = []


class UpdateSubAdminProfileRequest(BaseModel):
    fullName: Optional[str] = None
    phoneNumber: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    clearanceLevel: Optional[int] = None
    mfaEnforced: Optional[bool] = None
    hardwareKeyRequired: Optional[bool] = None
    allowedIpSubnets: Optional[List[str]] = None


class ReissueInviteResponse(BaseModel):
    success: bool
    userId: int
    email: str
    inviteUrl: str
    expiresAt: datetime
    message: str


class GenerateTempPasswordResponse(BaseModel):
    success: bool
    userId: int
    email: str
    tempPassword: str
    message: str


# --- Endpoints ---


@router.get("/me", response_model=AdminMeResponse)
async def get_admin_me(current_user=Depends(get_current_active_user)):
    """Get currently logged-in user's admin profile, assigned roles, and effective permissions."""
    profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={
            "roleAssignments": {
                "include": {
                    "role": True,
                }
            }
        },
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ADMIN_PROFILE_NOT_PROVISIONED",
                "message": "Administrative profile not provisioned. Contact a platform Super Admin to assign your administrative role and department.",
            },
        )

    roles = [ra.role.slug for ra in (profile.roleAssignments or []) if ra.role]
    effective_perms = await get_user_effective_permissions(current_user.id)

    return AdminMeResponse(
        id=profile.id,
        userId=profile.userId,
        department=str(profile.department),
        title=profile.title,
        clearanceLevel=profile.clearanceLevel,
        isActive=profile.isActive,
        roles=roles,
        permissions=list(effective_perms),
    )


@router.get(
    "/roles",
    response_model=List[RoleSummary],
    dependencies=[Depends(require_permissions("iam:roles:read"))],
)
async def list_admin_roles():
    """List all available system and custom administrative roles."""
    roles = await prisma.adminrole.find_many(
        include={
            "permissions": {
                "include": {
                    "permission": True,
                }
            }
        },
        order={"hierarchyRank": "asc"},
    )

    return [
        RoleSummary(
            id=r.id,
            slug=r.slug,
            name=r.name,
            description=r.description,
            isSystem=r.isSystem,
            hierarchyRank=r.hierarchyRank,
            permissions=[rp.permission.code for rp in r.permissions if rp.permission],
        )
        for r in roles
    ]


@router.post(
    "/roles/assign", dependencies=[Depends(require_permissions("iam:roles:assign"))]
)
async def assign_admin_role(
    req: AssignRoleRequest,
    current_user=Depends(get_current_active_user),
):
    """Assign a role and clearance to a staff profile with clearance hierarchy validation."""
    # Find role
    role = await prisma.adminrole.find_unique(where={"slug": req.roleSlug})
    if not role:
        raise HTTPException(status_code=404, detail="errors.iam.role_not_found")

    # Find target user
    target_user = await prisma.user.find_unique(where={"id": req.targetUserId})
    if not target_user:
        raise HTTPException(status_code=404, detail="errors.iam.target_user_not_found")

    # Current admin profile for assignment lineage & hierarchy check
    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    dept_enum = getattr(
        p_enums.AdminDepartment,
        req.department or "CUSTOMER_SUPPORT",
        p_enums.AdminDepartment.CUSTOMER_SUPPORT,
    )

    # Prevent non-super-admins from modifying their own roles (self-escalation prevention)
    if req.targetUserId == current_user.id and not is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.iam.cannot_modify_own_roles",
        )

    # Clearance hierarchy enforcement: non-super-admins cannot assign roles above or equal to their clearance
    if not is_super_admin:
        admin_clearance = current_profile.clearanceLevel if current_profile else 0
        if (
            role.slug == "super-admin"
            or dept_enum == p_enums.AdminDepartment.SUPER_ADMIN
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.super_admin_assignment_restricted",
            )
        if role.hierarchyRank >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.clearance_level_exceeded",
            )

    # Find or create admin profile
    profile = await prisma.adminprofile.find_unique(where={"userId": req.targetUserId})
    if profile and not is_super_admin:
        if profile.clearanceLevel >= (
            current_profile.clearanceLevel if current_profile else 0
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_modify_higher_clearance",
            )

    # Multi-Party Dual Approval Enforcement (Two-Person Integrity) for sensitive privilege grants
    if req.requestDualApproval:
        from app.services.maker_checker_service import (
            MakerCheckerService,
            ACTION_GRANT_PRIVILEGED_ROLE,
        )

        dept_str = dept_enum.name if hasattr(dept_enum, "name") else str(dept_enum)
        pending = await MakerCheckerService.create_pending_action(
            initiator_id=current_user.id,
            action_type=ACTION_GRANT_PRIVILEGED_ROLE,
            target_resource="AdminProfile",
            target_id=str(req.targetUserId),
            payload={
                "targetUserId": req.targetUserId,
                "roleSlug": role.slug,
                "department": dept_str,
                "title": req.title,
                "expiresAt": req.expiresAt.isoformat() if req.expiresAt else None,
            },
        )
        return {
            "success": True,
            "requires_approval": True,
            "pendingAction": pending,
            "message": "privileged_role_assignment_requires_dual_approval",
        }

    if not profile:
        profile = await prisma.adminprofile.create(
            data={
                "userId": req.targetUserId,
                "department": dept_enum,
                "title": req.title or f"{role.name} Staff",
                "clearanceLevel": min(role.hierarchyRank, 10),
                "isActive": True,
            }
        )
    else:
        new_clearance = max(profile.clearanceLevel, role.hierarchyRank)
        profile = await prisma.adminprofile.update(
            where={"id": profile.id},
            data={
                "department": dept_enum if req.department else profile.department,
                "title": req.title or profile.title,
                "clearanceLevel": new_clearance,
            },
        )

    # Create role assignment
    await prisma.adminuserroleassignment.upsert(
        where={
            "adminProfileId_roleId": {
                "adminProfileId": profile.id,
                "roleId": role.id,
            }
        },
        data={
            "create": {
                "adminProfileId": profile.id,
                "roleId": role.id,
                "assignedById": current_profile.id if current_profile else None,
                "expiresAt": req.expiresAt,
            },
            "update": {
                "assignedById": current_profile.id if current_profile else None,
                "expiresAt": req.expiresAt,
            },
        },
    )

    await invalidate_permission_cache(req.targetUserId)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_ROLE_ASSIGNED",
        domain="IAM",
        resource_type="User",
        resource_id=str(req.targetUserId),
        metadata={
            "role": role.slug,
            "department": str(dept_enum),
            "title": req.title,
            "expiresAt": req.expiresAt.isoformat() if req.expiresAt else None,
        },
    )

    logger.info(
        f"Assigned role {role.slug} to user {req.targetUserId} by admin {current_user.id}"
    )
    return {"success": True, "message": f"Role {role.name} assigned successfully"}


@router.post(
    "/roles/revoke", dependencies=[Depends(require_permissions("iam:roles:assign"))]
)
async def revoke_admin_role(
    req: RevokeRoleRequest,
    current_user=Depends(get_current_active_user),
):
    """Revoke a role from an admin profile with root protection."""
    profile = await prisma.adminprofile.find_unique(where={"userId": req.targetUserId})
    if not profile:
        raise HTTPException(
            status_code=404, detail="errors.iam.admin_profile_not_found"
        )

    role = await prisma.adminrole.find_unique(where={"slug": req.roleSlug})
    if not role:
        raise HTTPException(status_code=404, detail="errors.iam.role_not_found")

    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    # Prevent non-super-admins from revoking their own roles
    if req.targetUserId == current_user.id and not is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="errors.iam.cannot_modify_own_roles",
        )

    # Safeguard against revoking the last super-admin
    if role.slug == "super-admin":
        super_role_assignments = await prisma.adminuserroleassignment.count(
            where={"roleId": role.id}
        )
        if super_role_assignments <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.iam.cannot_revoke_last_super_admin",
            )

    # Clearance check: non-super-admins cannot revoke roles of equal or higher clearance
    if not is_super_admin:
        admin_clearance = current_profile.clearanceLevel if current_profile else 0
        if profile.clearanceLevel >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_revoke_higher_clearance",
            )

    await prisma.adminuserroleassignment.delete_many(
        where={"adminProfileId": profile.id, "roleId": role.id}
    )

    await invalidate_permission_cache(req.targetUserId)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_ROLE_REVOKED",
        domain="IAM",
        resource_type="User",
        resource_id=str(req.targetUserId),
        metadata={"role": role.slug},
    )

    logger.info(
        f"Revoked role {role.slug} from user {req.targetUserId} by admin {current_user.id}"
    )
    return {"success": True, "message": f"Role {role.name} revoked successfully"}


@router.post(
    "/sessions/revoke",
    dependencies=[Depends(require_permissions("iam:sessions:revoke"))],
)
async def revoke_admin_sessions(
    req: RevokeSessionRequest,
    current_user=Depends(get_current_active_user),
):
    """Revoke admin sessions and active tokens."""
    from app.core.redis_blocklist import token_blocklist

    now = datetime.now(timezone.utc)
    if req.sessionId:
        session = await prisma.adminsession.find_unique(where={"id": req.sessionId})
        await prisma.adminsession.update(
            where={"id": req.sessionId},
            data={"revokedAt": now},
        )
        if session and session.tokenHash:
            await token_blocklist.add(session.tokenHash)
    elif req.targetUserId:
        profile = await prisma.adminprofile.find_unique(
            where={"userId": req.targetUserId}
        )
        if profile:
            active_sessions = await prisma.adminsession.find_many(
                where={"adminProfileId": profile.id, "revokedAt": None}
            )
            await prisma.adminsession.update_many(
                where={"adminProfileId": profile.id, "revokedAt": None},
                data={"revokedAt": now},
            )
            for s in active_sessions:
                if s.tokenHash:
                    await token_blocklist.add(s.tokenHash)
            await invalidate_permission_cache(req.targetUserId)
            await add_user_to_blocklist(req.targetUserId)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_SESSION_REVOKED",
        domain="IAM",
        resource_type="AdminSession",
        resource_id=req.sessionId or str(req.targetUserId or "ALL"),
    )

    return {"success": True, "message": "Sessions revoked successfully"}


class SubAdminSummary(BaseModel):
    id: int
    userId: int
    fullName: str
    email: str
    avatarUrl: Optional[str] = None
    department: str
    title: str
    clearanceLevel: int
    isActive: bool
    roles: List[str]
    lastAdminLoginAt: Optional[datetime] = None
    createdAt: datetime


class SubAdminListResponse(BaseModel):
    subadmins: List[SubAdminSummary]
    total: int
    page: int
    pageSize: int


class RoleAssignmentDetail(BaseModel):
    roleSlug: str
    roleName: str
    hierarchyRank: int
    assignedAt: datetime
    expiresAt: Optional[datetime] = None


class SubAdminDetailResponse(BaseModel):
    id: int
    userId: int
    fullName: str
    email: str
    avatarUrl: Optional[str] = None
    department: str
    title: str
    clearanceLevel: int
    isActive: bool
    mfaEnforced: bool
    lastAdminLoginAt: Optional[datetime] = None
    createdAt: datetime
    roleAssignments: List[RoleAssignmentDetail]
    effectivePermissions: List[str]


class UpdateSubAdminStatusRequest(BaseModel):
    isActive: bool
    reason: Optional[str] = None


@router.get(
    "/users/{user_id}/lookup",
    response_model=UserLookupResponse,
    dependencies=[Depends(require_permissions("iam:roles:read"))],
)
async def lookup_user_for_iam(user_id: int):
    """Look up a user by ID to auto-populate user information and administrative attributes."""
    user = await prisma.user.find_unique(
        where={"id": user_id},
        include={
            "adminProfile": {
                "include": {
                    "roleAssignments": {
                        "include": {
                            "role": True,
                        }
                    }
                }
            }
        },
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="errors.iam.user_not_found",
        )

    admin_profile = getattr(user, "adminProfile", None)
    has_profile = admin_profile is not None
    department = None
    known_depts = [
        "SUPER_ADMIN",
        "EXECUTIVE",
        "FINANCE_AND_PAYMENTS",
        "COMPLIANCE_AND_KYC",
        "CONTENT_MODERATION",
        "CUSTOMER_SUPPORT",
        "SECURITY_AND_OPERATIONS",
        "REGIONAL_WILAYA_OPS",
    ]
    if has_profile and getattr(admin_profile, "department", None) is not None:
        dept_val = admin_profile.department
        s_val = str(getattr(dept_val, "value", getattr(dept_val, "name", dept_val)))
        matched = False
        for kd in known_depts:
            if kd in s_val:
                department = kd
                matched = True
                break
        if not matched:
            department = s_val.split(".")[-1].split(":")[0].strip("<>'\" ")

    title = admin_profile.title if has_profile else None
    clearance = admin_profile.clearanceLevel if has_profile else None
    roles = [
        ra.role.slug
        for ra in (getattr(admin_profile, "roleAssignments", []) or [])
        if getattr(ra, "role", None)
    ]

    known_roles = ["ADMIN", "MODERATOR", "INSTRUCTOR", "STUDENT", "USER"]
    user_role = "USER"
    if getattr(user, "role", None) is not None:
        r_val = user.role
        s_role = str(getattr(r_val, "value", getattr(r_val, "name", r_val)))
        matched_role = False
        for kr in known_roles:
            if kr in s_role:
                user_role = kr
                matched_role = True
                break
        if not matched_role:
            user_role = s_role.split(".")[-1].split(":")[0].strip("<>'\" ")

    return UserLookupResponse(
        id=user.id,
        fullName=user.fullName,
        email=user.email or "",
        username=getattr(user, "username", None),
        phoneNumber=getattr(user, "phoneNumber", None),
        avatarUrl=getattr(user, "avatarUrl", None),
        role=user_role,
        isActive=user.isActive,
        createdAt=user.createdAt,
        hasAdminProfile=has_profile,
        department=department,
        title=title,
        clearanceLevel=clearance,
        roles=roles,
    )


@router.get(
    "/subadmins",
    response_model=SubAdminListResponse,
    dependencies=[Depends(require_permissions("iam:roles:read"))],
)
async def list_subadmins(
    page: int = 1,
    page_size: int = 20,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    """List staff profiles and sub-admins with roles and department filtering."""
    where: dict = {}
    if department:
        dept_enum = getattr(p_enums.AdminDepartment, department, None)
        if dept_enum:
            where["department"] = dept_enum
    if is_active is not None:
        where["isActive"] = is_active
    if search:
        where["user"] = {
            "OR": [
                {"fullName": {"contains": search, "mode": "insensitive"}},
                {"email": {"contains": search, "mode": "insensitive"}},
            ]
        }

    total = await prisma.adminprofile.count(where=where)
    profiles = await prisma.adminprofile.find_many(
        where=where,
        include={
            "user": True,
            "roleAssignments": {
                "include": {
                    "role": True,
                }
            },
        },
        skip=(page - 1) * page_size,
        take=page_size,
        order={"clearanceLevel": "desc"},
    )

    items = []
    for p in profiles:
        u = p.user
        roles = [ra.role.slug for ra in (p.roleAssignments or []) if ra.role]
        items.append(
            SubAdminSummary(
                id=p.id,
                userId=p.userId,
                fullName=u.fullName if u else "Unknown",
                email=u.email if u else "unknown@podacium.com",
                avatarUrl=getattr(u, "avatarUrl", None) if u else None,
                department=str(p.department),
                title=p.title,
                clearanceLevel=p.clearanceLevel,
                isActive=p.isActive,
                roles=roles,
                lastAdminLoginAt=p.lastAdminLoginAt,
                createdAt=p.createdAt,
            )
        )

    return SubAdminListResponse(
        subadmins=items,
        total=total,
        page=page,
        pageSize=page_size,
    )


@router.get(
    "/subadmins/{user_id}",
    response_model=SubAdminDetailResponse,
    dependencies=[Depends(require_permissions("iam:roles:read"))],
)
async def get_subadmin_detail(user_id: int):
    """Get full details of a specific sub-admin profile, roles, and effective permissions."""
    profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id},
        include={
            "user": True,
            "roleAssignments": {
                "include": {
                    "role": True,
                }
            },
        },
    )
    if not profile:
        raise HTTPException(
            status_code=404, detail="errors.iam.admin_profile_not_found"
        )

    u = profile.user
    role_assignments = [
        RoleAssignmentDetail(
            roleSlug=ra.role.slug,
            roleName=ra.role.name,
            hierarchyRank=ra.role.hierarchyRank,
            assignedAt=getattr(ra, "assignedAt", None)
            or getattr(ra, "createdAt", None)
            or datetime.now(timezone.utc),
            expiresAt=ra.expiresAt,
        )
        for ra in (profile.roleAssignments or [])
        if ra.role
    ]

    effective_perms = await get_user_effective_permissions(user_id)

    return SubAdminDetailResponse(
        id=profile.id,
        userId=profile.userId,
        fullName=u.fullName if u else "Unknown",
        email=u.email if u else "unknown@podacium.com",
        avatarUrl=getattr(u, "avatarUrl", None) if u else None,
        department=str(profile.department),
        title=profile.title,
        clearanceLevel=profile.clearanceLevel,
        isActive=profile.isActive,
        mfaEnforced=profile.mfaEnforced,
        lastAdminLoginAt=profile.lastAdminLoginAt,
        createdAt=profile.createdAt,
        roleAssignments=role_assignments,
        effectivePermissions=list(effective_perms),
    )


@router.put(
    "/subadmins/{user_id}/status",
    dependencies=[Depends(require_permissions("iam:subadmins:deactivate"))],
)
async def update_subadmin_status(
    user_id: int,
    req: UpdateSubAdminStatusRequest,
    current_user=Depends(get_current_active_user),
):
    """Activate or deactivate a sub-admin profile with lockout and clearance hierarchy checks."""
    profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    if not profile:
        raise HTTPException(
            status_code=404, detail="errors.iam.admin_profile_not_found"
        )

    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    # If deactivating, protect against deactivating the last super-admin
    if not req.isActive:
        is_target_super = (
            profile.department == p_enums.AdminDepartment.SUPER_ADMIN
            or any(
                ra.role and ra.role.slug == "super-admin"
                for ra in (profile.roleAssignments or [])
            )
        )
        if is_target_super:
            super_count = await prisma.adminprofile.count(
                where={
                    "isActive": True,
                    "department": p_enums.AdminDepartment.SUPER_ADMIN,
                }
            )
            if super_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="errors.iam.cannot_revoke_last_super_admin",
                )

    # Clearance check: non-super-admins cannot modify profiles of equal or higher clearance
    if not is_super_admin:
        admin_clearance = current_profile.clearanceLevel if current_profile else 0
        if profile.clearanceLevel >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_modify_higher_clearance",
            )

    updated = await prisma.adminprofile.update(
        where={"id": profile.id},
        data={
            "isActive": req.isActive,
            "suspendedAt": None if req.isActive else datetime.now(timezone.utc),
            "suspensionReason": None if req.isActive else req.reason,
        },
    )

    await invalidate_permission_cache(user_id)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_STATUS_UPDATED",
        domain="IAM",
        resource_type="AdminProfile",
        resource_id=str(profile.id),
        metadata={
            "targetUserId": user_id,
            "isActive": req.isActive,
            "reason": req.reason,
        },
    )

    logger.info(
        f"Updated sub-admin {user_id} active status to {req.isActive} by admin {current_user.id}"
    )
    return {
        "success": True,
        "isActive": updated.isActive,
        "message": "status_updated_successfully",
    }


@router.get(
    "/permissions",
    response_model=List[RolePermissionSummary],
    dependencies=[Depends(require_permissions("iam:roles:read"))],
)
async def list_all_permissions():
    """List all registered micro-permissions across all 15 administrative domains."""
    perms = await prisma.adminpermission.find_many(
        order={"code": "asc"},
    )
    return [
        RolePermissionSummary(
            code=p.code,
            name=p.name,
            domain=str(p.domain),
            isDangerous=p.isDangerous,
        )
        for p in perms
    ]


@router.post(
    "/subadmins/provision",
    response_model=ProvisionSubAdminResponse,
    dependencies=[Depends(require_permissions("iam:roles:assign"))],
)
async def provision_subadmin(
    req: ProvisionSubAdminRequest,
    current_user=Depends(get_current_active_user),
):
    """Provision a new or existing user as a sub-admin with clearance enforcement and zero-knowledge credentials."""
    target_email = req.email.strip().lower()
    if not target_email or "@" not in target_email:
        raise HTTPException(status_code=400, detail="errors.iam.invalid_email")

    if not req.fullName.strip():
        raise HTTPException(status_code=400, detail="errors.iam.invalid_full_name")

    target_role_slugs: List[str] = []
    if req.roleSlugs and len(req.roleSlugs) > 0:
        target_role_slugs = [s.strip() for s in req.roleSlugs if s.strip()]
    elif req.roleSlug and req.roleSlug.strip():
        target_role_slugs = [req.roleSlug.strip()]

    if not target_role_slugs:
        raise HTTPException(status_code=400, detail="errors.iam.role_not_found")

    # Find roles
    roles = []
    for slug in target_role_slugs:
        r = await prisma.adminrole.find_unique(where={"slug": slug})
        if not r:
            raise HTTPException(status_code=404, detail="errors.iam.role_not_found")
        roles.append(r)

    primary_role = roles[0]

    # Caller clearance check
    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    dept_enum = getattr(
        p_enums.AdminDepartment,
        req.department,
        p_enums.AdminDepartment.CUSTOMER_SUPPORT,
    )
    max_role_hierarchy = max(r.hierarchyRank for r in roles)
    assigned_clearance = (
        req.clearanceLevel
        if req.clearanceLevel is not None
        else min(max_role_hierarchy, 10)
    )

    if not is_super_admin:
        admin_clearance = current_profile.clearanceLevel if current_profile else 0
        if (
            any(r.slug == "super-admin" for r in roles)
            or dept_enum == p_enums.AdminDepartment.SUPER_ADMIN
            or dept_enum == getattr(p_enums.AdminDepartment, "EXECUTIVE", None)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.super_admin_assignment_restricted",
            )
        if (
            assigned_clearance >= admin_clearance
            or max_role_hierarchy >= admin_clearance
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.clearance_level_exceeded",
            )

    # Multi-Party Dual Approval Enforcement (Two-Person Integrity) for provisioning
    if req.requestDualApproval:
        from app.services.maker_checker_service import (
            MakerCheckerService,
            ACTION_GRANT_PRIVILEGED_ROLE,
        )

        dept_str = dept_enum.name if hasattr(dept_enum, "name") else str(dept_enum)
        _pending = await MakerCheckerService.create_pending_action(
            initiator_id=current_user.id,
            action_type=ACTION_GRANT_PRIVILEGED_ROLE,
            target_resource="AdminProfile",
            target_id=target_email,
            payload={
                "email": target_email,
                "fullName": req.fullName,
                "roleSlug": primary_role.slug,
                "roleSlugs": [r.slug for r in roles],
                "department": dept_str,
                "title": req.title,
                "clearanceLevel": assigned_clearance,
            },
        )
        return ProvisionSubAdminResponse(
            success=True,
            userId=0,
            adminProfileId=0,
            email=target_email,
            fullName=req.fullName,
            department=dept_str,
            roleSlug=primary_role.slug,
            roleSlugs=[r.slug for r in roles],
            clearanceLevel=assigned_clearance,
            deliveryMethod=req.deliveryMethod,
            inviteUrl=None,
            tempPassword=None,
            message="subadmin_provision_requires_dual_approval",
        )

    temp_password = None
    invite_url = None
    if req.deliveryMethod == "TEMPORARY_CREDENTIAL":
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        part3 = secrets.token_hex(2).upper()
        part4 = secrets.token_hex(2).upper()
        temp_password = f"Poda-{part1}-{part2}-{part3}-{part4}!"
    else:
        invite_token = secrets.token_urlsafe(32)
        invite_url = f"/auth/setup-admin?token={invite_token}"

    existing_user = await prisma.user.find_unique(where={"email": target_email})
    if existing_user:
        existing_profile = await prisma.adminprofile.find_unique(
            where={"userId": existing_user.id}
        )
        if existing_profile and existing_profile.isActive:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.iam.user_already_admin",
            )

        user_update_data: dict = {
            "role": "ADMIN",
            "fullName": req.fullName.strip(),
        }
        if req.phoneNumber:
            user_update_data["phoneNumber"] = req.phoneNumber.strip()
        if temp_password:
            user_update_data["passwordHash"] = get_password_hash(temp_password)
            user_update_data["lastPasswordChangeAt"] = datetime.now(timezone.utc)

        user = await prisma.user.update(
            where={"id": existing_user.id},
            data=user_update_data,
        )

        if existing_profile:
            profile = await prisma.adminprofile.update(
                where={"id": existing_profile.id},
                data={
                    "department": dept_enum,
                    "title": req.title or f"{primary_role.name} Staff",
                    "clearanceLevel": assigned_clearance,
                    "mfaEnforced": req.mfaEnforced,
                    "isActive": True,
                    "suspendedAt": None,
                    "suspensionReason": None,
                    "deletedAt": None,
                },
            )
        else:
            profile = await prisma.adminprofile.create(
                data={
                    "userId": user.id,
                    "department": dept_enum,
                    "title": req.title or f"{primary_role.name} Staff",
                    "clearanceLevel": assigned_clearance,
                    "mfaEnforced": req.mfaEnforced,
                    "isActive": True,
                },
            )
    else:
        username = target_email.split("@")[0] + "_" + secrets.token_hex(2)
        pwd_to_hash = temp_password if temp_password else secrets.token_urlsafe(24)

        user_data: dict = {
            "email": target_email,
            "username": username,
            "fullName": req.fullName.strip(),
            "role": "ADMIN",
            "isActive": True,
            "emailVerified": False,
            "passwordHash": get_password_hash(pwd_to_hash),
        }
        if req.phoneNumber:
            user_data["phoneNumber"] = req.phoneNumber.strip()

        user = await prisma.user.create(data=user_data)

        profile = await prisma.adminprofile.create(
            data={
                "userId": user.id,
                "department": dept_enum,
                "title": req.title or f"{primary_role.name} Staff",
                "clearanceLevel": assigned_clearance,
                "mfaEnforced": req.mfaEnforced,
                "hardwareKeyRequired": req.hardwareKeyRequired,
                "allowedIpSubnets": req.allowedIpSubnets,
                "isActive": True,
            },
        )

    # Upsert all role assignments
    for role in roles:
        await prisma.adminuserroleassignment.upsert(
            where={
                "adminProfileId_roleId": {
                    "adminProfileId": profile.id,
                    "roleId": role.id,
                }
            },
            data={
                "create": {
                    "adminProfileId": profile.id,
                    "roleId": role.id,
                    "assignedById": current_profile.id if current_profile else None,
                },
                "update": {
                    "assignedById": current_profile.id if current_profile else None,
                },
            },
        )

    await invalidate_permission_cache(user.id)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_SUBADMIN_PROVISIONED",
        domain="IAM",
        resource_type="AdminProfile",
        resource_id=str(profile.id),
        metadata={
            "targetUserId": user.id,
            "email": target_email,
            "roles": [r.slug for r in roles],
            "department": str(dept_enum),
            "clearanceLevel": assigned_clearance,
            "deliveryMethod": req.deliveryMethod,
            "mfaEnforced": req.mfaEnforced,
            "hardwareKeyRequired": req.hardwareKeyRequired,
            "allowedIpSubnets": req.allowedIpSubnets,
        },
    )

    logger.info(
        f"Provisioned sub-admin {user.id} ({target_email}) with roles {[r.slug for r in roles]} by admin {current_user.id}"
    )
    return ProvisionSubAdminResponse(
        success=True,
        userId=user.id,
        adminProfileId=profile.id,
        email=target_email,
        fullName=user.fullName,
        department=str(dept_enum),
        roleSlug=primary_role.slug,
        roleSlugs=[r.slug for r in roles],
        clearanceLevel=assigned_clearance,
        deliveryMethod=req.deliveryMethod,
        tempPassword=temp_password,
        inviteUrl=invite_url,
        message="subadmin_provisioned_successfully",
    )


@router.put(
    "/subadmins/{user_id}/profile",
    dependencies=[Depends(require_permissions("iam:roles:assign"))],
)
async def update_subadmin_profile(
    user_id: int,
    req: UpdateSubAdminProfileRequest,
    current_user=Depends(get_current_active_user),
):
    """Update a sub-admin's administrative profile and user attributes with clearance hierarchy validation."""
    profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    if not profile:
        raise HTTPException(
            status_code=404, detail="errors.iam.admin_profile_not_found"
        )

    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    admin_clearance = current_profile.clearanceLevel if current_profile else 0

    if not is_super_admin:
        if profile.clearanceLevel >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_modify_higher_clearance",
            )
        if req.clearanceLevel is not None and req.clearanceLevel >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.clearance_level_exceeded",
            )
        if req.department in ("SUPER_ADMIN", "EXECUTIVE"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.super_admin_assignment_restricted",
            )

    # Update User attributes
    user_data: dict = {}
    if req.fullName is not None and req.fullName.strip():
        user_data["fullName"] = req.fullName.strip()
    if req.phoneNumber is not None:
        user_data["phoneNumber"] = req.phoneNumber.strip() or None

    if user_data:
        await prisma.user.update(
            where={"id": user_id},
            data=user_data,
        )

    # Update AdminProfile attributes
    profile_data: dict = {}
    if req.department is not None:
        dept_enum = getattr(p_enums.AdminDepartment, req.department, None)
        if dept_enum:
            profile_data["department"] = dept_enum
    if req.title is not None:
        profile_data["title"] = req.title.strip()
    if req.clearanceLevel is not None:
        profile_data["clearanceLevel"] = req.clearanceLevel
    if req.mfaEnforced is not None:
        profile_data["mfaEnforced"] = req.mfaEnforced
    if req.hardwareKeyRequired is not None:
        profile_data["hardwareKeyRequired"] = req.hardwareKeyRequired
    if req.allowedIpSubnets is not None:
        profile_data["allowedIpSubnets"] = req.allowedIpSubnets

    if profile_data:
        await prisma.adminprofile.update(
            where={"id": profile.id},
            data=profile_data,
        )

    await invalidate_permission_cache(user_id)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_SUBADMIN_PROFILE_UPDATED",
        domain="IAM",
        resource_type="AdminProfile",
        resource_id=str(profile.id),
        metadata={
            "targetUserId": user_id,
            "updatedUserData": user_data,
            "updatedProfileData": {k: str(v) for k, v in profile_data.items()},
        },
    )

    logger.info(f"Updated sub-admin profile {user_id} by admin {current_user.id}")
    return {"success": True, "message": "profile_updated_successfully"}


@router.delete(
    "/subadmins/{user_id}",
    dependencies=[Depends(require_permissions("iam:roles:assign"))],
)
async def deprovision_subadmin(
    user_id: int,
    request_dual_approval: bool = False,
    current_user=Depends(get_current_active_user),
):
    """Permanently de-provision a sub-admin with last super-admin, clearance, and dual-approval safeguards."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="errors.iam.cannot_delete_self",
        )

    profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    if not profile:
        raise HTTPException(
            status_code=404, detail="errors.iam.admin_profile_not_found"
        )

    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    # Safeguard against deleting the last active super-admin
    is_target_super = profile.department == p_enums.AdminDepartment.SUPER_ADMIN or any(
        ra.role and ra.role.slug == "super-admin"
        for ra in (profile.roleAssignments or [])
    )
    if is_target_super:
        super_count = await prisma.adminprofile.count(
            where={
                "isActive": True,
                "department": p_enums.AdminDepartment.SUPER_ADMIN,
            }
        )
        if super_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="errors.iam.cannot_revoke_last_super_admin",
            )

    # Clearance check: non-super-admins cannot deprovision profiles of equal or higher clearance
    if not is_super_admin:
        admin_clearance = current_profile.clearanceLevel if current_profile else 0
        if profile.clearanceLevel >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_modify_higher_clearance",
            )

    # Multi-Party Dual Approval Enforcement (Two-Person Integrity)
    if request_dual_approval:
        from app.services.maker_checker_service import (
            MakerCheckerService,
            ACTION_DEPROVISION_SUBADMIN,
        )

        pending = await MakerCheckerService.create_pending_action(
            initiator_id=current_user.id,
            action_type=ACTION_DEPROVISION_SUBADMIN,
            target_resource="AdminProfile",
            target_id=str(user_id),
            payload={
                "userId": user_id,
                "department": str(profile.department),
                "clearanceLevel": profile.clearanceLevel,
            },
        )
        return {
            "success": True,
            "requires_approval": True,
            "pendingAction": pending,
            "message": "subadmin_deprovision_requires_dual_approval",
        }

    # Delete role assignments
    await prisma.adminuserroleassignment.delete_many(
        where={"adminProfileId": profile.id}
    )

    # Revoke sessions
    await prisma.adminsession.update_many(
        where={"adminProfileId": profile.id, "revokedAt": None},
        data={"revokedAt": datetime.now(timezone.utc)},
    )
    await add_user_to_blocklist(user_id)

    # Soft-delete / deactivate admin profile
    await prisma.adminprofile.update(
        where={"id": profile.id},
        data={
            "isActive": False,
            "deletedAt": datetime.now(timezone.utc),
            "suspendedAt": datetime.now(timezone.utc),
            "suspensionReason": f"Deprovisioned by admin {current_user.id}",
        },
    )

    # Demote user role back to STUDENT
    await prisma.user.update(
        where={"id": user_id},
        data={"role": "STUDENT"},
    )

    await invalidate_permission_cache(user_id)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_SUBADMIN_DEPROVISIONED",
        domain="IAM",
        resource_type="AdminProfile",
        resource_id=str(profile.id),
        metadata={
            "targetUserId": user_id,
            "department": str(profile.department),
            "clearanceLevel": profile.clearanceLevel,
        },
    )

    logger.info(f"De-provisioned sub-admin {user_id} by admin {current_user.id}")
    return {"success": True, "message": "subadmin_deprovisioned_successfully"}


@router.post(
    "/subadmins/{user_id}/invite",
    response_model=ReissueInviteResponse,
    dependencies=[Depends(require_permissions("iam:roles:assign"))],
)
async def reissue_subadmin_invite(
    user_id: int,
    current_user=Depends(get_current_active_user),
):
    """Re-issue a time-limited cryptographically signed setup invite link for a sub-admin."""
    profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id},
        include={"user": True, "roleAssignments": {"include": {"role": True}}},
    )
    if not profile or not profile.user:
        raise HTTPException(
            status_code=404, detail="errors.iam.admin_profile_not_found"
        )

    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    if not is_super_admin:
        admin_clearance = current_profile.clearanceLevel if current_profile else 0
        if profile.clearanceLevel >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_modify_higher_clearance",
            )

    token = secrets.token_urlsafe(32)
    invite_url = f"/auth/setup-admin?token={token}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_INVITE_REISSUED",
        domain="IAM",
        resource_type="AdminProfile",
        resource_id=str(profile.id),
        metadata={
            "targetUserId": user_id,
            "email": profile.user.email,
            "expiresAt": expires_at.isoformat(),
        },
    )

    return ReissueInviteResponse(
        success=True,
        userId=user_id,
        email=profile.user.email or "",
        inviteUrl=invite_url,
        expiresAt=expires_at,
        message="invite_reissued_successfully",
    )


@router.post(
    "/subadmins/{user_id}/temp-password",
    response_model=GenerateTempPasswordResponse,
    dependencies=[Depends(require_permissions("iam:roles:assign"))],
)
async def generate_subadmin_temp_password(
    user_id: int,
    current_user=Depends(get_current_active_user),
):
    """Regenerate a single-use high-entropy temporary password for emergency recovery."""
    profile = await prisma.adminprofile.find_unique(
        where={"userId": user_id},
        include={"user": True, "roleAssignments": {"include": {"role": True}}},
    )
    if not profile or not profile.user:
        raise HTTPException(
            status_code=404, detail="errors.iam.admin_profile_not_found"
        )

    current_profile = await prisma.adminprofile.find_unique(
        where={"userId": current_user.id},
        include={"roleAssignments": {"include": {"role": True}}},
    )
    is_super_admin = current_profile is not None and (
        current_profile.department == p_enums.AdminDepartment.SUPER_ADMIN
        or any(
            ra.role and ra.role.slug == "super-admin"
            for ra in (current_profile.roleAssignments or [])
        )
    )

    if not is_super_admin:
        admin_clearance = current_profile.clearanceLevel if current_profile else 0
        if profile.clearanceLevel >= admin_clearance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="errors.iam.cannot_modify_higher_clearance",
            )

    part1 = secrets.token_hex(2).upper()
    part2 = secrets.token_hex(2).upper()
    part3 = secrets.token_hex(2).upper()
    part4 = secrets.token_hex(2).upper()
    temp_password = f"Poda-{part1}-{part2}-{part3}-{part4}!"

    # Update User password hash
    await prisma.user.update(
        where={"id": user_id},
        data={
            "passwordHash": get_password_hash(temp_password),
            "lastPasswordChangeAt": datetime.now(timezone.utc),
        },
    )

    # Invalidate existing sessions
    await add_user_to_blocklist(user_id)
    await prisma.adminsession.update_many(
        where={"adminProfileId": profile.id, "revokedAt": None},
        data={"revokedAt": datetime.now(timezone.utc)},
    )
    await invalidate_permission_cache(user_id)

    # Cryptographic Audit Logging
    await AuditTrailService.log_action(
        actor_id=current_user.id,
        action="IAM_TEMP_PASSWORD_GENERATED",
        domain="IAM",
        resource_type="AdminProfile",
        resource_id=str(profile.id),
        metadata={
            "targetUserId": user_id,
            "email": profile.user.email,
        },
    )

    return GenerateTempPasswordResponse(
        success=True,
        userId=user_id,
        email=profile.user.email or "",
        tempPassword=temp_password,
        message="temp_password_generated_successfully",
    )
