"""AWS S3, CloudFront & MediaConvert video provider implementation."""

import os
import logging
import asyncio
from typing import Dict, Any
from app.services.video.base import BaseVideoProvider
from app.services.aws_video_service import AWSVideoService, aws_video_service
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)


class AWSVideoProvider(BaseVideoProvider):
    """AWS S3 + CloudFront + MediaConvert video provider."""

    def __init__(self, service: AWSVideoService = aws_video_service):
        self._service = service

    @property
    def provider_name(self) -> str:
        return "aws"

    async def initialize(self) -> None:
        """Fetch AWS dynamic settings from SystemSettingsService if present."""
        region = await system_settings_service.get_setting(
            "video.aws.region", os.getenv("AWS_REGION", "us-east-1")
        )
        bucket = await system_settings_service.get_setting(
            "video.aws.s3_bucket",
            os.getenv("AWS_S3_VIDEO_BUCKET", "podacium-videos-2026"),
        )
        cf_domain = await system_settings_service.get_setting(
            "video.aws.cloudfront_domain", os.getenv("CLOUDFRONT_DOMAIN", "")
        )
        cf_key_id = await system_settings_service.get_setting(
            "video.aws.cloudfront_key_pair_id", os.getenv("CLOUDFRONT_KEY_PAIR_ID", "")
        )
        cf_key_path = await system_settings_service.get_setting(
            "video.aws.cloudfront_private_key_path",
            os.getenv("CLOUDFRONT_PRIVATE_KEY_PATH", ""),
        )
        mc_role = await system_settings_service.get_setting(
            "video.aws.mediaconvert_role_arn", os.getenv("MEDIACONVERT_ROLE_ARN", "")
        )
        mc_endpoint = await system_settings_service.get_setting(
            "video.aws.mediaconvert_endpoint", os.getenv("MEDIACONVERT_ENDPOINT", "")
        )

        if region:
            self._service.region = region
        if bucket:
            self._service.video_bucket = bucket
        if cf_domain:
            self._service.cloudfront_domain = cf_domain
        if cf_key_id:
            self._service.cloudfront_key_pair_id = cf_key_id
        if cf_key_path:
            self._service.cloudfront_private_key_path = cf_key_path
        if mc_role:
            self._service.mediaconvert_role_arn = mc_role
        if mc_endpoint:
            self._service.mediaconvert_endpoint = mc_endpoint

    async def upload_video_stream(
        self, file_obj, filename: str, lesson_id: str
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._service.upload_video_stream, file_obj, filename, lesson_id
        )

    async def generate_signed_url(
        self,
        path_or_id: str,
        expire_minutes: int = 120,
        client_ip: str | None = None,
    ) -> str:
        return self._service.generate_signed_url(
            path_or_id, expire_minutes=expire_minutes, client_ip=client_ip
        )

    async def generate_signed_cookies(
        self, resource_path: str, expire_seconds: int = 7200
    ) -> Dict[str, str]:
        """Generate CloudFront Signed Cookies for HLS wildcard streaming without query string parameters."""
        await self.initialize()
        if hasattr(self._service, "generate_signed_cookies"):
            return self._service.generate_signed_cookies(
                resource_path, expire_minutes=max(1, expire_seconds // 60)
            )
        return {}

    async def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        return self._service.generate_segment_token(
            lesson_id=lesson_id,
            segment_name=segment_name,
            expire_seconds=expire_seconds,
        )

    async def submit_transcode_job(self, raw_path_or_id: str, lesson_id: str) -> str:
        return self._service.submit_transcode_job(raw_path_or_id, lesson_id)

    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        return self._service.get_job_status(job_id)

    async def test_connection(self) -> Dict[str, Any]:
        """Test AWS S3 and CloudFront reachability and credentials."""
        import time
        import asyncio

        await self.initialize()
        start = time.perf_counter()

        try:

            def _probe():
                return self._service.s3.list_objects_v2(
                    Bucket=self._service.video_bucket, MaxKeys=1
                )

            await asyncio.to_thread(_probe)
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            cf_configured = bool(self._service.cloudfront_domain)

            return {
                "success": True,
                "provider": "aws",
                "message": f"Successfully connected to S3 bucket '{self._service.video_bucket}' in region '{self._service.region}'. CloudFront: {'Configured' if cf_configured else 'Unconfigured'}.",
                "latency_ms": latency_ms,
                "details": {
                    "bucket": self._service.video_bucket,
                    "region": self._service.region,
                    "cloudfront_domain": self._service.cloudfront_domain or None,
                },
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(f"AWS connection test failed: {e}")
            return {
                "success": False,
                "provider": "aws",
                "error": f"S3 connection failed for bucket '{self._service.video_bucket}': {str(e)}",
                "latency_ms": latency_ms,
            }

    async def delete_video(self, video_id_or_path: str) -> bool:
        """Delete raw video asset from S3 bucket."""
        await self.initialize()
        if not video_id_or_path or not self._service.video_bucket:
            return False

        def _delete():
            try:
                self._service.s3.delete_object(
                    Bucket=self._service.video_bucket,
                    Key=video_id_or_path,
                )
                return True
            except Exception as e:
                logger.warning(f"Error deleting S3 object {video_id_or_path}: {e}")
                return False

        try:
            return await asyncio.to_thread(_delete)
        except Exception as e:
            logger.error(f"Failed to delete AWS video asset {video_id_or_path}: {e}")
            return False
