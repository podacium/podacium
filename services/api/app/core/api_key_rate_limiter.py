"""
API Key Tiered Rate Limiter with Sliding Window Counter & IETF RateLimit Headers.
Enforces per-minute request quotas per API key in Redis with fail-open resilience.
"""

from __future__ import annotations

import logging
import time
from typing import Tuple

from fastapi import HTTPException, Request, status

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

DEFAULT_RATE_LIMIT_PER_MINUTE = 600


class ApiKeyRateLimiter:
    """Sliding-window Redis rate limiter for developer API Keys."""

    def __init__(self, default_limit: int = DEFAULT_RATE_LIMIT_PER_MINUTE):
        self.default_limit = default_limit

    async def check_rate_limit(
        self,
        key_id: int,
        limit: int | None = None,
    ) -> Tuple[bool, int, int, int]:
        """
        Check and record rate limit counter for a given key_id.
        Returns:
            (allowed: bool, limit: int, remaining: int, reset_epoch: int)
        """
        effective_limit = limit or self.default_limit
        now = int(time.time())
        window_size = 60
        current_bucket = now // window_size
        reset_epoch = (current_bucket + 1) * window_size

        redis_key = f"ratelimit:apikey:{key_id}:{current_bucket}"

        try:
            redis = await get_redis()
            if redis is None:
                return True, effective_limit, effective_limit - 1, reset_epoch

            current_count = await redis.incr(redis_key)
            if current_count == 1:
                await redis.expire(redis_key, window_size + 10)

            remaining = max(0, effective_limit - current_count)
            allowed = current_count <= effective_limit
            return allowed, effective_limit, remaining, reset_epoch

        except Exception as exc:
            logger.warning(
                f"Redis unavailable for API key rate limiting (key {key_id}): {exc}. Failing open."
            )
            # Fail-open resilience: allow request with default values
            return True, effective_limit, effective_limit - 1, reset_epoch


api_key_rate_limiter = ApiKeyRateLimiter()


async def enforce_api_key_rate_limit(
    request: Request, key_id: int, limit: int | None = None
) -> None:
    """
    Enforces API key rate limit and stores headers on request state for injection into response.
    Raises HTTPException(429) if quota is exceeded.
    """
    (
        allowed,
        eff_limit,
        remaining,
        reset_epoch,
    ) = await api_key_rate_limiter.check_rate_limit(
        key_id=key_id,
        limit=limit,
    )

    headers = {
        "X-RateLimit-Limit": str(eff_limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(reset_epoch),
    }
    request.state.ratelimit_headers = headers

    if not allowed:
        retry_after = max(1, reset_epoch - int(time.time()))
        headers["Retry-After"] = str(retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "rate_limit_exceeded",
                "message": f"API key rate limit exceeded. Limit is {eff_limit} req/min.",
                "limit": eff_limit,
                "retry_after_seconds": retry_after,
            },
            headers=headers,
        )
