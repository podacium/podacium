import logging
from typing import Dict, Any, List, Set

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)


class SkillMatchScorer(BaseScorer):
    weight = 0.35

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        user_skills = await self._get_user_skills(user_id)
        if not user_skills:
            return {c.entity_id: 0.0 for c in candidates}

        scores = {}
        for c in candidates:
            if not c.skills:
                scores[c.entity_id] = 0.0
                continue
            common = user_skills.intersection(c.skills)
            scores[c.entity_id] = len(common) / len(c.skills) if c.skills else 0.0

        context["skill_match_skills"] = user_skills
        return scores

    async def _get_user_skills(self, user_id: int) -> Set[str]:
        skills: Set[str] = set()
        user = await prisma.user.find_unique(where={"id": user_id})
        if user and user.skills:
            skills.update(user.skills)

        user_skills = await prisma.userskill.find_many(where={"userId": user_id})
        for us in user_skills:
            skills.add(us.name)

        enrolled = await prisma.enrollment.find_many(
            where={"userId": user_id},
            include={"module": True},
            take=20,
        )
        for e in enrolled:
            if e.module and e.module.skills:
                skills.update(e.module.skills)

        return skills
