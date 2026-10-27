"""
Request body size limit middleware.

Rejects requests with bodies exceeding a configured maximum before they
reach endpoint handlers, preventing memory exhaustion from oversized payloads.
"""

import logging
from fastapi import Request, Response, status


logger = logging.getLogger(__name__)

# Maximum JSON/form body size in bytes (separate from multipart file upload limits).
# File uploads are handled by the file_service which enforces MAX_FILE_SIZE
# independently. This covers all other POST/PUT/PATCH bodies.
_MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB


async def request_body_size_limit_middleware(request: Request, call_next):
    """Reject oversized request bodies before they reach handlers."""
    # Only check state-changing methods that carry a body
    if request.method in ("POST", "PUT", "PATCH"):
        content_type = request.headers.get("content-type", "").lower()

        # Skip multipart (file uploads) — those are validated by file_service
        if "multipart/form-data" in content_type:
            return await call_next(request)

        # Check Content-Length header first (fast path)
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > _MAX_BODY_SIZE:
                    logger.warning(
                        f"Request body too large: {content_length} bytes "
                        f"(method={request.method}, path={request.url.path})"
                    )
                    return Response(
                        content='{"detail":"Request body too large"}',
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        media_type="application/json",
                    )
            except (ValueError, TypeError):
                pass

        # Clamp the raw body stream to prevent reading more than allowed.
        # Capture the original receive BEFORE patching to avoid infinite recursion.
        _original_receive = request._receive

        async def receive():
            async def inner_receive():
                msg = await _original_receive()
                if msg["type"] == "http.request":
                    body = msg.get("body", b"")
                    if len(body) > _MAX_BODY_SIZE:
                        logger.warning(
                            f"Chunked body exceeded limit: {len(body)} bytes "
                            f"(method={request.method}, path={request.url.path})"
                        )
                        raise ValueError("Request body too large")
                return msg

            request._receive = inner_receive
            return await _original_receive()

        request._receive = receive

    return await call_next(request)
