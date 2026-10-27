"""
Podacium API — Main Application Entry Point.

This file is intentionally kept minimal. Business logic lives in:
- app/startup.py — Lifespan (DB connect, Sentry, background tasks, production guards)
- app/routes.py — Router registration
- app/middleware/ — All HTTP middleware
- app/routers/ — Endpoint handlers
- app/services/ — Business logic
"""

import sys
import time
import hashlib
import logging
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope, Receive, Send

from app.core.config import setting
from app.core.prisma import prisma
from app.core.logging_config import configure_logging
from app.core.i18n import get_request_locale, localize_error
from app.startup import lifespan, init_sentry
from app.routes import register_routes
from starlette.exceptions import HTTPException as StarletteHTTPException

# =============================================================================
# INITIALIZATION
# =============================================================================

# Configure structured logging before anything else
configure_logging()

logger = logging.getLogger(__name__)

# Initialize Sentry before app creation
init_sentry()

# Ensure Prisma client is importable
GENERATED_CLIENT_PATH = Path(__file__).parent / "generated/prisma"
if str(GENERATED_CLIENT_PATH) not in sys.path:
    sys.path.append(str(GENERATED_CLIENT_PATH))

# =============================================================================
# APP CREATION
# =============================================================================

app = FastAPI(
    title=setting.APP_NAME,
    description="TamWheel — Sovereign Ethical Agentic Venture & Economic Operating System API",
    version="1.0.0",
    # NEVER enable debug in production — it leaks full Python stack traces to clients.
    # The production guard in startup.py will warn if DEBUG=True, but we force it
    # off here as defense in depth.
    debug=setting.DEBUG if setting.ENVIRONMENT != "production" else False,
    lifespan=lifespan,
    # Interactive documentation available in non-production environments
    docs_url=f"/api/v1/docs-{hashlib.sha256(setting.SECRET_KEY.encode()).hexdigest()[:8]}"
    if setting.ENVIRONMENT != "production"
    else None,
    redoc_url=f"/api/v1/redoc-{hashlib.sha256(setting.SECRET_KEY.encode()).hexdigest()[:8]}"
    if setting.ENVIRONMENT != "production"
    else None,
    # Machine-readable OpenAPI contract
    openapi_url=f"/api/v1/openapi-{hashlib.sha256(setting.SECRET_KEY.encode()).hexdigest()[:8]}.json",
)


@app.get("/api/v1/openapi.json", include_in_schema=False)
async def get_public_openapi():
    from fastapi.openapi.utils import get_openapi

    return get_openapi(title=app.title, version=app.version, routes=app.routes)


# =============================================================================
# PROMETHEUS METRICS
# =============================================================================

from app.middleware.metrics import instrumentator
from app.middleware.trailing_slash import TrailingSlashMiddleware

instrumentator.instrument(app)
instrumentator.expose(app, include_in_schema=False, should_gzip=True)

# =============================================================================
# PATCH: Prometheus instrumentator routing — handle FastAPI _IncludedRouter
# FastAPI 0.138.0 introduced _IncludedRouter for include_router() with prefix.
# The instrumentator's routing.py accesses route.path which _IncludedRouter lacks.
# See https://github.com/trallnag/prometheus-fastapi-instrumentator/issues
# =============================================================================

import prometheus_fastapi_instrumentator.routing as _pfi_routing
from starlette.routing import Match, Mount

_orig_get_route_name = _pfi_routing._get_route_name


def _patched_get_route_name(scope, routes, route_name=None):
    """Handle _IncludedRouter by recursing into original_router.routes."""
    for route in routes:
        match, child_scope = route.matches(scope)
        # FastAPI _IncludedRouter — has original_router + include_context but no .path
        if hasattr(route, "original_router") and hasattr(route, "include_context"):
            prefix = route.include_context.prefix
            sub = {**scope}
            if sub["path"].startswith(prefix):
                sub["path"] = sub["path"][len(prefix) :]
            child = _patched_get_route_name(
                sub, route.original_router.routes, route_name
            )
            if child is not None:
                return child
            route_name = prefix
        elif match == Match.FULL:
            route_name = route.path
            child_scope = {**scope, **child_scope}
            if isinstance(route, Mount) and route.routes:
                child_name = _patched_get_route_name(
                    child_scope, route.routes, route_name
                )
                if child_name is None:
                    route_name = None
                else:
                    route_name += child_name
            return route_name
        elif match == Match.PARTIAL and route_name is None:
            route_name = route.path
    return None


_pfi_routing._get_route_name = _patched_get_route_name

# =============================================================================
# MIDDLEWARE (order matters — last added = first executed)
# =============================================================================

app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def strip_trailing_slash(request: Request, call_next):
    """Strip trailing slashes and rewrite legacy /api/, /admin/, and /auth/ endpoints to /api/v1/."""
    path = request.scope["path"]
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
        request.scope["path"] = path
        request.scope["raw_path"] = request.scope["raw_path"].rstrip(b"/")

    # Legacy prefix / non-versioned route support:
    # 1. /api/... (not /api/v1/) -> /api/v1/...
    # 2. /admin/... -> /api/v1/admin/...
    # 3. /auth/... -> /api/v1/auth/...
    if path.startswith("/api/") and not path.startswith("/api/v1/"):
        new_path = "/api/v1/" + path[5:]
        request.scope["path"] = new_path
        raw = request.scope.get("raw_path", b"")
        if raw.startswith(b"/api/") and not raw.startswith(b"/api/v1/"):
            request.scope["raw_path"] = b"/api/v1/" + raw[5:]
    elif path.startswith("/admin/") or path == "/admin":
        new_path = "/api/v1" + path
        request.scope["path"] = new_path
        raw = request.scope.get("raw_path", b"")
        if raw.startswith(b"/admin"):
            request.scope["raw_path"] = b"/api/v1" + raw
    elif path.startswith("/auth/") or path == "/auth":
        new_path = "/api/v1" + path
        request.scope["path"] = new_path
        raw = request.scope.get("raw_path", b"")
        if raw.startswith(b"/auth"):
            request.scope["raw_path"] = b"/api/v1" + raw

    try:
        return await call_next(request)
    except RuntimeError as exc:
        if "No response returned" in str(exc):
            try:
                is_disconnected = await request.is_disconnected()
            except Exception:
                is_disconnected = True
            if is_disconnected:
                logger.info(
                    f"Client disconnected before response was returned: {request.method} {request.url.path}"
                )
                return Response(status_code=204)
        raise


from app.middleware.security_headers import security_headers_middleware
from app.middleware.body_size_limit import request_body_size_limit_middleware
from app.middleware.db_connection import db_connection_middleware
from app.middleware.observability import observability_middleware
from app.middleware.rate_limit import rate_limit_middleware
from app.middleware.audit import audit_403_middleware
from app.middleware.csrf import csrf_middleware
from app.middleware.idempotency import idempotency_middleware
from app.middleware.correlation import correlation_middleware
from app.middleware.sql_injection import sql_injection_middleware
from app.middleware.pii_scan import pii_scan_middleware

app.middleware("http")(correlation_middleware)
app.middleware("http")(sql_injection_middleware)
app.middleware("http")(security_headers_middleware)
app.middleware("http")(request_body_size_limit_middleware)
app.middleware("http")(csrf_middleware)
app.middleware("http")(db_connection_middleware)
app.middleware("http")(observability_middleware)
app.middleware("http")(rate_limit_middleware)
app.middleware("http")(audit_403_middleware)
app.middleware("http")(idempotency_middleware)
app.middleware("http")(pii_scan_middleware)

# Strip trailing slashes from API paths before route matching (prevents 404s)
app.add_middleware(TrailingSlashMiddleware)

_origins = setting.CORS_ORIGINS
if setting.ENVIRONMENT != "production":
    _origins = _origins + [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://(.*\.)?podacium\.com|http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-Request-ID",
        "x-request-id",
        "X-Idempotency-Key",
        "x-idempotency-key",
        "X-CSRF-Token",
        "x-csrf-token",
        "X-Fingerprint",
        "x-fingerprint",
        "X-Locale",
        "x-locale",
        "Accept-Language",
        "accept-language",
    ],
    expose_headers=[
        "X-CSRF-Token",
        "x-csrf-token",
        "X-Idempotency-Key",
        "x-idempotency-key",
        "X-Request-ID",
        "x-request-id",
    ],
)

# =============================================================================
# ROUTES
# =============================================================================

register_routes(app)


# ── Authenticated static file serving ──────────────────────────────────────
# /static/ URLs are generated by FileResponse objects returned from /api/files/.
# Access requires a valid JWT to prevent unauthenticated reads of uploaded files.
class _AuthenticatedStaticFiles:
    """Wraps StaticFiles with JWT authentication for every request."""

    def __init__(self, directory: Path):
        self.static = StaticFiles(directory=str(directory), check_dir=False)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.static(scope, receive, send)
            return

        # Extract token from query param ?token= or Authorization header
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode()
        query_string = scope.get("query_string", b"").decode()

        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        elif query_string:
            params = dict(p.split("=", 1) for p in query_string.split("&") if "=" in p)
            token = params.get("token")

        if not token:
            # Try cookie (for browser navigation to profile pictures, etc.)
            cookie_header = headers.get(b"cookie", b"").decode()
            for part in cookie_header.split(";"):
                part = part.strip()
                if part.startswith("access_token="):
                    token = part[len("access_token=") :]
                    break

        if not token:
            response = b'{"detail":"Authentication required"}'
            await _send_json(send, 401, response)
            return

        # Verify token
        from app.core.security import verify_token

        payload = verify_token(token)
        if not payload or payload.get("type") != "access":
            response = b'{"detail":"Invalid or expired token"}'
            await _send_json(send, 401, response)
            return

        # Authenticated — serve the file with security headers
        async def secure_send(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                # Inject defensive headers to prevent MIME sniffing and unauthorized cross-origin framing
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"x-frame-options", b"SAMEORIGIN"))
                headers.append(
                    (
                        b"content-security-policy",
                        b"default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; script-src 'none'; object-src 'none'; frame-ancestors 'self' http://localhost:3000 http://localhost:3001 http://127.0.0.1:3000 http://127.0.0.1:3001 https://podacium.com https://*.podacium.com;",
                    )
                )
                headers.append(
                    (b"cache-control", b"private, max-age=3600, no-transform")
                )
                message = {**message, "headers": headers}
            await send(message)

        await self.static(scope, receive, secure_send)


async def _send_json(send: Send, status: int, body: bytes) -> None:
    """Send a raw JSON response via the ASGI send interface."""
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


uploads_dir = (
    Path(setting.UPLOAD_DIR).resolve()
    if Path(setting.UPLOAD_DIR).is_absolute()
    else (Path(__file__).parent.parent / (setting.UPLOAD_DIR or "uploads")).resolve()
)
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", _AuthenticatedStaticFiles(uploads_dir), name="static")

# =============================================================================
# GLOBAL ERROR HANDLERS
# =============================================================================


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Localize error details across en, fr, ar, and kab based on request locale."""
    locale = get_request_locale(request)
    localized_detail, error_code = localize_error(exc.detail, locale)
    headers = getattr(exc, "headers", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": localized_detail, "code": error_code},
        headers=headers,
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Convert ValueError to HTTP 400 Bad Request with locale translation."""
    logger.warning("ValueError on %s: %s", request.url.path, str(exc))
    locale = get_request_locale(request)
    localized_detail, error_code = localize_error(str(exc), locale)
    return JSONResponse(
        status_code=400,
        content={"detail": localized_detail, "code": error_code or "invalid_argument"},
    )


from app.services.bi_services.errors import BIError


@app.exception_handler(BIError)
async def bi_error_handler(request: Request, exc: BIError):
    """Map domain BI errors to structured HTTP 400 responses."""
    logger.warning(
        "BIError on %s: %s [%s]", request.url.path, exc.message, exc.error_type
    )
    locale = get_request_locale(request)
    localized_msg, _ = localize_error(exc.message, locale)
    return JSONResponse(
        status_code=400,
        content={"detail": localized_msg, "code": exc.error_type, "errors": exc.errors},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled 5xx errors and return localized JSON instead of HTML."""
    logger.exception("Unhandled exception: %s", exc)
    locale = get_request_locale(request)
    localized_detail, error_code = localize_error("Internal server error", locale)
    return JSONResponse(
        status_code=500,
        content={"detail": localized_detail, "code": error_code},
    )


@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    """Fallback for plain 500 responses."""
    logger.exception("Internal server error: %s", exc)
    locale = get_request_locale(request)
    localized_detail, error_code = localize_error("Internal server error", locale)
    return JSONResponse(
        status_code=500,
        content={"detail": localized_detail, "code": error_code},
    )


# =============================================================================
# HEALTH & ROOT ENDPOINTS
# =============================================================================


@app.get("/", tags=["health"])
async def root():
    """API root — version info."""
    return {
        "message": f"Welcome to {setting.APP_NAME}",
        "version": "1.0.0",
        "environment": setting.ENVIRONMENT,
    }


@app.get("/api/v1/auth/csrf", tags=["Authentication"])
@app.get("/api/auth/csrf", tags=["Authentication"])
async def get_csrf_token_endpoint(request: Request, response: Response):
    """Retrieve a fresh or existing CSRF token for state-changing requests."""
    from app.middleware.csrf import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, _set_csrf_cookie

    token = request.cookies.get(CSRF_COOKIE_NAME)
    if not token:
        token = _set_csrf_cookie(response)
    else:
        response.headers[CSRF_HEADER_NAME] = token
    return {"csrf_token": token}


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    try:
        try:
            await prisma.execute_raw("SELECT 1")
            db_healthy = True
        except Exception:
            db_healthy = False

        smtp_healthy = None
        if setting.SMTP_HOST:
            try:
                from app.services.email_service import email_service

                smtp_healthy = await email_service.test_connection()
            except Exception:
                smtp_healthy = False

        overall = "healthy" if db_healthy else "degraded"
        return {
            "status": overall,
            "service": setting.APP_NAME,
            "database": "healthy" if db_healthy else "unhealthy",
            "smtp": "healthy"
            if smtp_healthy
            else ("unconfigured" if smtp_healthy is None else "unhealthy"),
            "timestamp": time.time(),
        }
    except Exception:
        return {"status": "degraded", "timestamp": time.time()}


@app.get("/healthz", tags=["health"])
async def health_check_simple():
    """Simple health check for container orchestrators."""
    return {"status": "ok", "service": setting.APP_NAME}
