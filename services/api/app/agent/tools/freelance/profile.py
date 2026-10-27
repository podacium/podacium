"""
services/api/app/agent/tools/freelance/profile.py
Tool 10: Get freelancer profile, Skill Passport credentials, and Law 22-23 verification.
"""

from typing import Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.services.freelancing_service import FreelanceService
from app.core.prisma import prisma


class GetFreelancerProfileArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    freelancer_id: int = Field(..., gt=0, description="User ID of the freelancer")


class GetFreelancerProfileTool(BaseTool):
    name = "get_freelancer_profile"
    description = "Fetch comprehensive freelancer profile with Law 22-23 Auto-Entrepreneur status, completed contracts, rating, and verified skills."
    domain = ToolDomain.FREELANCE
    access_roles = [
        UserRole.STUDENT,
        UserRole.BUSINESS,
        UserRole.FREELANCER,
        UserRole.ADMIN,
        UserRole.INSTRUCTOR,
        UserRole.MODERATOR,
    ]
    args_schema = GetFreelancerProfileArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: GetFreelancerProfileArgs = args
        profile = await FreelanceService.get_freelancer_profile(
            user_id=typed_args.freelancer_id
        )

        # Query Law 22-23 Auto-Entrepreneur compliance
        fp = await prisma.freelancerprofile.find_unique(
            where={"userId": typed_args.freelancer_id}
        )

        anae_registered = bool(fp and fp.isAnaeRegistered)
        passport_verified = bool(fp and fp.skillPassportVerified)

        data = {
            "freelancer_id": typed_args.freelancer_id,
            "full_name": profile.get("fullName"),
            "role": profile.get("role"),
            "skills": profile.get("skills", []),
            "avg_rating": profile.get("avg_rating"),
            "completed_projects": profile.get("completed_projects", 0),
            "is_anae_registered": anae_registered,
            "skill_passport_verified": passport_verified,
        }

        return ToolResult(
            success=True,
            data=data,
            widget_payload={"type": "FreelancerProfileCard", "profile": data},
        )
