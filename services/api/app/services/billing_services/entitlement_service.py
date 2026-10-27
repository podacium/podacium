import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
from app.core.prisma import prisma
from app.core.config import setting

logger = logging.getLogger(__name__)


class EntitlementService:
    """
    Handles granting and checking user entitlements.
    Supports high-performance checks via Redis (read-through caching).
    """

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False
        self._lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def connect(self) -> None:
        """Initialize Redis connection. Safe to call concurrently."""
        if self._connected and self._redis:
            return

        async with self._get_lock():
            if self._connected and self._redis:
                return

            redis_url = setting.REDIS_URL
            if not redis_url:
                logger.warning(
                    "REDIS_URL not configured — entitlement cache using DB-only mode"
                )
                return

            try:
                self._redis = aioredis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=3,
                    socket_timeout=3,
                    max_connections=50,
                    retry_on_timeout=True,
                )
                # Verify connection
                await self._redis.ping()
                self._connected = True
                logger.info("Redis entitlement cache connected successfully")
            except Exception as e:
                logger.error(f"Redis entitlement cache connection failed: {e}")
                self._redis = None
                self._connected = False

    async def disconnect(self) -> None:
        """Close Redis connection pool cleanly."""
        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None
            self._connected = False

    async def grant_entitlement(
        self,
        user_id: int,
        entitlement_type: str,
        resource_id: Optional[str] = None,
        source_type: str = "purchase",
        source_id: str = "",
        expires_at: Optional[datetime] = None,
    ):
        """Grants a new entitlement to a user."""
        try:
            # Upsert entitlement to avoid duplicates
            await prisma.userentitlement.upsert(
                where={
                    "userId_entitlementType_resourceId": {
                        "userId": user_id,
                        "entitlementType": entitlement_type,
                        "resourceId": resource_id or "",
                    }
                },
                data={
                    "create": {
                        "userId": user_id,
                        "entitlementType": entitlement_type,
                        "resourceId": resource_id or "",
                        "sourceType": source_type,
                        "sourceId": str(source_id),
                        "grantedAt": datetime.now(timezone.utc),
                        "expiresAt": expires_at,
                    },
                    "update": {
                        "expiresAt": expires_at,
                        "grantedAt": datetime.now(timezone.utc),
                        "sourceId": str(source_id),
                    },
                },
            )

            # Invalidate cache
            await self.invalidate_cache(user_id)

            logger.info(f"Granted {entitlement_type} to user {user_id}")

        except Exception as e:
            logger.error(f"Failed to grant entitlement: {str(e)}")
            raise

    async def has_entitlement(
        self, user_id: int, entitlement_type: str, resource_id: Optional[str] = None
    ) -> bool:
        """
        Main access gate. Can user X access resource Y?
        Reads through cache (Redis).
        """
        await self.connect()

        # 1. Check Cache (Redis)
        cache_key = f"entitlements:{user_id}:{entitlement_type}:{resource_id or ''}"
        if self._connected and self._redis:
            try:
                cached = await self._redis.get(cache_key)
                if cached is not None:
                    return cached == "1"
            except Exception as e:
                logger.warning(f"Redis entitlement check failed: {e}")

        # 2. Fallback to DB
        entitlement = await prisma.userentitlement.find_first(
            where={
                "userId": user_id,
                "entitlementType": entitlement_type,
                "resourceId": resource_id or "",
                "OR": [
                    {"expiresAt": None},
                    {"expiresAt": {"gt": datetime.now(timezone.utc)}},
                ],
            }
        )

        has_access = entitlement is not None

        # 3. Write back to Redis
        if self._connected and self._redis:
            try:
                ttl = 3600  # Default to 1 hour cache
                if entitlement and entitlement.expiresAt:
                    time_left = (
                        entitlement.expiresAt.replace(tzinfo=timezone.utc)
                        - datetime.now(timezone.utc)
                    ).total_seconds()
                    if time_left > 0:
                        ttl = min(int(time_left), 3600)
                    else:
                        ttl = 0

                if ttl > 0 or not entitlement:
                    await self._redis.setex(
                        cache_key,
                        ttl if entitlement else 300,
                        "1" if has_access else "0",
                    )
            except Exception as e:
                logger.warning(f"Redis entitlement cache write failed: {e}")

        return has_access

    async def invalidate_cache(self, user_id: int):
        """Invalidates the entitlement cache for a specific user."""
        await self.connect()
        if self._connected and self._redis:
            try:
                keys = await self._redis.keys(f"entitlements:{user_id}:*")
                if keys:
                    await self._redis.delete(*keys)
                logger.info(f"Invalidated entitlement cache for user {user_id}")
            except Exception as e:
                logger.warning(f"Redis entitlement cache invalidation failed: {e}")

    async def revoke_entitlements_by_source(
        self, source_id: str, user_id: Optional[int] = None
    ) -> bool:
        """
        Revoke all entitlements tied to a given source_id (e.g. a refunded
        transaction). Returns True if any entitlements were removed.
        """
        try:
            where: dict = {"sourceId": source_id}
            if user_id is not None:
                where["userId"] = user_id

            result = await prisma.userentitlement.delete_many(where=where)
            if result > 0:
                await self.invalidate_cache(user_id or 0)
                logger.info(f"Revoked {result} entitlement(s) for source {source_id}")
            return result > 0
        except Exception as e:
            logger.error(f"Failed to revoke entitlements for source {source_id}: {e}")
            return False


# Singleton instance
entitlement_service = EntitlementService()
