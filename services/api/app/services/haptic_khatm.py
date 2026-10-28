"""
TamWheel Sovereign Ethical Agentic Venture OS — Sovereign Haptic Khatm Ceremony & Cooling-Off Service.
Pillar 6 / Phase 3 Expansion: Replaces gamified confetti with the dignified Sovereign Wax Stamp (Haptic Khatm).
- 80ms tactile pulse and resonant acoustic bronze tone tokens.
- Mandatory 3-second ethical reflection slider.
- Statutory 72-hour cooling-off window (100% refund, no questions asked cancellation).
"""

from __future__ import annotations

import hashlib
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MANDATORY_REFLECTION_SECONDS = 3.0
COOLING_OFF_PERIOD_HOURS = 72
COOLING_OFF_PERIOD_SECONDS = COOLING_OFF_PERIOD_HOURS * 3600  # 259,200 sec

HAPTIC_PROFILE = {
    "pulseDurationMs": 80,
    "pattern": [80, 40, 80],
    "microNotches": [25, 50, 75, 100],
    "soundEffect": "fx_khatm_chime",
    "frequenciesHz": [1840, 3680],
    "sealColorHex": "#2E7D52",  # Sovereign Emerald & Gold
}


class KhatmPledgeRecord:
    def __init__(
        self,
        khatm_id: str,
        user_id: int,
        startup_id: str,
        amount_dzd: int,
        equity_share_pct: Optional[float] = None,
        sealed_at: Optional[float] = None,
    ):
        self.khatm_id = khatm_id
        self.user_id = user_id
        self.startup_id = startup_id
        self.amount_dzd = amount_dzd
        self.equity_share_pct = equity_share_pct or 0.0
        self.sealed_at = sealed_at or time.time()
        self.cooling_off_expires_at = self.sealed_at + COOLING_OFF_PERIOD_SECONDS
        self.status = "PENDING_COOLING_OFF"  # PENDING_COOLING_OFF, FINALIZED, CANCELLED_REFUNDED
        self.khatm_seal_hash = hashlib.sha256(
            f"KHATM:{khatm_id}:{user_id}:{startup_id}:{amount_dzd}:{self.sealed_at}".encode()
        ).hexdigest()

    def is_cooling_off_active(self, now: Optional[float] = None) -> bool:
        if now is None:
            now = time.time()
        return self.status == "PENDING_COOLING_OFF" and now < self.cooling_off_expires_at

    def remaining_cooling_off_seconds(self, now: Optional[float] = None) -> float:
        if now is None:
            now = time.time()
        if not self.is_cooling_off_active(now):
            return 0.0
        return max(0.0, self.cooling_off_expires_at - now)

    def to_dict(self, now: Optional[float] = None) -> Dict[str, Any]:
        if now is None:
            now = time.time()
        return {
            "khatmId": self.khatm_id,
            "userId": self.user_id,
            "startupId": self.startup_id,
            "amountDzd": self.amount_dzd,
            "equitySharePct": self.equity_share_pct,
            "sealedAt": self.sealed_at,
            "coolingOffExpiresAt": self.cooling_off_expires_at,
            "isCoolingOffActive": self.is_cooling_off_active(now),
            "remainingCoolingOffSeconds": round(self.remaining_cooling_off_seconds(now), 1),
            "status": self.status,
            "khatmSealHash": self.khatm_seal_hash,
            "hapticProfile": HAPTIC_PROFILE,
        }


class HapticKhatmService:
    """
    Singleton service managing the Sovereign Khatm ceremony and 72-hour cooling-off window.
    """

    def __init__(self):
        self._pledges: Dict[str, KhatmPledgeRecord] = {}

    def seal_pledge(
        self,
        user_id: int,
        startup_id: str,
        amount_dzd: int,
        reflection_hold_duration_sec: float,
        equity_share_pct: Optional[float] = None,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Executes the Haptic Khatm ceremony.
        Strictly enforces the mandatory 3-second ethical reflection slider.
        """
        if now is None:
            now = time.time()

        if reflection_hold_duration_sec < MANDATORY_REFLECTION_SECONDS:
            raise ValueError(
                f"Ethical reflection requirement not satisfied: Held for {reflection_hold_duration_sec:.2f}s, "
                f"minimum required is {MANDATORY_REFLECTION_SECONDS}s."
            )

        khatm_id = f"KHATM-{uuid.uuid4().hex[:8].upper()}"
        record = KhatmPledgeRecord(
            khatm_id=khatm_id,
            user_id=user_id,
            startup_id=startup_id,
            amount_dzd=amount_dzd,
            equity_share_pct=equity_share_pct,
            sealed_at=now,
        )
        self._pledges[khatm_id] = record
        logger.info(f"Haptic Khatm sealed: {khatm_id} for user={user_id}, amount={amount_dzd:,} DZD")
        return record.to_dict(now)

    def cancel_during_cooling_off(
        self,
        khatm_id: str,
        user_id: int,
        reason: Optional[str] = None,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Permits statutory cancellation with 100% refund, no questions asked,
        provided request is made within the 72-hour window.
        """
        if now is None:
            now = time.time()

        record = self._pledges.get(khatm_id)
        if not record:
            raise ValueError(f"Khatm pledge '{khatm_id}' not found")

        if record.user_id != user_id:
            raise PermissionError("Cannot cancel pledge belonging to another citizen")

        if record.status != "PENDING_COOLING_OFF":
            raise ValueError(f"Pledge status is '{record.status}', cancellation impossible")

        if not record.is_cooling_off_active(now):
            raise ValueError(
                "Statutory 72-hour cooling-off window has elapsed. "
                "The allocation has been locked into the startup cap table."
            )

        record.status = "CANCELLED_REFUNDED"
        logger.info(f"Khatm pledge {khatm_id} cancelled during 72h window. 100% refund processed.")
        return {
            "khatmId": record.khatm_id,
            "status": "CANCELLED_REFUNDED",
            "refundAmountDzd": record.amount_dzd,
            "refundPercentage": 100,
            "cancelledAt": now,
            "reason": reason or "Investor invoked statutory 72-hour cooling-off right",
        }

    def finalize_pledge(
        self,
        khatm_id: str,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Permanently seals allocation into the company cap table after 72 hours.
        """
        if now is None:
            now = time.time()

        record = self._pledges.get(khatm_id)
        if not record:
            raise ValueError(f"Khatm pledge '{khatm_id}' not found")

        if record.status == "CANCELLED_REFUNDED":
            raise ValueError("Cannot finalize cancelled pledge")

        if record.is_cooling_off_active(now):
            raise ValueError(
                f"Cooling-off period still active ({record.remaining_cooling_off_seconds(now):.1f}s remaining). "
                "Finalization can only occur after 72 hours."
            )

        record.status = "FINALIZED"
        logger.info(f"Khatm pledge {khatm_id} permanently finalized after cooling-off.")
        return record.to_dict(now)

    def get_pledge(self, khatm_id: str, now: Optional[float] = None) -> Optional[Dict[str, Any]]:
        record = self._pledges.get(khatm_id)
        return record.to_dict(now) if record else None


# Global singleton instance
haptic_khatm_service = HapticKhatmService()
