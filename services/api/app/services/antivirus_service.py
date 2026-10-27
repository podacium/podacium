"""
Antivirus / malware scanning service.

Uses ClamAV via the clamd Unix-socket / TCP interface. The scan is performed
BEFORE the file is written to S3 so malicious payloads never reach CloudFront.

Graceful-degradation policy
────────────────────────────
If ClamAV is unavailable (socket not found, daemon not running, import error)
the behaviour is controlled by two env-vars:

  AV_REQUIRED=true   (default in production)
    → scan failure is treated as a hard error; upload is BLOCKED.

  AV_REQUIRED=false  (useful during local dev / CI)
    → scan failure logs a warning and upload proceeds, but the file is tagged
      with `av_scan_status=skipped` in the lesson metadata so ops can audit.

Deployment notes
────────────────
• Install the `clamd` Python package (already in requirements-base.txt).
• Run a ClamAV daemon alongside the API container:
    docker run -d --name clamav --network host clamav/clamav:latest
  or mount the Unix socket: /var/run/clamav/clamd.ctl
• Set CLAMD_HOST / CLAMD_PORT for TCP, or CLAMD_SOCKET for a Unix socket.
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Optional

from app.core.config import setting

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

_CLAMD_SOCKET: Optional[str] = os.getenv("CLAMD_SOCKET", "/var/run/clamav/clamd.ctl")
_CLAMD_HOST: str = os.getenv("CLAMD_HOST", "127.0.0.1")
_CLAMD_PORT: int = int(os.getenv("CLAMD_PORT", "3310"))
_CLAMD_TIMEOUT: int = int(os.getenv("CLAMD_TIMEOUT", "60"))

# When True, an unavailable ClamAV daemon blocks the upload. Mandatory in
# production; development/test may opt out explicitly.
_AV_REQUIRED: bool = os.getenv(
    "AV_REQUIRED",
    "true"
    if getattr(setting, "ENVIRONMENT", "development") == "production"
    else "false",
).lower() in {"true", "1", "yes"}


# ─────────────────────────────────────────────────────────────────────────────
# Result type
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class ScanResult:
    """Result of an antivirus scan."""

    clean: bool
    """True if the file is clean (no malware detected)."""

    skipped: bool = False
    """True if the scan was skipped (ClamAV unavailable + AV_REQUIRED=false)."""

    threat: Optional[str] = None
    """Name of the detected threat, or None if clean/skipped."""

    error: Optional[str] = None
    """Error message if the scan could not be completed."""


# ─────────────────────────────────────────────────────────────────────────────
# Scanner
# ─────────────────────────────────────────────────────────────────────────────


class AntivirusService:
    """Wraps clamd to provide async virus scanning for uploaded files."""

    def _get_client(self):
        """Return a connected clamd client, preferring the Unix socket."""
        import clamd  # type: ignore[import]

        if _CLAMD_SOCKET and os.path.exists(_CLAMD_SOCKET):
            return clamd.ClamdUnixSocket(path=_CLAMD_SOCKET, timeout=_CLAMD_TIMEOUT)
        # Fall back to TCP
        return clamd.ClamdNetworkSocket(
            host=_CLAMD_HOST, port=_CLAMD_PORT, timeout=_CLAMD_TIMEOUT
        )

    async def scan_bytes(self, data: bytes, filename: str = "<upload>") -> ScanResult:
        """Scan `data` for malware.

        Runs the blocking clamd I/O in a thread-pool executor so it does not
        block the asyncio event loop.

        Returns a ScanResult. Callers MUST check `clean` before proceeding:

            result = await antivirus_service.scan_bytes(data, filename)
            if not result.clean and not result.skipped:
                raise HTTPException(400, f"Malware detected: {result.threat}")
        """
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, self._scan_sync, data, filename
            )
            return result
        except Exception as exc:
            # Catch-all: treat any unexpected error as an availability failure.
            return self._handle_unavailable(str(exc), filename)

    def _scan_sync(self, data: bytes, filename: str) -> ScanResult:
        """Blocking scan — called inside a thread-pool executor."""
        from importlib.util import find_spec

        if find_spec("clamd") is None:
            logger.error("clamd package not installed — cannot perform AV scan")
            return self._handle_unavailable("clamd not installed", filename)

        try:
            cd = self._get_client()
        except Exception as exc:
            return self._handle_unavailable(
                f"Cannot connect to ClamAV: {exc}", filename
            )

        try:
            # instream() accepts a file-like; we wrap bytes in a BytesIO.
            import io

            scan_result = cd.instream(io.BytesIO(data))
        except Exception as exc:
            return self._handle_unavailable(f"ClamAV scan error: {exc}", filename)

        # clamd.instream() returns {'stream': ('OK', None)} or
        # {'stream': ('FOUND', 'Eicar-Test-Signature')}
        status, threat = scan_result.get("stream", ("ERROR", "no result"))

        if status == "OK":
            logger.info(f"AV scan clean: {filename}")
            return ScanResult(clean=True)
        elif status == "FOUND":
            logger.error(f"MALWARE DETECTED in '{filename}': {threat}")
            return ScanResult(clean=False, threat=threat)
        else:
            # Unexpected status — treat as failure
            return self._handle_unavailable(
                f"Unexpected ClamAV status '{status}' for {filename}", filename
            )

    @staticmethod
    def _handle_unavailable(reason: str, filename: str) -> ScanResult:
        """Handle ClamAV being unavailable according to AV_REQUIRED policy."""
        if _AV_REQUIRED:
            logger.error(
                f"AV scan unavailable for '{filename}' and AV_REQUIRED=true — blocking upload. "
                f"Reason: {reason}"
            )
            return ScanResult(
                clean=False,
                skipped=False,
                error=f"Antivirus scan unavailable: {reason}",
            )
        else:
            logger.warning(
                f"AV scan skipped for '{filename}' (AV_REQUIRED=false). "
                f"Reason: {reason}. File tagged for ops audit."
            )
            return ScanResult(clean=True, skipped=True, error=reason)


antivirus_service = AntivirusService()
