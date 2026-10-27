"""Rate limiting middleware — Redis-backed with in-memory sliding window fallback.

Design decisions:
- Redis is the primary store. If Redis is unavailable, auth-critical paths
  (login, MFA, phone verification) FAIL CLOSED with 503 so brute-force
  protection can never silently vanish during an outage/attack. Less sensitive
  paths fall back to an in-memory sliding window (per-process, safe but not
  multi-worker) while a critical log is emitted once per minute.
- The in-memory fallback uses a sliding window (list of timestamps per key) with
  automatic expiry. This is safe but does NOT scale across multiple workers.
- When Redis connectivity is restored, the next request automatically picks it up
  (the connection pool is created lazily per request).
"""

import time
import asyncio
import logging

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.core.config import setting

logger = logging.getLogger(__name__)

_RATE_LIMIT_TIERS = [
    ("/api/auth/reset-password", 5),
    ("/api/v1/auth/reset-password", 5),
    ("/api/auth/forgot-password", 5),
    ("/api/v1/auth/forgot-password", 5),
    ("/api/auth/verify-email", 10),
    ("/api/v1/auth/verify-email", 10),
    ("/api/auth/ws-ticket", 120),
    ("/api/v1/auth/ws-ticket", 120),
    ("/api/auth/login", 15),
    ("/api/v1/auth/login", 15),
    ("/api/auth", 30),
    ("/api/v1/auth", 30),
    ("/api/mfa/status", 60),
    ("/api/v1/mfa/status", 60),
    ("/api/mfa/backup-codes", 60),
    ("/api/v1/mfa/backup-codes", 60),
    ("/api/mfa/webauthn", 30),
    ("/api/v1/mfa/webauthn", 30),
    ("/api/mfa", 15),
    ("/api/v1/mfa", 15),
    ("/api/phone", 10),
    ("/api/v1/phone", 10),
    ("/api/tickets", 60),
    ("/api/v1/tickets", 60),
    ("/api/v1/billing", 30),
    ("/api/v1/payment", 30),
    ("/api/v1/files", 30),
    ("/api/admin", 120),
    ("/api/v1/admin/iam", 60),
    ("/api/v1/admin", 120),
    ("/api/v1/search", 120),
    # Education video signed-URL minting — authenticated + entitlement-checked,
    # but still rate-limited to prevent paid-video catalog harvesting.
    ("/api/v1/education/video/signed-url", 60),
    # Freelancing rate limits
    ("/api/v1/freelance/proposals/", 10),
    ("/api/v1/freelance/reviews", 10),
    ("/api/v1/freelance/contracts", 30),
    ("/api/v1/freelance/projects", 30),
    ("/api/v1/freelance/disputes", 5),
    # BI Analytics & Database Connectors rate limits
    ("/api/bi/analytics", 30),
    ("/api/bi/connectors/query", 10),
    ("/api/bi/datasets/upload", 15),
    ("/api/bi/embed/token", 20),
]

_DEFAULT_RATE_LIMIT = 120

# Paths where rate limiting must NEVER silently disappear: if Redis is down
# these fail closed (503) rather than opening the floodgates.
_CRITICAL_PATHS = (
    "/api/auth",
    "/api/v1/auth",
    "/api/mfa",
    "/api/v1/mfa",
    "/api/phone",
    "/api/v1/phone",
)

_EXEMPT_PATHS = (
    "/health",
    "/healthz",
    "/metrics",
    "/api/v1/docs",
    "/api/v1/redoc",
    "/api/v1/openapi.json",
)

# How long (in seconds) between WARNING-level log messages when Redis is down
_LOG_THROTTLE_SECONDS = 60

# In-memory store max entries before eviction (LRU, key insertion order)
_MAX_STORE_ENTRIES = 5000
_TRIM_TARGET = 4000


def _get_rate_limit(path: str) -> int:
    for prefix, limit in _RATE_LIMIT_TIERS:
        if path.startswith(prefix):
            return limit
    if path.startswith("/api"):
        return _DEFAULT_RATE_LIMIT
    return 0


async def _check_redis(app, key: str, max_requests: int) -> bool | None:
    """Check rate limit via Redis. Returns True if over limit, False if OK, None if Redis unavailable."""
    import redis.asyncio as aioredis

    current_loop = asyncio.get_running_loop()
    pool = getattr(app.state, "redis_pool", None)
    pool_loop = getattr(app.state, "redis_pool_loop", None)

    # Redis connections are bound to the event loop they were created on.
    # pytest-asyncio runs each test in a fresh loop, so a pool cached from a
    # previous loop raises "attached to a different loop" and spuriously fails
    # closed. Recreate the pool whenever the loop changed.
    if pool is None or pool_loop is not current_loop:
        redis_url = getattr(setting, "REDIS_URL", "")
        if redis_url:
            pool = aioredis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                max_connections=20,
            )
            app.state.redis_pool = pool
            app.state.redis_pool_loop = current_loop
        else:
            return None

    try:
        count = await pool.incr(key)
        if count == 1:
            await pool.expire(key, 120)
        return count > max_requests
    except Exception:
        # Drop the cached pool — it may be bound to a stale/closed event loop
        # (e.g. across pytest-asyncio loops or a uvicorn reload). Recreating it
        # on the next request lets Redis reconnect in the current loop instead
        # of permanently failing the connection.
        app.state.redis_pool = None
        app.state.redis_pool_loop = None
        return None


def _check_in_memory(app, key: str, max_requests: int) -> bool:
    """Sliding-window in-memory rate limit check. Returns True if over limit."""
    if not hasattr(app.state, "rate_limit_store"):
        app.state.rate_limit_store = {}

    store = app.state.rate_limit_store
    now_ts = time.time()
    cutoff = now_ts - 60

    entries = store.get(key, [])
    entries = [t for t in entries if t > cutoff]

    if len(entries) >= max_requests:
        store[key] = entries
        return True

    entries.append(now_ts)
    store[key] = entries

    if len(store) > _MAX_STORE_ENTRIES:
        excess = len(store) - _TRIM_TARGET
        for k in list(store.keys())[:excess]:
            del store[k]

    return False


def _log_fallback_once(app, path_segment: str, error: str) -> None:
    """Log at most once per _LOG_THROTTLE_SECONDS per path segment."""
    now_ts = int(time.time())
    alert_key = f"rl_fallback:{path_segment}"
    last_alert = getattr(app.state, alert_key, 0)
    if now_ts - last_alert > _LOG_THROTTLE_SECONDS:
        logger.critical(
            f"Rate limiter falling back to in-memory store. "
            f"Redis unavailable: {error}. "
            f"Rate limiting will NOT work across multiple workers. "
            f"Restore Redis connectivity immediately."
        )
        setattr(app.state, alert_key, now_ts)


async def check_entity_rate_limit(
    request: Request,
    key: str,
    max_requests: int,
    window_seconds: int = 60,
) -> None:
    """Per-entity rate limit (e.g. per session or per user), Redis-backed with the
    same in-memory sliding-window fallback as the middleware.

    Raises HTTP 429 with a ``Retry-After`` header when the limit is exceeded.
    """
    result = await _check_redis(request.app, key, max_requests)
    if result is True:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many requests. Please try again later.",
                "code": "RATE_LIMITED",
            },
            headers={"Retry-After": str(_retry_after(window_seconds))},
        )
    if result is False:
        return

    _log_fallback_once(
        request.app,
        key.split(":")[1] if len(key.split(":")) > 1 else "api",
        "Redis unavailable for entity rate limit",
    )

    if _check_in_memory(request.app, key, max_requests):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Too many requests. Please try again later.",
                "code": "RATE_LIMITED",
            },
            headers={"Retry-After": str(_retry_after(window_seconds))},
        )


def _retry_after(window_seconds: int) -> int:
    return max(window_seconds - (int(time.time()) % window_seconds), 1)


async def rate_limit_middleware(request: Request, call_next):
    if not setting.RATE_LIMIT_ENABLED:
        return await call_next(request)

    path = request.url.path

    if path.startswith(_EXEMPT_PATHS) or not path.startswith("/api"):
        return await call_next(request)

    max_requests = _get_rate_limit(path)
    if max_requests == 0:
        return await call_next(request)

    app = request.app
    client_ip = request.client.host if request.client else "unknown"
    window = int(time.time()) // 60
    if "ws-ticket" in path:
        seg = "ws-ticket"
    elif path in ("/api/auth/login", "/api/v1/auth/login"):
        seg = "auth-login"
    else:
        seg = path.split("/")[2] if len(path.split("/")) > 2 else "api"
    key = f"rl:{client_ip}:{seg}:{window}"

    result = await _check_redis(app, key, max_requests)
    if result is True:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests. Please try again later."},
        )
    if result is False:
        return await call_next(request)

    # Redis unavailable — fail closed for auth-critical paths, otherwise
    # fall back to the per-process in-memory store.
    _log_fallback_once(app, seg, "Redis connection failed or REDIS_URL not configured")

    if path.startswith(_CRITICAL_PATHS):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Service temporarily unavailable. Please retry."},
        )

    if _check_in_memory(app, key, max_requests):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests. Please try again later."},
        )

    return await call_next(request)
