"""
BI Query Cache Service
Provides Redis-backed query result caching, in-memory LRU fallbacks, and tag invalidation for BI widgets, dashboards, and datasets.
"""

import hashlib
import json
import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# In-memory fallback cache when Redis is disconnected
_in_memory_cache: Dict[str, Dict[str, Any]] = {}
_MAX_IN_MEMORY_KEYS = 500


class BICacheService:
    """Service for caching BI widget & query results in Redis with local fallback and tag invalidation."""

    DEFAULT_TTL = 300  # 5 minutes
    _hits = 0
    _misses = 0

    @classmethod
    def _generate_query_hash(cls, key_prefix: str, payload: Dict[str, Any]) -> str:
        raw_str = f"{key_prefix}:{json.dumps(payload, sort_keys=True, default=str)}"
        hashed = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()[:16]
        return f"bi:cache:{key_prefix}:{hashed}"

    @classmethod
    def _get_in_memory(cls, cache_key: str) -> Optional[Any]:
        if cache_key in _in_memory_cache:
            entry = _in_memory_cache[cache_key]
            if entry["expires_at"] > time.time():
                cls._hits += 1
                return entry["data"]
            else:
                del _in_memory_cache[cache_key]
        cls._misses += 1
        return None

    @classmethod
    def _set_in_memory(cls, cache_key: str, data: Any, ttl: int):
        if len(_in_memory_cache) >= _MAX_IN_MEMORY_KEYS:
            # Purge oldest 100 entries
            sorted_keys = sorted(_in_memory_cache.keys(), key=lambda k: _in_memory_cache[k]["created_at"])
            for k in sorted_keys[:100]:
                _in_memory_cache.pop(k, None)

        _in_memory_cache[cache_key] = {
            "data": data,
            "created_at": time.time(),
            "expires_at": time.time() + ttl,
        }

    @classmethod
    async def get_cached_widget_data(cls, widget_id: int, config: Dict[str, Any]) -> Optional[Any]:
        cache_key = cls._generate_query_hash(f"widget:{widget_id}", config)
        try:
            from app.core.redis import redis_client
            if redis_client:
                cached_val = await redis_client.get(cache_key)
                if cached_val:
                    cls._hits += 1
                    logger.debug(f"BI Cache HIT (Redis) for widget #{widget_id}")
                    return json.loads(cached_val)
        except Exception as e:
            logger.warning(f"BI Redis GET failed, using fallback: {e}")

        return cls._get_in_memory(cache_key)

    @classmethod
    async def set_cached_widget_data(
        cls, widget_id: int, config: Dict[str, Any], data: Any, ttl: int = DEFAULT_TTL
    ):
        cache_key = cls._generate_query_hash(f"widget:{widget_id}", config)
        cls._set_in_memory(cache_key, data, ttl)
        try:
            from app.core.redis import redis_client
            if redis_client:
                await redis_client.set(cache_key, json.dumps(data, default=str), ex=ttl)
                logger.debug(f"BI Cache SET (Redis) for widget #{widget_id} (TTL: {ttl}s)")
        except Exception as e:
            logger.warning(f"BI Redis SET failed: {e}")

    @classmethod
    async def invalidate_widget_cache(cls, widget_id: int):
        """Invalidate all cached results for a specific widget."""
        prefix = f"bi:cache:widget:{widget_id}:"
        # Clear in-memory entries matching prefix
        keys_to_del = [k for k in _in_memory_cache.keys() if k.startswith(prefix)]
        for k in keys_to_del:
            _in_memory_cache.pop(k, None)

        try:
            from app.core.redis import redis_client
            if redis_client:
                keys = await redis_client.keys(f"{prefix}*")
                if keys:
                    await redis_client.delete(*keys)
                    logger.info(f"Invalidated {len(keys)} Redis cache keys for widget #{widget_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate Redis cache for widget #{widget_id}: {e}")

    @classmethod
    async def invalidate_dataset_cache(cls, dataset_id: int):
        """Invalidate all cached results for a specific dataset across all widgets."""
        prefix = f"bi:cache:dataset:{dataset_id}:"
        keys_to_del = [k for k in _in_memory_cache.keys() if prefix in k]
        for k in keys_to_del:
            _in_memory_cache.pop(k, None)

        try:
            from app.core.redis import redis_client
            if redis_client:
                keys = await redis_client.keys(f"*dataset:{dataset_id}*")
                if keys:
                    await redis_client.delete(*keys)
                    logger.info(f"Invalidated {len(keys)} Redis cache keys for dataset #{dataset_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate Redis cache for dataset #{dataset_id}: {e}")

    @classmethod
    def get_cache_telemetry(cls) -> Dict[str, Any]:
        """Return cache hit/miss statistics and memory usage."""
        total = cls._hits + cls._misses
        hit_ratio = round((cls._hits / max(total, 1)) * 100, 2)
        return {
            "hits": cls._hits,
            "misses": cls._misses,
            "hit_ratio_percent": hit_ratio,
            "in_memory_keys_count": len(_in_memory_cache),
        }
