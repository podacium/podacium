"""
services/api/app/agent/tools/freelance/proposals.py
Tools 11 & 12: Submit bid proposal (HITL) and compare project proposals.
"""

from typing import Any, Dict, List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.services.freelancing_service import FreelanceService
from app.schemas.freelancing import ProposalCreate


class SubmitProposalArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    project_id: int = Field(..., gt=0, description="Target Project ID")
    amount_dzd: int = Field(..., ge=1000, description="Proposed bid amount in DZD")
    message: str = Field(
        ...,
        min_length=20,
        max_length=3000,
        description="Proposal pitch and scope description",
    )


class SubmitProposalTool(BaseTool):
    name = "submit_proposal"
    description = "Submit a formal proposal and bid for an open freelance project. Requires user confirmation."
    domain = ToolDomain.FREELANCE
    access_roles = [UserRole.FREELANCER, UserRole.ADMIN]
    is_mutating = True
    requires_hitl = True
    args_schema = SubmitProposalArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: SubmitProposalArgs = args
        prop_data = ProposalCreate(
            amount=typed_args.amount_dzd,
            message=typed_args.message,
            estimated_days=None,
            certificateId=None,
        )

        res = await FreelanceService.submit_proposal(
            project_id=typed_args.project_id,
            proposal_data=prop_data,
            freelancer_id=context.user_id,
        )

        return ToolResult(
            success=True,
            data={
                "proposal_id": res.get("id"),
                "project_id": typed_args.project_id,
                "amount_dzd": typed_args.amount_dzd,
            },
            widget_payload={
                "type": "ProposalReceipt",
                "proposal_id": res.get("id"),
                "amount_dzd": typed_args.amount_dzd,
            },
        )

    async def rollback(
        self, context: AgentSecurityContext, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        proposal_id = payload.get("proposal_id")
        if proposal_id:
            await FreelanceService.withdraw_proposal(
                proposal_id=proposal_id, freelancer_id=context.user_id
            )
            return {
                "status": "COMPENSATED",
                "message": f"Proposal {proposal_id} withdrawn.",
            }
        return {"status": "NOOP"}


class CompareProjectProposalsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    project_id: int = Field(
        ..., gt=0, description="Project ID to evaluate received bids"
    )
    limit: int = Field(default=20, ge=1, le=50)


class CompareProjectProposalsTool(BaseTool):
    name = "compare_project_proposals"
    description = "Generate a side-by-side comparison matrix of all received bids for a project, ranking price and freelancer ratings."
    domain = ToolDomain.FREELANCE
    access_roles = [UserRole.BUSINESS, UserRole.ADMIN]
    args_schema = CompareProjectProposalsArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: CompareProjectProposalsArgs = args
        res = await FreelanceService.get_project_proposals(
            project_id=typed_args.project_id,
            user_id=context.user_id,
            skip=0,
            limit=typed_args.limit,
        )
        items = res.get("items", [])

        matrix: List[dict[str, Any]] = []
        for p in items:
            f = p.get("freelancer") or {}
            matrix.append(
                {
                    "proposal_id": p.get("id"),
                    "freelancer_id": p.get("freelancerId"),
                    "freelancer_name": f.get("fullName", "Prestataire"),
                    "amount_dzd": p.get("amount"),
                    "rating": f.get("avg_rating", 5.0),
                    "completed_contracts": f.get("completed_projects", 0),
                    "skills": f.get("skills", []),
                }
            )

        matrix.sort(key=lambda x: x["amount_dzd"])

        return ToolResult(
            success=True,
            data={
                "project_id": typed_args.project_id,
                "bids_count": len(matrix),
                "matrix": matrix,
            },
            widget_payload={"type": "FreelancerBidMatrix", "matrix": matrix},
        )
