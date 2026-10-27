from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

from app.schemas.auth import UserRole


class CandidateEntity:
    def __init__(
        self,
        entity_id: str,
        entity_type: str,
        title: str = "",
        description: Optional[str] = None,
        action_url: Optional[str] = None,
        skills: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        price: Optional[float] = None,
        instructor_id: Optional[int] = None,
        country: Optional[str] = None,
        level: Optional[str] = None,
        created_at=None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.entity_id = entity_id
        self.entity_type = entity_type
        self.title = title
        self.description = description
        self.action_url = action_url
        self.skills = skills or []
        self.tags = tags or []
        self.price = price
        self.instructor_id = instructor_id
        self.country = country
        self.level = level
        self.created_at = created_at
        self.metadata = metadata or {}


class BaseScorer(ABC):
    weight: float = 1.0

    @abstractmethod
    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]: ...

    def weighted_score(self, raw_scores: Dict[str, float]) -> Dict[str, float]:
        return {eid: s * self.weight for eid, s in raw_scores.items()}
