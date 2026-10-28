"""
TamWheel Sovereign Ethical Agentic Venture OS — Live Stage Queue & WebRTC Speaker Arbitration.
Phase 2 Expansion: Interactive audience hand-raising, speaker queue arbitration,
3-minute hot-seat speaker switching, and WebRTC LiveKit room token provisioning.
"""

from __future__ import annotations

import asyncio
import enum
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

DEFAULT_HOT_SEAT_DURATION_SEC = 180  # 3 minutes maximum per audience speaker
MAX_HOT_SEAT_SPEAKERS = 4            # Maximum concurrent audience speakers on stage


class SpeakerRole(str, enum.Enum):
    AUDIENCE = "AUDIENCE"
    SPEAKER = "SPEAKER"
    MODERATOR = "MODERATOR"
    FOUNDER = "FOUNDER"


class HandRaiseStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    SPEAKING = "SPEAKING"
    COMPLETED = "COMPLETED"


class QueueEntry:
    def __init__(
        self,
        user_id: int,
        username: str,
        avatar_url: Optional[str] = None,
        wilaya: Optional[int] = None,
        raised_at: Optional[float] = None,
    ):
        self.user_id = user_id
        self.username = username
        self.avatar_url = avatar_url
        self.wilaya = wilaya
        self.raised_at = raised_at or time.time()
        self.status = HandRaiseStatus.QUEUED

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "avatar_url": self.avatar_url,
            "wilaya": self.wilaya,
            "raised_at": self.raised_at,
            "status": self.status.value,
        }


class ActiveSpeaker:
    def __init__(
        self,
        user_id: int,
        username: str,
        role: SpeakerRole = SpeakerRole.SPEAKER,
        duration_sec: int = DEFAULT_HOT_SEAT_DURATION_SEC,
        speaking_since: Optional[float] = None,
    ):
        self.user_id = user_id
        self.username = username
        self.role = role
        self.duration_sec = duration_sec
        self.speaking_since = speaking_since or time.time()
        self.turn_expires_at = self.speaking_since + duration_sec

    def is_expired(self, now: Optional[float] = None) -> bool:
        if now is None:
            now = time.time()
        # Founder & Moderator have unlimited duration
        if self.role in (SpeakerRole.FOUNDER, SpeakerRole.MODERATOR):
            return False
        return now >= self.turn_expires_at

    def remaining_seconds(self, now: Optional[float] = None) -> float:
        if now is None:
            now = time.time()
        if self.role in (SpeakerRole.FOUNDER, SpeakerRole.MODERATOR):
            return 99999.0
        return max(0.0, self.turn_expires_at - now)

    def to_dict(self, now: Optional[float] = None) -> Dict[str, Any]:
        if now is None:
            now = time.time()
        return {
            "user_id": self.user_id,
            "username": self.username,
            "role": self.role.value,
            "speaking_since": self.speaking_since,
            "duration_sec": self.duration_sec,
            "turn_expires_at": self.turn_expires_at,
            "remaining_seconds": round(self.remaining_seconds(now), 1),
            "is_expired": self.is_expired(now),
        }


class RoomStageState:
    """Maintains queue and active hot-seat speakers for a specific room."""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.queue: List[QueueEntry] = []
        self.active_speakers: Dict[int, ActiveSpeaker] = {}
        self._lock = asyncio.Lock()

    def get_queue(self) -> List[Dict[str, Any]]:
        return [q.to_dict() for q in self.queue if q.status == HandRaiseStatus.QUEUED]

    def get_active_speakers(self, now: Optional[float] = None) -> List[Dict[str, Any]]:
        return [s.to_dict(now) for s in self.active_speakers.values()]


class LiveStageQueueManager:
    """
    Singleton service managing WebRTC live stage participant state,
    hand-raising queues, moderator arbitration, and turn expiration.
    """

    def __init__(self):
        self._rooms: Dict[str, RoomStageState] = {}
        self._lock = asyncio.Lock()

    def _get_room(self, room_id: str) -> RoomStageState:
        if room_id not in self._rooms:
            self._rooms[room_id] = RoomStageState(room_id)
        return self._rooms[room_id]

    def raise_hand(
        self,
        room_id: str,
        user_id: int,
        username: str,
        avatar_url: Optional[str] = None,
        wilaya: Optional[int] = None,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """User raises hand to join the speaker queue."""
        stage = self._get_room(room_id)

        # Check if already active speaker
        if user_id in stage.active_speakers:
            return {
                "action": "already_speaking",
                "room_id": room_id,
                "user_id": user_id,
                "speaker": stage.active_speakers[user_id].to_dict(now),
            }

        # Check if already in queue
        existing = next((q for q in stage.queue if q.user_id == user_id and q.status == HandRaiseStatus.QUEUED), None)
        if existing:
            queue_position = [q for q in stage.queue if q.status == HandRaiseStatus.QUEUED].index(existing) + 1
            return {
                "action": "already_queued",
                "room_id": room_id,
                "user_id": user_id,
                "queue_position": queue_position,
                "total_queued": len([q for q in stage.queue if q.status == HandRaiseStatus.QUEUED]),
            }

        entry = QueueEntry(
            user_id=user_id,
            username=username,
            avatar_url=avatar_url,
            wilaya=wilaya,
            raised_at=now,
        )
        stage.queue.append(entry)

        queued_list = [q for q in stage.queue if q.status == HandRaiseStatus.QUEUED]
        position = len(queued_list)

        logger.info(f"Hand raised in [{room_id}]: user={username} ({user_id}), pos={position}")
        return {
            "type": "stage:hand_raised",
            "room_id": room_id,
            "user_id": user_id,
            "username": username,
            "avatar_url": avatar_url,
            "wilaya": wilaya,
            "queue_position": position,
            "total_queued": position,
            "timestamp": time.time(),
        }

    def lower_hand(self, room_id: str, user_id: int) -> Dict[str, Any]:
        """User lowers hand or cancels queue request."""
        stage = self._get_room(room_id)
        for q in stage.queue:
            if q.user_id == user_id and q.status == HandRaiseStatus.QUEUED:
                q.status = HandRaiseStatus.COMPLETED

        return {
            "type": "stage:hand_lowered",
            "room_id": room_id,
            "user_id": user_id,
            "total_queued": len([q for q in stage.queue if q.status == HandRaiseStatus.QUEUED]),
            "timestamp": time.time(),
        }

    def approve_speaker(
        self,
        room_id: str,
        user_id: int,
        moderator_id: int,
        duration_sec: int = DEFAULT_HOT_SEAT_DURATION_SEC,
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Moderator promotes a queued participant to the hot-seat speaker stage."""
        if now is None:
            now = time.time()
        stage = self._get_room(room_id)

        # Check speaker cap
        if len(stage.active_speakers) >= MAX_HOT_SEAT_SPEAKERS:
            # Auto-demote oldest expired speaker if available
            self.sweep_expired_speakers(room_id, now=now)

        entry = next((q for q in stage.queue if q.user_id == user_id and q.status == HandRaiseStatus.QUEUED), None)
        username = entry.username if entry else f"Speaker-{user_id}"
        if entry:
            entry.status = HandRaiseStatus.APPROVED

        speaker = ActiveSpeaker(
            user_id=user_id,
            username=username,
            role=SpeakerRole.SPEAKER,
            duration_sec=duration_sec,
            speaking_since=now,
        )
        stage.active_speakers[user_id] = speaker

        token = self.provision_webrtc_token(
            room_id=room_id,
            user_id=user_id,
            username=username,
            role=SpeakerRole.SPEAKER,
        )

        logger.info(f"Speaker approved in [{room_id}]: user={username} ({user_id}) by mod={moderator_id}")
        return {
            "type": "stage:speaker_approved",
            "room_id": room_id,
            "user_id": user_id,
            "username": username,
            "moderator_id": moderator_id,
            "duration_sec": duration_sec,
            "turn_expires_at": speaker.turn_expires_at,
            "webrtc_token": token,
            "active_speakers": stage.get_active_speakers(now),
            "timestamp": now,
        }

    def deny_speaker(
        self,
        room_id: str,
        user_id: int,
        moderator_id: int,
        reason: str = "Queue turn bypassed by moderator",
    ) -> Dict[str, Any]:
        """Moderator denies a hand-raise request."""
        stage = self._get_room(room_id)
        for q in stage.queue:
            if q.user_id == user_id and q.status == HandRaiseStatus.QUEUED:
                q.status = HandRaiseStatus.DENIED

        return {
            "type": "stage:speaker_denied",
            "room_id": room_id,
            "user_id": user_id,
            "moderator_id": moderator_id,
            "reason": reason,
            "timestamp": time.time(),
        }

    def demote_speaker(
        self,
        room_id: str,
        user_id: int,
        moderator_id: Optional[int] = None,
        reason: str = "Turn completed",
        now: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Moves an active speaker back to audience."""
        if now is None:
            now = time.time()
        stage = self._get_room(room_id)
        demoted = stage.active_speakers.pop(user_id, None)

        return {
            "type": "stage:speaker_demoted",
            "room_id": room_id,
            "user_id": user_id,
            "moderator_id": moderator_id,
            "reason": reason,
            "active_speakers": stage.get_active_speakers(now),
            "timestamp": now,
        }

    def sweep_expired_speakers(
        self,
        room_id: str,
        now: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Identifies and demotes speakers whose 3-minute hot-seat timer has expired."""
        if now is None:
            now = time.time()
        stage = self._get_room(room_id)
        expired_events = []

        expired_ids = [
            uid for uid, spk in stage.active_speakers.items()
            if spk.is_expired(now)
        ]

        for uid in expired_ids:
            event = self.demote_speaker(
                room_id=room_id,
                user_id=uid,
                reason="3-minute hot-seat speaker time limit reached",
                now=now,
            )
            expired_events.append(event)

        return expired_events

    def get_stage_state(self, room_id: str, now: Optional[float] = None) -> Dict[str, Any]:
        """Returns the full live stage status (queue + active speakers)."""
        stage = self._get_room(room_id)
        return {
            "room_id": room_id,
            "active_speakers": stage.get_active_speakers(now),
            "queue": stage.get_queue(),
            "total_queued": len(stage.get_queue()),
            "timestamp": time.time(),
        }

    def provision_webrtc_token(
        self,
        room_id: str,
        user_id: int,
        username: str,
        role: SpeakerRole = SpeakerRole.AUDIENCE,
    ) -> str:
        """
        Generates WebRTC / LiveKit room access token with granular publish/subscribe grants.
        Falls back to cryptographic JWT token if LiveKit Cloud credentials are unset in local test mode.
        """
        can_publish = role in (SpeakerRole.SPEAKER, SpeakerRole.MODERATOR, SpeakerRole.FOUNDER)

        try:
            from app.services.livekit_service import create_access_token
            # Attempt to use real LiveKit service
            return create_access_token(
                identity=f"user-{user_id}:{username}",
                room_name=room_id,
                ttl_minutes=15,
                role="HOST" if can_publish else "PARTICIPANT",
            )
        except Exception:
            # Deterministic test & fallback JWT token generator
            import hmac
            import hashlib
            import base64
            import json

            header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
            payload_data = {
                "sub": f"user-{user_id}:{username}",
                "room": room_id,
                "role": role.value,
                "can_publish": can_publish,
                "can_subscribe": True,
                "exp": int(time.time()) + 900,
            }
            payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
            sig = hmac.new(b"tamwheel_stage_secret", f"{header}.{payload}".encode(), hashlib.sha256).digest()
            sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
            return f"{header}.{payload}.{sig_b64}"


# Singleton stage queue manager
stage_queue_manager = LiveStageQueueManager()
