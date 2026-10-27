"""Audit middleware for security-relevant responses."""

import logging

from fastapi import Request

logger = logging.getLogger(__name__)


async def audit_403_middleware(request: Request, call_next):
    """Audit middleware specifically for 403 Forbidden responses."""
    response = await call_next(request)

    if response.status_code == 403:
        client_host = request.client.host if request.client else "unknown"
        origin = request.headers.get("origin", "no-origin")
        detail_msg = ""
        body = getattr(response, "body", None)
        if body:
            try:
                import json

                data = json.loads(body.decode("utf-8", errors="ignore"))
                detail = data.get("detail") or data.get("message") or data
                detail_msg = f" | Detail: {detail}"
            except Exception:
                pass
        logger.error(
            f"AUDIT-403: {request.method} {request.url.path} | "
            f"Host: {client_host} | Origin: {origin}{detail_msg}"
        )

    return response
