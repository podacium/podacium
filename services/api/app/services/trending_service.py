import logging
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis

from app.core.config import setting
from app.core.prisma import prisma

logger = logging.getLogger(__name__)

TRENDING_CACHE_PREFIX = "trending:"
TRENDING_INTERACTION_PREFIX = "trending:interaction:"
DEFAULT_CACHE_TTL = 3600
DEFAULT_INTERACTION_TTL = 86400 * 30

SCORE_WEIGHTS = {
    "recent_views": 0.35,
    "recent_engagement": 0.25,
    "rating_weight": 0.20,
    "recency_bonus": 0.20,
}

RECENCY_DAYS = 90


class TrendingService:
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        if self._connected and self._redis:
            return self._redis
        if not setting.REDIS_URL:
            return None
        try:
            self._redis = aioredis.from_url(
                setting.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
                max_connections=50,
            )
            await self._redis.ping()
            self._connected = True
            logger.info("TrendingService Redis connected")
            return self._redis
        except Exception as e:
            logger.warning(f"TrendingService Redis unavailable: {e}")
            self._redis = None
            self._connected = False
            return None

    async def record_interaction(
        self, entity_type: str, entity_id: int, interaction_type: str
    ) -> None:
        key = (
            f"{TRENDING_INTERACTION_PREFIX}{entity_type}:{entity_id}:{interaction_type}"
        )
        redis = await self._get_redis()
        if redis:
            try:
                await redis.incr(key)
                await redis.expire(key, DEFAULT_INTERACTION_TTL)
            except Exception as e:
                logger.debug(f"Failed to record interaction: {e}")

    async def _get_interaction_count(
        self, entity_type: str, entity_id: int, interaction_type: str
    ) -> int:
        key = (
            f"{TRENDING_INTERACTION_PREFIX}{entity_type}:{entity_id}:{interaction_type}"
        )
        redis = await self._get_redis()
        if redis:
            try:
                val = await redis.get(key)
                return int(val) if val else 0
            except Exception:
                pass
        return 0

    async def _compute_course_scores(self) -> Dict[str, float]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=RECENCY_DAYS)
        modules = await prisma.module.find_many(
            where={"deletedAt": None},
            include={
                "enrollments": True,
                "reviews": True,
            },
        )
        scores: Dict[str, float] = {}
        now = datetime.now(timezone.utc)

        for m in modules:
            entity_id = m.id
            enrollments = m.enrollments or []
            reviews = m.reviews or []

            recent_enrollments = [
                e for e in enrollments if e.createdAt and e.createdAt >= cutoff
            ]
            recent_views = len(recent_enrollments)

            recent_engagement = len(enrollments)

            avg_rating = 0.0
            if reviews:
                avg_rating = sum(r.rating for r in reviews if r.rating) / len(reviews)
            rating_weight = avg_rating / 5.0

            created_at = m.createdAt or now
            days_old = max(0, (now - created_at).days)
            recency_bonus = max(0, 1.0 - (days_old / 365))

            max_views = await self._get_max_views("course")
            max_engagement = await self._get_max_engagement("course")
            normalized_views = recent_views / max_views if max_views > 0 else 0
            normalized_engagement = (
                recent_engagement / max_engagement if max_engagement > 0 else 0
            )

            score = (
                SCORE_WEIGHTS["recent_views"] * normalized_views
                + SCORE_WEIGHTS["recent_engagement"] * normalized_engagement
                + SCORE_WEIGHTS["rating_weight"] * rating_weight
                + SCORE_WEIGHTS["recency_bonus"] * recency_bonus
            )
            scores[entity_id] = round(score, 4)

        return scores

    async def _compute_project_scores(self) -> Dict[str, float]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=RECENCY_DAYS)
        projects = await prisma.project.find_many(
            where={"deletedAt": None},
            include={
                "proposals": True,
                "contracts": True,
            },
        )
        scores: Dict[str, float] = {}
        now = datetime.now(timezone.utc)

        for p in projects:
            entity_id = str(p.id)
            proposals = p.proposals or []
            contracts = p.contracts or []

            recent_proposals = [
                pr for pr in proposals if pr.createdAt and pr.createdAt >= cutoff
            ]
            recent_views = len(recent_proposals)

            recent_engagement = len(contracts) + len(proposals)

            rating_weight = 0.5

            created_at = p.createdAt or now
            days_old = max(0, (now - created_at).days)
            recency_bonus = max(0, 1.0 - (days_old / 365))

            max_views = await self._get_max_views("project")
            max_engagement = await self._get_max_engagement("project")
            normalized_views = recent_views / max_views if max_views > 0 else 0
            normalized_engagement = (
                recent_engagement / max_engagement if max_engagement > 0 else 0
            )

            score = (
                SCORE_WEIGHTS["recent_views"] * normalized_views
                + SCORE_WEIGHTS["recent_engagement"] * normalized_engagement
                + SCORE_WEIGHTS["rating_weight"] * rating_weight
                + SCORE_WEIGHTS["recency_bonus"] * recency_bonus
            )
            scores[entity_id] = round(score, 4)

        return scores

    async def _compute_freelancer_scores(self) -> Dict[str, float]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=RECENCY_DAYS)
        freelancers = await prisma.freelancerprofile.find_many(
            include={
                "user": True,
                "contracts": {
                    "include": {"reviews": True},
                },
            },
        )
        scores: Dict[str, float] = {}
        now = datetime.now(timezone.utc)

        for fp in freelancers:
            entity_id = str(fp.userId)
            contracts = fp.contracts or []

            recent_contracts = [
                c for c in contracts if c.createdAt and c.createdAt >= cutoff
            ]
            recent_views = len(recent_contracts)
            recent_engagement = fp.completedProjects or 0

            all_ratings = []
            for c in contracts:
                if c.reviews:
                    for r in c.reviews:
                        if r.rating:
                            all_ratings.append(r.rating)
            avg_rating = sum(all_ratings) / len(all_ratings) if all_ratings else 0
            rating_weight = avg_rating / 5.0

            created_at = fp.createdAt or now
            days_old = max(0, (now - created_at).days)
            recency_bonus = max(0, 1.0 - (days_old / 365))

            max_views = await self._get_max_views("freelancer")
            max_engagement = await self._get_max_engagement("freelancer")
            normalized_views = recent_views / max_views if max_views > 0 else 0
            normalized_engagement = (
                recent_engagement / max_engagement if max_engagement > 0 else 0
            )

            score = (
                SCORE_WEIGHTS["recent_views"] * normalized_views
                + SCORE_WEIGHTS["recent_engagement"] * normalized_engagement
                + SCORE_WEIGHTS["rating_weight"] * rating_weight
                + SCORE_WEIGHTS["recency_bonus"] * recency_bonus
            )
            scores[entity_id] = round(score, 4)

        return scores

    async def _get_max_views(self, entity_type: str) -> int:
        cache_key = f"{TRENDING_CACHE_PREFIX}max_views:{entity_type}"
        redis = await self._get_redis()
        if redis:
            try:
                val = await redis.get(cache_key)
                if val is not None:
                    return int(val)
            except Exception:
                pass
        return 1

    async def _get_max_engagement(self, entity_type: str) -> int:
        cache_key = f"{TRENDING_CACHE_PREFIX}max_engagement:{entity_type}"
        redis = await self._get_redis()
        if redis:
            try:
                val = await redis.get(cache_key)
                if val is not None:
                    return int(val)
            except Exception:
                pass
        return 1

    async def calculate_trending(self, entity_type: str) -> Dict[str, float]:
        if entity_type == "course":
            scores = await self._compute_course_scores()
        elif entity_type == "project":
            scores = await self._compute_project_scores()
        elif entity_type == "freelancer":
            scores = await self._compute_freelancer_scores()
        else:
            raise ValueError(f"Unknown entity_type: {entity_type}")

        await self._cache_scores(entity_type, scores)
        logger.info(f"Calculated trending for {entity_type}: {len(scores)} items")
        return scores

    async def _cache_scores(self, entity_type: str, scores: Dict[str, float]) -> None:
        redis = await self._get_redis()
        if not redis:
            return
        cache_key = f"{TRENDING_CACHE_PREFIX}{entity_type}"
        try:
            await redis.setex(cache_key, DEFAULT_CACHE_TTL, json.dumps(scores))
        except Exception as e:
            logger.warning(f"Failed to cache trending scores: {e}")

    async def get_trending(
        self, entity_type: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        redis = await self._get_redis()
        scores: Dict[str, float] = {}

        if redis:
            cache_key = f"{TRENDING_CACHE_PREFIX}{entity_type}"
            try:
                cached = await redis.get(cache_key)
                if cached:
                    scores = json.loads(cached)
            except Exception as e:
                logger.debug(f"Cache read failed for {entity_type}: {e}")

        if not scores:
            try:
                scores = await self.calculate_trending(entity_type)
            except ValueError as e:
                logger.error(str(e))
                return []

        sorted_items = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_items = sorted_items[:limit]

        return await self._enrich_items(entity_type, top_items)

    async def _enrich_items(
        self, entity_type: str, items: List[Tuple[str, float]]
    ) -> List[Dict[str, Any]]:
        enriched = []
        for rank, (entity_id, score) in enumerate(items, start=1):
            item: Dict[str, Any] = {
                "entity_id": entity_id,
                "entity_type": entity_type,
                "score": score,
                "rank": rank,
                "title": entity_id,
                "description": None,
                "thumbnail_url": None,
            }

            if entity_type == "course":
                module = await prisma.module.find_unique(
                    where={"id": entity_id},
                )
                if module:
                    item["title"] = module.title or entity_id
                    item["description"] = module.description
                    item["thumbnail_url"] = module.thumbnailUrl

            elif entity_type == "project":
                project = await prisma.project.find_unique(
                    where={"id": int(entity_id)},
                )
                if project:
                    item["title"] = project.title or entity_id
                    item["description"] = project.description

            elif entity_type == "freelancer":
                user = await prisma.user.find_unique(
                    where={"id": int(entity_id)},
                )
                if user:
                    item["title"] = user.fullName or entity_id
                    item["thumbnail_url"] = user.profilePictureUrl

            enriched.append(item)

        return enriched

    async def close(self) -> None:
        if self._redis:
            try:
                await self._redis.close()
            except Exception:
                pass
            self._redis = None
            self._connected = False


trending_service = TrendingService()
