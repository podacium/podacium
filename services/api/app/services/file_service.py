import logging

logger = logging.getLogger(__name__)
import os
from fastapi import UploadFile, HTTPException
from app.core.prisma import prisma
from app.generated.prisma import Json
from app.core.config import setting
from app.schemas.file import FileResponse
from app.services.file_validator import (
    CATEGORY_ALLOWED_MIME_TYPES,
    validate_file_size,
    validate_file_content,
)

import re

DANGEROUS_EXTENSIONS_PATTERN = re.compile(
    r"\.(php\d?|phtml|phar|exe|dll|bat|cmd|sh|bash|pl|cgi|vbs|jar|scr|msi|vbe|wsf|hta|asp|aspx|jsp|jspx)(\.|$)",
    re.IGNORECASE,
)

SAFE_MIME_EXTENSIONS = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "image/bmp": [".bmp"],
    "image/svg+xml": [".svg"],
    "application/pdf": [".pdf"],
    "video/mp4": [".mp4"],
    "video/webm": [".webm"],
    "video/quicktime": [".mov"],
    "audio/mpeg": [".mp3"],
    "audio/mp3": [".mp3"],
    "audio/wav": [".wav"],
    "audio/x-wav": [".wav"],
    "audio/ogg": [".ogg"],
    "audio/webm": [".webm"],
    "audio/aac": [".aac"],
    "audio/mp4": [".m4a"],
    "audio/x-m4a": [".m4a"],
    "audio/flac": [".flac"],
    "application/json": [".json"],
    "text/csv": [".csv", ".tsv"],
    "text/plain": [
        ".txt",
        ".log",
        ".md",
        ".markdown",
        ".py",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".sql",
        ".csv",
        ".tsv",
        ".json",
        ".yaml",
        ".yml",
        ".xml",
        ".html",
        ".css",
        ".sh",
        ".env",
        ".ini",
        ".conf",
    ],
    "text/markdown": [".md", ".markdown"],
    "text/x-markdown": [".md", ".markdown"],
    "text/xml": [".xml"],
    "application/xml": [".xml"],
    "text/yaml": [".yaml", ".yml"],
    "application/x-yaml": [".yaml", ".yml"],
    "text/x-python": [".py"],
    "application/javascript": [".js", ".mjs"],
    "text/javascript": [".js", ".mjs"],
    "text/typescript": [".ts", ".tsx"],
    "text/css": [".css"],
    "text/html": [".html", ".htm"],
    "application/zip": [".zip", ".xlsx", ".docx", ".pptx"],
    "application/x-zip-compressed": [".zip", ".xlsx", ".docx", ".pptx"],
    "application/vnd.ms-excel": [".xls", ".xlsx"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx"
    ],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
        ".pptx"
    ],
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/parquet": [".parquet"],
    "application/octet-stream": [".parquet", ".bin", ".dat"],
}


def sanitize_filename(filename: str) -> str:
    """Sanitize and clean raw filename to prevent path traversal and null-byte injection."""
    if not filename:
        return "unnamed_file"
    # Remove null bytes and path separators
    cleaned = filename.replace("\x00", "").replace("/", "_").replace("\\", "_")
    # Remove control characters
    cleaned = "".join(ch for ch in cleaned if ord(ch) >= 32)
    # Strip whitespace
    cleaned = cleaned.strip()
    if not cleaned:
        return "unnamed_file"
    # Limit length
    return cleaned[:255]


def get_safe_extension(filename: str, detected_mime: str) -> str:
    """Validate and normalize extension for the detected MIME type."""
    # Check for dangerous double extensions (e.g. file.php.png)
    if DANGEROUS_EXTENSIONS_PATTERN.search(filename):
        raise HTTPException(
            status_code=400,
            detail="errors.file.dangerous_extension_detected",
        )

    ext = os.path.splitext(filename)[1].lower()
    allowed_exts = SAFE_MIME_EXTENSIONS.get(detected_mime, [])

    if ext in allowed_exts:
        return ext
    elif allowed_exts:
        # Default to canonical extension for the detected MIME
        return allowed_exts[0]

    # Check if ext is in text/plain or image extensions when MIME is broad
    if ext in SAFE_MIME_EXTENSIONS.get("text/plain", []) and (
        not detected_mime
        or detected_mime.startswith("text/")
        or detected_mime
        in ("application/octet-stream", "application/json", "application/xml")
    ):
        return ext

    return ".bin"


from app.services.storage import storage_manager
from app.schemas.file import UploadTicketResponse


class FileService:
    def __init__(self):
        self.allowed_categories = list(CATEGORY_ALLOWED_MIME_TYPES.keys())
        self.storage = storage_manager

    async def create_upload_ticket(
        self,
        filename: str,
        category: str,
        content_type: str,
        size: int,
        owner_id: int,
    ) -> UploadTicketResponse:
        """Create a presigned upload ticket or local upload endpoint."""
        if category not in self.allowed_categories:
            raise HTTPException(status_code=400, detail="errors.file.invalid_category")

        # Validate size limit
        size_result = validate_file_size(size)
        if not size_result.is_valid:
            raise HTTPException(status_code=413, detail=size_result.error)

        # Validate extension safety
        safe_ext = get_safe_extension(filename, content_type)
        safe_filename = sanitize_filename(filename)
        if safe_filename.lower().endswith(safe_ext.lower()):
            target_name = safe_filename
        else:
            target_name = f"{os.path.splitext(safe_filename)[0]}{safe_ext}"

        ticket = await self.storage.generate_presigned_upload_ticket(
            filename=target_name,
            category=category,
            content_type=content_type,
            max_size_bytes=setting.MAX_FILE_SIZE,
        )

        return UploadTicketResponse(
            upload_url=ticket.upload_url,
            file_key=ticket.file_key,
            method=ticket.method,
            headers=ticket.headers,
            is_cloud=ticket.is_cloud,
            category=ticket.category,
            expires_in_seconds=ticket.expires_in_seconds,
            driver_name=ticket.driver_name,
        )

    async def confirm_cloud_upload(
        self,
        file_key: str,
        filename: str,
        category: str,
        size: int,
        content_type: str,
        owner_id: int,
    ) -> FileResponse:
        """Confirm a direct cloud upload after client finishes PUT."""
        if category not in self.allowed_categories:
            raise HTTPException(status_code=400, detail="errors.file.invalid_category")

        # Verify file actually exists in storage
        exists = await self.storage.file_exists(file_key, category)
        if not exists:
            raise HTTPException(status_code=400, detail="errors.file.upload_not_found")

        safe_display_name = sanitize_filename(filename)
        stored_name = os.path.basename(file_key)
        download_url = await self.storage.generate_download_url(
            file_key, category, filename=safe_display_name
        )
        driver = self.storage.get_driver(category)

        db_file = await prisma.file.create(
            data={
                "filename": safe_display_name,
                "storedName": stored_name,
                "path": file_key,
                "contentType": content_type,
                "mimeType": content_type,
                "size": size,
                "ownerId": owner_id,
                "category": category,
            }
        )

        return FileResponse(
            id=db_file.id,
            filename=db_file.filename,
            url=download_url,
            size=size,
            content_type=content_type,
            owner_id=owner_id,
            category=category,
            created_at=db_file.createdAt,
            is_sovereign=driver.is_sovereign,
            driver=driver.driver_name,
        )

    async def save_file(
        self,
        file: UploadFile,
        owner_id: int,
        category: str = "avatars",
    ) -> FileResponse:
        """Save uploaded file using the active storage driver and record metadata in DB."""

        if category not in self.allowed_categories:
            raise HTTPException(status_code=400, detail="errors.file.invalid_category")

        try:
            # ── Sanitize client filename ────────────────────────────────────
            raw_filename = file.filename or "file"
            safe_display_name = sanitize_filename(raw_filename)

            # ── Read full content for validation ────────────────────────────
            max_size = setting.MAX_FILE_SIZE
            chunks = []
            total_read = 0

            while True:
                chunk = await file.read(65536)  # 64 KB chunks
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > max_size:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum size of {max_size / (1024 * 1024):.0f} MB",
                    )
                chunks.append(chunk)

            raw_bytes = b"".join(chunks)

            # ── Content validation (magic bytes & polyglot checks) ──────────
            content_result = validate_file_content(
                raw_bytes, category, content_type=file.content_type
            )
            if not content_result.is_valid:
                raise HTTPException(status_code=400, detail=content_result.error)

            detected_mime = content_result.detected_mime_type or file.content_type

            # ── Size validation ─────────────────────────────────────────────
            size_result = validate_file_size(total_read)
            if not size_result.is_valid:
                raise HTTPException(status_code=413, detail=size_result.error)

            # ── Validate & normalize file extension ─────────────────────────
            safe_ext = get_safe_extension(raw_filename, detected_mime)
            safe_filename = f"{safe_display_name}{safe_ext}"

            # ── Save using StorageManager ───────────────────────────────────
            upload_result = await self.storage.upload_file(
                content=raw_bytes,
                filename=safe_filename,
                category=category,
                content_type=detected_mime,
            )

            # ── Save metadata to DB ─────────────────────────────────────────
            db_file = await prisma.file.create(
                data={
                    "filename": safe_display_name,
                    "storedName": upload_result["unique_name"],
                    "path": upload_result["key"],
                    "contentType": file.content_type,
                    "mimeType": detected_mime,
                    "size": total_read,
                    "ownerId": owner_id,
                    "category": category,
                }
            )

            return FileResponse(
                id=db_file.id,
                filename=db_file.filename,
                url=upload_result["url"],
                size=total_read,
                content_type=detected_mime,
                owner_id=owner_id,
                category=category,
                created_at=db_file.createdAt,
                is_sovereign=upload_result.get("is_sovereign", True),
                driver=upload_result.get("driver", "local"),
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"File upload failed: {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail="errors.file.upload_failed")

    async def save_bytes(
        self,
        content: bytes,
        filename: str,
        owner_id: int,
        category: str = "invoices",
        content_type: str = "application/pdf",
    ) -> FileResponse:
        """Save bytes directly to storage and record metadata in DB (for internal generation)."""

        if not content:
            raise HTTPException(status_code=400, detail="errors.file.empty_content")

        if category not in self.allowed_categories:
            raise HTTPException(status_code=400, detail="errors.file.invalid_category")

        try:
            size_result = validate_file_size(len(content))
            if not size_result.is_valid:
                raise HTTPException(status_code=413, detail=size_result.error)

            safe_display_name = sanitize_filename(filename)
            safe_ext = get_safe_extension(filename, content_type)
            safe_filename = f"{safe_display_name}{safe_ext}"

            upload_result = await self.storage.upload_file(
                content=content,
                filename=safe_filename,
                category=category,
                content_type=content_type,
            )

            file_size = len(content)

            db_file = await prisma.file.create(
                data={
                    "filename": safe_display_name,
                    "storedName": upload_result["unique_name"],
                    "path": upload_result["key"],
                    "contentType": content_type,
                    "mimeType": content_type,
                    "size": file_size,
                    "ownerId": owner_id,
                    "category": category,
                }
            )

            return FileResponse(
                id=db_file.id,
                filename=db_file.filename,
                url=upload_result["url"],
                size=file_size,
                content_type=content_type,
                owner_id=owner_id,
                category=category,
                created_at=db_file.createdAt,
                is_sovereign=upload_result.get("is_sovereign", True),
                driver=upload_result.get("driver", "local"),
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"File save_bytes failed: {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail="errors.file.save_failed")

    async def get_user_files(self, owner_id: int, category: str = "avatars"):
        files = await prisma.file.find_many(
            where={
                "ownerId": owner_id,
                "category": category,
                "deletedAt": None,
            }
        )

        result = []
        for f in files:
            url = await self.storage.generate_download_url(
                f.path or f"{f.category}/{f.storedName}",
                f.category,
                filename=f.filename,
            )
            driver = self.storage.get_driver(f.category or "avatars")
            result.append(
                FileResponse(
                    id=f.id,
                    filename=f.filename,
                    url=url,
                    size=f.size,
                    content_type=f.contentType
                    or f.mimeType
                    or "application/octet-stream",
                    owner_id=f.ownerId,
                    category=f.category,
                    created_at=f.createdAt,
                    is_sovereign=driver.is_sovereign,
                    driver=driver.driver_name,
                )
            )
        return result

    async def delete_file(self, file_id: int, owner_id: int) -> dict:
        file_record = await prisma.file.find_first(
            where={
                "id": file_id,
                "ownerId": owner_id,
                "deletedAt": None,
            }
        )

        if not file_record:
            raise HTTPException(
                status_code=404, detail="errors.file.not_found_or_unauthorized"
            )

        # Delete physical asset
        key = file_record.path or f"{file_record.category}/{file_record.storedName}"
        await self.storage.delete_file(key, file_record.category or "avatars")

        # ANPDP / Law 18-07 Audit Trail for sovereign data deletion
        if self.storage.is_sovereign_category(file_record.category or ""):
            try:
                await prisma.auditlog.create(
                    data={
                        "actorId": owner_id,
                        "entityId": str(file_id),
                        "entityType": "FILE",
                        "eventType": "FILE_DELETE",
                        "metadata": Json(
                            {
                                "category": file_record.category,
                                "is_sovereign": True,
                            }
                        ),
                    }
                )
            except Exception as log_err:
                logger.warning(f"Audit log error: {log_err}")

        return {"message": "file.deleted_successfully"}


file_service = FileService()
