"""
Mail Attachment Security Scanner & Validator.

Verifies:
1. File extension against blocklists of executable/dangerous extensions.
2. File magic bytes for MIME sniffing verification.
3. ClamAV malware scanning via AntivirusService.
"""

import io
import logging
import os
import re
import zipfile
from dataclasses import dataclass
from typing import Optional, Set

from app.core.config import setting
from app.services.antivirus_service import antivirus_service
from app.services.file_validation_service import MAGIC_BYTES


def _av_required() -> bool:
    """AV is mandatory in production unless explicitly relaxed."""
    default = (
        "true"
        if getattr(setting, "ENVIRONMENT", "development") == "production"
        else "false"
    )
    return os.getenv("AV_REQUIRED", default).lower() in {"true", "1", "yes"}


logger = logging.getLogger(__name__)

# Security thresholds for archive decompression bomb protection
MAX_ZIP_UNCOMPRESSED_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_ZIP_RATIO = 100  # Max 100:1 ratio
MAX_ZIP_ENTRIES = 500

SVG_DANGEROUS_PATTERNS = re.compile(
    rb"(?i)(<script|<foreignobject|on[a-z]+\s*=|javascript:|data:text/html)"
)
PDF_DANGEROUS_PATTERNS = re.compile(
    rb"/(\s*JavaScript|\s*JS|\s*Launch|\s*EmbeddedFiles|\s*SubmitForm)\b"
)

DISALLOWED_EXTENSIONS: Set[str] = {
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".bash",
    ".vbs",
    ".vbe",
    ".js",
    ".jse",
    ".wsf",
    ".wsh",
    ".scr",
    ".pif",
    ".com",
    ".hta",
    ".cpl",
    ".msc",
    ".jar",
    ".gadget",
    ".msi",
    ".msp",
    ".reg",
    ".ps1",
    ".ps1xml",
    ".ps2",
    ".psc1",
    ".inf",
    ".dll",
    ".sys",
    ".drv",
    ".apk",
    ".app",
    ".action",
    ".bin",
    ".lnk",
    ".url",
    ".scf",
    ".settingcontent-ms",
    ".iso",
    ".img",
    ".vhd",
    ".docm",
    ".xlsm",
    ".pptm",
    ".py",
    ".rb",
    ".pl",
    ".php",
}


@dataclass
class MailAttachmentScanResult:
    is_safe: bool
    virus_clean: bool
    detected_mime: Optional[str]
    threat: Optional[str] = None
    error: Optional[str] = None
    scan_status: str = "unknown"  # clean | skipped | failed | infected | blocked
    scan_engine: Optional[str] = None


class MailAttachmentScanner:
    """Security scanner for mail attachments."""

    @classmethod
    async def scan_attachment(
        cls,
        filename: str,
        content: bytes,
        declared_mime: Optional[str] = None,
    ) -> MailAttachmentScanResult:
        # 1. Extension check (strip trailing whitespace and dots to prevent Windows normalization bypass)
        cleaned_filename = filename.rstrip(". \t\r\n")
        ext = os.path.splitext(cleaned_filename)[1].lower()
        if ext in DISALLOWED_EXTENSIONS:
            return MailAttachmentScanResult(
                is_safe=False,
                virus_clean=False,
                detected_mime=declared_mime,
                threat=f"Disallowed executable extension: {ext}",
                scan_status="blocked",
            )

        # 2. Magic byte check
        detected_mime = declared_mime
        for magic, mime in MAGIC_BYTES.items():
            if content.startswith(magic):
                detected_mime = mime
                break

        # 3. Zip bomb / Decompression bomb deep scan
        if ext in (".zip", ".jar", ".war") or content.startswith(b"PK\x03\x04"):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    entries = zf.infolist()
                    if len(entries) > MAX_ZIP_ENTRIES:
                        return MailAttachmentScanResult(
                            is_safe=False,
                            virus_clean=False,
                            detected_mime=detected_mime or "application/zip",
                            threat=f"Decompression bomb risk: zip archive contains {len(entries)} entries (max {MAX_ZIP_ENTRIES})",
                            scan_status="blocked",
                        )
                    total_uncompressed = 0
                    for info in entries:
                        total_uncompressed += info.file_size
                        comp_size = max(info.compress_size, 1)
                        ratio = info.file_size / comp_size
                        if ratio > MAX_ZIP_RATIO and info.file_size > 1024 * 1024:
                            return MailAttachmentScanResult(
                                is_safe=False,
                                virus_clean=False,
                                detected_mime=detected_mime or "application/zip",
                                threat=f"Decompression bomb detected: compression ratio {ratio:.1f}:1 exceeds limit",
                                scan_status="blocked",
                            )
                        if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                            return MailAttachmentScanResult(
                                is_safe=False,
                                virus_clean=False,
                                detected_mime=detected_mime or "application/zip",
                                threat=f"Decompression bomb detected: total uncompressed size exceeds {MAX_ZIP_UNCOMPRESSED_BYTES // (1024 * 1024)}MB",
                                scan_status="blocked",
                            )
            except zipfile.BadZipFile:
                # If explicitly declared as zip but invalid, flag as corrupted/unsafe
                if ext == ".zip":
                    return MailAttachmentScanResult(
                        is_safe=False,
                        virus_clean=False,
                        detected_mime=detected_mime,
                        threat="Corrupted or invalid zip archive",
                        scan_status="blocked",
                    )
            except Exception as e:
                logger.warning(f"Zip inspection warning for {filename}: {e}")

        # 4. SVG executable script & foreignObject scan
        if (
            ext == ".svg"
            or detected_mime == "image/svg+xml"
            or (b"<svg" in content[:1024].lower())
        ):
            if SVG_DANGEROUS_PATTERNS.search(content):
                return MailAttachmentScanResult(
                    is_safe=False,
                    virus_clean=False,
                    detected_mime="image/svg+xml",
                    threat="SVG attachment contains executable script or foreignObject vectors",
                    scan_status="blocked",
                )

        # 5. PDF active script / exploit scan
        if (
            ext == ".pdf"
            or detected_mime == "application/pdf"
            or content.startswith(b"%PDF")
        ):
            if PDF_DANGEROUS_PATTERNS.search(content):
                return MailAttachmentScanResult(
                    is_safe=False,
                    virus_clean=False,
                    detected_mime="application/pdf",
                    threat="PDF attachment contains active JavaScript, Launch, or interactive exploit structures",
                    scan_status="blocked",
                )

        # 6. Antivirus scan. A skipped scan must never be reported as clean.
        scan_status = "clean"
        try:
            av_result = await antivirus_service.scan_bytes(content, filename=filename)
            if av_result.skipped:
                scan_status = "skipped"
                logger.warning(
                    "ClamAV unavailable; attachment %s was NOT scanned", filename
                )
            elif not av_result.clean:
                return MailAttachmentScanResult(
                    is_safe=False,
                    virus_clean=False,
                    detected_mime=detected_mime,
                    threat=av_result.threat or "Malware detected",
                    error=av_result.error,
                    scan_status="infected",
                    scan_engine="clamav",
                )
        except Exception as exc:
            logger.warning(f"AV scan error for attachment {filename}: {exc}")
            scan_status = "failed"
            # If AV is strict, fail closed; otherwise continue but record that
            # no real scan happened.
            if _av_required():
                return MailAttachmentScanResult(
                    is_safe=False,
                    virus_clean=False,
                    detected_mime=detected_mime,
                    error=str(exc),
                    scan_status="failed",
                )

        return MailAttachmentScanResult(
            is_safe=True,
            virus_clean=scan_status == "clean",
            detected_mime=detected_mime,
            scan_status=scan_status,
            scan_engine="clamav" if scan_status == "clean" else None,
        )


mail_attachment_scanner = MailAttachmentScanner()
