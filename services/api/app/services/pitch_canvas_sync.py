"""
TamWheel Sovereign Ethical Agentic Venture OS — Synchronized Pitch Deck Annotation
& Collaborative Laser-Pointer Engine (Phase 4 Expansion).

Provides real-time slide presentation synchronization with collaborative overlays:
- Sub-100ms normalized (x, y) laser-pointer coordinate stream across multiple concurrent pointers.
- Persistent and ephemeral multi-user pen annotations, bounding box highlights, and text callouts
  tagged to specific slide indices.
- Timed slide bookmarks marking critical slide timestamps during live presentations for diligence reviews.
"""

from __future__ import annotations

import logging
import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AnnotationType(str, Enum):
    PEN_STROKE = "PEN_STROKE"
    BOUNDING_BOX = "BOUNDING_BOX"
    TEXT_CALLOUT = "TEXT_CALLOUT"
    HIGHLIGHT_RECT = "HIGHLIGHT_RECT"


class SlideAnnotation:
    """Represents a vector annotation anchored to a specific pitch slide."""

    def __init__(
        self,
        annotation_id: str,
        slide_index: int,
        annotation_type: AnnotationType,
        author_id: int,
        author_name: str,
        data: Dict[str, Any],
        color: str = "#E8632E",
        stroke_width: float = 2.5,
        is_ephemeral: bool = False,
        ttl_sec: float = 5.0,
        created_at: Optional[float] = None,
    ):
        self.annotation_id = annotation_id
        self.slide_index = int(slide_index)
        self.annotation_type = annotation_type
        self.author_id = author_id
        self.author_name = author_name
        self.data = data
        self.color = color
        self.stroke_width = float(stroke_width)
        self.is_ephemeral = bool(is_ephemeral)
        self.ttl_sec = float(ttl_sec) if is_ephemeral else 0.0
        self.created_at = created_at or time.time()

    def is_expired(self, current_time: Optional[float] = None) -> bool:
        if not self.is_ephemeral:
            return False
        now = current_time or time.time()
        return (now - self.created_at) >= self.ttl_sec

    def to_dict(self) -> Dict[str, Any]:
        return {
            "annotation_id": self.annotation_id,
            "slide_index": self.slide_index,
            "annotation_type": self.annotation_type.value,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "data": self.data,
            "color": self.color,
            "stroke_width": self.stroke_width,
            "is_ephemeral": self.is_ephemeral,
            "ttl_sec": self.ttl_sec,
            "created_at": self.created_at,
        }


class SlideBookmark:
    """Marks a critical moment during the pitch deck presentation for post-event diligence."""

    def __init__(
        self,
        bookmark_id: str,
        room_id: str,
        slide_index: int,
        timestamp_sec: float,
        label: str,
        created_by_user_id: int,
        created_by_username: str,
        note: Optional[str] = None,
        created_at: Optional[float] = None,
    ):
        self.bookmark_id = bookmark_id
        self.room_id = room_id
        self.slide_index = int(slide_index)
        self.timestamp_sec = round(float(timestamp_sec), 2)
        self.label = label
        self.note = note
        self.created_by_user_id = created_by_user_id
        self.created_by_username = created_by_username
        self.created_at = created_at or time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bookmark_id": self.bookmark_id,
            "room_id": self.room_id,
            "slide_index": self.slide_index,
            "timestamp_sec": self.timestamp_sec,
            "label": self.label,
            "note": self.note,
            "created_by_user_id": self.created_by_user_id,
            "created_by_username": self.created_by_username,
            "created_at": self.created_at,
        }


class PitchCanvasSession:
    """Manages collaborative canvas state, multi-pointer coordinates, and bookmarks for a live room."""

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
        self.presentation_start_epoch = time.time()
        self.last_updated_at = time.time()

        # user_id -> pointer dict
        self.pointers: Dict[int, Dict[str, Any]] = {}
        # slide_index -> list of SlideAnnotation
        self.annotations: Dict[int, List[SlideAnnotation]] = {}
        # list of SlideBookmark
        self.bookmarks: List[SlideBookmark] = []
        self.thumbnails = thumbnails or [
            f"/static/decks/{self.deck_id}/slide_{i+1}.webp" for i in range(self.total_slides)
        ]

    def set_slide(self, index: int, presenter_name: Optional[str] = None) -> Dict[str, Any]:
        """Changes active slide index within [0, total_slides - 1] and resets active pointers."""
        clamped = max(0, min(self.total_slides - 1, int(index)))
        self.current_slide_index = clamped
        for uid in self.pointers:
            self.pointers[uid]["active"] = False
        self.last_updated_at = time.time()

        return {
            "type": "deck:slide_change",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "current_slide_index": self.current_slide_index,
            "current_slide_number": self.current_slide_index + 1,
            "total_slides": self.total_slides,
            "presenter_name": presenter_name or "Presenter",
            "thumbnail_url": self.thumbnails[self.current_slide_index]
            if self.current_slide_index < len(self.thumbnails)
            else None,
            "timestamp": self.last_updated_at,
        }

    def update_pointer(
        self,
        user_id: int,
        username: str,
        x: float,
        y: float,
        active: bool = True,
        color: Optional[str] = None,
        slide_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Updates normalized laser pointer coordinates for a specific user with sub-100ms latency.
        x, y are strictly clamped within [0.0, 1.0].
        """
        clamped_x = max(0.0, min(1.0, float(x)))
        clamped_y = max(0.0, min(1.0, float(y)))
        now = time.time()

        target_slide = self.current_slide_index if slide_index is None else int(slide_index)

        pointer_data = {
            "user_id": user_id,
            "username": username,
            "x": round(clamped_x, 4),
            "y": round(clamped_y, 4),
            "active": bool(active),
            "color": color or "#E8632E",
            "slide_index": target_slide,
            "updated_at": now,
        }
        self.pointers[user_id] = pointer_data
        self.last_updated_at = now

        return {
            "type": "deck:pointer_update",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "slide_index": target_slide,
            "pointer": pointer_data,
            "timestamp": now,
        }

    def add_annotation(
        self,
        author_id: int,
        author_name: str,
        annotation_type: AnnotationType | str,
        data: Dict[str, Any],
        slide_index: Optional[int] = None,
        color: str = "#E8632E",
        stroke_width: float = 2.5,
        is_ephemeral: bool = False,
        ttl_sec: float = 5.0,
        annotation_id: Optional[str] = None,
    ) -> SlideAnnotation:
        """Adds a collaborative pen stroke, bounding box highlight, or text callout."""
        target_slide = self.current_slide_index if slide_index is None else int(slide_index)
        if isinstance(annotation_type, str):
            annotation_type = AnnotationType(annotation_type.upper())

        ann_id = annotation_id or f"ann-{uuid.uuid4().hex[:12]}"
        annotation = SlideAnnotation(
            annotation_id=ann_id,
            slide_index=target_slide,
            annotation_type=annotation_type,
            author_id=author_id,
            author_name=author_name,
            data=data,
            color=color,
            stroke_width=stroke_width,
            is_ephemeral=is_ephemeral,
            ttl_sec=ttl_sec,
        )

        self.annotations.setdefault(target_slide, []).append(annotation)
        self.last_updated_at = time.time()

        logger.info(
            f"Added {annotation_type.value} annotation {ann_id} on slide {target_slide} "
            f"in room {self.room_id} by {author_name} (ephemeral={is_ephemeral})"
        )
        return annotation

    def get_slide_annotations(
        self,
        slide_index: Optional[int] = None,
        include_expired: bool = False,
    ) -> List[Dict[str, Any]]:
        """Returns non-expired annotations for target slide (or current slide if omitted)."""
        target_slide = self.current_slide_index if slide_index is None else int(slide_index)
        now = time.time()
        ann_list = self.annotations.get(target_slide, [])

        # Filter out expired ephemeral annotations if requested
        valid_anns: List[SlideAnnotation] = []
        for ann in ann_list:
            if include_expired or not ann.is_expired(now):
                valid_anns.append(ann)

        return [ann.to_dict() for ann in valid_anns]

    def delete_annotation(self, annotation_id: str) -> bool:
        """Removes an annotation by its ID across all slides."""
        for slide_idx, anns in self.annotations.items():
            for i, ann in enumerate(anns):
                if ann.annotation_id == annotation_id:
                    anns.pop(i)
                    self.last_updated_at = time.time()
                    return True
        return False

    def clear_annotations(self, slide_index: Optional[int] = None) -> int:
        """Clears all annotations for a specific slide or the entire presentation."""
        cleared_count = 0
        if slide_index is not None:
            target = int(slide_index)
            cleared_count = len(self.annotations.pop(target, []))
        else:
            for anns in self.annotations.values():
                cleared_count += len(anns)
            self.annotations.clear()

        self.last_updated_at = time.time()
        return cleared_count

    def cleanup_ephemeral_annotations(self) -> int:
        """Purges expired ephemeral annotations across all slides."""
        now = time.time()
        removed = 0
        for slide_idx in list(self.annotations.keys()):
            original_len = len(self.annotations[slide_idx])
            self.annotations[slide_idx] = [
                ann for ann in self.annotations[slide_idx] if not ann.is_expired(now)
            ]
            removed += (original_len - len(self.annotations[slide_idx]))
        return removed

    def add_bookmark(
        self,
        slide_index: int,
        label: str,
        user_id: int,
        username: str,
        timestamp_sec: Optional[float] = None,
        note: Optional[str] = None,
        bookmark_id: Optional[str] = None,
    ) -> SlideBookmark:
        """Marks a critical presentation timestamp for post-event due diligence."""
        if timestamp_sec is None:
            timestamp_sec = max(0.0, time.time() - self.presentation_start_epoch)

        bm_id = bookmark_id or f"bm-{uuid.uuid4().hex[:10]}"
        bookmark = SlideBookmark(
            bookmark_id=bm_id,
            room_id=self.room_id,
            slide_index=slide_index,
            timestamp_sec=timestamp_sec,
            label=label,
            note=note,
            created_by_user_id=user_id,
            created_by_username=username,
        )
        self.bookmarks.append(bookmark)
        self.last_updated_at = time.time()

        logger.info(
            f"Created bookmark {bm_id} ('{label}') on slide {slide_index} at {timestamp_sec:.1f}s by {username}"
        )
        return bookmark

    def get_bookmarks(self) -> List[Dict[str, Any]]:
        """Returns all recorded presentation bookmarks sorted by timestamp."""
        sorted_bms = sorted(self.bookmarks, key=lambda b: b.timestamp_sec)
        return [b.to_dict() for b in sorted_bms]

    def get_canvas_state(self) -> Dict[str, Any]:
        """Provides full collaborative canvas state for state re-synchronization."""
        self.cleanup_ephemeral_annotations()
        return {
            "type": "deck:canvas_sync",
            "room_id": self.room_id,
            "deck_id": self.deck_id,
            "current_slide_index": self.current_slide_index,
            "current_slide_number": self.current_slide_index + 1,
            "total_slides": self.total_slides,
            "active_pointers": [p for p in self.pointers.values() if p.get("active", False)],
            "slide_annotations": self.get_slide_annotations(self.current_slide_index),
            "bookmarks": self.get_bookmarks(),
            "presentation_elapsed_sec": max(0.0, time.time() - self.presentation_start_epoch),
            "timestamp": self.last_updated_at,
        }


class PitchCanvasSyncEngine:
    """Singleton service managing synchronized collaborative pitch canvases across all arena rooms."""

    def __init__(self):
        self._sessions: Dict[str, PitchCanvasSession] = {}

    def get_or_create_session(
        self,
        room_id: str,
        deck_id: Optional[str] = None,
        total_slides: int = 12,
    ) -> PitchCanvasSession:
        if room_id not in self._sessions:
            self._sessions[room_id] = PitchCanvasSession(
                room_id=room_id,
                deck_id=deck_id,
                total_slides=total_slides,
            )
        return self._sessions[room_id]

    def get_session(self, room_id: str) -> Optional[PitchCanvasSession]:
        return self._sessions.get(room_id)

    def remove_session(self, room_id: str) -> None:
        self._sessions.pop(room_id, None)


# Global singleton instance
pitch_canvas_sync = PitchCanvasSyncEngine()
