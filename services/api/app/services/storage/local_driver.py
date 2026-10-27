"""
Local Filesystem Storage Driver (Sovereign Tier)
Stores files on the local VPS SSD with atomic writes and directory isolation.
Compliant with Algerian Law 18-07 / Law 25-11 on national personal data hosting.
"""

import os
import aiofiles
import logging
from typing import Optional
from pathlib import Path
from app.core.config import setting
from .base_driver import BaseStorageDriver, UploadTicket

logger = logging.getLogger(__name__)


class LocalStorageDriver(BaseStorageDriver):
    """Local disk storage driver storing files in services/api/uploads/."""

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or setting.UPLOAD_DIR or "uploads").resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    @property
    def driver_name(self) -> str:
        return "local"

    @property
    def is_sovereign(self) -> bool:
        return True

    def _get_full_path(self, key: str) -> Path:
        """Resolve full filesystem path and prevent directory traversal."""
        normalized = key.lstrip("/").replace("\\", "/")
        full_path = (self.base_dir / normalized).resolve()
        if not str(full_path).startswith(str(self.base_dir)):
            raise ValueError(f"Directory traversal detected in storage key: {key}")
        return full_path

    async def upload_file(
        self,
        content: bytes,
        key: str,
        content_type: str,
        is_public: bool = False,
    ) -> str:
        full_path = self._get_full_path(key)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Atomic write via temporary file
        temp_path = full_path.with_suffix(f"{full_path.suffix}.tmp.{os.getpid()}")
        try:
            async with aiofiles.open(temp_path, "wb") as f:
                await f.write(content)
            temp_path.replace(full_path)
        except Exception:
            if temp_path.exists():
                temp_path.unlink()
            raise

        return f"/static/{key.lstrip('/')}"

    async def generate_presigned_upload_ticket(
        self,
        key: str,
        content_type: str,
        max_size_bytes: int,
        category: str = "attachments",
        expires_in: int = 900,
    ) -> UploadTicket:
        # Local upload route streaming through FastAPI / Nginx
        upload_endpoint = f"/api/files/upload?category={category}&key={key}"
        return UploadTicket(
            upload_url=upload_endpoint,
            file_key=key,
            method="POST",
            is_cloud=False,
            category=category,
            driver_name="local",
            expires_in_seconds=expires_in,
        )

    async def generate_download_url(
        self,
        key: str,
        filename: Optional[str] = None,
        expires_in: int = 900,
    ) -> str:
        clean_key = key.lstrip("/")
        return f"/static/{clean_key}"

    async def delete_file(self, key: str) -> bool:
        try:
            full_path = self._get_full_path(key)
            if full_path.exists() and full_path.is_file():
                full_path.unlink()
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete local file {key}: {e}")
            return False

    async def file_exists(self, key: str) -> bool:
        try:
            full_path = self._get_full_path(key)
            return full_path.exists() and full_path.is_file()
        except Exception:
            return False

    async def read_file_bytes(self, key: str) -> Optional[bytes]:
        try:
            full_path = self._get_full_path(key)
            if not full_path.exists():
                return None
            async with aiofiles.open(full_path, "rb") as f:
                return await f.read()
        except Exception as e:
            logger.error(f"Failed to read local file {key}: {e}")
            return None

    def get_x_accel_path(self, key: str) -> str:
        """Returns the internal Nginx X-Accel-Redirect path for zero-copy streaming."""
        clean_key = key.lstrip("/")
        return f"/internal-uploads/{clean_key}"
