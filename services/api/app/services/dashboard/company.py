import logging
from typing import List
from asyncio import gather

from app.core.prisma import prisma
from app.schemas.dashboard import (
    DashboardState, JobListingSummary,
)
from .strategies import DashboardStrategy

logger = logging.getLogger(__name__)


class CompanyStrategy(DashboardStrategy):
    """Business/company dashboard — job listings, applicants, hires, team."""

    async def load_role_data(self, user_id: int, state: DashboardState) -> DashboardState:
        results = await gather(
            self._get_job_listings(user_id),
            self._count_applications(user_id),
            self._count_hires(user_id),
            self._count_team_members(user_id),
            return_exceptions=True,
        )
        state.job_listings = results[0] if not isinstance(results[0], Exception) else []
        state.total_applications = results[1] if isinstance(results[1], int) else 0
        state.total_hires = results[2] if isinstance(results[2], int) else 0
        state.team_members = results[3] if isinstance(results[3], int) else 0
        return state

    async def _get_job_listings(self, user_id: int) -> List[JobListingSummary]:
        projects = await self._get_cached(
            user_id, "biz_listings", prisma.project.find_many,
            where={"ownerId": user_id},
            order={"createdAt": "desc"}, take=10,
        ) or []
        proposal_counts: dict[int, int] = {}
        if projects:
            grouped = await prisma.proposal.group_by(
                by=["projectId"],
                where={"projectId": {"in": [p.id for p in projects]}},
                count={"_all": True},
            )
            proposal_counts = {r["projectId"]: r["_count"]["_all"] for r in grouped}
        return [
            JobListingSummary(
                id=p.id, title=p.title,
                applicants_count=proposal_counts.get(p.id, 0),
                status="ACTIVE" if p.status == "OPEN" else p.status,
                created_at=p.createdAt,
                budget_range=f"${p.budgetMin or 0}-${p.budgetMax or 0}" if hasattr(p, "budgetMin") else None,
            )
            for p in projects
        ]

    async def _count_applications(self, user_id: int) -> int:
        return await prisma.proposal.count(
            where={"project": {"ownerId": user_id}},
        )

    async def _count_hires(self, user_id: int) -> int:
        return await prisma.contract.count(
            where={"clientId": user_id, "status": "ACTIVE"},
        )

    async def _count_team_members(self, user_id: int) -> int:
        # The client does not support `_count` includes; count members per
        # organization the user belongs to.
        memberships = await prisma.organizationmember.find_many(
            where={"userId": user_id},
        )
        org_ids = [m.organizationId for m in memberships if m.organizationId]
        if not org_ids:
            return 0
        grouped = await prisma.organizationmember.group_by(
            by=["organizationId"],
            where={"organizationId": {"in": org_ids}},
            count={"_all": True},
        )
        return sum(row["_count"]["_all"] for row in grouped)
