"""
Idempotency Service.

Prevents duplicate payment processing by enforcing idempotency keys:
- Client sends an Idempotency-Key header with each payment request
- If the key has been seen before, return the cached response
- If not, process the request and cache the response

Uses Redis for distributed caching with DB fallback.
"""

import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple

from app.core.prisma import prisma
from app.core.config import setting

logger = logging.getLogger(__name__)

# Idempotency keys expire after 24 hours
IDEMPOTENCY_TTL_HOURS = 24


class IdempotencyService:
    """Manages idempotency for payment and financial operations."""

    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        """Lazy-initialize Redis connection."""
        if self._redis is None:
            try:
                import redis.asyncio as aioredis

                redis_url = getattr(setting, "REDIS_URL", "")
                if redis_url:
                    self._redis = aioredis.from_url(
                        redis_url,
                        decode_responses=True,
                        socket_connect_timeout=1,
                    )
            except Exception:
                self._redis = None
        return self._redis

    def _make_cache_key(self, idempotency_key: str, user_id: int) -> str:
        """Create a namespaced cache key."""
        return f"idempotency:{user_id}:{idempotency_key}"

    async def check_idempotency(
        self, idempotency_key: str, user_id: int
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Check if a request with this idempotency key has already been processed.

        Returns:
            (is_duplicate, cached_response)
            - (False, None) if this is a new request
            - (True, response_data) if this is a duplicate
        """
        if not idempotency_key:
            return False, None

        cache_key = self._make_cache_key(idempotency_key, user_id)

        # Try Redis first
        redis = await self._get_redis()
        if redis:
            try:
                cached = await redis.get(cache_key)
                if cached:
                    logger.info(
                        f"Idempotency hit: key={idempotency_key}, user={user_id}"
                    )
                    return True, json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis idempotency check failed: {e}")

        # Fallback to database
        try:
            existing = await prisma.idempotencykey.find_first(
                where={
                    "key": idempotency_key,
                    "userId": user_id,
                    "expiresAt": {"gt": datetime.now(timezone.utc)},
                }
            )
            if existing and existing.responseBody:
                logger.info(
                    f"Idempotency hit (DB): key={idempotency_key}, user={user_id}"
                )
                response_data = existing.responseBody
                if isinstance(response_data, str):
                    response_data = json.loads(response_data)
                return True, response_data
        except Exception as e:
            logger.warning(f"DB idempotency check failed: {e}")

        return False, None

    async def store_response(
        self,
        idempotency_key: str,
        user_id: int,
        response_data: Dict[str, Any],
        transaction_id: Optional[int] = None,
    ) -> None:
        """
        Store the response for an idempotency key after successful processing.
        """
        if not idempotency_key:
            return

        cache_key = self._make_cache_key(idempotency_key, user_id)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=IDEMPOTENCY_TTL_HOURS)
        serialized = json.dumps(response_data, default=str)

        # Store in Redis (fast path)
        redis = await self._get_redis()
        if redis:
            try:
                await redis.setex(
                    cache_key,
                    IDEMPOTENCY_TTL_HOURS * 3600,
                    serialized,
                )
            except Exception as e:
                logger.warning(f"Redis idempotency store failed: {e}")

        # Store in database (durable path)
        try:
            from app.generated.prisma import Json

            await prisma.idempotencykey.create(
                data={
                    "key": idempotency_key,
                    "userId": user_id,
                    "transactionId": transaction_id,
                    "lastRunAt": datetime.now(timezone.utc),
                    "responseCode": 200,
                    "responseBody": Json(response_data),
                    "expiresAt": expires_at,
                }
            )
        except Exception as e:
            # Unique constraint violation means it was already stored (race condition)
            if "unique" in str(e).lower():
                pass
            else:
                logger.error(f"Failed to store idempotency key: {e}")

    async def cleanup_expired(self) -> int:
        """Remove expired idempotency keys (run via Celery beat)."""
        try:
            result = await prisma.idempotencykey.delete_many(
                where={"expiresAt": {"lt": datetime.now(timezone.utc)}}
            )
            return result
        except Exception as e:
            logger.error(f"Idempotency cleanup failed: {e}")
            return 0


# Singleton
idempotency_service = IdempotencyService()
