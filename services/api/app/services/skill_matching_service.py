import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
import asyncio

from app.core.prisma import prisma
from app.services.category_definitions import CATEGORY_KEYWORDS

logger = logging.getLogger(__name__)


def _normalize_skills(skills: List[str]) -> List[str]:
    return [s.strip().lower() for s in skills if s and s.strip()]


def _compute_skill_overlap(skills_a: List[str], skills_b: List[str]) -> float:
    a = set(_normalize_skills(skills_a))
    b = set(_normalize_skills(skills_b))
    if not a or not b:
        return 0.0
    intersection = a & b
    union = a | b
    return len(intersection) / len(union)


def _infer_categories(skills: List[str]) -> set:
    normalized = _normalize_skills(skills)
    matched = set()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if any(kw in s for s in normalized):
                matched.add(cat)
                break
    return matched


def _compute_category_match(freelancer_skills: List[str], project_skills: List[str]) -> float:
    freelancer_cats = _infer_categories(freelancer_skills)
    project_cats = _infer_categories(project_skills)
    if not freelancer_cats or not project_cats:
        return 0.5
    overlap = freelancer_cats & project_cats
    if overlap:
        return 1.0
    return 0.3


class SkillMatchingService:

    @staticmethod
    async def get_recommended_projects(
        user_id: int,
        limit: int = 10,
        skill_weight: float = 0.40,
        category_weight: float = 0.15,
        budget_weight: float = 0.15,
        applied_penalty_weight: float = 0.20,
        recency_weight: float = 0.10,
    ) -> Dict[str, Any]:
        """Score OPEN projects by match with a freelancer's profile."""
        try:
            user = await prisma.user.find_unique(
                where={"id": user_id},
                include={"freelancerProfile": True}
            )
            if not user:
                return {"projects": [], "total": 0}

            freelancer_skills = list(user.skills) if user.skills else []
            if not freelancer_skills:
                return {"projects": [], "total": 0, "reason": "No skills on profile"}

            profile_metadata = {}
            if user.freelancerProfile and user.freelancerProfile.metadata:
                if isinstance(user.freelancerProfile.metadata, dict):
                    profile_metadata = user.freelancerProfile.metadata

            hourly_rate = profile_metadata.get('hourly_rate') or profile_metadata.get('hourlyRate')

            projects = await prisma.project.find_many(
                where={
                    "status": "OPEN",
                    "deletedAt": None,
                },
                take=200,
                order={"createdAt": "desc"},
            )

            if not projects:
                return {"projects": [], "total": 0}

            project_ids = [p.id for p in projects]

            proposals_task = prisma.proposal.find_many(
                where={
                    "freelancerId": user_id,
                    "projectId": {"in": project_ids},
                }
            )

            proposals_result = await proposals_task
            applied_project_ids = {p.projectId for p in proposals_result}

            now = datetime.now(timezone.utc)

            scored = []
            for project in projects:
                project_skills = list(project.skills) if project.skills else []

                skill_overlap = _compute_skill_overlap(freelancer_skills, project_skills)
                if skill_overlap == 0.0:
                    continue

                category_match = _compute_category_match(freelancer_skills, project_skills)

                if hourly_rate is not None and project.budget:
                    estimated_cost = hourly_rate * 40
                    if estimated_cost <= project.budget:
                        budget_score = 1.0
                    elif estimated_cost <= project.budget * 2:
                        budget_score = 0.5
                    else:
                        budget_score = 0.2
                else:
                    budget_score = 0.5

                already_applied = project.id in applied_project_ids
                applied_score = 0.0 if already_applied else 1.0

                days_old = (now - project.createdAt).days if project.createdAt else 30
                recency_score = max(0.0, 1.0 - (days_old / 60))

                total_score = (
                    skill_overlap * skill_weight
                    + category_match * category_weight
                    + budget_score * budget_weight
                    + applied_score * applied_penalty_weight
                    + recency_score * recency_weight
                )

                owner_info = None
                if project.owner:
                    owner_info = {
                        "id": project.owner.id,
                        "fullName": project.owner.fullName,
                        "profilePictureUrl": project.owner.profilePictureUrl,
                    }

                scored.append({
                    "id": project.id,
                    "title": project.title,
                    "description": project.description,
                    "skills": project_skills,
                    "budget": project.budget,
                    "currency": project.currency,
                    "status": project.status,
                    "createdAt": project.createdAt.isoformat() if project.createdAt else None,
                    "owner": owner_info,
                    "match_score": round(total_score, 4),
                    "match_breakdown": {
                        "skill_overlap": round(skill_overlap, 4),
                        "category_match": round(category_match, 4),
                        "budget_compatibility": round(budget_score, 4),
                        "already_applied": already_applied,
                        "recency": round(recency_score, 4),
                    },
                })

            scored.sort(key=lambda x: x["match_score"], reverse=True)

            return {
                "projects": scored[:limit],
                "total": len(scored),
                "limit": limit,
            }

        except Exception as e:
            logger.error(f"Error in get_recommended_projects: {str(e)}", exc_info=True)
            return {"projects": [], "total": 0, "error": str(e)}

    @staticmethod
    async def get_suggested_freelancers(
        project_id: int,
        limit: int = 5,
        skill_weight: float = 0.40,
        category_weight: float = 0.15,
        rating_weight: float = 0.20,
        experience_weight: float = 0.15,
        portfolio_weight: float = 0.10,
    ) -> Dict[str, Any]:
        """Find best-matching freelancers for a project."""
        try:
            project = await prisma.project.find_unique(
                where={"id": project_id},
            )
            if not project:
                return {"freelancers": [], "total": 0, "error": "Project not found"}

            project_skills = list(project.skills) if project.skills else []
            if not project_skills:
                return {"freelancers": [], "total": 0, "reason": "No skills on project"}

            users = await prisma.user.find_many(
                where={
                    "role": {"in": ["FREELANCER", "INSTRUCTOR", "ADMIN", "STUDENT"]},
                    "isActive": True,
                    "deletedAt": None,
                    "skills": {"hasSome": project_skills[:10]},
                },
                take=100,
            )

            if not users:
                return {"freelancers": [], "total": 0}

            user_ids = [u.id for u in users]

            certificates_task = prisma.certificate.group_by(
                by=["userId"],
                where={"userId": {"in": user_ids}},
                count={"id": True},
            )
            completed_contracts_task = prisma.contract.group_by(
                by=["freelancerId"],
                where={
                    "freelancerId": {"in": user_ids},
                    "status": "COMPLETED",
                },
                count={"id": True},
            )
            profiles_task = prisma.freelancerprofile.find_many(
                where={"userId": {"in": user_ids}},
            )

            certificates_result, contracts_result, profiles_result = await asyncio.gather(
                certificates_task, completed_contracts_task, profiles_task,
            )

            certificate_counts = {item["userId"]: item["_count"]["id"] for item in certificates_result}
            completed_counts = {item["freelancerId"]: item["_count"]["id"] for item in contracts_result}

            if user_ids:
                rating_rows = await prisma.query_raw(
                    "SELECT \"targetId\", AVG(\"rating\")::float AS avg_rating FROM \"ContractReview\" WHERE \"targetId\" = ANY($1::int[]) AND \"status\" = 'ACTIVE' GROUP BY \"targetId\"",
                    user_ids
                )
                avg_ratings = {row["targetId"]: row["avg_rating"] for row in rating_rows}
            else:
                avg_ratings = {}

            profile_map = {}
            for p in profiles_result:
                profile_map[p.userId] = p

            scored = []
            for user in users:
                freelancer_skills = list(user.skills) if user.skills else []

                skill_overlap = _compute_skill_overlap(freelancer_skills, project_skills)
                if skill_overlap == 0.0:
                    continue

                category_match = _compute_category_match(freelancer_skills, project_skills)

                avg_rating = avg_ratings.get(user.id)
                if avg_rating:
                    rating_score = float(avg_rating) / 5.0
                else:
                    rating_score = 0.3

                completed_projects = completed_counts.get(user.id, 0)
                experience_score = min(1.0, completed_projects / 20)

                certificates_count = certificate_counts.get(user.id, 0)
                portfolio_score = 1.0 if certificates_count > 0 else 0.0

                total_score = (
                    skill_overlap * skill_weight
                    + category_match * category_weight
                    + rating_score * rating_weight
                    + experience_score * experience_weight
                    + portfolio_score * portfolio_weight
                )

                scored.append({
                    "id": user.id,
                    "fullName": user.fullName,
                    "bio": user.bio,
                    "profilePictureUrl": user.profilePictureUrl,
                    "skills": freelancer_skills,
                    "city": user.city,
                    "country": user.country,
                    "phoneVerified": user.phoneVerified,
                    "certificates_count": certificates_count,
                    "completed_projects": completed_projects,
                    "avg_rating": round(float(avg_rating), 2) if avg_rating else None,
                    "match_score": round(total_score, 4),
                    "match_breakdown": {
                        "skill_overlap": round(skill_overlap, 4),
                        "category_match": round(category_match, 4),
                        "rating": round(rating_score, 4),
                        "experience": round(experience_score, 4),
                        "portfolio": round(portfolio_score, 4),
                    },
                })

            scored.sort(key=lambda x: x["match_score"], reverse=True)

            return {
                "freelancers": scored[:limit],
                "total": len(scored),
                "limit": limit,
            }

        except Exception as e:
            logger.error(f"Error in get_suggested_freelancers: {str(e)}", exc_info=True)
            return {"freelancers": [], "total": 0, "error": str(e)}
