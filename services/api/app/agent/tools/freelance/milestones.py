"""
services/api/app/agent/tools/freelance/milestones.py
Tools 15 & 16: Submit milestone delivery and approve milestone escrow release (HITL).
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.services.freelancing_service import FreelanceService
from app.core.prisma import prisma
from app.schemas.freelancing import DeliveryCreate


class SubmitMilestoneDeliveryArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    contract_id: int = Field(..., gt=0, description="Contract ID")
    milestone_id: Optional[int] = Field(None, gt=0, description="Target milestone ID")
    description: str = Field(
        ...,
        min_length=15,
        max_length=2000,
        description="Description of delivered assets",
    )
    file_urls: List[str] = Field(
        ..., min_length=1, max_length=20, description="Links to completed files"
    )


class SubmitMilestoneDeliveryTool(BaseTool):
    name = "submit_milestone_work"
    description = (
        "Submit completed deliverables for a contract milestone for client review."
    )
    domain = ToolDomain.FREELANCE
    access_roles = [UserRole.FREELANCER, UserRole.ADMIN]
    is_mutating = True
    args_schema = SubmitMilestoneDeliveryArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: SubmitMilestoneDeliveryArgs = args
        delivery = await FreelanceService.submit_delivery(
            contract_id=typed_args.contract_id,
            delivery_data=DeliveryCreate(
                description=typed_args.description,
                file_urls=typed_args.file_urls,
            ),
            freelancer_id=context.user_id,
        )

        return ToolResult(
            success=True,
            data={
                "delivery_id": delivery.get("id"),
                "contract_id": typed_args.contract_id,
                "files_count": len(typed_args.file_urls),
            },
            widget_payload={
                "type": "DeliveryReceipt",
                "delivery_id": delivery.get("id"),
                "contract_id": typed_args.contract_id,
            },
        )

    async def rollback(
        self, context: AgentSecurityContext, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        delivery_id = payload.get("delivery_id")
        if delivery_id:
            await prisma.delivery.delete(where={"id": delivery_id})
            return {
                "status": "COMPENSATED",
                "message": f"Delivery {delivery_id} deleted.",
            }
        return {"status": "NOOP"}


class ApproveMilestoneArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    contract_id: int = Field(..., gt=0, description="Contract ID")
    milestone_id: int = Field(
        ..., gt=0, description="Milestone ID to approve and release"
    )
    client_feedback: Optional[str] = Field(
        default="Approuvé", description="Approval notes"
    )


class ApproveMilestoneAndReleaseTool(BaseTool):
    name = "approve_milestone_and_release"
    description = "Formally approve a milestone delivery, authorizing the release of escrow funds to the freelancer. Requires client confirmation."
    domain = ToolDomain.FREELANCE
    access_roles = [UserRole.BUSINESS, UserRole.ADMIN]
    is_mutating = True
    requires_hitl = True
    args_schema = ApproveMilestoneArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: ApproveMilestoneArgs = args
        contract = await prisma.contract.find_unique(
            where={"id": typed_args.contract_id},
            include={"milestones": True, "freelancer": True},
        )
        if not contract:
            return ToolResult(
                success=False, error=f"Contract #{typed_args.contract_id} not found."
            )

        # Multi-tenant security check
        if contract.clientId != context.user_id and context.user_role != UserRole.ADMIN:
            return ToolResult(
                success=False,
                error="Unauthorized: You are not the client on this contract.",
            )

        target_milestone = next(
            (m for m in contract.milestones if m.id == typed_args.milestone_id), None
        )
        if not target_milestone:
            return ToolResult(
                success=False,
                error=f"Milestone #{typed_args.milestone_id} not found on contract.",
            )

        # Update milestone status to APPROVED
        await prisma.contractmilestone.update(
            where={"id": typed_args.milestone_id},
            data={"status": "APPROVED", "clientFeedback": typed_args.client_feedback},
        )

        return ToolResult(
            success=True,
            data={
                "contract_id": contract.id,
                "milestone_id": target_milestone.id,
                "status": "APPROVED",
                "amount_dzd": target_milestone.amount,
                "freelancer_name": contract.freelancer.fullName
                if contract.freelancer
                else "Freelancer",
            },
            widget_payload={
                "type": "MilestoneApprovedCard",
                "contract_id": contract.id,
                "milestone_id": target_milestone.id,
                "amount_dzd": target_milestone.amount,
            },
        )

    async def rollback(
        self, context: AgentSecurityContext, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        milestone_id = payload.get("milestone_id")
        if milestone_id:
            await prisma.contractmilestone.update(
                where={"id": milestone_id},
                data={"status": "SUBMITTED", "clientFeedback": None},
            )
            return {
                "status": "COMPENSATED",
                "message": f"Milestone {milestone_id} approval reverted.",
            }
        return {"status": "NOOP"}
