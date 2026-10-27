import logging
from typing import Dict, Any, List
from datetime import datetime, timezone

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)

POPULARITY_DECAY_DAYS = 180


class PopularityScorer(BaseScorer):
    weight = 0.15

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        enroll_counts = await self._get_enrollment_counts(
            [c.entity_id for c in candidates]
        )
        rating_map = await self._get_rating_map([c.entity_id for c in candidates])
        now = datetime.now(timezone.utc)

        max_enrolls = max(enroll_counts.values()) if enroll_counts else 1
        scores = {}
        for c in candidates:
            eid = c.entity_id
            enroll_score = enroll_counts.get(eid, 0) / max_enrolls
            avg_rating, review_count = rating_map.get(eid, (0.0, 0))
            rating_score = (
                (avg_rating / 5.0) * min(review_count / 10, 1.0)
                if review_count > 0
                else 0.0
            )

            recency_score = 0.0
            if c.created_at:
                days_old = (now - c.created_at).days
                if days_old < POPULARITY_DECAY_DAYS:
                    recency_score = 1.0 - (days_old / POPULARITY_DECAY_DAYS)

            scores[eid] = 0.5 * enroll_score + 0.3 * rating_score + 0.2 * recency_score

        max_score = (max(scores.values()) if scores else 1.0) or 1.0
        return {eid: s / max_score for eid, s in scores.items()}

    async def _get_enrollment_counts(self, entity_ids: List[str]) -> Dict[str, int]:
        if not entity_ids:
            return {}
        result = await prisma.enrollment.group_by(
            by=["moduleId"],
            where={"moduleId": {"in": entity_ids}},
            count={"_all": True},
        )
        return {r["moduleId"]: r["_count"]["_all"] for r in result}

    async def _get_rating_map(self, entity_ids: List[str]) -> Dict[str, tuple]:
        if not entity_ids:
            return {}
        result = await prisma.coursereview.group_by(
            by=["moduleId"],
            where={"moduleId": {"in": entity_ids}},
            avg={"rating": True},
            count={"rating": True},
        )
        return {
            r["moduleId"]: (r["_avg"]["rating"] or 0.0, r["_count"]["rating"])
            for r in result
        }
