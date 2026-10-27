import logging
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from asyncio import gather

from app.core.prisma import prisma
from app.schemas.dashboard import (
    DashboardState, ProjectStatus, ProposalSummary,
    ContractSummary, EarningsSummary,
)
from .strategies import DashboardStrategy

logger = logging.getLogger(__name__)


class FreelancerStrategy(DashboardStrategy):
    """Freelancer dashboard — projects, proposals, contracts, earnings."""

    async def load_role_data(self, user_id: int, state: DashboardState) -> DashboardState:
        results = await gather(
            self._get_active_projects(user_id),
            self._get_proposals(user_id),
            self._get_active_contracts(user_id),
            self._get_earnings(user_id),
            return_exceptions=True,
        )
        state.active_projects = results[0] if not isinstance(results[0], Exception) else []
        state.proposals = results[1] if not isinstance(results[1], Exception) else []
        state.active_contracts = results[2] if not isinstance(results[2], Exception) else []
        state.freelance_earnings = results[3] if not isinstance(results[3], Exception) else None
        return state

    async def _get_active_projects(self, user_id: int) -> List[ProjectStatus]:
        contracts = await self._get_cached(
            user_id, "fl_projects", prisma.contract.find_many,
            where={"freelancerId": user_id, "status": "ACTIVE"},
            include={"project": {"include": {"organization": True, "owner": True}}, "client": True},
        ) or []
        projects: List[ProjectStatus] = []
        for c in contracts:
            try:
                client_name = (
                    c.client.fullName if c.client
                    else (c.project.organization.name if c.project and c.project.organization else None)
                )
                projects.append(ProjectStatus(
                    id=c.projectId or 0, title=c.project.title if c.project else "Project",
                    status=c.status or "UNKNOWN", client=client_name, deadline=c.endDate,
                    progress=50, amount=float(c.project.budget or 0) if c.project else 0,
                ))
            except Exception as e:
                logger.warning(f"Skipping active project contract {c.id}: {e}")
        return projects

    async def _get_proposals(self, user_id: int) -> List[ProposalSummary]:
        proposals = await self._get_cached(
            user_id, "fl_proposals", prisma.proposal.find_many,
            where={"freelancerId": user_id},
            include={"project": True},
            order={"createdAt": "desc"}, take=10,
        ) or []
        return [
            ProposalSummary(
                id=p.id, project_title=p.project.title if p.project else "Project",
                status=p.status, amount=float(p.bidAmount or 0),
                submitted_at=p.createdAt,
                client_name=p.project.owner.fullName if p.project and p.project.owner else None,
            )
            for p in proposals
        ]

    async def _get_active_contracts(self, user_id: int) -> List[ContractSummary]:
        contracts = await self._get_cached(
            user_id, "fl_contracts", prisma.contract.find_many,
            where={"freelancerId": user_id, "status": {"in": ["ACTIVE", "IN_PROGRESS"]}},
            include={"project": {"include": {"owner": True}}, "client": True},
            order={"updatedAt": "desc"}, take=10,
        ) or []
        return [
            ContractSummary(
                id=c.id, project_title=c.project.title if c.project else "Project",
                client_name=c.client.fullName if c.client else None,
                status=c.status, amount=float(c.amount or 0),
                start_date=c.startDate or c.createdAt, end_date=c.endDate,
            )
            for c in contracts
        ]

    async def _get_earnings(self, user_id: int) -> Optional[EarningsSummary]:
        now = datetime.now(timezone.utc)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_start = (first_of_month - timedelta(days=1)).replace(day=1)
        contracts = await self._get_cached(
            user_id, "fl_earnings", prisma.contract.find_many,
            where={"freelancerId": user_id, "status": "COMPLETED"},
        ) or []
        total = sum(float(c.amount or 0) for c in contracts)
        this_month = sum(float(c.amount or 0) for c in contracts
                         if c.completedAt and c.completedAt >= first_of_month)
        last_month = sum(float(c.amount or 0) for c in contracts
                         if c.completedAt and last_month_start <= c.completedAt < first_of_month)
        # Pending payments
        pending = await prisma.contract.find_many(
            where={"freelancerId": user_id, "status": "ACTIVE"},
        )
        pending_sum = sum(float(c.amount or 0) for c in pending)
        avg = total / len(contracts) if contracts else 0
        return EarningsSummary(
            total_earned=total, pending_payments=pending_sum,
            this_month=this_month, last_month=last_month,
            average_per_project=avg,
        )

    def _estimate(self, progress: float):
        if progress >= 100:
            return None
        return datetime.now(timezone.utc) + timedelta(days=(100 - progress) / 3.33)
