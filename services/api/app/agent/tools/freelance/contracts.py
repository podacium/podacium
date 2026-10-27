"""
services/api/app/agent/tools/freelance/contracts.py
Tools 13 & 14: Accept proposal (HITL) and get freelance contracts.
"""

from typing import Optional, Any, Dict, List
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserRole

from app.agent.tools.base import BaseTool, ToolDomain, ToolResult
from app.agent.context import AgentSecurityContext
from app.services.freelancing_service import FreelanceService
from app.core.prisma import prisma
from app.schemas.freelancing import ContractStatus


class AcceptProposalArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    proposal_id: int = Field(..., gt=0, description="Proposal ID to accept")


class AcceptProposalTool(BaseTool):
    name = "accept_proposal"
    description = "Accept a freelancer's proposal, binding the project into an active contract with milestone escrows. Requires client confirmation."
    domain = ToolDomain.FREELANCE
    access_roles = [UserRole.BUSINESS, UserRole.ADMIN]
    is_mutating = True
    requires_hitl = True
    args_schema = AcceptProposalArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: AcceptProposalArgs = args
        contract = await FreelanceService.accept_proposal(
            proposal_id=typed_args.proposal_id, client_id=context.user_id
        )

        return ToolResult(
            success=True,
            data={
                "contract_id": contract.get("id"),
                "project_id": contract.get("projectId"),
                "status": contract.get("status"),
                "amount_dzd": contract.get("amount"),
            },
            widget_payload={"type": "ContractCreatedCard", "contract": contract},
        )

    async def rollback(
        self, context: AgentSecurityContext, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        contract_id = payload.get("contract_id")
        if contract_id:
            await prisma.contract.update(
                where={"id": contract_id}, data={"status": "CANCELLED"}
            )
            return {
                "status": "COMPENSATED",
                "message": f"Contract {contract_id} cancelled.",
            }
        return {"status": "NOOP"}


class GetContractsArgs(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: Optional[str] = Field(
        None, description="Contract status filter (ACTIVE, COMPLETED, CANCELLED)"
    )
    role: Optional[str] = Field(None, description="Filter by 'client' or 'freelancer'")
    limit: int = Field(default=20, ge=1, le=50)


class GetContractsTool(BaseTool):
    name = "get_my_freelance_contracts"
    description = "Retrieve active and past freelance contracts for the current user, detailing milestones, counterparty, and amounts."
    domain = ToolDomain.FREELANCE
    access_roles = [
        UserRole.STUDENT,
        UserRole.BUSINESS,
        UserRole.FREELANCER,
        UserRole.ADMIN,
    ]
    args_schema = GetContractsArgs

    async def execute(self, args: Any, context: AgentSecurityContext) -> ToolResult:
        typed_args: GetContractsArgs = args
        res = await FreelanceService.get_user_contracts(
            user_id=context.user_id,
            status=ContractStatus(typed_args.status) if typed_args.status else None,
            role=typed_args.role,
            skip=0,
            limit=typed_args.limit,
        )

        contracts: List[dict[str, Any]] = [
            {
                "id": c.get("id"),
                "title": c.get("project", {}).get("title")
                if c.get("project")
                else f"Contrat #{c.get('id')}",
                "amount_dzd": c.get("amount"),
                "status": c.get("status"),
                "client_name": c.get("client", {}).get("fullName")
                if c.get("client")
                else None,
                "freelancer_name": c.get("freelancer", {}).get("fullName")
                if c.get("freelancer")
                else None,
            }
            for c in res.get("items", [])
        ]

        return ToolResult(
            success=True,
            data={"total": res.get("total", 0), "contracts": contracts},
            widget_payload={"type": "ContractsList", "contracts": contracts},
        )
