import logging
import asyncio
import sys
import types as _py_types
from typing import Any, Dict, List, Union
import datetime

# Ensure runtime proxy for Prisma types is installed to prevent loading 567k lines
if "app.generated.prisma.types" not in sys.modules:

    class _PrismaLazyTypes(_py_types.ModuleType):
        Serializable = Union[
            None, bool, float, int, str, datetime.datetime, List[Any], Dict[Any, Any]
        ]

        def __getattr__(self, name: str) -> Any:
            return object

    sys.modules["app.generated.prisma.types"] = _PrismaLazyTypes(
        "app.generated.prisma.types"
    )

from app.generated.prisma import Prisma

logger = logging.getLogger(__name__)

# Initialize Prisma client
prisma = Prisma()

# Async lock to prevent concurrent reconnection races (thundering herd)
_connection_lock = asyncio.Lock()

# Celery children keep one Prisma engine for their whole lifetime. Tearing it
# down after every task adds latency and can deadlock in the client's engine
# shutdown (``do_wait``); the worker shutdown hook disconnects it instead.
_worker_process = False


def set_worker_process_mode(enabled: bool = True) -> None:
    """Mark this process as a Celery worker child."""
    global _worker_process
    _worker_process = enabled


async def connect_prisma():
    """Connect to the database with auto-reconnect logic and concurrency locking."""
    async with _connection_lock:
        # Check if already connected and healthy inside lock
        if prisma.is_connected():
            try:
                await asyncio.wait_for(prisma.execute_raw("SELECT 1"), timeout=2.0)
                return True
            except Exception as e:
                logger.warning(
                    f"⚠️ Prisma connected but unhealthy: {e}. Reconnecting..."
                )
                try:
                    await prisma.disconnect()
                except Exception:
                    pass

        max_retries = 3
        retry_delay = 1

        for attempt in range(max_retries):
            try:
                if not prisma.is_connected():
                    logger.info(
                        f"🔄 Database connection attempt {attempt + 1}/{max_retries}..."
                    )
                    await prisma.connect()
                    logger.info("✅ Database connected successfully")
                return True
            except Exception as e:
                error_str = str(e)
                if "Already connected" in error_str:
                    logger.info("✅ Database already connected")
                    return True
                logger.error(
                    f"❌ Database connection attempt {attempt + 1} failed: {e}"
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)

        # Fallback check
        if prisma.is_connected():
            return True
        return False


async def disconnect_prisma(force: bool = False):
    """Disconnect from the database.

    In a Celery worker the connection is intentionally kept alive between
    tasks; only the worker shutdown hook may force a disconnect.
    """
    if _worker_process and not force:
        return
    async with _connection_lock:
        try:
            if prisma.is_connected():
                await prisma.disconnect()
                logger.info("✅ Database disconnected successfully")
        except Exception as e:
            logger.error(f"❌ Database disconnection failed: {e}")


async def ensure_connection():
    """Ensure database connection is active."""
    if prisma.is_connected():
        return True
    return await connect_prisma()


async def get_prisma():
    """Get Prisma instance, ensuring it's connected"""
    await ensure_connection()
    return prisma
