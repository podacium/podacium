import logging
from typing import Dict, Any, List, Set

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from .base import BaseScorer, CandidateEntity

logger = logging.getLogger(__name__)

CAREER_PATH_SKILLS: Dict[str, Set[str]] = {
    "data_scientist": {
        "python",
        "sql",
        "machine learning",
        "statistics",
        "deep learning",
        "data visualization",
        "big data",
        "nlp",
        "feature engineering",
    },
    "data_analyst": {
        "sql",
        "excel",
        "python",
        "data visualization",
        "statistics",
        "tableau",
        "power bi",
        "cleaning",
    },
    "web_developer": {
        "javascript",
        "html",
        "css",
        "react",
        "node.js",
        "typescript",
        "database",
        "git",
        "rest api",
    },
    "mobile_developer": {
        "kotlin",
        "swift",
        "react native",
        "flutter",
        "firebase",
        "rest api",
        "git",
    },
    "devops_engineer": {
        "docker",
        "kubernetes",
        "ci/cd",
        "terraform",
        "aws",
        "linux",
        "python",
        "git",
        "monitoring",
    },
    "backend_developer": {
        "python",
        "java",
        "node.js",
        "sql",
        "rest api",
        "docker",
        "git",
        "database design",
        "authentication",
    },
    "frontend_developer": {
        "javascript",
        "typescript",
        "react",
        "css",
        "html",
        "responsive design",
        "accessibility",
        "git",
    },
    "fullstack_developer": {
        "javascript",
        "typescript",
        "react",
        "node.js",
        "sql",
        "html",
        "css",
        "git",
        "rest api",
        "database design",
    },
    "ml_engineer": {
        "python",
        "machine learning",
        "deep learning",
        "sql",
        "docker",
        "mlops",
        "tensorflow",
        "pytorch",
        "feature engineering",
    },
    "freelancer_digital": {
        "python",
        "javascript",
        "react",
        "node.js",
        "sql",
        "git",
        "responsive design",
        "wordpress",
        "seo",
    },
    "business_analyst": {
        "sql",
        "excel",
        "data visualization",
        "statistics",
        "requirements gathering",
        "process modeling",
        "tableau",
    },
    "ai_specialist": {
        "python",
        "machine learning",
        "deep learning",
        "nlp",
        "computer vision",
        "llm",
        "rag",
        "tensorflow",
        "pytorch",
    },
}


class SkillGapScorer(BaseScorer):
    weight = 0.25

    async def score(
        self,
        user_id: int,
        role: UserRole,
        candidates: List[CandidateEntity],
        context: Dict[str, Any],
    ) -> Dict[str, float]:
        user_skills = await self._get_user_skills(user_id)
        target_skills = await self._get_target_skills(user_id, role)
        if not target_skills:
            return {c.entity_id: 0.0 for c in candidates}

        gap_skills = target_skills - user_skills
        if not gap_skills:
            return {c.entity_id: 0.0 for c in candidates}

        context["skill_gap_skills"] = list(gap_skills)

        scores = {}
        for c in candidates:
            if not c.skills:
                scores[c.entity_id] = 0.0
                continue
            gap_overlap = len(gap_skills & set(c.skills))
            scores[c.entity_id] = (
                gap_overlap / len(gap_skills) if gap_overlap > 0 else 0.0
            )
            if gap_overlap > 0:
                scores[c.entity_id] *= 1.5

        max_score = (max(scores.values()) if scores else 1.0) or 1.0
        return {eid: s / max_score for eid, s in scores.items()}

    async def _get_user_skills(self, user_id: int) -> Set[str]:
        skills: Set[str] = set()
        user = await prisma.user.find_unique(where={"id": user_id})
        if user and user.skills:
            skills.update(user.skills)
        user_skills = await prisma.userskill.find_many(where={"userId": user_id})
        for us in user_skills:
            skills.add(us.name.lower())
        enrolled = await prisma.enrollment.find_many(
            where={"userId": user_id},
            include={"module": True},
        )
        for e in enrolled:
            if e.module and e.module.skills:
                for s in e.module.skills:
                    skills.add(s.lower() if e.completedAt else s.lower())
        return skills

    async def _get_target_skills(self, user_id: int, role: UserRole) -> Set[str]:
        target: Set[str] = set()

        profile = await prisma.studentprofile.find_unique(where={"userId": user_id})
        if profile:
            if profile.careerPath:
                key = profile.careerPath.lower().replace(" ", "_").replace("-", "_")
                if key in CAREER_PATH_SKILLS:
                    target.update(CAREER_PATH_SKILLS[key])
                    logger.info(
                        f"Career path '{profile.careerPath}' mapped to {len(CAREER_PATH_SKILLS[key])} target skills"
                    )
            if profile.learningGoals:
                goal_skills = self._extract_skills_from_text(profile.learningGoals)
                target.update(goal_skills)
            if profile.wishlist:
                wish_modules = await prisma.module.find_many(
                    where={"id": {"in": [str(w) for w in profile.wishlist]}},
                )
                for m in wish_modules:
                    if m and m.skills:
                        target.update(m.skills)

        if role == UserRole.FREELANCER:
            proposals = await prisma.proposal.find_many(
                where={"freelancerId": user_id},
                include={"project": True},
                take=20,
            )
            for p in proposals:
                if p.project and p.project.skills:
                    target.update(p.project.skills)

        business = await prisma.businessprofile.find_unique(where={"userId": user_id})
        if business and business.areasOfExpertise:
            target.update(business.areasOfExpertise)

        onboarding = await prisma.onboardinganswer.find_many(
            where={"userId": user_id},
            take=5,
        )
        for o in onboarding:
            if o.fieldOfInterest:
                target.add(o.fieldOfInterest.lower())
            if o.primaryGoal:
                goal_skills = self._extract_skills_from_text(o.primaryGoal)
                target.update(goal_skills)

        return {s.lower() for s in target if s}

    def _extract_skills_from_text(self, text: str) -> Set[str]:
        if not text:
            return set()
        known_skills = set()
        for skill_set in CAREER_PATH_SKILLS.values():
            known_skills.update(skill_set)
        lower = text.lower()
        found: Set[str] = set()
        for skill in known_skills:
            if skill in lower:
                found.add(skill)
        return found
