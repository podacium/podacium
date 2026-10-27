import logging
from typing import Dict, Any, List, Set

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)


class SocialScorer(BaseScorer):
    weight = 0.10

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        followed_users = await self._get_followed_users(user_id)
        if not followed_users:
            return {c.entity_id: 0.0 for c in candidates}

        candidate_ids = {c.entity_id for c in candidates}
        peer_enrollments = await prisma.enrollment.find_many(
            where={"userId": {"in": list(followed_users)}},
            include={"module": True},
            take=100,
        )

        enrolled_set: Set[str] = set()
        for e in peer_enrollments:
            if e.moduleId and e.moduleId in candidate_ids:
                enrolled_set.add(e.moduleId)

        if not enrolled_set:
            return {c.entity_id: 0.0 for c in candidates}

        return {c.entity_id: 1.0 if c.entity_id in enrolled_set else 0.0 for c in candidates}

    async def _get_followed_users(self, user_id: int) -> List[int]:
        follows = await prisma.userfollow.find_many(
            where={"followerId": user_id},
            take=100,
        )
        return [f.followingId for f in follows if f.followingId]
