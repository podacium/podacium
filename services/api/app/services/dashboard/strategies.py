from abc import ABC, abstractmethod
from typing import Dict, List, Any
from datetime import datetime, timezone, timedelta
from asyncio import gather
import logging

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from app.schemas.dashboard import (
    DashboardStats, RecentActivity, DatasetInfo, DashboardState,
)
from app.services.recommendations.engine import recommendation_engine

logger = logging.getLogger(__name__)


class CommonDataMixin:
    """Shared data-loading methods used by all strategies."""

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = 300

    async def _get_cached(self, user_id: int, method: str, query_func, *args, **kwargs):
        cache_key = f"dashboard:{user_id}:{method}"
        if cache_key in self._cache:
            cached_data, timestamp = self._cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=self._cache_ttl):
                return cached_data
        result = await query_func(*args, **kwargs)
        self._cache[cache_key] = (result, datetime.now())
        return result

    async def load_user_stats(self, user_id: int) -> DashboardStats:
        count_results = await gather(
            self._get_cached(user_id, "enroll_all", prisma.enrollment.count, where={"userId": user_id}),
            self._get_cached(user_id, "enroll_comp", prisma.enrollment.count, where={"userId": user_id, "completedAt": {"not": None}}),
            self._get_cached(user_id, "contract_act", prisma.contract.count, where={"OR": [{"freelancerId": user_id}, {"clientId": user_id}], "status": "ACTIVE"}),
            self._get_cached(user_id, "contract_comp", prisma.contract.count, where={"OR": [{"freelancerId": user_id}, {"clientId": user_id}], "status": "COMPLETED"}),
            self._get_cached(user_id, "datasets", prisma.dataset.count, where={"userId": user_id}),
            self._get_cached(user_id, "earnings", prisma.contract.find_many, where={"freelancerId": user_id, "status": "COMPLETED"}),
            return_exceptions=True,
        )
        total_courses = count_results[0] if isinstance(count_results[0], int) else 0
        completed_courses = count_results[1] if isinstance(count_results[1], int) else 0
        active_projects = count_results[2] if isinstance(count_results[2], int) else 0
        completed_projects = count_results[3] if isinstance(count_results[3], int) else 0
        dataset_count = count_results[4] if isinstance(count_results[4], int) else 0
        completed_contracts = count_results[5]
        total_earnings = 0
        if completed_contracts and not isinstance(completed_contracts, Exception):
            total_earnings = sum(c.amount or 0 for c in completed_contracts)
        total_activities = total_courses + completed_projects
        if total_activities == 0:
            skill_level = "Beginner"
        elif total_activities < 5:
            skill_level = "Intermediate"
        elif total_activities < 15:
            skill_level = "Advanced"
        else:
            skill_level = "Expert"
        return DashboardStats(
            total_courses=total_courses, completed_courses=completed_courses,
            active_projects=active_projects, completed_projects=completed_projects,
            datasets_count=dataset_count, certifications_count=0,
            total_earnings=total_earnings, skill_level=skill_level,
        )

    async def load_recent_activities(self, user_id: int) -> List[RecentActivity]:
        activities: List[RecentActivity] = []
        completions = await self._get_cached(
            user_id, "act_courses", prisma.enrollment.find_many,
            where={"userId": user_id, "completedAt": {"not": None}},
            include={"module": True}, take=5, order={"completedAt": "desc"},
        ) or []
        for c in completions:
            activities.append(RecentActivity(
                id=c.id, type="course_completed",
                title=c.module.title if c.module else "Course",
                description=f"Completed {c.module.title}" if c.module else "Completed course",
                timestamp=c.completedAt or datetime.now(timezone.utc),
                metadata={"module_id": c.moduleId},
            ))
        contracts = await self._get_cached(
            user_id, "act_projects", prisma.contract.find_many,
            where={"OR": [{"freelancerId": user_id}, {"clientId": user_id}]},
            include={"project": True}, take=5, order={"updatedAt": "desc"},
        ) or []
        for c in contracts:
            atype = "project_started" if c.status == "ACTIVE" else "project_updated"
            activities.append(RecentActivity(
                id=c.id, type=atype,
                title=c.project.title if c.project else "Project",
                description=f"Project status: {c.status}",
                timestamp=c.updatedAt,
                metadata={"project_id": c.projectId, "status": c.status},
            ))
        activities.sort(key=lambda x: x.timestamp, reverse=True)
        return activities[:10]

    async def load_skill_breakdown(self, user_id: int) -> Dict[str, float]:
        user_skills = await self._get_cached(
            user_id, "skills", prisma.userskill.find_many, where={"userId": user_id},
        ) or []
        completed = await self._get_cached(
            user_id, "skills_enroll", prisma.enrollment.find_many,
            where={"userId": user_id, "completedAt": {"not": None}},
            include={"module": True},
        ) or []
        levels: Dict[str, float] = {}
        for s in user_skills:
            levels[s.name] = levels.get(s.name, 0) + 30
        for e in completed:
            if e.module and getattr(e.module, "skills", None):
                for sk in e.module.skills:
                    levels[sk] = levels.get(sk, 0) + 20
        if levels:
            mx = max(levels.values())
            levels = {s: (v / mx * 100) for s, v in levels.items()}
        return levels

    async def load_recommendations(self, user_id: int) -> List[Dict[str, Any]]:
        try:
            enrolled = await self._get_cached(
                user_id, "rec_enrolled", prisma.enrollment.find_many,
                where={"userId": user_id},
                include={"module": True},
            ) or []
            enrolled_ids = {e.moduleId for e in enrolled if e.moduleId}
            return await recommendation_engine.recommend(
                user_id=user_id,
                role=self._role,
                limit=5,
                exclude_ids=list(enrolled_ids),
            )
        except Exception as e:
            logger.warning(f"Recommendations failed for user={user_id}: {e}")
            return []

    async def load_datasets(self, user_id: int) -> List[DatasetInfo]:
        datasets = await self._get_cached(
            user_id, "ds", prisma.dataset.find_many,
            where={"userId": user_id}, take=5, order={"updatedAt": "desc"},
        ) or []
        results = []
        for d in datasets:
            try:
                results.append(DatasetInfo(
                    id=d.id, name=d.name, size=self._format_size(d.fileSize or 0),
                    last_accessed=d.updatedAt or d.createdAt or datetime.now(timezone.utc),
                    record_count=len(d.previewRows or []) if d.previewRows else 0,
                    processing_status=d.processingStatus or "UNKNOWN",
                ))
            except Exception as e:
                logger.warning(f"Skipping dataset {d.id}: {e}")
        return results

    def _format_size(self, size_bytes: int) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"


class DashboardStrategy(ABC, CommonDataMixin):
    """Abstract base for role-specific dashboard data loading."""

    def __init__(self, role: UserRole = UserRole.STUDENT):
        CommonDataMixin.__init__(self)
        self._role = role

    @abstractmethod
    async def load_role_data(self, user_id: int, state: DashboardState) -> DashboardState:
        """Populate role-specific fields on the state."""

    async def load_common(self, user_id: int, state: DashboardState) -> DashboardState:
        state.user_stats = await self.load_user_stats(user_id)
        state.recent_activities = await self.load_recent_activities(user_id)
        state.skill_breakdown = await self.load_skill_breakdown(user_id)
        state.recommendations = await self.load_recommendations(user_id)
        state.datasets = await self.load_datasets(user_id)
        return state


_strategy_cache: Dict[UserRole, 'DashboardStrategy'] = {}

def get_strategy(role: UserRole) -> 'DashboardStrategy':
    if role in _strategy_cache:
        return _strategy_cache[role]

    from .student import StudentStrategy
    from .freelancer import FreelancerStrategy
    from .company import CompanyStrategy
    from .admin import AdminStrategy

    mapping = {
        UserRole.STUDENT: (StudentStrategy, UserRole.STUDENT),
        UserRole.FREELANCER: (FreelancerStrategy, UserRole.FREELANCER),
        UserRole.BUSINESS: (CompanyStrategy, UserRole.BUSINESS),
        UserRole.ADMIN: (AdminStrategy, UserRole.ADMIN),
        UserRole.INSTRUCTOR: (StudentStrategy, UserRole.INSTRUCTOR),
    }
    cls, mapped_role = mapping.get(role, (StudentStrategy, UserRole.STUDENT))
    instance = cls(role=mapped_role)
    _strategy_cache[role] = instance
    return instance
