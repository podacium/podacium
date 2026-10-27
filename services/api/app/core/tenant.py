from fastapi import Header, HTTPException, Query, status, Depends
from typing import Any, Optional, NamedTuple, Set
from app.core.prisma import prisma
from app.core.auth import get_current_user


class TenantContext(NamedTuple):
    organization_id: int
    user_id: int
    role: str
    is_owner: bool
    user: Any = None


async def get_tenant_context(
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    organization_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
) -> TenantContext:
    header_org_id = (
        x_organization_id if isinstance(x_organization_id, (str, int)) else None
    )
    query_org_id = organization_id if isinstance(organization_id, (str, int)) else None
    user_org = getattr(current_user, "primaryOrganizationId", None) or getattr(
        current_user, "organization_id", None
    )
    if not isinstance(user_org, (str, int)):
        user_org = None

    raw_org_id = (
        header_org_id
        if header_org_id is not None
        else (query_org_id if query_org_id is not None else user_org)
    )
    if not raw_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required: Supply X-Organization-Id header or configure primaryOrganization.",
        )
    try:
        org_id = int(raw_org_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID format.",
        )

    # Super-Admin bypass
    user_role = getattr(current_user, "role", None)
    user_role_str = getattr(user_role, "value", user_role)
    if user_role_str == "ADMIN" or getattr(current_user, "is_admin", False) is True:
        org = await prisma.organization.find_first(
            where={"id": org_id, "deletedAt": None}
        )
        if not org and header_org_id is not None:
            raise HTTPException(status_code=404, detail="Organization not found")
        return TenantContext(
            organization_id=org_id,
            user_id=current_user.id,
            role="OWNER",
            is_owner=True,
            user=current_user,
        )

    org = await prisma.organization.find_first(
        where={"id": org_id, "deletedAt": None},
        include={"members": {"where": {"userId": current_user.id, "deletedAt": None}}},
    )
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive.",
        )

    is_owner = org.ownerId == current_user.id
    membership = org.members[0] if org.members else None

    if not is_owner and not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: You do not have active access to organization {org_id}.",
        )

    if is_owner:
        role = "OWNER"
    elif membership and getattr(membership, "role", None):
        role = str(membership.role)
    else:
        role = "MEMBER"

    return TenantContext(
        organization_id=org_id,
        user_id=current_user.id,
        role=role,
        is_owner=is_owner,
        user=current_user,
    )


ROLE_PERMISSIONS: dict[str, Set[str]] = {
    "OWNER": {"*"},
    "ADMIN": {
        "org:read",
        "org:update",
        "org:members:invite",
        "org:members:remove",
        "org:members:role_update",
        "bi:*",
        "contracts:*",
        "billing:read",
    },
    "BILLING_ADMIN": {
        "org:read",
        "billing:read",
        "billing:write",
        "billing:fiscal:update",
        "audit:read",
    },
    "HIRING_MANAGER": {
        "org:read",
        "contracts:create",
        "contracts:manage",
        "contracts:milestone:approve",
        "escrow:release",
        "proposals:review",
    },
    "ANALYST": {
        "org:read",
        "bi:datasets:create",
        "bi:datasets:query",
        "bi:dashboards:edit",
        "bi:dashboards:view",
        "bi:reports:create",
        "bi:reports:run",
        "bi:quality:scan",
    },
    "VIEWER": {"org:read", "bi:dashboards:view", "bi:reports:view"},
    "AUDITOR": {"org:read", "audit:read", "billing:read", "compliance:read"},
}


def require_org_permission(required_perm: str):
    async def checker(ctx: TenantContext = Depends(get_tenant_context)):
        if ctx.is_owner or "*" in ROLE_PERMISSIONS.get(ctx.role, set()):
            return ctx
        perms = ROLE_PERMISSIONS.get(ctx.role, set())
        domain = required_perm.split(":")[0] + ":*"
        if required_perm not in perms and domain not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires permission '{required_perm}'. Current role: '{ctx.role}'",
            )
        return ctx

    return checker
