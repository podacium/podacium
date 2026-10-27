"""Database connection health middleware."""
import logging

from fastapi import Request

logger = logging.getLogger(__name__)


async def db_connection_middleware(request: Request, call_next):
    """Ensure database connection is active and healthy for every request."""
    # Skip for health checks to avoid circular/redundant work
    if request.url.path in ["/health", "/healthz"]:
        return await call_next(request)

    from app.core.prisma import ensure_connection

    try:
        await ensure_connection()
    except Exception as e:
        logger.error(f"Failed to ensure database connection: {e}")

    return await call_next(request)
