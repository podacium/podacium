import logging
from typing import Dict, Any, List, Optional

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)


class PriceScorer(BaseScorer):
    weight = 0.10

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        price_tier = await self._get_user_price_tier(user_id)
        if price_tier is None:
            return {c.entity_id: 0.3 for c in candidates}

        scores = {}
        for c in candidates:
            if c.price is None or c.price <= 0:
                scores[c.entity_id] = 0.8
            elif c.price <= price_tier * 1.5:
                scores[c.entity_id] = 1.0
            elif c.price <= price_tier * 3:
                scores[c.entity_id] = 0.5
            else:
                scores[c.entity_id] = 0.1

        return scores

    async def _get_user_price_tier(self, user_id: int) -> Optional[float]:
        transactions = await prisma.transaction.find_many(
            where={"userId": user_id, "status": "COMPLETED"},
            order={"createdAt": "desc"},
            take=10,
        )
        if transactions:
            amounts = [t.amount for t in transactions if t.amount]
            if amounts:
                return sum(amounts) / len(amounts)

        profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
        if profile and profile.totalLearningHours and profile.totalLearningHours > 0:
            return 5000.0

        return None
