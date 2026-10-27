"""
Core Profile Tools: GetMyProfileTool, UpdateProfileSettingsTool.
"""

from typing import List, Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma


class GetMyProfileArgs(BaseModel):
    pass


class GetMyProfileTool(BaseTool):
    name = "get_my_profile"
    description = "Retrieve the authenticated user's profile details, role, skills, and organization affiliation."
    domain = ToolDomain.CORE
    access_roles = [
        "USER",
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = GetMyProfileArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        user = await prisma.user.find_unique(
            where={"id": user_id},
            include={
                "wallet": True,
                "primaryOrganization": True,
                "ownedOrganizations": True,
                "memberships": {"include": {"organization": True}},
                "kyc": True,
            },
        )
        if not user or user.deletedAt is not None:
            return ToolResult(success=False, error="User profile not found")

        org_name = None
        if user.primaryOrganization:
            org_name = user.primaryOrganization.name
        elif getattr(user, "ownedOrganizations", None):
            org_name = user.ownedOrganizations[0].name
        elif (
            user.memberships
            and len(user.memberships) > 0
            and user.memberships[0].organization
        ):
            org_name = user.memberships[0].organization.name

        data = {
            "id": user.id,
            "full_name": user.fullName,
            "email": user.email,
            "username": user.username,
            "role": str(user.role),
            "headline": user.headline,
            "bio": user.bio,
            "skills": user.skills,
            "availability": user.availability,
            "organization": org_name,
            "kyc_status": str(user.kyc.status) if user.kyc else "NOT_SUBMITTED",
            "wallet_id": user.wallet.id if user.wallet else None,
        }

        return ToolResult(
            success=True,
            data=data,
            widget_payload={
                "widgetType": "user_profile_card",
                "userId": user.id,
                "fullName": user.fullName,
                "role": str(user.role),
                "headline": user.headline,
                "skills": user.skills,
            },
        )


class UpdateProfileSettingsArgs(BaseModel):
    headline: Optional[str] = Field(
        default=None, max_length=120, description="Short professional headline"
    )
    bio: Optional[str] = Field(
        default=None, max_length=1000, description="Detailed profile biography"
    )
    skills: Optional[List[str]] = Field(
        default=None, description="Updated list of professional skills"
    )
    availability: Optional[str] = Field(
        default=None, description="AVAILABLE, BUSY, or AWAY"
    )


class UpdateProfileSettingsTool(BaseTool):
    name = "update_profile_settings"
    description = (
        "Update the authenticated user's headline, bio, skills, or availability status."
    )
    domain = ToolDomain.CORE
    access_roles = [
        "USER",
        "STUDENT",
        "INSTRUCTOR",
        "FREELANCER",
        "CLIENT",
        "ORGANIZATION_MEMBER",
        "ORGANIZATION_ADMIN",
        "ADMIN",
    ]
    is_mutating = True
    requires_hitl = False
    args_schema: Type[BaseModel] = UpdateProfileSettingsArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, UpdateProfileSettingsArgs)

        user_id = context.user_id
        if not user_id:
            return ToolResult(success=False, error="User context required")

        previous_user = await prisma.user.find_unique(where={"id": user_id})
        if not previous_user:
            return ToolResult(success=False, error="User not found")

        update_data = {}
        if typed_args.headline is not None:
            update_data["headline"] = typed_args.headline
        if typed_args.bio is not None:
            update_data["bio"] = typed_args.bio
        if typed_args.skills is not None:
            update_data["skills"] = typed_args.skills
        if typed_args.availability is not None:
            update_data["availability"] = typed_args.availability

        if not update_data:
            return ToolResult(success=False, error="No update fields provided")

        updated_user = await prisma.user.update(
            where={"id": user_id},
            data=update_data,
        )

        async def rollback_profile() -> bool:
            try:
                restore_data = {
                    "headline": previous_user.headline,
                    "bio": previous_user.bio,
                    "skills": previous_user.skills,
                    "availability": previous_user.availability,
                }
                await prisma.user.update(where={"id": user_id}, data=restore_data)
                return True
            except Exception:
                return False

        return ToolResult(
            success=True,
            data={
                "user_id": updated_user.id,
                "headline": updated_user.headline,
                "bio": updated_user.bio,
                "skills": updated_user.skills,
                "availability": updated_user.availability,
            },
            widget_payload={
                "widgetType": "profile_updated_card",
                "userId": updated_user.id,
                "headline": updated_user.headline,
                "skills": updated_user.skills,
            },
            compensating_action=rollback_profile,
        )
