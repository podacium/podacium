"""Subtitle serving endpoint — serves VTT files from local disk.

Requires authentication and a verified entitlement for the owning module.
The lesson id is basename-sanitized to prevent path traversal.
"""
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.core.auth import get_current_user
from app.core.config import setting
from app.core.prisma import prisma
from app.services.education_service import education_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subtitles", tags=["Subtitles"])


@router.get("/{lesson_id}")
async def get_lesson_subtitles(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Serve WebVTT subtitle file for a lesson (enrolled/entitled users only)."""
    # Path traversal guard: only accept a bare lesson id.
    if lesson_id != Path(lesson_id).name or "/" in lesson_id or "\\" in lesson_id or ".." in lesson_id:
        raise HTTPException(status_code=400, detail="Invalid lesson id")

    lesson = await prisma.lesson.find_unique(
        where={"id": lesson_id},
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Ownership bypass (instructor/admin) mirrors the video access rules.
    is_owner = await _user_is_instructor_or_admin(current_user, lesson)
    if not is_owner:
        try:
            has_access = await education_service.check_access(current_user.id, lesson.moduleId)
        except Exception:
            has_access = False
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="No access to this lesson's subtitles",
            )

    sub_dir = Path(setting.SUBTITLES_DIR)
    path = sub_dir / f"{lesson_id}.vtt"

    if not path.exists():
        raise HTTPException(status_code=404, detail="Subtitles not found")

    return FileResponse(
        path=path,
        media_type="text/vtt",
        headers={
            "Cache-Control": "private, max-age=86400",
        },
    )


async def _user_is_instructor_or_admin(user, lesson) -> bool:
    """Instructors (module owner) and admins may always fetch their content."""
    if getattr(user, "role", None) == "ADMIN":
        return True
    if getattr(user, "role", None) == "INSTRUCTOR":
        module = await prisma.module.find_unique(
            where={"id": lesson.moduleId},
        )
        if module and module.instructorId == user.id:
            return True
    return False