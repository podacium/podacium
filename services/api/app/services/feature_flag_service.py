"""
Feature Flag Service with Prisma FeatureFlag model and Redis caching.

Supports:
- Global flags (enabled/disabled for all)
- Percentage rollout (gradual rollout to % of users)
- User targeting (specific user IDs)
- Organization targeting (specific org IDs)
"""

import json
import logging
import hashlib
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from functools import wraps

import redis.asyncio as aioredis

from app.core.config import setting
from app.core.prisma import prisma

logger = logging.getLogger(__name__)

FEATURE_FLAG_PREFIX = "feature_flag:"
CACHE_TTL_SECONDS = 300  # 5 minutes


@dataclass
class FeatureFlag:
    """Feature flag configuration matching the Prisma model."""

    key: str
    name: str
    description: Optional[str] = None
    enabled: bool = False
    category: str = "general"
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "enabled": self.enabled,
            "category": self.category,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeatureFlag":
        """Create FeatureFlag from dictionary (for cache)."""
        return cls(
            key=data["key"],
            name=data.get("name", data["key"]),
            description=data.get("description"),
            enabled=data.get("enabled", False),
            category=data.get("category", "general"),
            metadata=data.get("metadata", {}),
        )

    @classmethod
    def from_prisma(cls, flag) -> "FeatureFlag":
        """Create FeatureFlag from Prisma model."""
        metadata = flag.metadata if isinstance(flag.metadata, dict) else {}
        return cls(
            key=flag.key,
            name=flag.name,
            description=flag.description,
            enabled=flag.isEnabled,
            category=flag.category,
            metadata=metadata,
        )

    def get_rollout_percentage(self) -> int:
        return self.metadata.get("rollout_percentage", 0)

    def get_target_user_ids(self) -> List[int]:
        return self.metadata.get("target_user_ids", [])

    def get_target_org_ids(self) -> List[int]:
        return self.metadata.get("target_org_ids", [])


class FeatureFlagService:
    """Service for managing and evaluating feature flags."""

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        """Get or create Redis connection."""
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
                retry_on_timeout=True,
            )
            await self._redis.ping()
            self._connected = True
            return self._redis
        except Exception as e:
            logger.warning(f"Redis connection failed for feature flags: {e}")
            self._connected = False
            return None

    def _cache_key(self, flag_key: str) -> str:
        return f"{FEATURE_FLAG_PREFIX}{flag_key}"

    async def _get_from_cache(self, flag_key: str) -> Optional[FeatureFlag]:
        """Get flag from Redis cache."""
        redis = await self._get_redis()
        if not redis:
            return None

        try:
            data = await redis.get(self._cache_key(flag_key))
            if data:
                return FeatureFlag.from_dict(json.loads(data))
        except Exception as e:
            logger.warning(f"Cache read failed for {flag_key}: {e}")
        return None

    async def _set_cache(self, flag: FeatureFlag) -> None:
        """Set flag in Redis cache."""
        redis = await self._get_redis()
        if not redis:
            return

        try:
            await redis.setex(
                self._cache_key(flag.key),
                CACHE_TTL_SECONDS,
                json.dumps(flag.to_dict()),
            )
        except Exception as e:
            logger.warning(f"Cache write failed for {flag.key}: {e}")

    async def _invalidate_cache(self, flag_key: str) -> None:
        """Invalidate flag cache."""
        redis = await self._get_redis()
        if not redis:
            return

        try:
            await redis.delete(self._cache_key(flag_key))
        except Exception as e:
            logger.warning(f"Cache invalidation failed for {flag_key}: {e}")

    async def get_flag(self, flag_key: str) -> Optional[FeatureFlag]:
        """Get feature flag by key (with caching)."""
        # Try cache first
        cached = await self._get_from_cache(flag_key)
        if cached:
            return cached

        # Fallback to database
        try:
            flag = await prisma.featureflag.find_unique(where={"key": flag_key})
            if not flag:
                return None

            feature_flag = FeatureFlag.from_prisma(flag)
            await self._set_cache(feature_flag)
            return feature_flag
        except Exception as e:
            logger.error(f"Failed to get feature flag {flag_key}: {e}")
            return None

    async def set_flag(self, flag: FeatureFlag) -> bool:
        """Create or update a feature flag."""
        try:
            await prisma.featureflag.upsert(
                where={"key": flag.key},
                data={
                    "create": {
                        "key": flag.key,
                        "name": flag.name,
                        "description": flag.description,
                        "isEnabled": flag.enabled,
                        "category": flag.category,
                        "metadata": flag.metadata,
                    },
                    "update": {
                        "name": flag.name,
                        "description": flag.description,
                        "isEnabled": flag.enabled,
                        "category": flag.category,
                        "metadata": flag.metadata,
                    },
                },
            )
            await self._set_cache(flag)
            logger.info(f"Feature flag updated: {flag.key}")
            return True
        except Exception as e:
            logger.error(f"Failed to set feature flag {flag.key}: {e}")
            return False

    async def delete_flag(self, flag_key: str) -> bool:
        """Delete a feature flag."""
        try:
            await prisma.featureflag.delete(where={"key": flag_key})
            await self._invalidate_cache(flag_key)
            logger.info(f"Feature flag deleted: {flag_key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete feature flag {flag_key}: {e}")
            return False

    async def list_flags(self, category: Optional[str] = None) -> List[FeatureFlag]:
        """List all feature flags."""
        try:
            where = {}
            if category:
                where["category"] = category

            flags = await prisma.featureflag.find_many(where=where)
            result = []
            for f in flags:
                try:
                    flag = FeatureFlag.from_prisma(f)
                    result.append(flag)
                except Exception:
                    continue
            return result
        except Exception as e:
            logger.error(f"Failed to list feature flags: {e}")
            return []

    def _user_in_rollout(self, user_id: int, percentage: int) -> bool:
        """Deterministic rollout check using user ID hash."""
        if percentage <= 0:
            return False
        if percentage >= 100:
            return True
        hash_val = int(
            hashlib.md5(str(user_id).encode(), usedforsecurity=False).hexdigest(), 16
        )
        return (hash_val % 100) < percentage

    def _org_in_rollout(self, org_id: int, percentage: int) -> bool:
        """Deterministic rollout check using org ID hash."""
        if percentage <= 0:
            return False
        if percentage >= 100:
            return True
        hash_val = int(
            hashlib.md5(str(org_id).encode(), usedforsecurity=False).hexdigest(), 16
        )
        return (hash_val % 100) < percentage

    async def is_enabled(
        self,
        flag_key: str,
        user_id: Optional[int] = None,
        org_id: Optional[int] = None,
    ) -> bool:
        """
        Check if a feature flag is enabled for a given user/org.

        Evaluation order:
        1. If flag doesn't exist or disabled globally -> False
        2. If user explicitly targeted -> True
        3. If org explicitly targeted -> True
        4. If rollout percentage > 0 -> check deterministic hash
        5. Otherwise -> global enabled state
        """
        flag = await self.get_flag(flag_key)
        if not flag or not flag.enabled:
            return False

        # Explicit user targeting
        if user_id and user_id in flag.get_target_user_ids():
            return True

        # Explicit org targeting
        if org_id and org_id in flag.get_target_org_ids():
            return True

        # Percentage rollout (user takes precedence over org)
        rollout = flag.get_rollout_percentage()
        if user_id and rollout > 0:
            return self._user_in_rollout(user_id, rollout)

        if org_id and rollout > 0:
            return self._org_in_rollout(org_id, rollout)

        # Global enabled
        return True


# Singleton instance
feature_flag_service = FeatureFlagService()


def feature_flag(flag_key: str):
    """
    Decorator to guard an endpoint with a feature flag.

    Usage:
        @router.get("/new-feature")
        @feature_flag("new_dashboard")
        async def new_dashboard_endpoint(user_id: int = Depends(get_current_user_id)):
            return {"feature": "enabled"}
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Try to extract user_id and org_id from dependencies
            user_id = kwargs.get("user_id") or kwargs.get("current_user_id")
            org_id = kwargs.get("org_id") or kwargs.get("current_org_id")

            # Also check common dependency names
            for key, value in kwargs.items():
                if hasattr(value, "id") and not user_id:
                    user_id = value.id
                if hasattr(value, "organization_id") and not org_id:
                    org_id = value.organization_id

            enabled = await feature_flag_service.is_enabled(
                flag_key, user_id=user_id, org_id=org_id
            )

            if not enabled:
                from fastapi import HTTPException, status

                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Feature '{flag_key}' not available",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator
