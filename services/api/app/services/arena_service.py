"""
TamWheel Sovereign Ethical Agentic Venture OS — Realtime Arena Service.
Pillar 6: Realtime Multiplayer Watch Party, Live Pitch Arena WebSockets,
Synchronized Video Playback Clock (<250ms drift), Rolling Sentiment Radar,
and 60-second Flash Allocation Window.
"""

from __future__ import annotations

import asyncio
import enum
import logging
import math
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Max acceptable drift between clients and server video clock
MAX_DRIFT_TOLERANCE_MS = 250.0

# Critical crowd conviction threshold for triggering Hype Alarm
HYPE_ALARM_THRESHOLD_PCT = 35.0
HYPE_ALARM_DEFENSE_WINDOW_SEC = 30
HYPE_ALARM_COOLDOWN_SEC = 30.0


class ArenaStage(str, enum.Enum):
    LOBBY = "LOBBY"
    PITCH_ACTIVE = "PITCH_ACTIVE"           # 3 minutes (180 sec)
    GRILLING_ACTIVE = "GRILLING_ACTIVE"     # 5 minutes (300 sec)
    FLASH_ALLOCATION = "FLASH_ALLOCATION"   # 60 seconds (60 sec)
    CLOSED = "CLOSED"


STAGE_DURATIONS_SEC: Dict[ArenaStage, int] = {
    ArenaStage.LOBBY: 0,
    ArenaStage.PITCH_ACTIVE: 180,
    ArenaStage.GRILLING_ACTIVE: 300,
    ArenaStage.FLASH_ALLOCATION: 60,
    ArenaStage.CLOSED: 0,
}

REACTION_CONFIG: Dict[str, Dict[str, Any]] = {
    "🚀": {"name": "MOON", "labelAr": "صاروخ", "conviction": 100.0, "weight": 1.0},
    "💡": {"name": "GENIUS", "labelAr": "فكرة واعرة", "conviction": 90.0, "weight": 1.0},
    "🇩🇿": {"name": "LOCAL_PRIDE", "labelAr": "دعم محلي", "conviction": 80.0, "weight": 0.8},
    "🧐": {"name": "SKEPTICAL", "labelAr": "تحفظ", "conviction": 40.0, "weight": 0.7},
    "🚩": {"name": "RED_FLAG", "labelAr": "علامة حمراء", "conviction": 10.0, "weight": 1.0},
}


class ArenaSession:
    """
    State container for an active pitch arena room.
    Maintains synchronized video clock, pitch stage timer, reaction buffer,
    rolling exponential sentiment radar, and flash allocation state.
    """

    def __init__(self, room_id: str, startup_id: str, startup_name: Optional[str] = None):
        self.room_id = room_id
        self.startup_id = startup_id
        self.startup_name = startup_name or f"Startup-{startup_id[:8]}"
        self.stage = ArenaStage.LOBBY
        self.stage_started_at = time.time()
        self.stage_duration_seconds = STAGE_DURATIONS_SEC[ArenaStage.LOBBY]

        # Video synchronization state
        self.video_position_sec: float = 0.0
        self.video_playback_state: str = "PAUSED"  # PLAYING, PAUSED, BUFFERING
        self.playback_rate: float = 1.0
        self.video_last_updated_at: float = time.time()

        # Sentiment & Reaction buffer: tuples of (timestamp, emoji, conviction, weight)
        self.reaction_history: List[Tuple[float, str, float, float]] = []
        self.current_sentiment_score: float = 75.0  # Initial baseline
        self.last_alarm_at: float = 0.0

        # Flash allocation pledges
        self.total_pledges_dzd: int = 0
        self.pledges_count: int = 0
        self.pledge_history: List[Dict[str, Any]] = []

    def get_video_position(self, now: Optional[float] = None) -> float:
        """Computes current video playback position with elapsed time extrapolation."""
        if now is None:
            now = time.time()
        if self.video_playback_state == "PLAYING":
            elapsed = (now - self.video_last_updated_at) * self.playback_rate
            return max(0.0, self.video_position_sec + elapsed)
        return self.video_position_sec

    def update_video_state(
        self,
        position_sec: float,
        playback_state: str,
        playback_rate: float = 1.0,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Updates video clock state and returns synchronized broadcast state."""
        if now is None:
            now = time.time()
        self.video_position_sec = max(0.0, float(position_sec))
        self.video_playback_state = playback_state
        self.playback_rate = max(0.25, min(4.0, float(playback_rate)))
        self.video_last_updated_at = now

        return self.get_clock_sync_payload(now)

    def get_clock_sync_payload(self, now: Optional[float] = None) -> Dict[str, Any]:
        """Generates synchronized playback clock payload for clients (<250ms delta)."""
        if now is None:
            now = time.time()
        current_pos = self.get_video_position(now)
        elapsed_stage = max(0.0, now - self.stage_started_at)
        remaining_stage = 0.0
        if self.stage_duration_seconds > 0:
            remaining_stage = max(0.0, self.stage_duration_seconds - elapsed_stage)

        return {
            "type": "arena:clock_sync",
            "room_id": self.room_id,
            "startup_id": self.startup_id,
            "server_timestamp": now,
            "video_position_sec": round(current_pos, 3),
            "video_playback_state": self.video_playback_state,
            "playback_rate": self.playback_rate,
            "stage": self.stage.value,
            "stage_elapsed_sec": round(elapsed_stage, 2),
            "stage_remaining_sec": round(remaining_stage, 2),
            "max_drift_tolerance_ms": MAX_DRIFT_TOLERANCE_MS,
        }

    def set_stage(self, new_stage: ArenaStage, now: Optional[float] = None) -> Dict[str, Any]:
        """Transition arena to a specific stage."""
        if now is None:
            now = time.time()
        prev_stage = self.stage
        self.stage = new_stage
        self.stage_started_at = now
        self.stage_duration_seconds = STAGE_DURATIONS_SEC.get(new_stage, 0)

        logger.info(f"Arena [{self.room_id}] transitioned {prev_stage.value} -> {new_stage.value}")
        return {
            "type": "arena:stage_transition",
            "room_id": self.room_id,
            "startup_id": self.startup_id,
            "previous_stage": prev_stage.value,
            "current_stage": new_stage.value,
            "stage_duration_sec": self.stage_duration_seconds,
            "server_timestamp": now,
        }

    def advance_stage(self, now: Optional[float] = None) -> Dict[str, Any]:
        """Advances the state machine: LOBBY -> PITCH_ACTIVE -> GRILLING_ACTIVE -> FLASH_ALLOCATION -> CLOSED."""
        progression = {
            ArenaStage.LOBBY: ArenaStage.PITCH_ACTIVE,
            ArenaStage.PITCH_ACTIVE: ArenaStage.GRILLING_ACTIVE,
            ArenaStage.GRILLING_ACTIVE: ArenaStage.FLASH_ALLOCATION,
            ArenaStage.FLASH_ALLOCATION: ArenaStage.CLOSED,
            ArenaStage.CLOSED: ArenaStage.CLOSED,
        }
        return self.set_stage(progression[self.stage], now)

    def calculate_rolling_sentiment(
        self,
        now: Optional[float] = None,
        half_life_sec: float = 20.0,
        window_sec: float = 60.0,
    ) -> float:
        """
        Calculates time-weighted rolling exponential crowd sentiment [0.0 - 100.0%].
        Reactions decay according to exp(-(now - t_i) / half_life).
        """
        if now is None:
            now = time.time()

        # Prune reactions older than window
        cutoff = now - window_sec
        self.reaction_history = [r for r in self.reaction_history if r[0] >= cutoff]

        if not self.reaction_history:
            return round(self.current_sentiment_score, 2)

        weighted_sum = 0.0
        total_weights = 0.0

        for t_stamp, _, conviction, base_weight in self.reaction_history:
            delta = max(0.0, now - t_stamp)
            time_decay = math.exp(-delta / half_life_sec)
            effective_weight = base_weight * time_decay
            weighted_sum += conviction * effective_weight
            total_weights += effective_weight

        if total_weights <= 0.0:
            return round(self.current_sentiment_score, 2)

        score = weighted_sum / total_weights
        self.current_sentiment_score = max(0.0, min(100.0, score))
        return round(self.current_sentiment_score, 2)

    def add_reaction(
        self,
        emoji: str,
        user_name: str,
        now: Optional[float] = None,
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
        """
        Records an emoji reaction, recalculates rolling sentiment,
        and triggers a Hype Alarm if sentiment drops below 35% during pitch.
        """
        if now is None:
            now = time.time()

        cfg = REACTION_CONFIG.get(emoji)
        if not cfg:
            # Fallback or invalid emoji default to neutral
            cfg = {"name": "OTHER", "labelAr": "تفاعل", "conviction": 50.0, "weight": 0.5}

        self.reaction_history.append((now, emoji, cfg["conviction"], cfg["weight"]))
        sentiment = self.calculate_rolling_sentiment(now)

        reaction_event = {
            "type": "arena:reaction",
            "room_id": self.room_id,
            "startup_id": self.startup_id,
            "user_name": user_name,
            "emoji": emoji,
            "emoji_name": cfg["name"],
            "emoji_label_ar": cfg["labelAr"],
            "audience_sentiment_score": sentiment,
            "server_timestamp": now,
        }

        # Check Hype Alarm condition
        alarm_event: Optional[Dict[str, Any]] = None
        if (
            self.stage in (ArenaStage.PITCH_ACTIVE, ArenaStage.GRILLING_ACTIVE)
            and sentiment < HYPE_ALARM_THRESHOLD_PCT
            and (now - self.last_alarm_at) >= HYPE_ALARM_COOLDOWN_SEC
        ):
            self.last_alarm_at = now
            alarm_event = {
                "type": "arena:hype_alarm",
                "room_id": self.room_id,
                "startup_id": self.startup_id,
                "startup_name": self.startup_name,
                "audience_sentiment_score": sentiment,
                "threshold_pct": HYPE_ALARM_THRESHOLD_PCT,
                "defense_window_sec": HYPE_ALARM_DEFENSE_WINDOW_SEC,
                "reason": f"Audience sentiment dropped to {sentiment}% (<{HYPE_ALARM_THRESHOLD_PCT}% threshold)",
                "action_required": "Founder has 30 seconds to defend their business model and address crowd skepticism",
                "server_timestamp": now,
            }
            logger.warning(
                f"HYPE ALARM triggered for arena [{self.room_id}]! Sentiment={sentiment}%"
            )

        return reaction_event, alarm_event

    def record_flash_pledge(
        self,
        backer_name: str,
        amount_dzd: int,
        equity_share_pct: Optional[float] = None,
        wilaya: Optional[int] = None,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Records a pledge during the 60-second Flash Allocation window and emits crowd ticker event."""
        if now is None:
            now = time.time()

        self.total_pledges_dzd += amount_dzd
        self.pledges_count += 1

        pledge_data = {
            "backer_name": backer_name,
            "amount_dzd": amount_dzd,
            "equity_share_pct": equity_share_pct,
            "wilaya": wilaya,
            "timestamp": now,
        }
        self.pledge_history.append(pledge_data)

        return {
            "type": "arena:flash_pledge",
            "room_id": self.room_id,
            "startup_id": self.startup_id,
            "startup_name": self.startup_name,
            "backer_name": backer_name,
            "amount_dzd": amount_dzd,
            "equity_share_pct": equity_share_pct,
            "wilaya": wilaya,
            "running_total_dzd": self.total_pledges_dzd,
            "total_pledges_count": self.pledges_count,
            "stage": self.stage.value,
            "crowd_ticker_alert": f"🔥 {backer_name} pledged {amount_dzd:,} DZD!",
            "server_timestamp": now,
        }


class RealtimeArenaService:
    """
    Singleton service managing multiplayer pitch arenas, synchronized rooms,
    and live broadcast states across the TamWheel platform.
    """

    def __init__(self):
        self._rooms: Dict[str, ArenaSession] = {}
        self._lock = asyncio.Lock()

    def get_or_create_room(
        self,
        room_id: str,
        startup_id: Optional[str] = None,
        startup_name: Optional[str] = None,
    ) -> ArenaSession:
        if room_id not in self._rooms:
            s_id = startup_id or room_id.replace("startup:", "").replace("arena:", "")
            self._rooms[room_id] = ArenaSession(
                room_id=room_id,
                startup_id=s_id,
                startup_name=startup_name,
            )
        return self._rooms[room_id]

    def get_room(self, room_id: str) -> Optional[ArenaSession]:
        return self._rooms.get(room_id)

    def remove_room(self, room_id: str) -> None:
        self._rooms.pop(room_id, None)

    def list_active_rooms(self) -> List[Dict[str, Any]]:
        now = time.time()
        return [
            {
                "room_id": r.room_id,
                "startup_id": r.startup_id,
                "startup_name": r.startup_name,
                "stage": r.stage.value,
                "sentiment_score": r.calculate_rolling_sentiment(now),
                "total_pledges_dzd": r.total_pledges_dzd,
                "pledges_count": r.pledges_count,
            }
            for r in self._rooms.values()
        ]


# Process-wide singleton instance
arena_service = RealtimeArenaService()
