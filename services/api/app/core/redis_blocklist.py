"""
Redis-backed Token Blocklist.

Replaces the in-memory set with a Redis-backed blocklist that:
- Survives worker restarts
- Is shared across all uvicorn workers
- Automatically expires entries (no unbounded growth)
- Falls back to in-memory if Redis is unavailable (degraded mode)

Usage:
    from app.core.redis_blocklist import token_blocklist

    await token_blocklist.add(token, ttl_seconds=1800)
    is_blocked = await token_blocklist.contains(token)
"""

import logging
import hashlib
from typing import Optional, Set

import redis.asyncio as aioredis

from app.core.config import setting

logger = logging.getLogger(__name__)

# Prefix for all blocklist keys in Redis
_REDIS_PREFIX = "token_blocklist:"

# Default TTL: 14 days (max refresh token lifetime)
_DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60


class RedisTokenBlocklist:
    """
    Redis-backed token blocklist with in-memory fallback.

    Tokens are stored as SHA-256 hashes in Redis to avoid storing
    raw JWTs (which could be stolen if Redis is compromised).
    """

    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False
        # In-memory fallback for when Redis is unavailable
        self._fallback: Set[str] = set()
        self._user_min_iat: dict[int, int] = {}
        self._fallback_kv: dict[str, str] = {}

    def _hash_token(self, token: str) -> str:
        """Hash token before storing (defense in depth)."""
        return hashlib.sha256(token.encode()).hexdigest()

    async def connect(self) -> None:
        """Initialize Redis connection. Safe to call multiple times."""
        if self._connected and self._redis:
            return

        redis_url = setting.REDIS_URL
        if not redis_url:
            logger.warning(
                "REDIS_URL not configured — token blocklist using in-memory fallback"
            )
            return

        try:
            self._redis = aioredis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
                max_connections=50,
                retry_on_timeout=True,
            )
            # Verify connection
            if self._redis:
                await self._redis.ping()
            self._connected = True
            logger.info("Redis token blocklist connected")
        except Exception as e:
            logger.error(
                f"Redis blocklist connection failed: {e} — using in-memory fallback"
            )
            self._redis = None
            self._connected = False

    async def add(self, token: str, ttl_seconds: int = _DEFAULT_TTL_SECONDS) -> None:
        """
        Add a token to the blocklist.

        Args:
            token: The raw JWT string to blocklist.
            ttl_seconds: How long to keep it blocklisted (default: 14 days).
        """
        token_hash = self._hash_token(token)

        # Always add to in-memory for immediate effect on this worker
        self._fallback.add(token_hash)

        if self._redis and self._connected:
            try:
                key = f"{_REDIS_PREFIX}{token_hash}"
                await self._redis.setex(key, ttl_seconds, "1")
            except Exception as e:
                logger.warning(f"Redis blocklist add failed: {e}")

    async def contains(self, token: str) -> bool:
        """
        Check if a token is blocklisted.

        Returns True if the token is found in Redis OR the in-memory fallback.
        """
        token_hash = self._hash_token(token)

        # Check in-memory first (fast path, covers current worker)
        if token_hash in self._fallback:
            return True

        # Check Redis (covers all workers)
        if self._redis and self._connected:
            try:
                key = f"{_REDIS_PREFIX}{token_hash}"
                result = await self._redis.exists(key)
                if result:
                    # Sync to local cache for future fast-path hits
                    self._fallback.add(token_hash)
                    return True
            except Exception as e:
                logger.warning(f"Redis blocklist check failed: {e}")

        return False

    def contains_sync(self, token: str) -> bool:
        """
        Synchronous check against in-memory fallback only.
        Used in contexts where async is not available (e.g., token verification).
        """
        token_hash = self._hash_token(token)
        return token_hash in self._fallback

    async def remove(self, token: str) -> None:
        """Remove a token from the blocklist (rarely needed)."""
        token_hash = self._hash_token(token)
        self._fallback.discard(token_hash)

        if self._redis and self._connected:
            try:
                key = f"{_REDIS_PREFIX}{token_hash}"
                await self._redis.delete(key)
            except Exception as e:
                logger.warning(f"Redis blocklist remove failed: {e}")

    def clear(self) -> None:
        """Clear the in-memory fallback (for testing only)."""
        self._fallback.clear()
        self._user_min_iat.clear()
        self._fallback_kv.clear()

    async def set_user_min_iat(
        self, user_id: int, min_iat: int, ttl_seconds: int = _DEFAULT_TTL_SECONDS
    ) -> None:
        """Store the minimum allowable token issuance timestamp (iat) for a user."""
        self._user_min_iat[user_id] = min_iat
        if self._redis and self._connected:
            try:
                # Support both key schemas:
                # 1. user:{id}:revoked_at (RFC / Edge standard)
                # 2. user_min_iat:{id} (Legacy internal)
                pipe = self._redis.pipeline()
                pipe.setex(f"user:{user_id}:revoked_at", ttl_seconds, str(min_iat))
                pipe.setex(f"user_min_iat:{user_id}", ttl_seconds, str(min_iat))
                await pipe.execute()
            except Exception as e:
                logger.warning(f"Redis set_user_min_iat failed for user {user_id}: {e}")

    async def get_user_min_iat(self, user_id: int) -> Optional[int]:
        """Retrieve minimum token issuance timestamp for a user from Redis or in-memory fallback."""
        if self._redis and self._connected:
            try:
                # Try user:{id}:revoked_at first, fallback to user_min_iat:{id}
                val = await self._redis.get(f"user:{user_id}:revoked_at")
                if val is None:
                    val = await self._redis.get(f"user_min_iat:{user_id}")
                if val is not None:
                    min_iat = int(val)
                    self._user_min_iat[user_id] = min_iat
                    return min_iat
            except Exception as e:
                logger.warning(f"Redis get_user_min_iat failed for user {user_id}: {e}")

        return self._user_min_iat.get(user_id)

    def get_user_min_iat_sync(self, user_id: int) -> Optional[int]:
        """Synchronously get cached min_iat for user."""
        return self._user_min_iat.get(user_id)

    async def set(self, key: str, value: str, ttl_seconds: int) -> None:
        """
        Store an arbitrary key-value pair in Redis with TTL.
        Falls back to in-memory if Redis is unavailable.
        Used by WebAuthn challenge storage.
        """
        self._fallback_kv[key] = value
        if self._redis and self._connected:
            try:
                await self._redis.setex(key, ttl_seconds, value)
            except Exception as e:
                logger.warning(f"Redis set failed for key {key}: {e}")

    async def get(self, key: str) -> Optional[str]:
        """Retrieve a value from Redis by key. Returns None if not found or Redis is down."""
        if self._redis and self._connected:
            try:
                val = await self._redis.get(key)
                if val is not None:
                    return val
            except Exception as e:
                logger.warning(f"Redis get failed for key {key}: {e}")
        return self._fallback_kv.get(key)

    async def delete_key(self, key: str) -> None:
        """Delete a key from Redis and in-memory fallback."""
        self._fallback_kv.pop(key, None)
        if self._redis and self._connected:
            try:
                await self._redis.delete(key)
            except Exception as e:
                logger.warning(f"Redis delete failed for key {key}: {e}")

    async def get_and_delete(self, key: str) -> Optional[str]:
        """
        Atomically retrieve and delete a key from Redis (GETDEL) with in-memory fallback.
        Ensures strict one-time-use semantics to prevent challenge replay.
        """
        val_fallback = self._fallback_kv.pop(key, None)
        if self._redis and self._connected:
            try:
                # Redis 6.2+ GETDEL command
                val = await self._redis.getdel(key)
                if val is not None:
                    return val
            except Exception:
                # Pipeline fallback for older Redis versions
                try:
                    pipe = self._redis.pipeline()
                    pipe.get(key)
                    pipe.delete(key)
                    res = await pipe.execute()
                    if res and res[0] is not None:
                        return res[0]
                except Exception as e:
                    logger.warning(f"Redis get_and_delete failed for key {key}: {e}")
        return val_fallback

    async def close(self) -> None:
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None
            self._connected = False


# Singleton instance
token_blocklist = RedisTokenBlocklist()
