"""
Background task: periodically purge expired idempotency keys from the database.

Idempotency keys have an `expiresAt` timestamp set when they're stored.
This task runs every 6 hours and deletes all keys past their expiry.

Run via: app/startup.py (asyncio.create_task)
"""

import asyncio
import logging
from datetime import datetime, timezone

from app.core.prisma import prisma

logger = logging.getLogger(__name__)

_CLEANUP_INTERVAL_SECONDS = 6 * 60 * 60  # every 6 hours


async def cleanup_expired_idempotency_keys() -> int:
    """Delete idempotency keys where expiresAt is in the past. Returns count deleted."""
    now = datetime.now(timezone.utc)
    result = await prisma.idempotencykey.delete_many(where={"expiresAt": {"lt": now}})
    if result > 0:
        logger.info(f"Cleaned up {result} expired idempotency key(s)")
    return result


async def idempotency_cleanup_loop() -> None:
    """Periodic background loop that purges expired idempotency keys."""
    logger.info(
        f"Idempotency cleanup task started (interval={_CLEANUP_INTERVAL_SECONDS}s)"
    )
    while True:
        try:
            await cleanup_expired_idempotency_keys()
        except Exception as e:
            logger.error(f"Idempotency cleanup failed: {e}")
        await asyncio.sleep(_CLEANUP_INTERVAL_SECONDS)
