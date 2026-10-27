"""FastAPI TUS v1.0.0 Resumable Upload Protocol Router."""

import base64
import logging
from typing import Optional
from fastapi import APIRouter, Request, Response, HTTPException, Header, status, Depends
from app.core.auth import get_current_user
from app.services.video.tus_service import tus_upload_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video/tus", tags=["video-tus"])


def _extract_user_info(user: object) -> tuple[int, str]:
    if isinstance(user, dict):
        uid = user.get("id") or 0
        role = user.get("role") or ""
    else:
        uid = getattr(user, "id", 0)
        role = getattr(user, "role", "")
    return int(uid), str(role)


@router.options("")
@router.options("/{upload_id}")
async def tus_options():
    """TUS Protocol 1.0.0 Capabilities Pre-flight Header Negotiation."""
    return Response(
        status_code=204,
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,checksum",
            "Tus-Max-Size": "5368709120",  # 5 GB
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, HEAD, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata",
            "Access-Control-Expose-Headers": "Upload-Offset, Location, Upload-Length, Tus-Resumable, Tus-Version",
        },
    )


@router.post("")
async def tus_create(
    request: Request,
    upload_length: Optional[int] = Header(None, alias="Upload-Length"),
    upload_metadata: Optional[str] = Header(None, alias="Upload-Metadata"),
    tus_resumable: Optional[str] = Header(None, alias="Tus-Resumable"),
    current_user: dict = Depends(get_current_user),
):
    """TUS Protocol 1.0.0 Creation Extension: Create a new resumable upload session."""
    if tus_resumable is not None and tus_resumable != "1.0.0":
        return Response(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            headers={"Tus-Version": "1.0.0"},
            content="Unsupported Tus-Resumable version",
        )

    if upload_length is None or upload_length <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload-Length header is required and must be greater than 0",
        )
    max_size = 5368709120  # 5 GB
    if upload_length > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Upload-Length exceeds maximum allowed size of {max_size} bytes",
        )

    meta_dict = {}
    if upload_metadata:
        for item in upload_metadata.split(","):
            parts = item.strip().split(" ", 1)
            k = parts[0].strip()
            v = parts[1].strip() if len(parts) > 1 else ""
            try:
                meta_dict[k] = base64.b64decode(v).decode("utf-8")
            except Exception:
                meta_dict[k] = v

    file_name = meta_dict.get("filename") or meta_dict.get("name") or "video.mp4"
    lesson_id = meta_dict.get("lesson_id") or meta_dict.get("lessonId")
    provider = meta_dict.get("provider") or "aws"

    user_id, _ = _extract_user_info(current_user)
    session = await tus_upload_service.create_upload_session(
        user_id=user_id,
        file_name=file_name,
        file_size_bytes=upload_length,
        lesson_id=lesson_id,
        provider=provider,
    )
    tus_id = session["tus_id"]
    location_url = f"/api/v1/video/tus/{tus_id}"

    return Response(
        status_code=201,
        headers={
            "Tus-Resumable": "1.0.0",
            "Location": location_url,
            "Upload-Offset": "0",
            "Access-Control-Expose-Headers": "Location, Tus-Resumable, Upload-Offset",
        },
    )


@router.head("/{upload_id}")
async def tus_head(
    upload_id: str,
    tus_resumable: Optional[str] = Header(None, alias="Tus-Resumable"),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve current TUS byte offset for upload session with access control."""
    if tus_resumable is not None and tus_resumable != "1.0.0":
        return Response(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            headers={"Tus-Version": "1.0.0"},
            content="Unsupported Tus-Resumable version",
        )

    user_id, user_role = _extract_user_info(current_user)
    is_admin = user_role in ("ADMIN", "SUPERADMIN")

    has_access = await tus_upload_service.verify_session_access(
        upload_id, user_id, is_admin
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to upload session",
        )

    current_offset = tus_upload_service.get_upload_offset(upload_id)
    return Response(
        status_code=200,
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(current_offset),
            "Cache-Control": "no-store",
        },
    )


@router.patch("/{upload_id}")
async def tus_patch(
    upload_id: str,
    request: Request,
    upload_offset: Optional[int] = Header(None, alias="Upload-Offset"),
    content_type: Optional[str] = Header(None, alias="Content-Type"),
    tus_resumable: Optional[str] = Header(None, alias="Tus-Resumable"),
    current_user: dict = Depends(get_current_user),
):
    """Receive binary chunk for TUS upload session with Chunk 0 magic byte header verification."""
    if tus_resumable is not None and tus_resumable != "1.0.0":
        return Response(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            headers={"Tus-Version": "1.0.0"},
            content="Unsupported Tus-Resumable version",
        )

    if content_type != "application/offset+octet-stream":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Content-Type must be application/offset+octet-stream",
        )

    if upload_offset is None or upload_offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload-Offset header is required and must be >= 0",
        )

    user_id, user_role = _extract_user_info(current_user)
    is_admin = user_role in ("ADMIN", "SUPERADMIN")

    has_access = await tus_upload_service.verify_session_access(
        upload_id, user_id, is_admin
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to upload session",
        )

    current_disk_offset = tus_upload_service.get_upload_offset(upload_id)
    if upload_offset != current_disk_offset:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Upload offset mismatch: server has {current_disk_offset}, request specified {upload_offset}",
        )

    try:
        new_offset = await tus_upload_service.write_chunk_stream(
            upload_id, request.stream(), upload_offset
        )
        session = await tus_upload_service.get_session(upload_id)
        if session and new_offset >= session.fileSizeBytes:
            try:
                from app.tasks.video_tasks import finalize_tus_upload_task

                finalize_tus_upload_task.delay(upload_id=upload_id)
            except Exception as task_err:
                logger.warning(
                    f"Could not enqueue finalize_tus_upload_task for {upload_id}: {task_err}"
                )
    except ValueError as e:
        err_msg = str(e)
        if "Security rejection" in err_msg or "Invalid video magic bytes" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=err_msg,
        )

    return Response(
        status_code=204,
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(new_offset),
        },
    )


@router.delete("/{upload_id}")
async def tus_delete(
    upload_id: str,
    tus_resumable: Optional[str] = Header(None, alias="Tus-Resumable"),
    current_user: dict = Depends(get_current_user),
):
    """Abort TUS upload session and purge landing storage."""
    if tus_resumable is not None and tus_resumable != "1.0.0":
        return Response(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            headers={"Tus-Version": "1.0.0"},
            content="Unsupported Tus-Resumable version",
        )

    user_id, user_role = _extract_user_info(current_user)
    is_admin = user_role in ("ADMIN", "SUPERADMIN")

    has_access = await tus_upload_service.verify_session_access(
        upload_id, user_id, is_admin
    )
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to upload session",
        )

    tus_upload_service.delete_upload(upload_id)
    return Response(
        status_code=204,
        headers={"Tus-Resumable": "1.0.0"},
    )
