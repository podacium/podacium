"""
Core KYC Verification Tools: VerifyKycStatusTool.
"""

from typing import Optional, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.core.prisma import prisma


class VerifyKycStatusArgs(BaseModel):
    user_id: Optional[int] = Field(
        default=None, description="Target user ID to check KYC for (admins only)"
    )


class VerifyKycStatusTool(BaseTool):
    name = "verify_kyc_status"
    description = "Check KYC verification and Algerian Auto-Entrepreneur (ANAE) legal compliance status for a user."
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
    args_schema: Type[BaseModel] = VerifyKycStatusArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, VerifyKycStatusArgs)

        target_id = context.user_id
        if typed_args.user_id is not None:
            if typed_args.user_id != context.user_id and not context.has_role("ADMIN"):
                return ToolResult(
                    success=False,
                    error="Only administrators can query KYC for other users",
                )
            target_id = typed_args.user_id

        if not target_id:
            return ToolResult(success=False, error="User context required")

        kyc = await prisma.userkyc.find_unique(where={"userId": target_id})

        if not kyc:
            return ToolResult(
                success=True,
                data={
                    "user_id": target_id,
                    "status": "NOT_SUBMITTED",
                    "is_verified": False,
                    "has_anae_card": False,
                },
                widget_payload={
                    "widgetType": "kyc_status_badge",
                    "status": "NOT_SUBMITTED",
                    "isVerified": False,
                },
            )

        status_str = str(kyc.status)
        is_verified = status_str in ("VERIFIED", "APPROVED")

        return ToolResult(
            success=True,
            data={
                "user_id": target_id,
                "status": status_str,
                "is_verified": is_verified,
                "has_anae_card": bool(kyc.anaeCardNumber),
                "anae_card_number": kyc.anaeCardNumber if is_verified else None,
                "rejection_reason": kyc.rejectionReason,
                "verified_at": kyc.verifiedAt.isoformat() if kyc.verifiedAt else None,
            },
            widget_payload={
                "widgetType": "kyc_status_badge",
                "status": status_str,
                "isVerified": is_verified,
                "hasAnaeCard": bool(kyc.anaeCardNumber),
            },
        )
