"""
Email/IP rate limiting utility for per-credential throttling.

Provides a sliding-window counter for arbitrary keys (email, phone, user ID)
backed by Redis with in-memory fallback for development/testing.
"""

import time
import hashlib
import logging

from app.core.config import setting

logger = logging.getLogger(__name__)


class PerCredentialRateLimiter:
    """
    Sliding-window rate limiter keyed on a hashed credential.

    Usage:
        limiter = PerCredentialRateLimiter(max_attempts=5, window_seconds=60)
        if await limiter.is_limited("user@example.com"):
            raise HTTPException(status_code=429, ...)
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._redis = None
        # In-memory fallback: {hashed_key: [(timestamp, ...)]}
        self._store: dict[str, list[float]] = {}

    async def _get_redis(self):
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

    def _hash_key(self, credential: str) -> str:
        """Hash the credential to avoid storing plain PII in Redis keys."""
        return hashlib.sha256(credential.lower().encode()).hexdigest()[:16]

    async def is_limited(self, credential: str) -> bool:
        """
        Check and record an attempt for the given credential.

        Returns True if the credential is rate-limited.
        """
        key = self._hash_key(credential)
        now = time.time()
        cutoff = now - self.window_seconds

        redis = await self._get_redis()
        if redis:
            redis_key = f"rl_email:{key}"
            try:
                # Remove old entries and add current timestamp
                await redis.zremrangebyscore(redis_key, "-inf", cutoff)
                count = await redis.zcard(redis_key)
                if count >= self.max_attempts:
                    return True
                await redis.zadd(redis_key, {str(now): now})
                await redis.expire(redis_key, self.window_seconds * 2)
                return False
            except Exception:
                pass  # fall through to in-memory

        # In-memory fallback
        entries = self._store.get(key, [])
        # Prune expired
        entries = [t for t in entries if t > cutoff]
        if len(entries) >= self.max_attempts:
            self._store[key] = entries
            return True
        entries.append(now)
        self._store[key] = entries
        return False

    async def reset(self, credential: str) -> None:
        """Clear rate limit for a credential (e.g., on successful login)."""
        key = self._hash_key(credential)
        redis = await self._get_redis()
        if redis:
            try:
                await redis.delete(f"rl_email:{key}")
                return
            except Exception:
                pass
        self._store.pop(key, None)


# Singleton instances at different thresholds
login_rate_limiter = PerCredentialRateLimiter(
    max_attempts=5, window_seconds=60
)  # 5 POST/min per email
login_ip_rate_limiter = PerCredentialRateLimiter(
    max_attempts=20, window_seconds=3600
)  # 20 POST/hour per IP
complete_2fa_rate_limiter = PerCredentialRateLimiter(
    max_attempts=5, window_seconds=300
)  # 5 POST/5min per user
password_reset_limiter = PerCredentialRateLimiter(
    max_attempts=3, window_seconds=300
)  # 3 POST/5min per email
resend_verification_email_limiter = PerCredentialRateLimiter(
    max_attempts=3, window_seconds=3600
)  # 3 POST/hour per email
resend_verification_ip_limiter = PerCredentialRateLimiter(
    max_attempts=10, window_seconds=3600
)  # 10 POST/hour per IP
