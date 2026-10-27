"""
services/api/app/agent/providers/circuit_breaker.py
Production Circuit Breaker with exponential backoff and full jitter.
"""

import time
import random
import asyncio
from enum import Enum
from typing import Optional


class CircuitState(Enum):
    CLOSED = "closed"  # Healthy, traffic flows
    OPEN = "open"  # Failing, traffic rejected
    HALF_OPEN = "half_open"  # Probe request testing recovery


class CircuitBreaker:
    """Manages failure thresholds and recovery cooldowns for LLM providers."""

    def __init__(
        self, failure_threshold: int = 5, recovery_timeout_seconds: float = 60.0
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout_seconds
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0.0
        self._half_open_in_flight = False
        self._lock = asyncio.Lock()

    async def can_execute(self) -> bool:
        async with self._lock:
            now = time.monotonic()
            if self.state == CircuitState.OPEN:
                if now - self.last_failure_time >= self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self._half_open_in_flight = True
                    return True
                return False
            if self.state == CircuitState.HALF_OPEN:
                if not self._half_open_in_flight:
                    self._half_open_in_flight = True
                    return True
                return False
            return True

    async def record_success(self):
        async with self._lock:
            self.failure_count = 0
            self.state = CircuitState.CLOSED
            self._half_open_in_flight = False

    async def record_failure(self):
        async with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.monotonic()
            self._half_open_in_flight = False
            if (
                self.state == CircuitState.HALF_OPEN
                or self.failure_count >= self.failure_threshold
            ):
                self.state = CircuitState.OPEN


def calculate_jitter_backoff(
    attempt: int,
    base_backoff: float = 0.5,
    max_backoff: float = 8.0,
    retry_after: Optional[float] = None,
) -> float:
    """Calculates exponential backoff with full jitter, honoring Retry-After headers."""
    if retry_after is not None and retry_after > 0:
        return retry_after
    backoff_cap = min(max_backoff, base_backoff * (2**attempt))
    return random.uniform(0, backoff_cap)
