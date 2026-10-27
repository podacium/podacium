import logging
from typing import Dict, Any, List

from app.schemas.auth import UserRole
from app.services.trending_service import trending_service
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)


class TrendingScorer(BaseScorer):
    weight = 0.15

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        entity_type = self._entity_type_for_role(role)
        if not entity_type:
            return {c.entity_id: 0.0 for c in candidates}

        try:
            scores = await trending_service.get_trending(entity_type, limit=50)
            trending_map = {s["entity_id"]: s["score"] for s in scores}
        except Exception as e:
            logger.warning(f"Trending service unavailable: {e}")
            trending_map = {}

        max_score = (max(trending_map.values()) if trending_map else 1.0) or 1.0
        return {
            c.entity_id: trending_map.get(c.entity_id, 0.0) / max_score
            for c in candidates
        }

    def _entity_type_for_role(self, role: UserRole) -> str:
        mapping = {
            UserRole.STUDENT: "course",
            UserRole.INSTRUCTOR: "course",
            UserRole.FREELANCER: "project",
            UserRole.BUSINESS: "course",
        }
        return mapping.get(role, "course")
