import logging
from enum import Enum
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class PaymentFallbackMode(str, Enum):
    STRICT = "STRICT"
    WALLET_ONLY = "WALLET_ONLY"
    AUTO_RETRY = "AUTO_RETRY"


class PaymentFallbackState:
    """Manages fallback state for payment gateway failures.

    Tracks retry count, cooldown period, and automatically escalates
    the fallback mode when consecutive failures exceed the threshold.
    """

    def __init__(
        self,
        max_retries: int = 3,
        cooldown_seconds: int = 300,
    ):
        self._mode: PaymentFallbackMode = PaymentFallbackMode.STRICT
        self._retry_count: int = 0
        self._max_retries: int = max_retries
        self._cooldown_seconds: int = cooldown_seconds
        self._cooldown_until: Optional[datetime] = None

    @property
    def mode(self) -> PaymentFallbackMode:
        return self._mode

    @property
    def retry_count(self) -> int:
        return self._retry_count

    @property
    def cooldown_until(self) -> Optional[datetime]:
        return self._cooldown_until

    def can_retry(self) -> bool:
        """Check if another retry is allowed under current state."""
        if self._cooldown_until and datetime.utcnow() < self._cooldown_until:
            logger.info(
                f"Fallback in cooldown until {self._cooldown_until.isoformat()}, "
                f"mode={self._mode.value}"
            )
            return False
        return self._retry_count < self._max_retries

    def record_failure(self) -> None:
        """Record a failure and escalate mode if threshold is reached."""
        self._retry_count += 1
        logger.warning(
            f"Payment failure recorded: retry={self._retry_count}/{self._max_retries}"
        )
        if self._retry_count >= self._max_retries:
            self._mode = PaymentFallbackMode.WALLET_ONLY
            self._cooldown_until = datetime.utcnow() + timedelta(
                seconds=self._cooldown_seconds
            )
            logger.info(
                f"Fallback escalated to {self._mode.value}, "
                f"cooldown until {self._cooldown_until.isoformat()}"
            )

    def record_success(self) -> None:
        """Record a success and reset to STRICT mode."""
        old_mode = self._mode
        self._mode = PaymentFallbackMode.STRICT
        self._retry_count = 0
        self._cooldown_until = None
        if old_mode != PaymentFallbackMode.STRICT:
            logger.info(f"Fallback reset from {old_mode.value} to STRICT")
