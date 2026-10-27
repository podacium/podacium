"""Supabase Storage Video Provider Implementation."""

import os
import logging
from typing import Dict, Any
import httpx
from app.services.video.base import BaseVideoProvider
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)


class SupabaseVideoProvider(BaseVideoProvider):
    """Supabase S3-compatible Object Storage Video Provider."""

    def __init__(self):
        self.supabase_url: str = os.getenv("SUPABASE_URL", "")
        self.supabase_key: str = os.getenv(
            "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", "")
        )
        self.bucket: str = os.getenv("SUPABASE_VIDEO_BUCKET", "course-videos")

    @property
    def provider_name(self) -> str:
        return "supabase"

    async def initialize(self) -> None:
        """Fetch dynamic settings from SystemSettingsService if available."""
        url = await system_settings_service.get_setting(
            "video.supabase.url", os.getenv("SUPABASE_URL", "")
        )
        key = await system_settings_service.get_setting(
            "video.supabase.key",
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", "")),
        )
        bucket = await system_settings_service.get_setting(
            "video.supabase.bucket",
            os.getenv("SUPABASE_VIDEO_BUCKET", "course-videos"),
        )
        if url:
            self.supabase_url = url.rstrip("/")
        if key:
            self.supabase_key = key
        if bucket:
            self.bucket = bucket

    async def upload_video_stream(
        self, file_obj, filename: str, lesson_id: str
    ) -> Dict[str, Any]:
        """Upload raw video object to Supabase Storage."""
        await self.initialize()
        clean_name = filename.replace(" ", "_")
        dest_path = f"raw/{lesson_id}/{clean_name}"

        duration_secs, duration_mins, formatted_duration = self.extract_video_duration(
            file_obj
        )

        if not self.supabase_url or not self.supabase_key:
            logger.warning("Supabase credentials missing; saving local path reference")
            return {
                "raw_path": dest_path,
                "video_id": dest_path,
                "provider": "supabase",
                "duration_seconds": duration_secs,
                "duration_minutes": duration_mins,
                "formatted_duration": formatted_duration,
            }

        upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{dest_path}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key,
            "Content-Type": "video/mp4",
        }

        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        content = file_obj.read() if hasattr(file_obj, "read") else file_obj

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(upload_url, headers=headers, content=content)
            if resp.status_code not in (200, 201):
                logger.error(f"Supabase upload error: {resp.status_code} - {resp.text}")

        return {
            "raw_path": dest_path,
            "video_id": dest_path,
            "provider": "supabase",
            "duration_seconds": duration_secs,
            "duration_minutes": duration_mins,
            "formatted_duration": formatted_duration,
        }

    async def generate_signed_url(
        self,
        path_or_id: str,
        expire_minutes: int = 120,
        client_ip: str | None = None,
    ) -> str:
        """Generate a secure signed URL for Supabase video asset."""
        await self.initialize()
        if not self.supabase_url or not self.supabase_key:
            return path_or_id

        clean_path = path_or_id.lstrip("/")
        sign_url = (
            f"{self.supabase_url}/storage/v1/object/sign/{self.bucket}/{clean_path}"
        )
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key,
            "Content-Type": "application/json",
        }
        payload = {"expiresIn": expire_minutes * 60}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(sign_url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    signed_token = data.get("signedURL", "")
                    if signed_token.startswith("http"):
                        return signed_token
                    return f"{self.supabase_url}/storage/v1{signed_token}"
        except Exception as e:
            logger.error(f"Error generating Supabase signed URL: {e}")

        return (
            f"{self.supabase_url}/storage/v1/object/public/{self.bucket}/{clean_path}"
        )

    async def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        """Generate token for HLS segments."""
        return await self.generate_signed_url(
            f"hls/{lesson_id}/{segment_name}",
            expire_minutes=max(1, expire_seconds // 60),
        )

    async def submit_transcode_job(self, raw_path_or_id: str, lesson_id: str) -> str:
        """Supabase uses direct playback or external webhook transcoding."""
        return f"supabase-direct-{lesson_id}"

    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        return {"status": "completed", "progress": 100}

    async def delete_video(self, video_id_or_path: str) -> bool:
        await self.initialize()
        if not self.supabase_url or not self.supabase_key:
            return True
        clean_path = video_id_or_path.lstrip("/")
        delete_url = f"{self.supabase_url}/storage/v1/object/{self.bucket}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.request(
                    "DELETE",
                    delete_url,
                    headers=headers,
                    json={"prefixes": [clean_path]},
                )
            return True
        except Exception as e:
            logger.error(f"Failed to delete Supabase video object {clean_path}: {e}")
            return False

    async def test_connection(self) -> Dict[str, Any]:
        await self.initialize()
        if not self.supabase_url or not self.supabase_key:
            return {
                "success": False,
                "provider": "supabase",
                "message": "SUPABASE_URL or SUPABASE_KEY is missing.",
            }
        test_url = f"{self.supabase_url}/storage/v1/bucket/{self.bucket}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key,
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(test_url, headers=headers)
                return {
                    "success": resp.status_code == 200,
                    "provider": "supabase",
                    "message": "Connected to Supabase storage successfully."
                    if resp.status_code == 200
                    else f"Supabase responded with status {resp.status_code}.",
                }
        except Exception as e:
            return {
                "success": False,
                "provider": "supabase",
                "message": f"Connection failed: {str(e)}",
            }
