import logging

logger = logging.getLogger(__name__)
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from typing import List
from app.core.auth import get_current_active_user
from app.services.file_service import file_service
from app.schemas.file import (
    FileResponse,
    UploadTicketRequest,
    UploadTicketResponse,
    ConfirmUploadRequest,
)

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload-ticket", response_model=UploadTicketResponse)
async def create_upload_ticket(
    req: UploadTicketRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Request a presigned upload ticket for direct-to-cloud or streaming upload.
    Validates user authentication, file size constraints, and allowed category.
    """
    return await file_service.create_upload_ticket(
        filename=req.filename,
        category=req.category,
        content_type=req.content_type,
        size=req.size,
        owner_id=current_user.id,
    )


@router.post("/confirm-upload", response_model=FileResponse)
async def confirm_cloud_upload(
    req: ConfirmUploadRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Confirm completion of direct cloud upload and record metadata in the database.
    """
    return await file_service.confirm_cloud_upload(
        file_key=req.file_key,
        filename=req.filename,
        category=req.category,
        size=req.size,
        content_type=req.content_type,
        owner_id=current_user.id,
    )


@router.post("/upload", response_model=FileResponse)
async def upload_file(
    category: str = Query(
        "avatars",
        description="File category: avatars, datasets, certificates, courses, attachments, invoices",
    ),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Upload a file for the current user (Streaming fallback).
    File type is verified via magic bytes, and size is enforced.
    """
    try:
        return await file_service.save_file(
            file=file, owner_id=current_user.id, category=category
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="errors.file.upload_failed")


@router.get("", response_model=List[FileResponse])
async def list_user_files(
    category: str = Query("avatars"),
    current_user: dict = Depends(get_current_active_user),
):
    """List user's uploaded files by category"""
    return await file_service.get_user_files(
        owner_id=current_user.id, category=category
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: int, current_user: dict = Depends(get_current_active_user)
):
    """Delete one of the user's files"""
    return await file_service.delete_file(file_id=file_id, owner_id=current_user.id)
