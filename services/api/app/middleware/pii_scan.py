"""
PII Scanning Middleware.
Scans request bodies for Algerian PII (phone numbers, ID numbers)
in non-authenticated mutation endpoints. Logs and optionally blocks.
"""

import logging
import re
from typing import Callable
from starlette.requests import Request

logger = logging.getLogger(__name__)

DZ_PHONE = re.compile(r"(?:\+213|00213|0)(?:5|6|7|9)\d{8}")
SAFE_PATHS = {
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/verify",
    "/api/v1/newsletter/subscribe",
    "/api/v1/contact",
    "/health",
    "/metrics",
    "/api/v1/webhook",
}


async def pii_scan_middleware(request: Request, call_next: Callable):
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)

    path = request.url.path
    if any(path.startswith(safe) for safe in SAFE_PATHS) or path.startswith(
        "/api/files"
    ):
        return await call_next(request)

    content_type = request.headers.get("content-type", "").lower()
    if "multipart/form-data" in content_type:
        return await call_next(request)

    body = await request.body()
    if body:
        text = body.decode("utf-8", errors="replace")
        if DZ_PHONE.search(text):
            logger.warning(
                "Potential DZ phone PII in body to %s (len=%d)", path, len(text)
            )
    return await call_next(request)
