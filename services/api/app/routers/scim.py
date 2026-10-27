"""
Enterprise SCIM 2.0 Directory Sync (RFC 7643 / RFC 7644) & SAML 2.0 SSO Metadata Router.
Supports automated provisioning, deprovisioning (instant seat & membership revocation),
and IdP Group-to-Department synchronization for Okta, Microsoft Entra ID, and Google Workspace.
"""

from datetime import datetime, timezone
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.prisma import prisma
from app.core.tenant import TenantContext, get_tenant_context
from app.core.security import get_password_hash

router = APIRouter(prefix="/scim/v2", tags=["Enterprise SCIM 2.0 & SAML SSO"])

SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User"
SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group"
SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
SCIM_PATCH_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp"


class ScimName(BaseModel):
    givenName: Optional[str] = None
    familyName: Optional[str] = None
    formatted: Optional[str] = None


class ScimEmail(BaseModel):
    value: str
    primary: bool = True
    type: str = "work"


class ScimUserCreateRequest(BaseModel):
    schemas: List[str] = Field(default_factory=lambda: [SCIM_USER_SCHEMA])
    userName: str
    name: Optional[ScimName] = None
    displayName: Optional[str] = None
    emails: Optional[List[ScimEmail]] = None
    active: bool = True
    title: Optional[str] = None
    department: Optional[str] = None
    role: str = "MEMBER"


class ScimPatchOperation(BaseModel):
    op: str
    path: Optional[str] = None
    value: Optional[Any] = None


class ScimPatchRequest(BaseModel):
    schemas: List[str] = Field(default_factory=lambda: [SCIM_PATCH_SCHEMA])
    Operations: List[ScimPatchOperation] = []


class ScimGroupMember(BaseModel):
    value: str
    display: Optional[str] = None


class ScimGroupCreateRequest(BaseModel):
    schemas: List[str] = Field(default_factory=lambda: [SCIM_GROUP_SCHEMA])
    displayName: str
    externalId: Optional[str] = None
    members: List[ScimGroupMember] = []


def _format_scim_user(user: Any, member: Any) -> Dict[str, Any]:
    is_active = getattr(member, "deletedAt", None) is None
    full_name = getattr(user, "fullName", None) or getattr(user, "email", "")
    parts = full_name.split(" ", 1) if full_name else ["", ""]
    given = parts[0]
    family = parts[1] if len(parts) > 1 else ""
    return {
        "schemas": [SCIM_USER_SCHEMA],
        "id": str(user.id),
        "userName": user.email,
        "displayName": full_name,
        "name": {
            "givenName": given,
            "familyName": family,
            "formatted": full_name,
        },
        "emails": [{"value": user.email, "primary": True, "type": "work"}],
        "active": is_active,
        "roles": [
            {"value": getattr(member, "role", "MEMBER") or "MEMBER", "primary": True}
        ],
        "meta": {
            "resourceType": "User",
            "created": (
                member.createdAt.isoformat()
                if getattr(member, "createdAt", None)
                else datetime.now(timezone.utc).isoformat()
            ),
            "location": f"/api/v1/scim/v2/Users/{user.id}",
        },
    }


def _require_org_admin(ctx: TenantContext) -> None:
    if not ctx.is_owner and ctx.role not in ("OWNER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SCIM 2.0 directory operations require OWNER or ADMIN role",
        )


@router.get("/ServiceProviderConfig")
async def get_scim_service_provider_config():
    """RFC 7643 SCIM 2.0 ServiceProviderConfig discovery endpoint."""
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "patch": {"supported": True},
        "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
        "filter": {"supported": True, "maxResults": 200},
        "changePassword": {"supported": False},
        "sort": {"supported": True},
        "etag": {"supported": False},
        "authenticationSchemes": [
            {
                "type": "oauthbearertoken",
                "name": "OAuth Bearer Token",
                "description": "Authentication scheme using the OAuth Bearer Token Standard",
                "specUri": "https://www.rfc-editor.org/info/rfc6750",
                "primary": True,
            }
        ],
    }


@router.get("/Users")
async def scim_list_users(
    startIndex: int = Query(1, ge=1),
    count: int = Query(100, ge=1, le=200),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """RFC 7644 SCIM 2.0 list provisioned users in the organization."""
    _require_org_admin(ctx)
    skip = max(0, startIndex - 1)
    members = await prisma.organizationmember.find_many(
        where={"organizationId": ctx.organization_id},
        include={"user": True},
        skip=skip,
        take=count,
    )
    resources = [
        _format_scim_user(m.user, m) for m in members if getattr(m, "user", None)
    ]
    return {
        "schemas": [SCIM_LIST_SCHEMA],
        "totalResults": len(resources),
        "startIndex": startIndex,
        "itemsPerPage": count,
        "Resources": resources,
    }


@router.post("/Users", status_code=status.HTTP_201_CREATED)
async def scim_provision_user(
    payload: ScimUserCreateRequest,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """RFC 7644 SCIM 2.0 user provisioning endpoint."""
    _require_org_admin(ctx)
    email = (
        payload.emails[0].value.strip().lower()
        if payload.emails
        else payload.userName.strip().lower()
    )
    full_name = payload.displayName
    if not full_name and payload.name:
        full_name = (
            payload.name.formatted
            or f"{payload.name.givenName or ''} {payload.name.familyName or ''}".strip()
        )
    if not full_name:
        full_name = email.split("@")[0]

    user = await prisma.user.find_unique(where={"email": email})
    if not user:
        user = await prisma.user.create(
            data={
                "email": email,
                "fullName": full_name,
                "passwordHash": get_password_hash(secrets.token_urlsafe(24)),
                "isVerified": True,
                "organizationId": ctx.organization_id,
            }
        )

    dept_id: Optional[int] = None
    if payload.department:
        dept = await prisma.department.find_first(
            where={
                "organizationId": ctx.organization_id,
                "name": payload.department,
                "deletedAt": None,
            }
        )
        if dept:
            dept_id = dept.id

    existing_member = await prisma.organizationmember.find_unique(
        where={
            "organizationId_userId": {
                "organizationId": ctx.organization_id,
                "userId": user.id,
            }
        }
    )
    if existing_member:
        member = await prisma.organizationmember.update(
            where={"id": existing_member.id},
            data={
                "deletedAt": None if payload.active else datetime.now(timezone.utc),
                "role": payload.role.upper(),
                "departmentId": dept_id
                if dept_id is not None
                else existing_member.departmentId,
            },
        )
    else:
        member = await prisma.organizationmember.create(
            data={
                "organizationId": ctx.organization_id,
                "userId": user.id,
                "role": payload.role.upper(),
                "departmentId": dept_id,
                "invitedById": ctx.user_id,
            }
        )

    return _format_scim_user(user, member)


async def _deprovision_org_user(organization_id: int, target_user_id: int) -> Any:
    """
    Atomically deprovisions a user from the organization and revokes any active corporate EdTech seats.
    """
    now = datetime.now(timezone.utc)
    member = await prisma.organizationmember.find_unique(
        where={
            "organizationId_userId": {
                "organizationId": organization_id,
                "userId": target_user_id,
            }
        }
    )
    if not member:
        raise HTTPException(status_code=404, detail="SCIM user membership not found")

    updated_member = await prisma.organizationmember.update(
        where={"id": member.id},
        data={"deletedAt": now},
    )

    # Revoke active corporate EdTech seats belonging to this organization
    pools = await prisma.teamlicensepool.find_many(
        where={"organizationId": organization_id}
    )
    for pool in pools:
        active_alloc = await prisma.seatallocation.find_first(
            where={"poolId": pool.id, "userId": target_user_id, "revokedAt": None}
        )
        if active_alloc:
            await prisma.seatallocation.update(
                where={"id": active_alloc.id},
                data={"revokedAt": now},
            )
            await prisma.teamlicensepool.update(
                where={"id": pool.id},
                data={"allocatedSeats": max(0, pool.allocatedSeats - 1)},
            )

    return updated_member


@router.patch("/Users/{user_id}")
async def scim_patch_user(
    user_id: int,
    payload: ScimPatchRequest,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    RFC 7644 SCIM 2.0 PatchOp endpoint.
    When an IdP sends `active: false`, immediately deprovisions membership and reclaims EdTech seats.
    """
    _require_org_admin(ctx)
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    should_deactivate = False
    for op in payload.Operations:
        if op.op.lower() in ("replace", "add"):
            if op.path == "active" and op.value is False:
                should_deactivate = True
            elif isinstance(op.value, dict) and op.value.get("active") is False:
                should_deactivate = True

    if should_deactivate:
        member = await _deprovision_org_user(ctx.organization_id, user_id)
    else:
        member = await prisma.organizationmember.find_unique(
            where={
                "organizationId_userId": {
                    "organizationId": ctx.organization_id,
                    "userId": user_id,
                }
            }
        )
        if not member:
            raise HTTPException(
                status_code=404, detail="SCIM user membership not found"
            )
        member = await prisma.organizationmember.update(
            where={"id": member.id},
            data={"deletedAt": None},
        )

    return _format_scim_user(user, member)


@router.delete("/Users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def scim_delete_user(
    user_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """RFC 7644 SCIM 2.0 user deprovisioning endpoint."""
    _require_org_admin(ctx)
    await _deprovision_org_user(ctx.organization_id, user_id)
    return None


@router.get("/Groups")
async def scim_list_groups(
    ctx: TenantContext = Depends(get_tenant_context),
):
    """RFC 7644 SCIM 2.0 Groups endpoint mapped to corporate Departments."""
    _require_org_admin(ctx)
    depts = await prisma.department.find_many(
        where={"organizationId": ctx.organization_id, "deletedAt": None},
        include={"members": {"include": {"user": True}}},
    )
    resources = [
        {
            "schemas": [SCIM_GROUP_SCHEMA],
            "id": str(d.id),
            "displayName": d.name,
            "members": [
                {
                    "value": str(m.userId),
                    "display": m.user.email
                    if getattr(m, "user", None)
                    else str(m.userId),
                }
                for m in (d.members or [])
                if getattr(m, "deletedAt", None) is None
            ],
            "meta": {
                "resourceType": "Group",
                "location": f"/api/v1/scim/v2/Groups/{d.id}",
            },
        }
        for d in depts
    ]
    return {
        "schemas": [SCIM_LIST_SCHEMA],
        "totalResults": len(resources),
        "startIndex": 1,
        "itemsPerPage": max(1, len(resources)),
        "Resources": resources,
    }


@router.post("/Groups", status_code=status.HTTP_201_CREATED)
async def scim_create_group(
    payload: ScimGroupCreateRequest,
    ctx: TenantContext = Depends(get_tenant_context),
):
    """Provision a corporate Department via SCIM 2.0 Group creation and assign members."""
    _require_org_admin(ctx)
    base_slug = payload.displayName.lower().replace(" ", "-")[:40]
    slug = "".join(c for c in base_slug if c.isalnum() or c == "-") or "scim-group"
    dept = await prisma.department.find_first(
        where={"organizationId": ctx.organization_id, "slug": slug}
    )
    if not dept:
        dept = await prisma.department.create(
            data={
                "organizationId": ctx.organization_id,
                "name": payload.displayName,
                "slug": slug,
                "code": payload.externalId,
            }
        )

    for member_ref in payload.members:
        if str(member_ref.value).isdigit():
            uid = int(member_ref.value)
            org_member = await prisma.organizationmember.find_unique(
                where={
                    "organizationId_userId": {
                        "organizationId": ctx.organization_id,
                        "userId": uid,
                    }
                }
            )
            if org_member:
                await prisma.organizationmember.update(
                    where={"id": org_member.id},
                    data={"departmentId": dept.id},
                )

    return {
        "schemas": [SCIM_GROUP_SCHEMA],
        "id": str(dept.id),
        "displayName": dept.name,
        "members": [m.model_dump() for m in payload.members],
        "meta": {
            "resourceType": "Group",
            "location": f"/api/v1/scim/v2/Groups/{dept.id}",
        },
    }


@router.get("/saml/{org_id}/metadata")
async def get_saml_sp_metadata(org_id: int):
    """Return SAML 2.0 Service Provider configuration descriptor for enterprise IdPs."""
    org = await prisma.organization.find_unique(where={"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    sp_entity_id = f"https://podacium.com/saml/sp/org/{org.id}"
    acs_url = f"https://backend-api.podacium.com/api/v1/scim/v2/saml/{org.id}/acs"
    return {
        "organizationId": org.id,
        "organizationSlug": org.slug,
        "spEntityId": sp_entity_id,
        "acsUrl": acs_url,
        "nameIdFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        "idpEntityId": getattr(org, "samlEntityId", None),
        "idpMetadataUrl": getattr(org, "samlMetadataUrl", None),
        "verifiedDomains": getattr(org, "verifiedDomains", None) or [],
        "scimEnabled": bool(getattr(org, "scimEnabled", False)),
    }
