"""
CSRF Protection Middleware.

Uses the Double-Submit Cookie pattern: the server sets a csrf_token cookie
on every GET response, and the client must echo it back as the X-CSRF-Token
header on every unsafe (POST/PUT/DELETE/PATCH) request. The server compares
cookie value vs header value using constant-time comparison.

All unsafe methods are validated regardless of auth cookies. This is defense
in depth: even though SameSite=Lax prevents cross-site cookie sending, an
explicit CSRF token check prevents:
  1. Subdomain cookie injection attacks (non-__Host- prefixed cookies).
  2. Same-site script inclusion attacks.
  3. Compromised subdomain → API subdomain CSRF.

Webhook endpoints and auth login/register paths are exempt.
"""

import logging
import secrets
from typing import Set

from fastapi import Request, Response

from app.core.config import setting

logger = logging.getLogger(__name__)

CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_TOKEN_LENGTH = 32

_IS_SECURE = setting.ENVIRONMENT == "production"

CSRF_EXEMPT_PATHS: Set[str] = {
    "/health",
    "/healthz",
    "/metrics",
    "/api/v1/docs",
    "/api/v1/redoc",
    "/api/v1/openapi.json",
}

CSRF_EXEMPT_PREFIXES = (
    "/api/v1/webhooks/",
    "/api/v1/billing/webhooks/",
    "/api/v1/education/video/webhook/",
    "/api/education/video/webhook/",
    "/api/auth/oauth/",
    "/api/v1/auth/csrf",
    "/api/auth/csrf",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/check-email",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/refresh-token",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/logout",
    "/api/v1/auth/resend-verification",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/check-email",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/refresh-token",
    "/api/auth/verify-email",
    "/api/auth/logout",
    "/api/auth/resend-verification",
    "/api/onboarding",
    # Public anonymous endpoints — no authenticated session to protect, so
    # requiring a CSRF token would block legitimate public form submissions.
    "/api/v1/waitlist/register",
    "/api/waitlist/register",
    "/api/v1/newsletter/subscribe",
    "/api/newsletter/subscribe",
    "/api/v1/contact",
    "/api/contact",
    "/api/v1/support/",
    "/api/support/",
    "/api/v1/agent/chat",
    "/api/agent/chat",
    "/ws",
)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _generate_csrf_token() -> str:
    return secrets.token_hex(CSRF_TOKEN_LENGTH)


def _is_exempt(path: str, request: Request | None = None) -> bool:
    if path in ("/api/v1/agent/chat", "/api/agent/chat"):
        # Authenticated requests with session cookies must validate CSRF to prevent cross-site session spoofing
        if request and (
            request.cookies.get("__Host-access_token")
            or request.cookies.get("access_token")
        ):
            return False
        return True
    if path in CSRF_EXEMPT_PATHS:
        return True
    for prefix in CSRF_EXEMPT_PREFIXES:
        if path.startswith(prefix):
            return True
    # Endpoints triggered via navigator.sendBeacon during page unload cannot attach custom headers
    if path.endswith("/leave") and "/live-sessions/" in path:
        return True
    return False


def _set_csrf_cookie(response: Response, token: str | None = None) -> str:
    if not token:
        token = _generate_csrf_token()
    domain = (
        setting.COOKIE_DOMAIN
        if (not CSRF_COOKIE_NAME.startswith("__Host-") and setting.COOKIE_DOMAIN)
        else None
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        samesite="lax",
        secure=_IS_SECURE or setting.ENVIRONMENT == "production",
        max_age=86400,
        path="/",
        domain=domain,
    )
    response.headers[CSRF_HEADER_NAME] = token
    return token


async def csrf_middleware(request: Request, call_next) -> Response:
    path = request.url.path
    method = request.method.upper()

    is_login_register = path in {
        "/api/v1/auth/login",
        "/api/auth/login",
        "/api/v1/auth/register",
        "/api/auth/register",
    }

    existing_cookie_token = request.cookies.get(CSRF_COOKIE_NAME)

    if _is_exempt(path, request) and not is_login_register:
        response = await call_next(request)
        if not existing_cookie_token and CSRF_HEADER_NAME not in response.headers:
            _set_csrf_cookie(response)
        elif existing_cookie_token and CSRF_HEADER_NAME not in response.headers:
            response.headers[CSRF_HEADER_NAME] = existing_cookie_token
        return response

    if is_login_register:
        response = await call_next(request)
        _set_csrf_cookie(response)
        return response

    if method in SAFE_METHODS:
        response = await call_next(request)
        if not existing_cookie_token and CSRF_HEADER_NAME not in response.headers:
            _set_csrf_cookie(response)
        elif existing_cookie_token and CSRF_HEADER_NAME not in response.headers:
            response.headers[CSRF_HEADER_NAME] = existing_cookie_token
        return response

    cookie_token = existing_cookie_token
    header_token = request.headers.get(CSRF_HEADER_NAME)

    if not cookie_token or not header_token:
        logger.warning(
            f"CSRF validation failed: missing token (path={path}) "
            f"[cookie_token={bool(cookie_token)}, header_token={bool(header_token)}, "
            f"cookie_val={cookie_token[:6] if cookie_token else 'NONE'}, "
            f"header_val={header_token[:6] if header_token else 'NONE'}]"
        )
        return Response(
            content='{"detail": "CSRF token missing"}',
            status_code=403,
            media_type="application/json",
        )

    if not secrets.compare_digest(cookie_token, header_token):
        logger.warning(f"CSRF validation failed: token mismatch (path={path})")
        return Response(
            content='{"detail": "CSRF token invalid"}',
            status_code=403,
            media_type="application/json",
        )

    response = await call_next(request)
    _set_csrf_cookie(response, token=cookie_token)
    return response
