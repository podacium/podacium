import logging
from typing import Dict, Any, List

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)


class GeoLocScorer(BaseScorer):
    weight = 0.10

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            return {c.entity_id: 0.0 for c in candidates}

        user_country = user.country
        if not user_country:
            return {c.entity_id: 0.0 for c in candidates}

        scores = {}
        for c in candidates:
            score = 0.0
            if c.country == user_country:
                score = 1.0
            elif c.country:
                score = 0.3
            else:
                score = 0.1
            scores[c.entity_id] = score

        context["user_country"] = user_country
        return scores
