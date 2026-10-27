"""Observability middleware — request timing, request IDs, slow request logging."""
import time
import uuid
import logging

from fastapi import Request

logger = logging.getLogger(__name__)


async def observability_middleware(request: Request, call_next):
    """Timing and Request ID middleware."""
    start_time = time.time()

    # Trace ID for logs
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    # Security monitoring: log auth/payment paths for attack detection (brute force, recon).
    # Only the path, method, and status are logged — NO request bodies, tokens, or cookies.
    is_sensitive = request.url.path.startswith(("/api/auth", "/api/payments"))
    if is_sensitive:
        logger.info(f"REQ-START: {request.method} {request.url.path} | RID: {request_id}")

    response = await call_next(request)

    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"

    if is_sensitive:
        logger.info(
            f"REQ-DONE: {request.method} {request.url.path} | "
            f"Status: {response.status_code} | Time: {process_time:.2f}s"
        )

    # Log slow requests
    if process_time > 1.0:
        logger.warning(
            f"SLOW-REQ: {request.method} {request.url.path} | "
            f"Time: {process_time:.2f}s | RID: {request_id}"
        )

    return response
