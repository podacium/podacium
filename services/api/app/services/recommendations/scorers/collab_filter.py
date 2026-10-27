import logging
from typing import Dict, Any, List, Set, Counter

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)


class CollaborativeFilteringScorer(BaseScorer):
    weight = 0.20

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        enrolled_ids = await self._get_user_enrolled_ids(user_id)
        if not enrolled_ids:
            return {c.entity_id: 0.0 for c in candidates}

        similar_users = await self._find_similar_users(user_id, enrolled_ids)
        if not similar_users:
            return {c.entity_id: 0.0 for c in candidates}

        peer_enrollments = await prisma.enrollment.find_many(
            where={
                "userId": {"in": list(similar_users.keys())},
                "moduleId": {"notIn": list(enrolled_ids), "not": None},
            },
            include={"module": True},
        )

        candidate_ids = {c.entity_id for c in candidates}
        peer_counts: Counter[str] = Counter()
        {c.entity_id: c for c in candidates}

        for e in peer_enrollments:
            if e.moduleId in candidate_ids:
                weight = similar_users.get(e.userId, 1.0)
                peer_counts[e.moduleId] += weight

        if not peer_counts:
            return {c.entity_id: 0.0 for c in candidates}

        max_count = max(peer_counts.values())
        return {
            c.entity_id: peer_counts.get(c.entity_id, 0) / max_count
            for c in candidates
        }

    async def _get_user_enrolled_ids(self, user_id: int) -> Set[str]:
        enrollments = await prisma.enrollment.find_many(
            where={"userId": user_id},
            take=100,
        )
        return {e.moduleId for e in enrollments if e.moduleId}

    async def _find_similar_users(
        self, user_id: int, enrolled_ids: Set[str]
    ) -> Dict[int, float]:
        if not enrolled_ids:
            return {}

        peers = await prisma.enrollment.find_many(
            where={
                "moduleId": {"in": list(enrolled_ids)},
                "userId": {"not": user_id},
            },
        )

        user_scores: Dict[int, float] = {}
        for e in peers:
            user_scores.setdefault(e.userId, 0.0)
            user_scores[e.userId] += 1.0 / len(enrolled_ids)

        return dict(sorted(user_scores.items(), key=lambda x: -x[1])[:20])
