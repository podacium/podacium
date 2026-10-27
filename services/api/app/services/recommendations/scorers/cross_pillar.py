import logging
from typing import Dict, Any, List, Set

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)


class CrossPillarScorer(BaseScorer):
    weight = 0.20

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        if role == UserRole.STUDENT:
            return await self._score_projects_to_student(user_id, candidates, context)
        elif role == UserRole.FREELANCER:
            return await self._score_courses_to_freelancer(user_id, candidates, context)
        elif role == UserRole.BUSINESS:
            return await self._score_datasets_to_business(user_id, candidates, context)
        return {c.entity_id: 0.0 for c in candidates}

    async def _score_projects_to_student(
        self, user_id: int, candidates: List[CandidateEntity], context: Dict[str, Any]
    ) -> Dict[str, float]:
        user_skills = await self._get_user_skills(user_id)
        if not user_skills:
            return {c.entity_id: 0.0 for c in candidates}

        projects = await prisma.project.find_many(
            where={"status": "OPEN", "deletedAt": None},
            take=30,
        )
        project_skills: Dict[str, Set[str]] = {}
        for p in projects:
            if p.id and p.skills:
                project_skills[str(p.id)] = set(p.skills)

        candidate_ids = {c.entity_id for c in candidates}
        if not candidate_ids:
            return {c.entity_id: 0.0 for c in candidates}

        scores = {}
        for eid in candidate_ids:
            ps = project_skills.get(eid, set())
            if not ps:
                scores[eid] = 0.0
                continue
            overlap = len(user_skills & ps)
            scores[eid] = overlap / len(ps) if ps else 0.0

        max_score = (max(scores.values()) if scores else 1.0) or 1.0
        return {eid: s / max_score for eid, s in scores.items()}

    async def _score_courses_to_freelancer(
        self, user_id: int, candidates: List[CandidateEntity], context: Dict[str, Any]
    ) -> Dict[str, float]:
        profile = await prisma.freelancerprofile.find_unique(
            where={"userId": user_id},
            include={"user": True},
        )
        if not profile:
            return {c.entity_id: 0.0 for c in candidates}

        user_skills: Set[str] = set()
        if profile.user and profile.user.skills:
            user_skills.update(profile.user.skills)
            user_skills.add(profile.tier.name.lower())

        proposals = await prisma.proposal.find_many(
            where={"freelancerId": user_id},
            include={"project": True},
            take=20,
        )
        for p in proposals:
            if p.project and p.project.skills:
                user_skills.update(p.project.skills)

        if not user_skills:
            return {c.entity_id: 0.0 for c in candidates}

        scores = {}
        for c in candidates:
            if not c.skills:
                scores[c.entity_id] = 0.0
                continue
            overlap = len(user_skills & set(c.skills))
            scores[c.entity_id] = overlap / len(c.skills) if c.skills else 0.0

        max_score = (max(scores.values()) if scores else 1.0) or 1.0
        return {eid: s / max_score for eid, s in scores.items()}

    async def _score_datasets_to_business(
        self, user_id: int, candidates: List[CandidateEntity], context: Dict[str, Any]
    ) -> Dict[str, float]:
        user = await prisma.user.find_unique(
            where={"id": user_id},
            include={"businessProfile": True},
        )
        if not user:
            return {c.entity_id: 0.0 for c in candidates}

        user_tags: Set[str] = set()
        biz = getattr(user, "businessProfile", None) or getattr(
            user, "business_profile", None
        )
        if biz:
            if getattr(biz, "industry", None):
                user_tags.add(biz.industry.lower())
            if getattr(biz, "areasOfExpertise", None):
                user_tags.update(e.lower() for e in biz.areasOfExpertise if e)

        scores = {}
        for c in candidates:
            if c.tags:
                overlap = len(user_tags & set(t.lower() for t in c.tags))
                scores[c.entity_id] = overlap / len(c.tags) if c.tags else 0.0
            else:
                scores[c.entity_id] = 0.0

        max_score = (max(scores.values()) if scores else 1.0) or 1.0
        return {eid: s / max_score for eid, s in scores.items()}

    async def _get_user_skills(self, user_id: int) -> Set[str]:
        skills: Set[str] = set()
        user = await prisma.user.find_unique(where={"id": user_id})
        if user and user.skills:
            skills.update(user.skills)
        enrolled = await prisma.enrollment.find_many(
            where={"userId": user_id},
            include={"module": True},
            take=30,
        )
        for e in enrolled:
            if e.module and e.module.skills:
                skills.update(e.module.skills)
        user_skills = await prisma.userskill.find_many(where={"userId": user_id})
        for us in user_skills:
            skills.add(us.name)
        return skills
