import asyncio
import logging
from typing import Coroutine, Set

logger = logging.getLogger(__name__)

_background_tasks: Set[asyncio.Task] = set()


def run_background(coro: Coroutine, name: str = "background") -> asyncio.Task:
    task = asyncio.create_task(_wrap_task(coro, name), name=name)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task


async def _wrap_task(coro: Coroutine, name: str) -> None:
    try:
        await coro
    except asyncio.CancelledError:
        logger.warning("Background task '%s' was cancelled", name)
    except Exception:
        logger.exception("Background task '%s' failed", name)
