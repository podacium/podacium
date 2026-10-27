"""
Bridge utility for running asynchronous coroutines safely inside Celery worker processes.
Prevents 'Event loop is closed' crashes and Prisma engine disconnects by maintaining
a persistent background event loop per worker thread/process.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, Callable, Coroutine, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_worker_loop: asyncio.AbstractEventLoop | None = None
_worker_thread: threading.Thread | None = None
_loop_lock = threading.Lock()


def _background_loop_worker(loop: asyncio.AbstractEventLoop) -> None:
    """Target function for dedicated background event loop thread."""
    asyncio.set_event_loop(loop)
    try:
        loop.run_forever()
    finally:
        try:
            # Drain and cancel pending tasks before closing
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(
                    asyncio.gather(*pending, return_exceptions=True)
                )
        except Exception:
            pass
        loop.close()


def get_worker_event_loop() -> asyncio.AbstractEventLoop:
    """
    Get or spawn a persistent, thread-safe background asyncio event loop
    for the current Celery worker process.
    """
    global _worker_loop, _worker_thread
    with _loop_lock:
        if (
            _worker_loop is None
            or not _worker_loop.is_running()
            or _worker_loop.is_closed()
        ):
            _worker_loop = asyncio.new_event_loop()
            _worker_thread = threading.Thread(
                target=_background_loop_worker,
                args=(_worker_loop,),
                name="CeleryPersistentAsyncLoop",
                daemon=True,
            )
            _worker_thread.start()
            logger.info(
                "Initialized persistent background event loop for Celery worker process."
            )
        return _worker_loop


def run_async_in_worker(
    coro: Coroutine[Any, Any, T], timeout: float | None = None
) -> T:
    """
    Execute a coroutine in the persistent worker event loop safely.
    Works whether Celery is running synchronously, multi-threaded, or in eager test mode.
    """
    target_loop = get_worker_event_loop()

    # Prevent deadlock if called from within the background loop thread itself
    if _worker_thread is not None and threading.current_thread() is _worker_thread:
        raise RuntimeError(
            "run_async_in_worker cannot be called synchronously from within the background loop thread"
        )

    future = asyncio.run_coroutine_threadsafe(coro, target_loop)
    return future.result(timeout=timeout)


def async_to_sync(coro_fn: Callable[..., Coroutine[Any, Any, T]]) -> Callable[..., T]:
    """
    Drop-in replacement for asgiref.sync.async_to_sync that bridges to
    the persistent worker event loop without creating or destroying loops per task.
    """

    def wrapper(*args: Any, **kwargs: Any) -> T:
        return run_async_in_worker(coro_fn(*args, **kwargs))

    wrapper.__name__ = getattr(coro_fn, "__name__", "async_to_sync_wrapper")
    wrapper.__doc__ = getattr(coro_fn, "__doc__", None)
    return wrapper
