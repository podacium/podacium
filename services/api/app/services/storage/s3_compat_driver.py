"""
S3-Compatible Storage Driver (Cloud & Edge Tier)
Supports Google Cloud Storage (GCS Interoperability), Cloudflare R2, Bunny Storage, AWS S3, and MinIO.
"""

import logging
import asyncio
from typing import Optional, Dict, Any
from .base_driver import BaseStorageDriver, UploadTicket

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError

    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False
    boto3 = None
    Config = None
    ClientError = None


class S3CompatibleStorageDriver(BaseStorageDriver):
    """Universal S3-compatible driver (GCS, Cloudflare R2, Bunny, AWS S3, MinIO)."""

    def __init__(
        self,
        bucket_name: str,
        endpoint_url: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        region_name: Optional[str] = None,
        public_cdn_url: Optional[str] = None,
        driver_name: str = "s3",
        is_sovereign: bool = False,
    ):
        if not HAS_BOTO3:
            raise RuntimeError(
                "boto3 package is required for S3CompatibleStorageDriver"
            )

        self._driver_name = driver_name
        self._is_sovereign = is_sovereign
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        self.public_cdn_url = public_cdn_url.rstrip("/") if public_cdn_url else None

        # Configure boto3 client with S3v4 signatures
        config = Config(
            signature_version="s3v4",
            s3={
                "addressing_style": "virtual"
                if "r2.cloudflarestorage.com" in (endpoint_url or "")
                else "auto"
            },
            retries={"max_attempts": 3, "mode": "standard"},
        )

        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region_name or "auto",
            config=config,
        )

    @property
    def driver_name(self) -> str:
        return self._driver_name

    @property
    def is_sovereign(self) -> bool:
        return self._is_sovereign

    async def upload_file(
        self,
        content: bytes,
        key: str,
        content_type: str,
        is_public: bool = False,
    ) -> str:
        clean_key = key.lstrip("/")
        loop = asyncio.get_running_loop()

        def _sync_upload():
            extra_args: Dict[str, Any] = {"ContentType": content_type}
            if is_public:
                extra_args["ACL"] = "public-read"
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=clean_key,
                Body=content,
                **extra_args,
            )

        await loop.run_in_executor(None, _sync_upload)

        if is_public and self.public_cdn_url:
            return f"{self.public_cdn_url}/{clean_key}"
        return f"/static/{clean_key}"

    async def generate_presigned_upload_ticket(
        self,
        key: str,
        content_type: str,
        max_size_bytes: int,
        category: str = "attachments",
        expires_in: int = 900,
    ) -> UploadTicket:
        clean_key = key.lstrip("/")
        loop = asyncio.get_running_loop()

        def _sync_presign():
            return self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": clean_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )

        upload_url = await loop.run_in_executor(None, _sync_presign)

        return UploadTicket(
            upload_url=upload_url,
            file_key=clean_key,
            method="PUT",
            headers={"Content-Type": content_type},
            is_cloud=True,
            category=category,
            driver_name=self._driver_name,
            expires_in_seconds=expires_in,
        )

    async def generate_download_url(
        self,
        key: str,
        filename: Optional[str] = None,
        expires_in: int = 900,
    ) -> str:
        clean_key = key.lstrip("/")

        # If CDN URL is configured for public assets, return clean CDN URL
        if self.public_cdn_url and clean_key.startswith(("avatars/", "public/")):
            return f"{self.public_cdn_url}/{clean_key}"

        loop = asyncio.get_running_loop()

        def _sync_presign_get():
            params: Dict[str, Any] = {
                "Bucket": self.bucket_name,
                "Key": clean_key,
            }
            if filename:
                params["ResponseContentDisposition"] = f'inline; filename="{filename}"'
            return self.client.generate_presigned_url(
                ClientMethod="get_object",
                Params=params,
                ExpiresIn=expires_in,
            )

        return await loop.run_in_executor(None, _sync_presign_get)

    async def delete_file(self, key: str) -> bool:
        clean_key = key.lstrip("/")
        loop = asyncio.get_running_loop()

        def _sync_delete():
            try:
                self.client.delete_object(Bucket=self.bucket_name, Key=clean_key)
                return True
            except ClientError as e:
                logger.error(f"S3 delete error for {clean_key}: {e}")
                return False

        return await loop.run_in_executor(None, _sync_delete)

    async def file_exists(self, key: str) -> bool:
        clean_key = key.lstrip("/")
        loop = asyncio.get_running_loop()

        def _sync_head():
            try:
                self.client.head_object(Bucket=self.bucket_name, Key=clean_key)
                return True
            except ClientError:
                return False

        return await loop.run_in_executor(None, _sync_head)

    async def read_file_bytes(self, key: str) -> Optional[bytes]:
        clean_key = key.lstrip("/")
        loop = asyncio.get_running_loop()

        def _sync_read():
            try:
                response = self.client.get_object(
                    Bucket=self.bucket_name, Key=clean_key
                )
                return response["Body"].read()
            except ClientError as e:
                logger.error(f"S3 read error for {clean_key}: {e}")
                return None

        return await loop.run_in_executor(None, _sync_read)
