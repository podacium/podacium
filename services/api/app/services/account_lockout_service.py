"""
Account Lockout Service.

Implements progressive account lockout after failed login attempts:
- 5 failed attempts → 5 minute lockout
- 10 failed attempts → 30 minute lockout
- 15+ failed attempts → 1 hour lockout

Uses Redis for distributed tracking across multiple API instances.
Falls back to in-memory tracking if Redis is unavailable.
"""

import logging
import math
import time
from typing import Tuple

from app.core.config import setting

logger = logging.getLogger(__name__)

# Lockout thresholds
LOCKOUT_THRESHOLDS = [
    (5, 5 * 60),  # 5 attempts → 5 min lockout
    (10, 30 * 60),  # 10 attempts → 30 min lockout
    (15, 60 * 60),  # 15+ attempts → 1 hour lockout
]

# In-memory fallback store
_attempt_store: dict = {}


class AccountLockoutService:
    """Manages login attempt tracking and account lockout."""

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

    def _get_lockout_duration(self, attempts: int) -> int:
        """Get lockout duration in seconds based on attempt count."""
        duration = 0
        for threshold, lock_time in LOCKOUT_THRESHOLDS:
            if attempts >= threshold:
                duration = lock_time
        return duration

    async def record_failed_attempt(self, identifier: str) -> Tuple[bool, int]:
        """Record a failed login attempt and apply progressive lockout if threshold reached."""
        clean_id = identifier.lower().strip()
        key = f"lockout:{clean_id}"
        redis = await self._get_redis()
        now = time.time()

        if redis:
            try:
                attempts = await redis.hincrby(key, "attempts", 1)
                await redis.expire(key, 86400)
                duration = self._get_lockout_duration(attempts)
                if duration > 0:
                    locked_until = now + duration
                    await redis.hset(key, "locked_until", str(locked_until))
                    return True, duration
                return False, 0
            except Exception as e:
                logger.warning(f"Redis lockout record failed: {e}")

        # In-memory fallback
        if key not in _attempt_store:
            _attempt_store[key] = {
                "attempts": 0,
                "first_attempt": now,
                "locked_until": 0,
            }
        _attempt_store[key]["attempts"] += 1
        attempts = _attempt_store[key]["attempts"]
        duration = self._get_lockout_duration(attempts)
        if duration > 0:
            _attempt_store[key]["locked_until"] = now + duration
            return True, duration
        return False, 0

    async def clear_attempts(self, identifier: str) -> None:
        """Clear failed attempts after successful login."""
        clean_id = identifier.lower().strip()
        key = f"lockout:{clean_id}"
        redis = await self._get_redis()

        if redis:
            try:
                await redis.delete(key)
                return
            except Exception:
                pass

        # In-memory fallback
        _attempt_store.pop(key, None)

    async def is_locked_out(self, identifier: str) -> Tuple[bool, int]:
        """
        Check if an account/IP is locked out.
        Returns (is_locked, remaining_seconds).
        """
        clean_id = identifier.lower().strip()
        key = f"lockout:{clean_id}"
        redis = await self._get_redis()
        now = time.time()

        if redis:
            try:
                locked_until_raw = await redis.hget(key, "locked_until")
                if locked_until_raw:
                    locked_until = float(locked_until_raw)
                    if now < locked_until:
                        return True, max(1, math.ceil(locked_until - now))
                return False, 0
            except Exception:
                pass

        # In-memory fallback
        entry = _attempt_store.get(key)
        if entry:
            locked_until = entry.get("locked_until", 0)
            if now < locked_until:
                return True, max(1, math.ceil(locked_until - now))

        return False, 0

    async def get_attempt_count(self, identifier: str) -> int:
        """Get the current number of failed attempts."""
        clean_id = identifier.lower().strip()
        key = f"lockout:{clean_id}"
        redis = await self._get_redis()

        if redis:
            try:
                val = await redis.hget(key, "attempts")
                return int(val) if val else 0
            except Exception:
                pass

        entry = _attempt_store.get(key)
        return entry.get("attempts", 0) if entry else 0

    async def should_require_captcha(self, identifier: str) -> bool:
        """
        Returns True if failed login attempts for this identifier reach or exceed 3.
        Triggers Cloudflare Turnstile verification dynamically.
        """
        attempts = await self.get_attempt_count(identifier)
        return attempts >= 3


# Singleton
account_lockout_service = AccountLockoutService()
