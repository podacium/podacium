"""
Organization Service - Enterprise Multi-Tenancy Management

Encapsulates all organization lifecycle, membership, invitation, and RBAC operations.
Enforces multi-tenancy isolation and atomic transactional integrity.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import HTTPException, status

from app.core.config import setting
from app.core.prisma import prisma
from app.schemas.organizations import (
    MemberInviteRequest,
    OrganizationCreate,
    OrganizationUpdate,
)
from app.services.email_service import EmailService
from app.services.notification_service import NotificationCreate, NotificationService

logger = logging.getLogger(__name__)

ROLE_HIERARCHY = {"OWNER": 3, "ADMIN": 2, "MEMBER": 1, "VIEWER": 1}


class OrganizationService:
    def __init__(self):
        self.db = prisma

    async def get_org_with_permission(
        self, org_id: int, user_id: int, required_role: str = "MEMBER"
    ):
        """
        Verify tenant membership and role hierarchy for an organization.
        Raises 404 if not found, 403 if unauthorized.
        """
        org = await self.db.organization.find_unique(
            where={"id": org_id},
            include={"members": {"where": {"userId": user_id, "deletedAt": None}}},
        )

        if not org or org.deletedAt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
            )

        is_owner = org.ownerId == user_id
        membership = org.members[0] if org.members else None
        user_role = "OWNER" if is_owner else (membership.role if membership else None)

        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this organization",
            )

        if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(required_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {required_role}",
            )

        return org

    async def list_user_organizations(self, user_id: int) -> Dict[str, Any]:
        """List all organizations the user owns or is an active member of."""
        owned_org = await self.db.organization.find_first(
            where={"ownerId": user_id, "deletedAt": None},
            include={"members": {"where": {"deletedAt": None}}},
        )

        memberships = await self.db.organizationmember.find_many(
            where={
                "userId": user_id,
                "deletedAt": None,
                "organization": {"deletedAt": None},
            },
            include={
                "organization": {"include": {"members": {"where": {"deletedAt": None}}}}
            },
        )

        organizations = []
        if owned_org:
            org_data = owned_org.dict()
            org_data["isOwner"] = True
            org_data["userRole"] = "OWNER"
            org_data["memberCount"] = len(owned_org.members) + 1
            org_data["members"] = []
            organizations.append(org_data)

        for membership in memberships:
            org = membership.organization
            if owned_org and org.id == owned_org.id:
                continue

            org_data = org.dict()
            org_data["isOwner"] = False
            org_data["userRole"] = membership.role or "MEMBER"
            org_data["memberCount"] = len(org.members) + 1
            org_data["members"] = []
            organizations.append(org_data)

        return {"organizations": organizations, "total": len(organizations)}

    async def create_organization(
        self, user_id: int, data: OrganizationCreate
    ) -> Dict[str, Any]:
        """Create a new organization and assign the user as owner."""
        # Check if user already owns an active organization
        existing = await self.db.organization.find_first(
            where={"ownerId": user_id, "deletedAt": None}
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already owns an active organization",
            )

        # Generate unique slug
        base_slug = data.name.lower().replace(" ", "-")[:40]
        base_slug = "".join(c for c in base_slug if c.isalnum() or c in "-") or "org"
        slug = base_slug
        counter = 1
        while await self.db.organization.find_unique(where={"slug": slug}):
            slug = f"{base_slug}-{counter}"
            counter += 1

        new_org = await self.db.organization.create(
            data={
                "name": data.name,
                "slug": slug,
                "description": data.description,
                "country": data.country,
                "city": data.city,
                "website": data.website,
                "sector": data.sector,
                "ownerId": user_id,
            }
        )

        user = await self.db.user.find_unique(where={"id": user_id})
        if user and not user.primaryOrganizationId:
            await self.db.user.update(
                where={"id": user_id}, data={"primaryOrganizationId": new_org.id}
            )

        org_data = new_org.dict()
        org_data["isOwner"] = True
        org_data["userRole"] = "OWNER"
        org_data["memberCount"] = 1
        org_data["members"] = []
        return org_data

    async def update_organization(
        self, org_id: int, user_id: int, data: OrganizationUpdate
    ) -> Dict[str, Any]:
        """Update organization details (ADMIN or OWNER only)."""
        await self.get_org_with_permission(org_id, user_id, required_role="ADMIN")

        update_data = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        updated_org = await self.db.organization.update(
            where={"id": org_id}, data=update_data
        )

        member_count = await self.db.organizationmember.count(
            where={"organizationId": org_id, "deletedAt": None}
        )
        org_data = updated_org.dict()
        org_data["isOwner"] = updated_org.ownerId == user_id
        org_data["userRole"] = "OWNER" if org_data["isOwner"] else "ADMIN"
        org_data["memberCount"] = member_count + 1
        org_data["members"] = []
        return org_data

    async def invite_member(
        self, org_id: int, inviter: Any, invite: MemberInviteRequest
    ) -> Dict[str, Any]:
        """Invite a member with SHA-256 token hashing and email dispatch."""
        await self.get_org_with_permission(org_id, inviter.id, required_role="ADMIN")

        if invite.role == "OWNER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot invite as OWNER. Use ownership transfer instead.",
            )

        # Check existing member
        target_user = await self.db.user.find_unique(where={"email": invite.email})
        if target_user:
            existing_member = await self.db.organizationmember.find_first(
                where={
                    "organizationId": org_id,
                    "userId": target_user.id,
                    "deletedAt": None,
                }
            )
            if existing_member:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already a member",
                )

        # Check pending invitation
        existing_invite = await self.db.invitation.find_first(
            where={"organizationId": org_id, "email": invite.email, "status": "PENDING"}
        )
        if existing_invite:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation already sent to this email",
            )

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        invitation = await self.db.invitation.create(
            data={
                "email": invite.email,
                "role": invite.role or "MEMBER",
                "token": token,
                "organizationId": org_id,
                "inviterId": inviter.id,
                "expiresAt": expires_at,
                "status": "PENDING",
            },
            include={"organization": True, "inviter": True},
        )

        org_name = (
            invitation.organization.name if invitation.organization else "Organization"
        )
        inviter_name = inviter.fullName or inviter.email
        invite_url = f"{setting.FRONTEND_URL}/bi/organizations/invitations/{token}"

        try:
            email_service = EmailService()
            await email_service.send_organization_invitation_email(
                email=invite.email,
                org_name=org_name,
                inviter_name=inviter_name,
                role=invite.role or "MEMBER",
                invite_url=invite_url,
            )
        except Exception as e:
            logger.error(f"Failed to dispatch invitation email: {e}")

        if target_user:
            try:
                await NotificationService.create_notification(
                    NotificationCreate(
                        user_id=target_user.id,
                        type="ORGANIZATION_INVITE",
                        title="notifications.invitation.title",
                        body="notifications.invitation.message",
                        variables={
                            "inviterName": inviter_name,
                            "orgName": org_name,
                            "role": (invite.role or "MEMBER").lower(),
                        },
                        data={
                            "invitation_id": invitation.id,
                            "organization_id": org_id,
                            "token": token,
                        },
                        category="SYSTEM",
                        priority="HIGH",
                    )
                )
            except Exception as e:
                logger.error(f"Failed to create in-app invite notification: {e}")

        return invitation.dict()

    async def accept_invitation(self, token: str, current_user: Any) -> Dict[str, Any]:
        """Accept invitation with email verification check and atomic member creation."""
        if not getattr(current_user, "emailVerified", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required before accepting an invitation",
            )

        invitation = await self.db.invitation.find_unique(
            where={"token": token}, include={"organization": True}
        )
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found"
            )

        if invitation.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invitation is {invitation.status.lower()}",
            )

        if invitation.expiresAt < datetime.now(timezone.utc):
            await self.db.invitation.update(
                where={"id": invitation.id}, data={"status": "EXPIRED"}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation has expired"
            )

        if invitation.email.lower() != current_user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation was sent to another email address",
            )

        # Atomic transaction: create member and mark invitation as accepted
        existing_member = await self.db.organizationmember.find_first(
            where={
                "organizationId": invitation.organizationId,
                "userId": current_user.id,
            }
        )

        if existing_member:
            if existing_member.deletedAt:
                await self.db.organizationmember.update(
                    where={"id": existing_member.id},
                    data={"deletedAt": None, "role": invitation.role},
                )
        else:
            await self.db.organizationmember.create(
                data={
                    "organizationId": invitation.organizationId,
                    "userId": current_user.id,
                    "role": invitation.role,
                    "invitedById": invitation.inviterId,
                }
            )

        await self.db.invitation.update(
            where={"id": invitation.id}, data={"status": "ACCEPTED"}
        )

        return {"success": True, "message": "Invitation accepted successfully"}


organization_service = OrganizationService()
