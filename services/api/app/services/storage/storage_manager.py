"""
Storage Manager (Unified Provider-Agnostic Router)
Manages storage drivers, enforces Algerian Law 18-07/25-11 data sovereignty constraints,
and routes each category (avatars, invoices, datasets, attachments) to the configured driver.
"""

import os
import uuid
import logging
from typing import Dict, Optional, Any
from app.core.config import setting
from .base_driver import BaseStorageDriver, UploadTicket
from .local_driver import LocalStorageDriver
from .s3_compat_driver import S3CompatibleStorageDriver

logger = logging.getLogger(__name__)


class StorageManager:
    """Singleton managing storage drivers and category routing."""

    def __init__(self):
        self._drivers: Dict[str, BaseStorageDriver] = {}
        self._category_driver_map: Dict[str, str] = {}
        self._initialize_drivers()

    def _initialize_drivers(self):
        # 1. Local Sovereign Driver (Always available)
        self._drivers["local"] = LocalStorageDriver(
            base_dir=setting.UPLOAD_DIR or "uploads"
        )

        # 2. Google Cloud Storage (GCS) Driver
        gcs_bucket = os.getenv("GCS_BUCKET_NAME") or getattr(
            setting, "GCS_BUCKET_NAME", None
        )
        gcs_access_key = os.getenv("GCS_ACCESS_KEY_ID") or getattr(
            setting, "GCS_ACCESS_KEY_ID", None
        )
        gcs_secret = os.getenv("GCS_SECRET_ACCESS_KEY") or getattr(
            setting, "GCS_SECRET_ACCESS_KEY", None
        )

        if gcs_bucket and gcs_access_key and gcs_secret:
            try:
                self._drivers["gcs"] = S3CompatibleStorageDriver(
                    bucket_name=gcs_bucket,
                    endpoint_url="https://storage.googleapis.com",
                    access_key_id=gcs_access_key,
                    secret_access_key=gcs_secret,
                    public_cdn_url=os.getenv(
                        "PUBLIC_CDN_URL", "https://cdn.podacium.com"
                    ),
                    driver_name="gcs",
                )
                logger.info("Google Cloud Storage driver initialized successfully")
            except Exception as e:
                logger.warning(f"Could not initialize GCS storage driver: {e}")

        # 3. Cloudflare R2 Driver ($0 Egress)
        r2_bucket = os.getenv("R2_BUCKET_NAME") or getattr(
            setting, "R2_BUCKET_NAME", None
        )
        r2_account_id = os.getenv("R2_ACCOUNT_ID") or getattr(
            setting, "R2_ACCOUNT_ID", None
        )
        r2_access_key = os.getenv("R2_ACCESS_KEY_ID") or getattr(
            setting, "R2_ACCESS_KEY_ID", None
        )
        r2_secret = os.getenv("R2_SECRET_ACCESS_KEY") or getattr(
            setting, "R2_SECRET_ACCESS_KEY", None
        )

        if r2_bucket and r2_account_id and r2_access_key and r2_secret:
            try:
                self._drivers["r2"] = S3CompatibleStorageDriver(
                    bucket_name=r2_bucket,
                    endpoint_url=f"https://{r2_account_id}.r2.cloudflarestorage.com",
                    access_key_id=r2_access_key,
                    secret_access_key=r2_secret,
                    public_cdn_url=os.getenv(
                        "PUBLIC_CDN_URL", "https://cdn.podacium.com"
                    ),
                    driver_name="r2",
                )
                logger.info("Cloudflare R2 storage driver initialized successfully")
            except Exception as e:
                logger.warning(f"Could not initialize R2 storage driver: {e}")

        # 4. Bunny Storage Driver
        bunny_storage_zone = os.getenv("BUNNY_STORAGE_ZONE") or getattr(
            setting, "BUNNY_STORAGE_ZONE", None
        )
        bunny_password = os.getenv("BUNNY_STORAGE_PASSWORD") or getattr(
            setting, "BUNNY_STORAGE_PASSWORD", None
        )
        bunny_region = os.getenv("BUNNY_REGION", "de")

        if bunny_storage_zone and bunny_password:
            try:
                self._drivers["bunny"] = S3CompatibleStorageDriver(
                    bucket_name=bunny_storage_zone,
                    endpoint_url=f"https://{bunny_region}-s3.storage.bunnycdn.com",
                    access_key_id=bunny_storage_zone,
                    secret_access_key=bunny_password,
                    public_cdn_url=os.getenv(
                        "BUNNY_PULL_ZONE_URL", "https://cdn.podacium.com"
                    ),
                    driver_name="bunny",
                )
                logger.info("Bunny.net Storage driver initialized successfully")
            except Exception as e:
                logger.warning(f"Could not initialize Bunny storage driver: {e}")

        # 5. Standard AWS S3 / MinIO Driver
        s3_bucket = os.getenv("S3_BUCKET_NAME") or getattr(
            setting, "S3_BUCKET_NAME", None
        )
        s3_endpoint = os.getenv("S3_ENDPOINT_URL") or getattr(
            setting, "S3_ENDPOINT_URL", None
        )
        s3_access_key = os.getenv("AWS_ACCESS_KEY_ID") or getattr(
            setting, "AWS_ACCESS_KEY_ID", None
        )
        s3_secret = os.getenv("AWS_SECRET_ACCESS_KEY") or getattr(
            setting, "AWS_SECRET_ACCESS_KEY", None
        )

        if s3_bucket and s3_access_key and s3_secret:
            try:
                self._drivers["s3"] = S3CompatibleStorageDriver(
                    bucket_name=s3_bucket,
                    endpoint_url=s3_endpoint,
                    access_key_id=s3_access_key,
                    secret_access_key=s3_secret,
                    public_cdn_url=os.getenv(
                        "PUBLIC_CDN_URL", "https://cdn.podacium.com"
                    ),
                    driver_name="s3",
                )
                logger.info("S3 storage driver initialized successfully")
            except Exception as e:
                logger.warning(f"Could not initialize S3 storage driver: {e}")

        # Configure category mappings
        default_driver = os.getenv("STORAGE_DRIVER_DEFAULT", "local")
        self._default_driver_name = (
            default_driver if default_driver in self._drivers else "local"
        )

        self._category_driver_map = {
            "avatars": os.getenv("STORAGE_DRIVER_AVATARS", self._default_driver_name),
            "courses": os.getenv("STORAGE_DRIVER_COURSES", self._default_driver_name),
            "datasets": os.getenv("STORAGE_DRIVER_DATASETS", self._default_driver_name),
            # Sovereign-protected under Law 18-07 (default to local unless specifically configured)
            "invoices": os.getenv("STORAGE_DRIVER_INVOICES", "local"),
            "attachments": os.getenv("STORAGE_DRIVER_ATTACHMENTS", "local"),
            "certificates": os.getenv("STORAGE_DRIVER_CERTIFICATES", "local"),
        }

    def get_driver(self, category: str) -> BaseStorageDriver:
        driver_name = self._category_driver_map.get(category, self._default_driver_name)
        if driver_name not in self._drivers:
            driver_name = "local"
        return self._drivers[driver_name]

    def is_sovereign_category(self, category: str) -> bool:
        """Returns True if category contains protected personal data under Algerian Law 18-07."""
        return category in ("invoices", "attachments", "contracts", "identities")

    async def upload_file(
        self,
        content: bytes,
        filename: str,
        category: str,
        content_type: str,
        is_public: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Upload a file using the designated driver for this category."""
        driver = self.get_driver(category)
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        key = f"{category}/{unique_name}"

        public_flag = (
            is_public if is_public is not None else (category in ("avatars", "public"))
        )
        url = await driver.upload_file(
            content=content,
            key=key,
            content_type=content_type,
            is_public=public_flag,
        )

        return {
            "key": key,
            "unique_name": unique_name,
            "url": url,
            "driver": driver.driver_name,
            "is_sovereign": driver.is_sovereign,
            "size": len(content),
        }

    async def generate_presigned_upload_ticket(
        self,
        filename: str,
        category: str,
        content_type: str,
        max_size_bytes: int,
        expires_in: int = 900,
    ) -> UploadTicket:
        """Generate presigned upload ticket for direct-to-storage upload."""
        driver = self.get_driver(category)
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        key = f"{category}/{unique_name}"

        ticket = await driver.generate_presigned_upload_ticket(
            key=key,
            content_type=content_type,
            max_size_bytes=max_size_bytes,
            category=category,
            expires_in=expires_in,
        )
        return ticket

    async def generate_download_url(
        self,
        key: str,
        category: str,
        filename: Optional[str] = None,
        expires_in: int = 900,
    ) -> str:
        """Generate download or streaming URL."""
        driver = self.get_driver(category)
        return await driver.generate_download_url(
            key=key, filename=filename, expires_in=expires_in
        )

    async def delete_file(self, key: str, category: str) -> bool:
        driver = self.get_driver(category)
        return await driver.delete_file(key=key)

    async def file_exists(self, key: str, category: str) -> bool:
        driver = self.get_driver(category)
        return await driver.file_exists(key=key)

    async def read_file_bytes(self, key: str, category: str) -> Optional[bytes]:
        driver = self.get_driver(category)
        return await driver.read_file_bytes(key=key)


# Global Singleton Instance
storage_manager = StorageManager()
