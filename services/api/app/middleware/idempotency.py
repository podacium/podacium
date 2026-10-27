"""
Idempotency Middleware.

Ensures that requests containing an Idempotency-Key header are only processed once.
Caches and returns the exact same response on duplicate requests.
"""

import json
import logging
from fastapi import Request, Response
from app.services.idempotency_service import idempotency_service
from app.core.security import verify_token

logger = logging.getLogger(__name__)

IDEMPOTENCY_HEADER_NAMES = ["idempotency-key", "x-idempotency-key"]

# Methods to apply idempotency checks on
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths to exclude from idempotency check
EXEMPT_PATHS = {
    "/api/v1/webhooks/",
    "/api/v1/billing/webhooks/",
    "/api/auth/login",
    "/api/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
}


async def idempotency_middleware(request: Request, call_next) -> Response:
    """FastAPI middleware to handle request idempotency."""
    method = request.method.upper()
    path = request.url.path

    if method not in MUTATING_METHODS:
        return await call_next(request)

    # Skip exempt paths
    for exempt_prefix in EXEMPT_PATHS:
        if path.startswith(exempt_prefix):
            return await call_next(request)

    # Extract idempotency key
    idempotency_key = None
    for header_name in IDEMPOTENCY_HEADER_NAMES:
        idempotency_key = request.headers.get(header_name) or request.headers.get(
            header_name.upper()
        )
        if idempotency_key:
            break

    if not idempotency_key:
        return await call_next(request)

    # Extract user ID from JWT token to partition keys by user (critical security isolation)
    user_id = 0
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header[7:]

    if token and token.startswith("sk_"):
        try:
            from app.services.api_key_service import api_key_service

            key_ctx = await api_key_service.verify_api_key_context(token)
            if key_ctx:
                user_id = key_ctx.user_id
        except Exception:
            pass
    elif token:
        try:
            payload = verify_token(token)
            if payload and "sub" in payload:
                user_id = int(payload["sub"])
        except Exception:
            pass

    # 1. Check if key has already been processed
    is_duplicate, cached_response = await idempotency_service.check_idempotency(
        idempotency_key, user_id
    )
    if is_duplicate and cached_response:
        logger.info(
            f"Idempotency hit! Returning cached response for key {idempotency_key} (user {user_id})"
        )
        return Response(
            content=json.dumps(cached_response.get("body", "")),
            status_code=cached_response.get("status_code", 200),
            headers=cached_response.get("headers", {}),
            media_type="application/json",
        )

    # 2. Acquire in-flight mutex to block concurrent double-submissions
    from app.core.redis import get_redis

    lock_acquired = False
    lock_key = f"idempotency:lock:{user_id}:{idempotency_key}"
    redis_conn = await get_redis()
    if redis_conn:
        try:
            res = await redis_conn.set(lock_key, "PROCESSING", nx=True, ex=45)
            if not res:
                return Response(
                    content=json.dumps(
                        {
                            "detail": "A concurrent request with this idempotency key is already in progress.",
                            "code": "CONCURRENT_IDEMPOTENT_REQUEST",
                        }
                    ),
                    status_code=409,
                    media_type="application/json",
                )
            lock_acquired = True
        except Exception as e:
            logger.warning(f"Failed to acquire idempotency lock in redis: {e}")

    try:
        # 3. Process downstream request
        response = await call_next(request)

        # Cache response only if it was successful (2xx) or standard validation 4xx (400, 409, 422).
        # Never cache auth/security failures (401, 403, 429) or 5xx server errors.
        if (200 <= response.status_code < 300) or response.status_code in (
            400,
            409,
            422,
        ):
            # Read the body of the response safely
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk

            try:
                body_json = json.loads(response_body.decode("utf-8"))
            except Exception:
                body_json = response_body.decode("utf-8")

            # Cache it in Redis/DB
            cache_payload = {
                "body": body_json,
                "status_code": response.status_code,
                "headers": dict(response.headers),
            }
            await idempotency_service.store_response(
                idempotency_key, user_id, cache_payload
            )

            # Re-construct response since we consumed the body iterator
            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        return response
    finally:
        if redis_conn and lock_acquired:
            try:
                await redis_conn.delete(lock_key)
            except Exception:
                pass

    return response
