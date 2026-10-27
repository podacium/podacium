"""
Celery Worker Task for Optical QR Code Scanning & CNRC Verification on KYB Documents.
"""

import base64
import logging
from typing import Any, Dict

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma
from app.services.kyb_service import KybService

logger = logging.getLogger("podacium.tasks.kyb")


@celery_app.task(
    name="app.tasks.kyb_tasks.scan_corporate_document_qr_task",
    bind=True,
    max_retries=3,
    default_retry_delay=15,
    retry_backoff=True,
)
def scan_corporate_document_qr_task(
    self, document_id: int, file_bytes_b64: str
) -> Dict[str, Any]:
    """
    Background Celery task that decodes an uploaded KYB document image/PDF,
    extracts the optical CNRC QR code matrix, verifies its domain, and updates risk scores.
    """
    file_bytes = base64.b64decode(file_bytes_b64.encode("ascii"))

    async def _run() -> Dict[str, Any]:
        try:
            await connect_prisma()
            return await KybService.scan_and_verify_document_qr(
                document_id=document_id, file_bytes=file_bytes
            )
        finally:
            await disconnect_prisma()

    try:
        return run_async_in_worker(_run())
    except Exception as exc:
        logger.error(f"KYB optical QR scan failed for document {document_id}: {exc}")
        raise self.retry(exc=exc)
