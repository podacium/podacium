"""Dailymotion API 3-Step Upload & Embed Video Provider."""

import os
import logging
from typing import Dict, Any
import httpx

from app.services.video.base import BaseVideoProvider
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)


class DailymotionVideoProvider(BaseVideoProvider):
    """Dailymotion Data API strategy for private/unlisted video hosting."""

    def __init__(self):
        self.api_key = os.getenv("DAILYMOTION_API_KEY", "")
        self.api_secret = os.getenv("DAILYMOTION_API_SECRET", "")
        self.access_token = os.getenv("DAILYMOTION_ACCESS_TOKEN", "")

    @property
    def provider_name(self) -> str:
        return "dailymotion"

    async def initialize(self) -> None:
        """Fetch dynamic Dailymotion credentials from system settings."""
        self.api_key = (
            await system_settings_service.get_setting(
                "video.dailymotion.api_key", self.api_key
            )
            or ""
        )
        self.api_secret = (
            await system_settings_service.get_setting(
                "video.dailymotion.api_secret", self.api_secret
            )
            or ""
        )
        self.access_token = (
            await system_settings_service.get_setting(
                "video.dailymotion.access_token", self.access_token
            )
            or ""
        )

    async def create_direct_upload_intent(
        self, filename: str, filesize: int, lesson_id: str = ""
    ) -> Dict[str, Any]:
        """Request a temporary upload URL from Dailymotion API.

        Step 1: GET https://api.dailymotion.com/file/upload (authenticated)
        Returns: {"upload_url": "..."}
        """
        await self.initialize()
        if not self.access_token:
            raise ValueError("Dailymotion access_token must be configured.")

        url = "https://api.dailymotion.com/file/upload"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        upload_url = data.get("upload_url", "")
        return {
            "upload_url": upload_url,
            "provider": "dailymotion",
            "lesson_id": lesson_id,
            "filename": filename,
        }

    async def finalize_upload(self, temp_url: str, title: str) -> Dict[str, Any]:
        """Create private video entry on Dailymotion using temporary uploaded URL.

        Step 3: POST https://api.dailymotion.com/me/videos?url=<temp_url>&private=true&published=true
        """
        await self.initialize()
        url = "https://api.dailymotion.com/me/videos"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        params = {
            "url": temp_url,
            "title": title,
            "private": "true",
            "published": "true",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        video_id = data.get("id", "")
        return {
            "video_id": video_id,
            "raw_path": video_id,
            "storage_provider": "dailymotion",
        }

    async def upload_video_stream(
        self, file_obj, filename: str, lesson_id: str
    ) -> Dict[str, Any]:
        """Server-side 3-step stream upload to Dailymotion."""
        intent = await self.create_direct_upload_intent(filename, 0, lesson_id)
        upload_url = intent["upload_url"]

        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
            content = file_obj.read()
        else:
            content = file_obj

        files = {"file": (filename, content, "video/mp4")}
        async with httpx.AsyncClient(timeout=120.0) as client:
            upload_resp = await client.post(upload_url, files=files)
            upload_resp.raise_for_status()
            temp_url = upload_resp.json().get("url", "")

        return await self.finalize_upload(temp_url, f"Lesson {lesson_id} - {filename}")

    async def generate_signed_url(
        self,
        path_or_id: str,
        expire_minutes: int = 120,
        client_ip: str | None = None,
    ) -> str:
        """Return privacy-enhanced Dailymotion iframe embed URL."""
        clean_id = path_or_id.strip("/").split("/")[-1]
        return f"https://www.dailymotion.com/embed/video/{clean_id}?ui-highlight=3b82f6&sharing-enable=0"

    async def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        return ""

    async def submit_transcode_job(self, raw_path_or_id: str, lesson_id: str) -> str:
        clean_id = raw_path_or_id.strip("/").split("/")[-1]
        return f"dm_{clean_id}"

    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        clean_id = job_id.replace("dm_", "").strip()
        if not clean_id:
            return {"status": "completed", "progress": 100}

        url = f"https://api.dailymotion.com/video/{clean_id}?fields=status,encoding_progress"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return {"status": "completed", "progress": 100}

            data = resp.json()
            status_str = data.get("status", "ready")
            progress = data.get("encoding_progress", 100)

            if status_str in ("processing", "encoding"):
                return {"status": "processing", "progress": int(progress)}
            elif status_str == "ready":
                return {"status": "completed", "progress": 100}
            else:
                return {"status": "failed", "progress": 0}

    async def test_connection(self) -> Dict[str, Any]:
        """Test Dailymotion API reachability and access token."""
        import time

        await self.initialize()
        if not self.access_token:
            return {
                "success": False,
                "provider": "dailymotion",
                "error": "Dailymotion access_token must be configured in SystemSettings or environment.",
            }

        start = time.perf_counter()
        url = "https://api.dailymotion.com/user/me?fields=id,screenname,status"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                latency_ms = round((time.perf_counter() - start) * 1000, 1)

                if resp.status_code == 200:
                    data = resp.json()
                    screenname = data.get("screenname", "Dailymotion User")
                    return {
                        "success": True,
                        "provider": "dailymotion",
                        "message": f"Successfully authenticated with Dailymotion API (User: '{screenname}').",
                        "latency_ms": latency_ms,
                        "details": {"user": screenname, "user_id": data.get("id")},
                    }
                elif resp.status_code == 401:
                    return {
                        "success": False,
                        "provider": "dailymotion",
                        "error": "Dailymotion access token is invalid or expired.",
                        "latency_ms": latency_ms,
                    }
                else:
                    return {
                        "success": False,
                        "provider": "dailymotion",
                        "error": f"Dailymotion API returned HTTP {resp.status_code}: {resp.text[:200]}",
                        "latency_ms": latency_ms,
                    }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(f"Dailymotion connection test failed: {e}")
            return {
                "success": False,
                "provider": "dailymotion",
                "error": f"Network error reaching Dailymotion API: {str(e)}",
                "latency_ms": latency_ms,
            }

    async def delete_video(self, video_id_or_path: str) -> bool:
        """Delete a video asset from Dailymotion by ID."""
        await self.initialize()
        clean_id = video_id_or_path.strip("/").split("/")[-1].replace("dm_", "")
        if not self.access_token or not clean_id:
            return False

        url = f"https://api.dailymotion.com/video/{clean_id}"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(url, headers=headers)
                return resp.status_code in (200, 204, 404)
        except Exception as e:
            logger.warning(f"Failed to delete Dailymotion video {clean_id}: {e}")
            return False
