"""
TamWheel Sovereign Ethical Agentic Venture OS — Arena Presentation Router.
Phase 4 Expansion: Synchronized live pitch deck annotation, laser-pointer coordinates,
timed slide bookmarks, and multilingual closed captions.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_active_user, get_optional_current_user
from app.services.pitch_canvas_sync import pitch_canvas_sync, AnnotationType
from app.services.pitch_transcription_engine import pitch_transcription_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/arena/presentation", tags=["Arena Live Presentation & Annotation"])


# -----------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------------

class LaserPointerRequest(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0, description="Normalized x coordinate [0.0, 1.0]")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalized y coordinate [0.0, 1.0]")
    active: bool = Field(True, description="Whether the laser pointer is actively projecting")
    color: Optional[str] = Field("#E8632E", description="Pointer color hex code")
    slide_index: Optional[int] = Field(None, ge=0, description="Target slide index")


class SlideAnnotationRequest(BaseModel):
    slide_index: int = Field(..., ge=0, description="Target slide index")
    annotation_type: str = Field(..., description="PEN_STROKE, BOUNDING_BOX, TEXT_CALLOUT, HIGHLIGHT_RECT")
    data: Dict[str, Any] = Field(..., description="Vector payload (points, coordinates, or callout text)")
    color: str = Field("#E8632E", description="Stroke or fill color hex")
    stroke_width: float = Field(2.5, ge=0.5, le=20.0, description="Stroke thickness")
    is_ephemeral: bool = Field(False, description="Whether annotation fades after TTL")
    ttl_sec: float = Field(5.0, ge=1.0, le=60.0, description="TTL in seconds for ephemeral annotations")


class SlideBookmarkRequest(BaseModel):
    slide_index: int = Field(..., ge=0, description="Referenced slide index")
    label: str = Field(..., min_length=2, max_length=100, description="Bookmark headline / topic")
    timestamp_sec: Optional[float] = Field(None, ge=0.0, description="Elapsed timestamp in presentation")
    note: Optional[str] = Field(None, max_length=500, description="Diligence annotation note")


class SlideChangeRequest(BaseModel):
    slide_index: int = Field(..., ge=0, description="Target slide index")
    presenter_name: Optional[str] = Field(None, description="Presenter identifier")


class AudioTranscribeRequest(BaseModel):
    duration_sec: float = Field(..., ge=0.5, le=60.0, description="Audio chunk duration in seconds")
    speaker_name: str = Field(..., description="Speaker identifier")
    current_slide_index: int = Field(..., ge=0, description="Active slide index")
    presentation_elapsed_sec: Optional[float] = Field(None, ge=0.0, description="Elapsed presentation clock")
    speaker_role: str = Field("FOUNDER", description="FOUNDER, INVESTOR, MODERATOR")
    original_language: str = Field("ar-DZ", description="Language code: ar-DZ, ar-SA, fr-FR, en-US")
    raw_text_override: Optional[str] = Field(None, description="Direct text transcription if pre-decoded")


# -----------------------------------------------------------------------------
# REST ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/rooms/{room_id}/state", response_model=Dict[str, Any])
async def get_canvas_state(room_id: str):
    """Retrieves full synchronized collaborative canvas state for room."""
    session = pitch_canvas_sync.get_or_create_session(room_id)
    return session.get_canvas_state()


@router.post("/rooms/{room_id}/slides/current", response_model=Dict[str, Any])
async def set_current_slide(
    room_id: str,
    req: SlideChangeRequest,
    current_user=Depends(get_optional_current_user),
):
    """Synchronizes presentation slide across all connected participants."""
    session = pitch_canvas_sync.get_or_create_session(room_id)
    presenter = req.presenter_name or (current_user.full_name if current_user else "Presenter")
    return session.set_slide(index=req.slide_index, presenter_name=presenter)


@router.post("/rooms/{room_id}/pointer", response_model=Dict[str, Any])
async def update_laser_pointer(
    room_id: str,
    req: LaserPointerRequest,
    current_user=Depends(get_optional_current_user),
):
    """Broadcasts low-latency normalized laser pointer coordinates for presenter/investor."""
    session = pitch_canvas_sync.get_or_create_session(room_id)
    user_id = current_user.id if current_user else 1
    username = current_user.full_name or current_user.email if current_user else "Presenter"

    return session.update_pointer(
        user_id=user_id,
        username=username,
        x=req.x,
        y=req.y,
        active=req.active,
        color=req.color,
        slide_index=req.slide_index,
    )


@router.post("/rooms/{room_id}/annotations", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_slide_annotation(
    room_id: str,
    req: SlideAnnotationRequest,
    current_user=Depends(get_optional_current_user),
):
    """Creates a persistent or ephemeral collaborative pen stroke, bounding box, or callout."""
    session = pitch_canvas_sync.get_or_create_session(room_id)
    user_id = current_user.id if current_user else 1
    username = current_user.full_name or current_user.email if current_user else "Scout"

    try:
        annotation = session.add_annotation(
            author_id=user_id,
            author_name=username,
            annotation_type=req.annotation_type,
            data=req.data,
            slide_index=req.slide_index,
            color=req.color,
            stroke_width=req.stroke_width,
            is_ephemeral=req.is_ephemeral,
            ttl_sec=req.ttl_sec,
        )
        return annotation.to_dict()
    except Exception as e:
        logger.error(f"Error creating annotation: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/rooms/{room_id}/slides/{slide_index}/annotations", response_model=List[Dict[str, Any]])
async def list_slide_annotations(
    room_id: str,
    slide_index: int,
    include_expired: bool = Query(False),
):
    """Retrieves active annotations anchored to a specific slide number."""
    session = pitch_canvas_sync.get_or_create_session(room_id)
    return session.get_slide_annotations(slide_index=slide_index, include_expired=include_expired)


@router.delete("/rooms/{room_id}/annotations/{annotation_id}", response_model=Dict[str, Any])
async def delete_slide_annotation(room_id: str, annotation_id: str):
    """Deletes an annotation by ID."""
    session = pitch_canvas_sync.get_session(room_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation room not found")

    deleted = session.delete_annotation(annotation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    return {"status": "DELETED", "annotation_id": annotation_id}


@router.post("/rooms/{room_id}/bookmarks", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_slide_bookmark(
    room_id: str,
    req: SlideBookmarkRequest,
    current_user=Depends(get_optional_current_user),
):
    """Marks a presentation timestamp for post-event diligence review."""
    session = pitch_canvas_sync.get_or_create_session(room_id)
    user_id = current_user.id if current_user else 1
    username = current_user.full_name or current_user.email if current_user else "Lead Investor"

    bookmark = session.add_bookmark(
        slide_index=req.slide_index,
        label=req.label,
        user_id=user_id,
        username=username,
        timestamp_sec=req.timestamp_sec,
        note=req.note,
    )
    return bookmark.to_dict()


@router.get("/rooms/{room_id}/bookmarks", response_model=List[Dict[str, Any]])
async def list_slide_bookmarks(room_id: str):
    """Lists all timed slide bookmarks for due diligence review."""
    session = pitch_canvas_sync.get_or_create_session(room_id)
    return session.get_bookmarks()


# -----------------------------------------------------------------------------
# MULTILINGUAL PITCH TRANSCRIPTION ENDPOINTS
# -----------------------------------------------------------------------------

@router.post("/rooms/{room_id}/transcribe", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def ingest_audio_chunk(room_id: str, req: AudioTranscribeRequest):
    """Ingests streaming audio chunk and emits synchronized multilingual closed captions."""
    session = pitch_transcription_engine.get_or_create_session(room_id)
    segment = session.ingest_audio_chunk(
        duration_sec=req.duration_sec,
        speaker_name=req.speaker_name,
        current_slide_index=req.current_slide_index,
        presentation_elapsed_sec=req.presentation_elapsed_sec,
        speaker_role=req.speaker_role,
        original_language=req.original_language,
        raw_text_override=req.raw_text_override,
    )
    return segment.to_dict()


@router.get("/rooms/{room_id}/transcript", response_model=List[Dict[str, Any]])
async def get_presentation_transcript(
    room_id: str,
    slide_index: Optional[int] = Query(None),
    language: Optional[str] = Query(None),
):
    """Retrieves synchronized transcript segments filtered by slide or formatted by language."""
    session = pitch_transcription_engine.get_or_create_session(room_id)
    return session.get_transcript(slide_index=slide_index, language=language)


@router.get("/rooms/{room_id}/transcript/export", response_model=Dict[str, Any])
async def export_presentation_transcript(room_id: str):
    """Exports structured transcript grouped by slide for Due Diligence Memorandums."""
    session = pitch_transcription_engine.get_or_create_session(room_id)
    return session.export_full_transcript()
