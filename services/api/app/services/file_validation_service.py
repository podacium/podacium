"""
File Upload Validation Service.

Validates uploaded files for:
- File type (MIME type + magic bytes)
- File size (per-category limits)
- Filename sanitization
"""

import logging
import os
import re
from typing import Optional, Tuple

from fastapi import UploadFile

logger = logging.getLogger(__name__)

# Per-category file size limits (in bytes)
SIZE_LIMITS = {
    "avatar": 5 * 1024 * 1024,  # 5 MB
    "course_thumbnail": 10 * 1024 * 1024,  # 10 MB
    "certificate": 20 * 1024 * 1024,  # 20 MB
    "dataset": 100 * 1024 * 1024,  # 100 MB
    "invoice": 10 * 1024 * 1024,  # 10 MB
    "video": 2 * 1024 * 1024 * 1024,  # 2 GB
    "attachments": 50 * 1024 * 1024,  # 50 MB
    "default": 50 * 1024 * 1024,  # 50 MB
}

# Allowed MIME types per category
ALLOWED_TYPES = {
    "avatar": {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    },
    "course_thumbnail": {
        "image/jpeg",
        "image/png",
        "image/webp",
    },
    "certificate": {
        "application/pdf",
        "image/png",
        "image/jpeg",
    },
    "dataset": {
        "text/csv",
        "application/json",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",  # For binary datasets
    },
    "invoice": {
        "application/pdf",
    },
    "video": {
        "video/mp4",
        "video/quicktime",
        "video/x-matroska",
        "video/webm",
        "application/octet-stream",  # Browsers/curl frequently omit the type
    },
    "attachments": {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/svg+xml",
        "application/pdf",
        "text/csv",
        "text/plain",
        "text/markdown",
        "text/x-markdown",
        "text/xml",
        "application/xml",
        "text/yaml",
        "application/x-yaml",
        "application/json",
        "application/zip",
        "application/x-zip-compressed",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/webm",
    },
    "default": {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/svg+xml",
        "application/pdf",
        "text/csv",
        "text/plain",
        "text/markdown",
        "text/x-markdown",
        "application/json",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
    },
}

# Magic bytes for common file types
MAGIC_BYTES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
    b"RIFF": "image/webp",  # WebP starts with RIFF
    b"%PDF": "application/pdf",
    b"PK\x03\x04": "application/zip",  # xlsx, docx, etc.
}

# Video container signatures (magic bytes) — validated BEFORE anything is
# streamed to storage. MP4/MOV share the ISO BMFF box header (ftyp at offset 4).
VIDEO_MAGIC_BYTES = {
    b"\x00\x00\x00\x18ftyp": "video/mp4",  # MP4 (ISO BMFF)
    b"\x00\x00\x00\x1cftyp": "video/mp4",  # MP4 (larger box size)
    b"ftyp": "video/mp4",  # MP4/MOV family (offset 4)
    b"\x1a\x45\xdf\xa3": "video/x-matroska",  # MKV / WebM (EBML header)
    b"RIFF": "video/avi",  # AVI
}

# Extensions that are always rejected for video uploads.
BLOCKED_VIDEO_EXTENSIONS = {
    ".html",
    ".htm",
    ".svg",
    ".js",
    ".css",
    ".xml",
    ".php",
    ".asp",
    ".jsp",
    ".py",
    ".rb",
    ".sh",
    ".bat",
    ".cmd",
    ".exe",
    ".msi",
    ".com",
    ".pif",
    ".vbs",
    ".ps1",
    ".dll",
    ".so",
    ".bin",
    ".txt",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".json",
    ".gz",
    ".zip",
    ".tar",
    ".7z",
    ".rar",
}

# Categories where an unrecognised magic byte signature is rejected outright (no benefit of the doubt).
STRICT_MAGIC_CATEGORIES = {"avatar", "course_thumbnail", "certificate", "invoice"}

# Dangerous file extensions (never allow)
BLOCKED_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".com",
    ".msi",
    ".scr",
    ".pif",
    ".vbs",
    ".js",
    ".wsh",
    ".wsf",
    ".ps1",
    ".sh",
    ".bash",
    ".php",
    ".asp",
    ".aspx",
    ".jsp",
    ".cgi",
    ".py",
    ".rb",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
}


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent path traversal and injection.
    Returns a safe filename string.
    """
    if not filename:
        return "unnamed_file"

    # Remove path separators
    filename = os.path.basename(filename)

    # Remove null bytes
    filename = filename.replace("\x00", "")

    # Replace dangerous characters
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", filename)

    # Limit length
    name, ext = os.path.splitext(filename)
    name = name[:100]  # Max 100 chars for name
    ext = ext[:10]  # Max 10 chars for extension

    # Ensure it's not empty after sanitization
    if not name:
        name = "unnamed_file"

    return f"{name}{ext}"


def validate_file_extension(filename: str) -> Optional[str]:
    """
    Check if the file extension is blocked.
    Returns error message if blocked, None if OK.
    """
    if not filename:
        return None

    _, ext = os.path.splitext(filename.lower())
    if ext in BLOCKED_EXTENSIONS:
        return f"File type '{ext}' is not allowed for security reasons"

    return None


def validate_magic_bytes(content_start: bytes, claimed_type: str) -> bool:
    """
    Verify that the file's magic bytes match the claimed MIME type.
    Returns True if valid or if we can't determine (benefit of the doubt).
    """
    for magic, mime_type in MAGIC_BYTES.items():
        if content_start.startswith(magic):
            # If we can identify the file, check it matches
            if claimed_type and mime_type != claimed_type:
                # Special case: xlsx files are zip archives
                if magic == b"PK\x03\x04" and "spreadsheet" in claimed_type:
                    return True
                logger.warning(
                    f"MIME mismatch: claimed={claimed_type}, detected={mime_type}"
                )
                return False
            return True

    # Can't determine from magic bytes — allow (rely on MIME type check)
    return True


def validate_magic_bytes_strict(content_start: bytes, claimed_type: str) -> bool:
    """Like `validate_magic_bytes`, but rejects files with unrecognised signatures.

    Used for categories where a mismatched magic byte is an upload attack vector
    (avatars, thumbnails, certificates, invoices).
    """
    for magic, mime_type in MAGIC_BYTES.items():
        if content_start.startswith(magic):
            if claimed_type and mime_type != claimed_type:
                if magic == b"PK\x03\x04" and "spreadsheet" in claimed_type:
                    return True
                logger.warning(
                    f"Strict MIME mismatch: claimed={claimed_type}, detected={mime_type}"
                )
                return False
            return True

    logger.warning(
        f"Strict magic-bytes check failed: unrecognized content (claimed={claimed_type})"
    )
    return False


async def validate_upload(
    file: UploadFile,
    category: str = "default",
) -> Tuple[bool, Optional[str]]:
    """
    Validate an uploaded file.

    Returns:
        (is_valid, error_message) — error_message is None if valid.
    """
    # 1. Check filename
    if not file.filename:
        return False, "No filename provided"

    ext_error = validate_file_extension(file.filename)
    if ext_error:
        return False, ext_error

    # 2. Check MIME type
    allowed = ALLOWED_TYPES.get(category, ALLOWED_TYPES["default"])
    if file.content_type and file.content_type not in allowed:
        return False, f"File type '{file.content_type}' is not allowed for {category}"

    # 3. Check file size
    max_size = SIZE_LIMITS.get(category, SIZE_LIMITS["default"])

    # Read first chunk to check magic bytes and estimate size
    content_start = await file.read(8192)
    file_size = len(content_start)

    # Read rest to get full size
    while True:
        chunk = await file.read(65536)
        if not chunk:
            break
        file_size += len(chunk)
        if file_size > max_size:
            await file.seek(0)
            max_mb = max_size / (1024 * 1024)
            return (
                False,
                f"File too large. Maximum size for {category} is {max_mb:.0f} MB",
            )

    # Reset file position for subsequent reads
    await file.seek(0)

    # 4. Validate magic bytes
    if content_start and file.content_type:
        if category in STRICT_MAGIC_CATEGORIES:
            if not validate_magic_bytes_strict(content_start, file.content_type):
                return False, "File content does not match its declared type"
        elif not validate_magic_bytes(content_start, file.content_type):
            return False, "File content does not match its declared type"

    # 5. Antivirus scan on the full content buffer (small files fit in memory).
    from app.services.antivirus_service import antivirus_service

    # Re-read after seek to get full bytes for scanning.
    full_content = await file.read()
    await file.seek(0)

    av_result = await antivirus_service.scan_bytes(
        full_content, file.filename or "upload"
    )
    if not av_result.clean and not av_result.skipped:
        logger.error(
            f"AV scan blocked upload '{file.filename}': "
            f"threat={av_result.threat}, error={av_result.error}"
        )
        return False, (
            f"Upload blocked by antivirus scan: {av_result.threat or av_result.error}"
        )

    return True, None


async def validate_video_upload(
    file: UploadFile,
    max_size: int = SIZE_LIMITS["video"],
) -> Tuple[bool, Optional[str]]:
    """Validate a video upload without buffering it in memory.

    Checks extension, content-type, container magic bytes, size cap, and
    runs an AV pre-screen on the header. Resets file position to 0 on return.
    """
    from app.services.antivirus_service import antivirus_service

    if not file.filename:
        return False, "No filename provided"

    clean_name = sanitize_filename(file.filename)
    _, ext = os.path.splitext(clean_name.lower())
    if ext in BLOCKED_VIDEO_EXTENSIONS:
        return False, f"File type '{ext}' is not a supported video format"

    if file.content_type and file.content_type not in ALLOWED_TYPES["video"]:
        return False, f"Content type '{file.content_type}' is not an allowed video type"

    # 1. Read header (first 16 KB) to inspect magic bytes.
    header = await file.read(16 * 1024)
    if not header:
        return False, "Empty file"

    # 2. Verify the container signature.
    if not _matches_video_magic(header):
        return (
            False,
            "File content is not a recognized video container (MP4/MOV/MKV/WebM/AVI)",
        )

    # Auditable: note uploads that came in with an ambiguous content type.
    if file.content_type == "application/octet-stream":
        logger.warning(
            f"Video upload with ambiguous content type 'application/octet-stream' "
            f"(filename={file.filename}); accepted because container magic matched"
        )

    # 3. Stream the remainder to enforce the size cap without buffering in RAM.
    total = len(header)
    chunk_size = 1024 * 1024  # 1 MB
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > max_size:
            await file.seek(0)
            max_gb = max_size / (1024 * 1024 * 1024)
            return False, f"File too large. Maximum video size is {max_gb:.0f} GB"

    # 4. AV pre-screen on the header — catches polyglot files without reading the full 2 GB.
    # A full rescan is queued via Celery after the file reaches S3.
    av_result = await antivirus_service.scan_bytes(header, file.filename or "upload")
    if not av_result.clean and not av_result.skipped:
        logger.error(
            f"AV pre-screen blocked video upload '{file.filename}': "
            f"threat={av_result.threat}, error={av_result.error}"
        )
        return False, (
            f"Upload blocked by antivirus scan: {av_result.threat or av_result.error}"
        )

    # 5. Reset position so the caller can stream the content.
    await file.seek(0)
    return True, None


def _matches_video_magic(header: bytes) -> bool:
    """Return True if the header matches a known video container signature."""
    # ISO BMFF (MP4/MOV): box size (4 bytes) + "ftyp"
    if b"ftyp" in header[:16]:
        return True
    # EBML (MKV/WebM): 0x1A 0x45 0xDF 0xA3
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return True
    # AVI: "RIFF" + "AVI "
    if header.startswith(b"RIFF") and b"AVI " in header[:12]:
        return True
    return False
