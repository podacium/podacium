import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

FEEDBACK_PREFIX = "rec:feedback:"
IMPRESSION_TTL = 86400 * 30


class RecommendationTracker:
    """Tracks recommendation impressions and click-through for future ML training."""

    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis
            from app.core.config import setting
            url = setting.REDIS_CACHE_URL or setting.REDIS_URL
            if not url:
                self._redis = False
                return None
            self._redis = aioredis.from_url(
                url, decode_responses=True,
                socket_timeout=2, socket_connect_timeout=2,
            )
            await self._redis.ping()
        except Exception as e:
            logger.debug(f"RecTracker Redis unavailable: {e}")
            self._redis = False
            return None
        return self._redis

    async def log_impression(
        self,
        user_id: int,
        entity_id: str,
        entity_type: str,
        role: str,
        score: float,
        reason_type: str,
        rank: int,
    ):
        redis = await self._get_redis()
        if not redis:
            return
        key = f"{FEEDBACK_PREFIX}impression:{user_id}:{entity_id}"
        try:
            await redis.setex(key, IMPRESSION_TTL, json.dumps({
                "user_id": user_id,
                "entity_id": entity_id,
                "entity_type": entity_type,
                "role": role,
                "score": score,
                "reason_type": reason_type,
                "rank": rank,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))
        except Exception as e:
            logger.debug(f"Failed to log impression: {e}")

    async def log_click(self, user_id: int, entity_id: str):
        redis = await self._get_redis()
        if not redis:
            return
        click_key = f"{FEEDBACK_PREFIX}click:{user_id}:{entity_id}"
        count_key = f"{FEEDBACK_PREFIX}stats:{entity_id}:clicks"
        try:
            await redis.setex(click_key, IMPRESSION_TTL, json.dumps({
                "user_id": user_id,
                "entity_id": entity_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))
            await redis.incr(count_key)
        except Exception as e:
            logger.debug(f"Failed to log click: {e}")


recommendation_tracker = RecommendationTracker()
