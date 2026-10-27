import logging
from typing import Dict, Any, List, Optional, Set

from app.core.prisma import prisma
from app.schemas.auth import UserRole
from app.services.recommendations.scorers.base import BaseScorer, CandidateEntity
from app.services.recommendations.scorers.skill_match import SkillMatchScorer
from app.services.recommendations.scorers.skill_gap import SkillGapScorer
from app.services.recommendations.scorers.collab_filter import (
    CollaborativeFilteringScorer,
)
from app.services.recommendations.scorers.geo_loc import GeoLocScorer
from app.services.recommendations.scorers.trending_scorer import TrendingScorer
from app.services.recommendations.scorers.popularity import PopularityScorer
from app.services.recommendations.scorers.price_scorer import PriceScorer
from app.services.recommendations.scorers.social import SocialScorer
from app.services.recommendations.scorers.cross_pillar import CrossPillarScorer
from app.services.recommendations.tracker import recommendation_tracker

logger = logging.getLogger(__name__)

DIVERSITY_PENALTY = 0.15


class ScorerConfig:
    __slots__ = ("scorer", "weight", "name")

    def __init__(self, scorer: BaseScorer, weight: float, name: str):
        self.scorer = scorer
        self.weight = weight
        self.name = name


ROLE_SCORERS: Dict[UserRole, List[ScorerConfig]] = {
    UserRole.STUDENT: [
        ScorerConfig(SkillGapScorer(), 0.25, "skill_gap"),
        ScorerConfig(SkillMatchScorer(), 0.20, "skill_match"),
        ScorerConfig(CollaborativeFilteringScorer(), 0.15, "collab_filter"),
        ScorerConfig(PopularityScorer(), 0.12, "popularity"),
        ScorerConfig(CrossPillarScorer(), 0.10, "cross_pillar"),
        ScorerConfig(TrendingScorer(), 0.08, "trending"),
        ScorerConfig(GeoLocScorer(), 0.05, "geo_loc"),
        ScorerConfig(SocialScorer(), 0.03, "social"),
        ScorerConfig(PriceScorer(), 0.02, "price_match"),
    ],
    UserRole.INSTRUCTOR: [
        ScorerConfig(SkillGapScorer(), 0.20, "skill_gap"),
        ScorerConfig(SkillMatchScorer(), 0.20, "skill_match"),
        ScorerConfig(PopularityScorer(), 0.18, "popularity"),
        ScorerConfig(TrendingScorer(), 0.15, "trending"),
        ScorerConfig(CollaborativeFilteringScorer(), 0.10, "collab_filter"),
        ScorerConfig(GeoLocScorer(), 0.08, "geo_loc"),
        ScorerConfig(SocialScorer(), 0.05, "social"),
        ScorerConfig(CrossPillarScorer(), 0.04, "cross_pillar"),
    ],
    UserRole.FREELANCER: [
        ScorerConfig(SkillGapScorer(), 0.25, "skill_gap"),
        ScorerConfig(SkillMatchScorer(), 0.20, "skill_match"),
        ScorerConfig(CrossPillarScorer(), 0.18, "cross_pillar"),
        ScorerConfig(PopularityScorer(), 0.12, "popularity"),
        ScorerConfig(TrendingScorer(), 0.10, "trending"),
        ScorerConfig(GeoLocScorer(), 0.08, "geo_loc"),
        ScorerConfig(SocialScorer(), 0.05, "social"),
        ScorerConfig(PriceScorer(), 0.02, "price_match"),
    ],
    UserRole.BUSINESS: [
        ScorerConfig(SkillGapScorer(), 0.22, "skill_gap"),
        ScorerConfig(PopularityScorer(), 0.18, "popularity"),
        ScorerConfig(CrossPillarScorer(), 0.16, "cross_pillar"),
        ScorerConfig(TrendingScorer(), 0.14, "trending"),
        ScorerConfig(SkillMatchScorer(), 0.12, "skill_match"),
        ScorerConfig(CollaborativeFilteringScorer(), 0.10, "collab_filter"),
        ScorerConfig(GeoLocScorer(), 0.05, "geo_loc"),
        ScorerConfig(PriceScorer(), 0.03, "price_match"),
    ],
}


class RecommendationOrchestrator:
    def __init__(self):
        pass

    async def recommend(
        self,
        user_id: int,
        role: UserRole,
        limit: int = 5,
        exclude_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        candidates = await self._fetch_candidates(user_id, role, exclude_ids)
        if not candidates:
            return []

        context: Dict[str, Any] = {}
        scorers = ROLE_SCORERS.get(role, ROLE_SCORERS[UserRole.STUDENT])

        all_scores: Dict[str, float] = {c.entity_id: 0.0 for c in candidates}
        scorer_names: Dict[str, str] = {}

        for cfg in scorers:
            try:
                raw = await cfg.scorer.score(user_id, role, candidates, context)
            except Exception as e:
                logger.warning(f"Scorer '{cfg.name}' failed for user={user_id}: {e}")
                continue
            for c in candidates:
                eid = c.entity_id
                score = raw.get(eid, 0.0) * cfg.weight
                all_scores[eid] += round(score, 4)
                if score > 0 and eid not in scorer_names:
                    scorer_names[eid] = cfg.name

        top_entities = self._rank_with_diversity(
            candidates, all_scores, scorer_names, limit
        )

        results = []
        for rank, entity in enumerate(top_entities):
            eid = entity.entity_id
            score = round(all_scores.get(eid, 0.0), 3)
            reason_type = scorer_names.get(eid, "default")
            results.append(
                {
                    "id": eid,
                    "type": entity.entity_type,
                    "title": entity.title,
                    "description": entity.description or "",
                    "reason": self._build_reason(reason_type, context, entity),
                    "reason_type": reason_type,
                    "action_url": entity.action_url or f"/learn/courses/{eid}",
                    "score": score,
                }
            )
            try:
                await recommendation_tracker.log_impression(
                    user_id=user_id,
                    entity_id=eid,
                    entity_type=entity.entity_type,
                    role=role.value,
                    score=score,
                    reason_type=reason_type,
                    rank=rank,
                )
            except Exception:
                pass

        return results

    def _rank_with_diversity(
        self,
        candidates: List[CandidateEntity],
        scores: Dict[str, float],
        scorer_names: Dict[str, str],
        limit: int,
    ) -> List[CandidateEntity]:
        sorted_candidates = sorted(
            candidates, key=lambda c: scores.get(c.entity_id, 0.0), reverse=True
        )
        selected: List[CandidateEntity] = []
        seen_types: Set[str] = set()
        seen_scorers: Set[str] = set()

        for c in sorted_candidates:
            if len(selected) >= limit:
                break
            eid = c.entity_id
            penalty = 0.0
            if c.entity_type in seen_types:
                penalty += DIVERSITY_PENALTY
            name = scorer_names.get(eid, "")
            if name in seen_scorers:
                penalty += DIVERSITY_PENALTY * 0.5
            adjusted = scores.get(eid, 0.0) - penalty
            if adjusted > 0 or not selected:
                selected.append(c)
                seen_types.add(c.entity_type)
                if name:
                    seen_scorers.add(name)
            else:
                for alt in sorted_candidates:
                    if alt.entity_id not in {s.entity_id for s in selected}:
                        selected.append(alt)
                        break

        return selected[:limit]

    async def _fetch_candidates(
        self,
        user_id: int,
        role: UserRole,
        exclude_ids: Optional[List[str]] = None,
    ) -> List[CandidateEntity]:
        exclude = set(exclude_ids or [])
        enrolled = await prisma.enrollment.find_many(
            where={"userId": user_id},
            take=100,
        )
        exclude.update(e.moduleId for e in enrolled if e.moduleId)
        exclude.update(str(e.pathId) for e in enrolled if e.pathId)

        module_tasks = [self._fetch_modules(user_id, exclude)]
        project_task = (
            self._fetch_projects(user_id, exclude)
            if role != UserRole.BUSINESS
            else None
        )

        candidates = await module_tasks[0]
        if project_task:
            projects = await project_task
            candidates.extend(projects)

        return candidates

    async def _fetch_modules(self, user_id: int, exclude: set) -> List[CandidateEntity]:
        where: Dict[str, Any] = {"deletedAt": None, "status": "PUBLISHED"}
        if exclude:
            where["id"] = {"notIn": list(exclude)}
        modules = await prisma.module.find_many(
            where=where,
            take=60,
            order={"createdAt": "desc"},
        )
        return [
            CandidateEntity(
                entity_id=m.id,
                entity_type="course",
                title=m.title,
                description=m.description,
                action_url=f"/learn/courses/{m.id}",
                skills=m.skills or [],
                tags=m.tags or [],
                level=m.level,
                created_at=m.createdAt,
            )
            for m in modules
            if m
        ]

    async def _fetch_projects(
        self, user_id: int, exclude: set
    ) -> List[CandidateEntity]:
        ex_ids = [int(x) for x in exclude if x.isdigit()]
        where: Dict[str, Any] = {"deletedAt": None, "status": "OPEN"}
        if ex_ids:
            where["id"] = {"notIn": ex_ids}
        projects = await prisma.project.find_many(
            where=where,
            take=30,
            order={"createdAt": "desc"},
        )
        return [
            CandidateEntity(
                entity_id=str(p.id),
                entity_type="project",
                title=p.title,
                description=p.description,
                action_url=f"/projects/{p.id}",
                skills=p.skills or [],
                level=p.status,
                created_at=p.createdAt,
            )
            for p in projects
            if p
        ]

    def _build_reason(
        self,
        top_scorer: Optional[str],
        context: Dict[str, Any],
        entity: CandidateEntity,
    ) -> str:
        if top_scorer == "skill_gap":
            gaps = context.get("skill_gap_skills", [])
            if gaps:
                shown = gaps[:2]
                rest = len(gaps) - 2
                suffix = f" +{rest} more" if rest > 0 else ""
                return f"Fill your skill gap — learn {', '.join(shown)}{suffix}"
            return "Bridges your skill gaps"
        elif top_scorer == "skill_match":
            skills = entity.skills[:3] if entity.skills else []
            if skills:
                return f"Master {', '.join(skills)} — top match for your skills"
            return "Strong match for your profile"
        elif top_scorer == "collab_filter":
            return "Popular among learners with similar goals"
        elif top_scorer == "popularity":
            return "Most popular among Podacium learners"
        elif top_scorer == "cross_pillar":
            if entity.entity_type == "project":
                return "Apply your course skills to real projects"
            return "Complement your professional experience"
        elif top_scorer == "trending":
            return "Trending now in your field"
        elif top_scorer == "geo_loc":
            country = context.get("user_country", "")
            if country:
                return f"Popular in {country}"
            return "Trending in your region"
        elif top_scorer == "social":
            return "Recommended by people you follow"
        elif top_scorer == "price_match":
            return "Fits your budget"
        return "Recommended for you"


recommendation_engine = RecommendationOrchestrator()
