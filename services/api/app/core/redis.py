# services/api/app/core/redis.py
"""
Shared Async Redis Connection Pool.
"""

import logging
from typing import Optional
import redis.asyncio as aioredis
from app.core.config import setting

logger = logging.getLogger("podacium.redis")

_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> Optional[aioredis.Redis]:
    """Get shared async Redis connection client."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    redis_url = getattr(setting, "REDIS_URL", None)
    if not redis_url:
        return None

    try:
        _redis_client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        return _redis_client
    except Exception as e:
        logger.warning(f"Could not connect to Redis: {e}")
        return None


async def close_redis() -> None:
    """Close shared Redis connection."""
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
        except Exception:
            pass
        _redis_client = None
