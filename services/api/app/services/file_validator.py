"""
File Upload Validator — MIME type verification via magic bytes, plus size enforcement.

Magic byte detection is authoritative (checks the actual file content), not relying on
the Content-Type header which the client can spoof. For formats without reliable magic
bytes (CSV, JSON), we do heuristic content checks instead.
"""

import logging
from typing import Dict, List, Tuple, Optional

from app.core.config import setting

logger = logging.getLogger(__name__)

# =============================================================================
# MAGIC BYTE CHECKERS
# =============================================================================
# Each returns True if `data` starts with (or contains at the given offset)
# the expected signature for that MIME type.


def _check_jpeg(data: bytes) -> bool:
    return len(data) >= 3 and data[:3] == b"\xff\xd8\xff"


def _check_png(data: bytes) -> bool:
    return len(data) >= 8 and data[:8] == b"\x89\x50\x4e\x47\x0d\x0a\x1a\x0a"


def _check_gif(data: bytes) -> bool:
    return len(data) >= 6 and data[:6] in (
        b"\x47\x49\x46\x38\x37\x61",  # GIF87a
        b"\x47\x49\x46\x38\x39\x61",  # GIF89a
    )


def _check_webp(data: bytes) -> bool:
    """WebP: RIFF header at offset 0, WEBP at offset 8."""
    return (
        len(data) >= 12
        and data[:4] == b"\x52\x49\x46\x46"
        and data[8:12] == b"\x57\x45\x42\x50"
    )


def _check_bmp(data: bytes) -> bool:
    return len(data) >= 2 and data[:2] == b"\x42\x4d"


def _check_pdf(data: bytes) -> bool:
    return len(data) >= 4 and data[:4] == b"\x25\x50\x44\x46"


def _check_mp4(data: bytes) -> bool:
    """MP4: ftyp box at offset 4 (ftyp = file type box)."""
    return (
        len(data) >= 12
        and data[4:8] == b"ftyp"
        # Common MP4 brands
        and data[8:12] in (b"isom", b"mp42", b"mp41", b"avc1", b"dash")
    )


def _check_webm(data: bytes) -> bool:
    """WebM / Matroska: starts with EBML header."""
    return len(data) >= 4 and data[:4] == b"\x1a\x45\xdf\xa3"


def _check_quicktime(data: bytes) -> bool:
    """QuickTime .mov: ftyp box or moov at offset 4."""
    return (len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] == b"qt  ") or (
        len(data) >= 8 and data[4:8] == b"moov"
    )


def _check_zip(data: bytes) -> bool:
    """ZIP archive signature: PK\x03\x04 or PK\x05\x06 (empty) or PK\x07\x08."""
    return len(data) >= 4 and (
        data[:4] == b"\x50\x4b\x03\x04"
        or data[:4] == b"\x50\x4b\x05\x06"
        or data[:4] == b"\x50\x4b\x07\x08"
    )


def _check_text_plain(data: bytes) -> bool:
    """Printable UTF-8 text with no null bytes."""
    if not data:
        return False
    if b"\x00" in data[:1024]:
        return False
    return _is_printable_ascii_or_utf8(data[:1024])


def _check_docx(data: bytes) -> bool:
    """Office Open XML Document (.docx) — ZIP-based containing word/."""
    if len(data) < 4 or data[:4] != b"\x50\x4b\x03\x04":
        return False
    try:
        import zipfile

        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            return any(n.startswith("word/") for n in zf.namelist())
    except Exception:
        return False


def _check_xlsx(data: bytes) -> bool:
    """Office Open XML (xlsx, xlsm) — ZIP-based containing xl/."""
    if len(data) < 4 or data[:4] != b"\x50\x4b\x03\x04":
        return False
    try:
        import zipfile

        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            return any(n.startswith("xl/") for n in zf.namelist())
    except Exception:
        return False


def _check_svg(data: bytes) -> bool:
    """SVG image: XML containing <svg tag, printable text with no null bytes, and no embedded scripts or event handlers."""
    if not data or len(data) < 4:
        return False
    if b"\x00" in data[:1024]:
        return False
    data_lower = data.lower()
    if b"<svg" not in data_lower:
        return False

    dangerous_patterns = [
        b"<script",
        b"javascript:",
        b"onload",
        b"onerror",
        b"onclick",
        b"onmouseover",
        b"onfocus",
        b"onblur",
        b'xlink:href="javascript:',
        b"xlink:href='javascript:",
        b"data:text/html",
        b"data:application/javascript",
        b"<foreignobject",
        b"<iframe",
        b"<embed",
        b"<object",
    ]
    for pattern in dangerous_patterns:
        if pattern in data_lower:
            return False

    sample = data[:4096].strip()
    return _is_printable_ascii_or_utf8(sample[:512])


def _check_pptx(data: bytes) -> bool:
    """Office Open XML Presentation (.pptx) — ZIP-based containing ppt/."""
    if len(data) < 4 or data[:4] != b"\x50\x4b\x03\x04":
        return False
    try:
        import io
        import zipfile

        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            return any(n.startswith("ppt/") for n in zf.namelist())
    except Exception:
        return False


def _check_audio_mp3(data: bytes) -> bool:
    """MP3 audio: starts with ID3 header or frame sync word."""
    if len(data) >= 3 and data[:3] == b"ID3":
        return True
    if len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0:
        return True
    return False


def _check_audio_wav(data: bytes) -> bool:
    """WAV audio: RIFF header with WAVE format."""
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"


def _check_audio_ogg(data: bytes) -> bool:
    """OGG audio/video: OggS container signature."""
    return len(data) >= 4 and data[:4] == b"OggS"


def _check_parquet(data: bytes) -> bool:
    """Parquet: PAR1 magic bytes at start AND end."""
    return (
        len(data) >= 8
        and data[:4] == b"\x50\x41\x52\x31"  # PAR1
        and data[-4:] == b"\x50\x41\x52\x31"
    )


def _check_json(data: bytes) -> bool:
    """Heuristic: must start with { or [ and be valid-ish UTF-8."""
    stripped = data.lstrip(b"\xef\xbb\xbf")  # strip BOM
    stripped = stripped.lstrip(b"\t\n\r ")
    if not stripped:
        return False
    return stripped[0] in (ord("{"), ord("[")) and _is_printable_ascii_or_utf8(
        stripped[:512]
    )


def _check_csv(data: bytes) -> bool:
    """Heuristic: text-only content, no null bytes, printable ASCII or UTF-8."""
    if not data or len(data) < 4:
        return False
    # Reject files with null bytes (binary content disguised as CSV)
    if b"\x00" in data[:1024]:
        return False
    # Must be printable-ish text
    return _is_printable_ascii_or_utf8(data[:1024])


def _is_printable_ascii_or_utf8(data: bytes) -> bool:
    """Check that bytes are printable ASCII or valid UTF-8 continuation."""
    try:
        text = data.decode("utf-8")
        # Allow common control chars (tab, newline, carriage return) plus printable
        for ch in text:
            code = ord(ch)
            if code < 32 and code not in (9, 10, 13):  # tab, lf, cr
                return False
            if 127 <= code <= 159:  # C1 control chars
                return False
        return True
    except (UnicodeDecodeError, AttributeError):
        return False


# =============================================================================
# EXECUTABLE & MALICIOUS CODE DETECTOR (POLYGLOT DEFENSE)
# =============================================================================

DANGEROUS_EXECUTABLE_SIGNATURES = [
    (b"MZ", "Windows Executable/DLL (PE)"),
    (b"\x7fELF", "Linux ELF Executable"),
    (b"\xfe\xed\xfa\xce", "Mach-O 32-bit"),
    (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit"),
    (b"\xce\xfa\xed\xfe", "Mach-O 32-bit reverse"),
    (b"\xcf\xfa\xed\xfe", "Mach-O 64-bit reverse"),
    (b"\xca\xfe\xba\xbe", "Universal Binary / Java Class"),
]

DANGEROUS_SCRIPT_PATTERNS = [
    b"<?php",
    b"<?=",
    b"<script",
    b"<%@",
    b"<%",
    b"javascript:",
    b"vbscript:",
    b"<!entity",
]


def detect_malicious_content(
    data: bytes, detected_mime: Optional[str] = None
) -> Optional[str]:
    """
    Check for dangerous executable headers or embedded script polyglots.
    Returns an error description if malicious content is detected, else None.
    """
    # 1. Check raw executable headers
    for sig, desc in DANGEROUS_EXECUTABLE_SIGNATURES:
        if len(data) >= len(sig) and data.startswith(sig):
            return f"Dangerous executable signature detected: {desc}"

    # 2. Check for shell script shebangs
    if data.startswith(b"#!"):
        first_line = data[:128].lower()
        if (
            b"/sh" in first_line
            or b"/bash" in first_line
            or b"/python" in first_line
            or b"/perl" in first_line
            or b"/php" in first_line
        ):
            return "Shell script / executable shebang detected"

    # 3. Check for polyglots in image & binary documents (exclude text formats)
    if (
        detected_mime
        and not detected_mime.startswith("text/")
        and detected_mime != "application/json"
    ):
        sample = data[:8192].lower()
        for pattern in DANGEROUS_SCRIPT_PATTERNS:
            if pattern in sample:
                return f"Embedded script pattern '{pattern.decode('latin-1')}' detected in binary file"

    return None


# =============================================================================
# ZIP ARCHIVE SECURITY INSPECTOR (ZIP BOMB & TRAVERSAL)
# =============================================================================


def validate_zip_archive(
    data: bytes,
    max_uncompressed_bytes: int = 200 * 1024 * 1024,
    max_ratio: float = 100.0,
    max_files: int = 1000,
) -> Tuple[bool, Optional[str]]:
    """
    Deeply inspect a ZIP archive to prevent:
    - Zip bombs (extreme compression ratio or massive uncompressed size)
    - Path traversal attacks (relative paths '../' or absolute paths)
    - Resource exhaustion (excessive member file counts)
    """
    import io
    import zipfile

    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            infolist = zf.infolist()
            if len(infolist) > max_files:
                return (
                    False,
                    f"ZIP archive contains too many files ({len(infolist)} > {max_files})",
                )

            total_uncompressed = 0
            for info in infolist:
                # Path traversal check
                fn = info.filename
                if (
                    fn.startswith("/")
                    or fn.startswith("\\")
                    or "../" in fn
                    or "..\\" in fn
                ):
                    return False, f"Path traversal attempt in ZIP entry: '{fn}'"

                total_uncompressed += info.file_size
                if total_uncompressed > max_uncompressed_bytes:
                    return (
                        False,
                        f"ZIP uncompressed size exceeds limit of {max_uncompressed_bytes // (1024 * 1024)} MB",
                    )

            # Check compression ratio
            compressed_len = max(len(data), 1)
            ratio = total_uncompressed / compressed_len
            if ratio > max_ratio and total_uncompressed > 10 * 1024 * 1024:
                return (
                    False,
                    f"Suspicious compression ratio ({ratio:.1f}:1) detected (potential ZIP bomb)",
                )

        return True, None
    except zipfile.BadZipFile:
        return False, "Invalid or corrupted ZIP archive"
    except Exception as e:
        return False, f"ZIP inspection failed: {str(e)}"


# =============================================================================
# MIME TYPE → MAGIC BYTE CHECKER MAP
# =============================================================================

MIME_CHECKERS: Dict[str, Tuple] = {
    "image/jpeg": (_check_jpeg,),
    "image/png": (_check_png,),
    "image/gif": (_check_gif,),
    "image/webp": (_check_webp,),
    "image/bmp": (_check_bmp,),
    "image/svg+xml": (_check_svg,),
    "application/pdf": (_check_pdf,),
    "video/mp4": (_check_mp4,),
    "video/webm": (_check_webm,),
    "video/quicktime": (_check_quicktime,),
    "audio/mpeg": (_check_audio_mp3,),
    "audio/mp3": (_check_audio_mp3,),
    "audio/wav": (_check_audio_wav,),
    "audio/x-wav": (_check_audio_wav,),
    "audio/ogg": (_check_audio_ogg,),
    "audio/webm": (_check_webm,),
    "application/json": (_check_json,),
    "text/csv": (_check_csv,),
    "text/plain": (_check_text_plain,),
    "text/markdown": (_check_text_plain,),
    "text/x-markdown": (_check_text_plain,),
    "text/xml": (_check_text_plain,),
    "application/xml": (_check_text_plain,),
    "text/yaml": (_check_text_plain,),
    "application/x-yaml": (_check_text_plain,),
    "text/x-python": (_check_text_plain,),
    "application/javascript": (_check_text_plain,),
    "text/javascript": (_check_text_plain,),
    "text/typescript": (_check_text_plain,),
    "text/css": (_check_text_plain,),
    "text/html": (_check_text_plain,),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (_check_xlsx,),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
        _check_docx,
    ),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
        _check_pptx,
    ),
    "application/vnd.ms-excel": (_check_xlsx,),
    "application/zip": (_check_zip,),
    "application/x-zip-compressed": (_check_zip,),
    "application/parquet": (_check_parquet,),
    "application/octet-stream": (_check_parquet,),  # Parquet often sent as octet-stream
}

# =============================================================================
# ALLOWED MIME TYPES PER CATEGORY
# =============================================================================

CATEGORY_ALLOWED_MIME_TYPES: Dict[str, List[str]] = {
    "avatars": [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/svg+xml",
    ],
    "datasets": [
        "application/json",
        "text/csv",
        "text/plain",
        "text/markdown",
        "text/xml",
        "application/xml",
        "text/yaml",
        "application/x-yaml",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/parquet",
        "application/zip",
    ],
    "certificates": [
        "application/pdf",
        "image/png",
        "image/jpeg",
    ],
    "courses": [
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    "invoices": [
        "application/pdf",
    ],
    "attachments": [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/svg+xml",
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/csv",
        "text/plain",
        "text/markdown",
        "text/x-markdown",
        "text/xml",
        "application/xml",
        "text/yaml",
        "application/x-yaml",
        "text/x-python",
        "application/javascript",
        "text/javascript",
        "text/typescript",
        "text/css",
        "text/html",
        "application/json",
        "application/zip",
        "application/x-zip-compressed",
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/ogg",
        "audio/webm",
    ],
}

# Maximum bytes to read for magic byte detection
_MAGIC_READ_SIZE = 4096  # 4 KB is plenty for all signatures


# =============================================================================
# VALIDATION RESULT
# =============================================================================


class ValidationResult:
    """Result of file validation."""

    def __init__(
        self,
        is_valid: bool,
        detected_mime_type: Optional[str] = None,
        error: Optional[str] = None,
    ):
        self.is_valid = is_valid
        self.detected_mime_type = detected_mime_type
        self.error = error


# =============================================================================
# PUBLIC VALIDATION FUNCTIONS
# =============================================================================


def detect_mime_type(data: bytes) -> Optional[str]:
    """
    Detect MIME type from file content using magic bytes.
    Returns the MIME type string, or None if unrecognised.
    """
    for mime_type, checkers in MIME_CHECKERS.items():
        checker = checkers[0]
        if checker(data):
            return mime_type
    return None


def validate_file_size(file_size: int) -> ValidationResult:
    """
    Validate that file size does not exceed the configured maximum.
    """
    max_size = setting.MAX_FILE_SIZE
    if file_size > max_size:
        max_mb = max_size / (1024 * 1024)
        actual_mb = file_size / (1024 * 1024)
        return ValidationResult(
            is_valid=False,
            error=f"File size {actual_mb:.1f} MB exceeds maximum of {max_mb:.0f} MB",
        )
    return ValidationResult(is_valid=True)


def validate_file_content(
    data: bytes, category: str, content_type: Optional[str] = None
) -> ValidationResult:
    """
    Validate file content against allowed MIME types for the given category.

    Args:
        data: The raw file bytes (at least first 4 KB recommended).
        category: Upload category (avatars, datasets, certificates, courses, invoices).
        content_type: The Content-Type header from the upload (used only for logging).

    Returns:
        ValidationResult with detected MIME type and any error.
    """
    # 1. Check category is known
    allowed_types = CATEGORY_ALLOWED_MIME_TYPES.get(category)
    if not allowed_types:
        return ValidationResult(
            is_valid=False,
            error=f"Unknown upload category: '{category}'",
        )

    # 2. Detect actual MIME type from content
    detected = detect_mime_type(data)

    if detected is None:
        return ValidationResult(
            is_valid=False,
            error=(
                f"Unrecognised file format. "
                f"Allowed types for '{category}': {', '.join(allowed_types)}. "
                f"(Reported Content-Type: {content_type or 'none'})"
            ),
        )

    # 3. Check detected type is allowed for this category
    if detected not in allowed_types:
        return ValidationResult(
            is_valid=False,
            error=(
                f"File type '{detected}' is not allowed for category '{category}'. "
                f"Allowed types: {', '.join(allowed_types)}."
            ),
        )

    # 4. Check for dangerous executables, polyglots, or script patterns
    malicious_error = detect_malicious_content(data, detected)
    if malicious_error:
        return ValidationResult(
            is_valid=False,
            error=malicious_error,
        )

    # 5. For ZIP archives, perform deep archive security inspection
    if detected in ("application/zip", "application/x-zip-compressed"):
        is_zip_valid, zip_error = validate_zip_archive(data)
        if not is_zip_valid:
            return ValidationResult(
                is_valid=False,
                error=zip_error or "Invalid or dangerous ZIP archive",
            )

    return ValidationResult(is_valid=True, detected_mime_type=detected)


async def read_and_validate(
    file_data: bytes,
    category: str,
    content_type: Optional[str] = None,
) -> ValidationResult:
    """
    Convenience wrapper: validates both content and size in one call.
    Call this after reading the entire file content into `file_data`.
    """
    # Check size first (fast, no content analysis needed)
    size_result = validate_file_size(len(file_data))
    if not size_result.is_valid:
        return size_result

    # Check content magic bytes
    content_result = validate_file_content(file_data, category, content_type)
    if not content_result.is_valid:
        return content_result

    return content_result
