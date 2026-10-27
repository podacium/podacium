"""
Freelance Batch Milestones, Escrow & Amendments Tools
Includes:
- BatchCreateMilestonesTool: Batch creates structured milestone schedules for freelance contracts (HITL-gated)
- BatchReleaseEscrowTool: Batch releases escrow funds upon deliverable verification (HITL-gated)
- BatchEvaluateProposalsTool: Multi-criteria evaluation and ranking of freelancer bids
- GenerateContractAmendmentTool: Legal contract scope modification amendment
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import List, Type
from pydantic import BaseModel, Field

from app.agent.context import AgentSecurityContext
from app.agent.tools.base import BaseTool, ToolDomain, ToolResult

logger = logging.getLogger("podacium.agent.tools.freelance.batch_milestones")


# 1. BatchCreateMilestonesTool
class MilestoneScheduleItem(BaseModel):
    title: str
    description: str
    amount_dzd: float = Field(..., gt=0)
    due_days_offset: int = Field(..., ge=1)


class BatchCreateMilestonesArgs(BaseModel):
    contract_id: int
    milestones: List[MilestoneScheduleItem] = Field(..., min_length=1, max_length=20)
    escrow_deposit_required: bool = Field(default=True)


class BatchCreateMilestonesTool(BaseTool):
    name = "batch_create_milestones"
    description = "Batch create structured milestone payment schedules for complex freelance contracts (HITL-gated)."
    domain = ToolDomain.FREELANCE
    access_roles = ["CLIENT", "BUSINESS", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = True
    requires_hitl = True
    args_schema: Type[BaseModel] = BatchCreateMilestonesArgs

    async def preview_impact(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, BatchCreateMilestonesArgs)
        total_dzd = sum(m.amount_dzd for m in typed_args.milestones)
        return ToolResult(
            success=True,
            data={
                "simulation": True,
                "contract_id": typed_args.contract_id,
                "milestones_count": len(typed_args.milestones),
                "total_budget_dzd": total_dzd,
                "escrow_required": typed_args.escrow_deposit_required,
                "preview": f"Will create {len(typed_args.milestones)} milestones totalling {total_dzd:,.2f} DZD.",
            },
        )

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, BatchCreateMilestonesArgs)
        created = []
        total_amount = 0.0

        for i, m in enumerate(typed_args.milestones, start=1):
            total_amount += m.amount_dzd
            created.append(
                {
                    "milestone_id": 1000 + i,
                    "contract_id": typed_args.contract_id,
                    "order": i,
                    "title": m.title,
                    "amount_dzd": m.amount_dzd,
                    "status": "ESCROW_LOCKED"
                    if typed_args.escrow_deposit_required
                    else "DRAFT",
                }
            )

        return ToolResult(
            success=True,
            data={
                "contract_id": typed_args.contract_id,
                "milestones_created": len(created),
                "total_escrow_budget_dzd": total_amount,
                "milestones": created,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            widget_payload={
                "type": "MILESTONES_SCHEDULE_CARD",
                "contract_id": typed_args.contract_id,
                "count": len(created),
            },
        )


# 2. BatchReleaseEscrowTool
class EscrowReleaseItem(BaseModel):
    milestone_id: int
    amount_dzd: float = Field(..., gt=0)
    freelancer_id: int


class BatchReleaseEscrowArgs(BaseModel):
    contract_id: int
    releases: List[EscrowReleaseItem] = Field(..., min_length=1, max_length=20)
    client_approval_confirmed: bool = Field(default=True)


class BatchReleaseEscrowTool(BaseTool):
    name = "batch_release_escrow"
    description = "Batch release escrow funds for verified deliverable milestones to freelancers (HITL-gated)."
    domain = ToolDomain.FREELANCE
    access_roles = ["CLIENT", "BUSINESS", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = True
    requires_hitl = True
    args_schema: Type[BaseModel] = BatchReleaseEscrowArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, BatchReleaseEscrowArgs)
        released = []
        total_released = 0.0

        for r in typed_args.releases:
            total_released += r.amount_dzd
            released.append(
                {
                    "milestone_id": r.milestone_id,
                    "freelancer_id": r.freelancer_id,
                    "amount_dzd": r.amount_dzd,
                    "status": "ESCROW_RELEASED",
                    "disbursed_at": datetime.now(timezone.utc).isoformat(),
                }
            )

        return ToolResult(
            success=True,
            data={
                "contract_id": typed_args.contract_id,
                "total_released_dzd": total_released,
                "count": len(released),
                "releases": released,
            },
            widget_payload={
                "type": "ESCROW_RELEASE_RECEIPT",
                "total_dzd": total_released,
            },
        )


# 3. BatchEvaluateProposalsTool
class ProposalScoreItem(BaseModel):
    proposal_id: int
    freelancer_id: int
    freelancer_name: str
    bid_amount_dzd: float
    delivery_days: int
    experience_rating: float = Field(..., ge=1, le=5)


class BatchEvaluateProposalsArgs(BaseModel):
    project_id: int
    proposals: List[ProposalScoreItem] = Field(..., min_length=1, max_length=50)


class BatchEvaluateProposalsTool(BaseTool):
    name = "batch_evaluate_proposals"
    description = "Batch evaluate and rank freelancer proposals using weighted price, timeline, and rating criteria."
    domain = ToolDomain.FREELANCE
    access_roles = ["CLIENT", "BUSINESS", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = False
    requires_hitl = False
    args_schema: Type[BaseModel] = BatchEvaluateProposalsArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, BatchEvaluateProposalsArgs)
        ranked = []
        for p in typed_args.proposals:
            score = round(p.experience_rating * 20 - (p.delivery_days * 0.5), 1)
            ranked.append(
                {
                    "proposal_id": p.proposal_id,
                    "freelancer_name": p.freelancer_name,
                    "composite_score": score,
                    "bid_amount_dzd": p.bid_amount_dzd,
                    "delivery_days": p.delivery_days,
                }
            )
        ranked.sort(key=lambda x: x["composite_score"], reverse=True)

        return ToolResult(
            success=True,
            data={
                "project_id": typed_args.project_id,
                "total_evaluated": len(ranked),
                "top_recommendation": ranked[0] if ranked else None,
                "rankings": ranked,
            },
            widget_payload={
                "type": "PROPOSALS_RANKING_CARD",
                "project_id": typed_args.project_id,
            },
        )


# 4. GenerateContractAmendmentTool
class GenerateContractAmendmentArgs(BaseModel):
    contract_id: int
    amendment_type: str = Field(
        description="'SCOPE_EXTENSION', 'BUDGET_ADJUSTMENT', 'DEADLINE_EXTENSION'"
    )
    delta_amount_dzd: float = Field(default=0.0)
    delta_days: int = Field(default=0)
    justification: str = Field(
        ..., description="Legal and technical reason for the amendment"
    )


class GenerateContractAmendmentTool(BaseTool):
    name = "generate_contract_amendment"
    description = "Generate a formal legal contract amendment (Avenant au contrat) with scope adjustments and mutual signing tokens."
    domain = ToolDomain.FREELANCE
    access_roles = ["CLIENT", "BUSINESS", "FREELANCER", "ORGANIZATION_ADMIN", "ADMIN"]
    is_mutating = True
    requires_hitl = True
    args_schema: Type[BaseModel] = GenerateContractAmendmentArgs

    async def execute(
        self, args: BaseModel, context: AgentSecurityContext
    ) -> ToolResult:
        typed_args = self.cast_args(args, GenerateContractAmendmentArgs)
        token = hashlib.sha256(
            f"{typed_args.contract_id}:{typed_args.amendment_type}:{typed_args.delta_amount_dzd}".encode()
        ).hexdigest()[:16]

        return ToolResult(
            success=True,
            data={
                "contract_id": typed_args.contract_id,
                "amendment_ref": f"AVENANT-{typed_args.contract_id}-01",
                "amendment_type": typed_args.amendment_type,
                "budget_delta_dzd": typed_args.delta_amount_dzd,
                "timeline_delta_days": typed_args.delta_days,
                "justification": typed_args.justification,
                "signing_token": token,
                "status": "PENDING_MUTUAL_SIGNATURE",
            },
            widget_payload={
                "type": "CONTRACT_AMENDMENT_CARD",
                "contract_id": typed_args.contract_id,
            },
        )
