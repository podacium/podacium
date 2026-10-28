"""
TamWheel Sovereign Ethical Agentic Venture OS — Dual-Track Pitch Deck Slide Synchronizer.
Phase 2 Expansion: Real-time synchronized slide casting, laser-pointer coordinates,
and interactive slide annotations alongside video playback clock.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class SlideDeckSession:
    """Maintains synchronized pitch deck presentation state for a room."""

    def __init__(
        self,
        room_id: str,
        deck_id: Optional[str] = None,
        total_slides: int = 12,
        thumbnails: Optional[List[str]] = None,
    ):
        self.room_id = room_id
        self.deck_id = deck_id or f"deck-{room_id[:8]}"
        self.total_slides = max(1, total_slides)
        self.current_slide_index = 0
        self.pointer: Dict[str, Any] = {
            "x": 0.5,
            "y": 0.5,
            "active": False,
            "color": "#E8632E",  # Energy Orange
        }
        # slide_index -> list of annotations (e.g. highlight box, pen stroke, note)
        self.annotations: Dict[int, List[Dict[str, Any]]] = {}
        self.thumbnails = thumbnails or [f"/static/decks/{self.deck_id}/slide_{i+1}.webp" for i in range(self.total_slides)]
        self.last_updated_at = time.time()

    def set_slide(self, index: int, presenter_name: Optional[str] = None) -> Dict[str, Any]:
        """Sets the active slide index, clamped within [0, total_slides - 1]."""
        clamped_idx = max(0, min(self.total_slides - 1, int(index)))
        self.current_slide_index = clamped_idx
        # Reset pointer on slide transition
        self.pointer["active"] = False
        self.last_updated_at = time.time()

        return {
            "type": "deck:slide_change",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "current_slide_index": self.current_slide_index,
            "current_slide_number": self.current_slide_index + 1,
            "total_slides": self.total_slides,
            "presenter_name": presenter_name or "Presenter",
            "thumbnail_url": self.thumbnails[self.current_slide_index] if self.current_slide_index < len(self.thumbnails) else None,
            "timestamp": self.last_updated_at,
        }

    def update_pointer(
        self,
        x: float,
        y: float,
        active: bool = True,
        color: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Updates presenter laser pointer coordinates normalized to [0.0, 1.0]."""
        clamped_x = max(0.0, min(1.0, float(x)))
        clamped_y = max(0.0, min(1.0, float(y)))

        self.pointer = {
            "x": round(clamped_x, 4),
            "y": round(clamped_y, 4),
            "active": bool(active),
            "color": color or self.pointer.get("color", "#E8632E"),
        }
        self.last_updated_at = time.time()

        return {
            "type": "deck:pointer_update",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "slide_index": self.current_slide_index,
            "pointer": self.pointer,
            "timestamp": self.last_updated_at,
        }

    def add_annotation(
        self,
        annotation_data: Dict[str, Any],
        slide_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Appends an annotation (stroke, vector highlight, or sticky) to a slide."""
        target_slide = self.current_slide_index if slide_index is None else int(slide_index)
        self.annotations.setdefault(target_slide, []).append(annotation_data)
        self.last_updated_at = time.time()

        return {
            "type": "deck:annotation_added",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "slide_index": target_slide,
            "annotation": annotation_data,
            "total_slide_annotations": len(self.annotations[target_slide]),
            "timestamp": self.last_updated_at,
        }

    def clear_annotations(self, slide_index: Optional[int] = None) -> Dict[str, Any]:
        """Clears annotations for a specific slide or the whole deck."""
        if slide_index is not None:
            self.annotations.pop(int(slide_index), None)
            target = slide_index
        else:
            self.annotations.clear()
            target = "ALL"

        self.last_updated_at = time.time()
        return {
            "type": "deck:annotations_cleared",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "cleared_target": target,
            "timestamp": self.last_updated_at,
        }

    def get_state(self) -> Dict[str, Any]:
        """Returns the complete synchronized slide deck state."""
        return {
            "type": "deck:state_sync",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "current_slide_index": self.current_slide_index,
            "current_slide_number": self.current_slide_index + 1,
            "total_slides": self.total_slides,
            "pointer": self.pointer,
            "slide_annotations": self.annotations.get(self.current_slide_index, []),
            "all_annotations": self.annotations,
            "thumbnails": self.thumbnails,
            "timestamp": self.last_updated_at,
        }


class SlideDeckSynchronizer:
    """
    Singleton service managing synchronized slide decks across all live pitch rooms.
    """

    def __init__(self):
        self._sessions: Dict[str, SlideDeckSession] = {}

    def get_or_create_session(
        self,
        room_id: str,
        deck_id: Optional[str] = None,
        total_slides: int = 12,
    ) -> SlideDeckSession:
        if room_id not in self._sessions:
            self._sessions[room_id] = SlideDeckSession(
                room_id=room_id,
                deck_id=deck_id,
                total_slides=total_slides,
            )
        return self._sessions[room_id]

    def get_session(self, room_id: str) -> Optional[SlideDeckSession]:
        return self._sessions.get(room_id)

    def remove_session(self, room_id: str) -> None:
        self._sessions.pop(room_id, None)


# Singleton slide deck synchronizer
slide_deck_synchronizer = SlideDeckSynchronizer()
