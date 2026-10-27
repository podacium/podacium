"""
OAuth State Nonce Store — enforces single-use OAuth state tokens (replay protection).

Uses Redis with an in-memory fallback, same pattern as the token blocklist.
Each state token is stored by its JTI (JWT ID) claim and auto-expires via TTL.
"""

import logging
import hashlib
from typing import Optional, Set

import redis.asyncio as aioredis

from app.core.config import setting

logger = logging.getLogger(__name__)

_REDIS_PREFIX = "oauth_state:"
_DEFAULT_TTL_SECONDS = 1800  # 30 minutes (matches access token expiry)


class OAuthStateStore:
    """
    Tracks used OAuth state nonces to prevent replay attacks.
    Redis-backed with in-memory fallback (degraded mode).
    """

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False
        self._fallback: Set[str] = set()

    def _hash_nonce(self, jti: str) -> str:
        return hashlib.sha256(jti.encode()).hexdigest()

    async def connect(self) -> None:
        """Initialize Redis connection. Safe to call multiple times."""
        if self._connected and self._redis:
            return

        redis_url = setting.REDIS_URL
        if not redis_url:
            logger.warning(
                "REDIS_URL not configured — OAuth state store using in-memory fallback"
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
            if self._redis:
                await self._redis.ping()
            self._connected = True
            logger.info("OAuth state store connected to Redis")
        except Exception as e:
            logger.error(
                f"OAuth state store Redis connection failed: {e} — using in-memory fallback"
            )
            self._redis = None
            self._connected = False

    async def mark_used(
        self, jti: str, ttl_seconds: int = _DEFAULT_TTL_SECONDS
    ) -> None:
        """Mark an OAuth state nonce as used (prevents replay)."""
        nonce_hash = self._hash_nonce(jti)
        self._fallback.add(nonce_hash)

        if self._redis and self._connected:
            try:
                key = f"{_REDIS_PREFIX}{nonce_hash}"
                await self._redis.setex(key, ttl_seconds, "1")
            except Exception as e:
                logger.warning(f"OAuth state Redis mark_used failed: {e}")

    async def is_used(self, jti: str) -> bool:
        """Check if an OAuth state nonce has already been used."""
        nonce_hash = self._hash_nonce(jti)

        if nonce_hash in self._fallback:
            return True

        if self._redis and self._connected:
            try:
                key = f"{_REDIS_PREFIX}{nonce_hash}"
                result = await self._redis.exists(key)
                if result:
                    self._fallback.add(nonce_hash)
                    return True
            except Exception as e:
                logger.warning(f"OAuth state Redis check failed: {e}")

        return False

    async def close(self) -> None:
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None
            self._connected = False

    def clear(self) -> None:
        """Clear in-memory fallback (for testing only)."""
        self._fallback.clear()


oauth_state_store = OAuthStateStore()
