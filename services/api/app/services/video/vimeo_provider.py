"""Vimeo API v3 TUS Resumable Upload & Privacy Management Provider."""

import os
import logging
from typing import Dict, Any
import httpx

from app.services.video.base import BaseVideoProvider
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)


class VimeoVideoProvider(BaseVideoProvider):
    """Vimeo API v3 strategy for unlisted, domain-whitelisted video hosting."""

    def __init__(self):
        self.access_token = os.getenv("VIMEO_ACCESS_TOKEN", "")
        self.client_id = os.getenv("VIMEO_CLIENT_ID", "")
        self.client_secret = os.getenv("VIMEO_CLIENT_SECRET", "")
        self.allowed_domain = os.getenv("VIMEO_EMBED_DOMAIN", "app.podacium.com")

    @property
    def provider_name(self) -> str:
        return "vimeo"

    async def initialize(self) -> None:
        """Fetch dynamic Vimeo API credentials from system settings."""
        self.access_token = (
            await system_settings_service.get_setting(
                "video.vimeo.access_token", self.access_token
            )
            or ""
        )
        self.client_id = (
            await system_settings_service.get_setting(
                "video.vimeo.client_id", self.client_id
            )
            or ""
        )
        self.client_secret = (
            await system_settings_service.get_setting(
                "video.vimeo.client_secret", self.client_secret
            )
            or ""
        )
        self.allowed_domain = (
            await system_settings_service.get_setting(
                "video.vimeo.embed_domain", self.allowed_domain
            )
            or "app.podacium.com"
        )

    async def create_direct_tus_upload_intent(
        self,
        filename: str,
        filesize: int,
        lesson_id: str = "",
        expire_minutes: int = 120,
    ) -> Dict[str, Any]:
        """Request TUS resumable upload link from Vimeo API v3 with unlisted & domain-whitelisted privacy.

        POST https://api.vimeo.com/me/videos
        Header: Authorization: Bearer <access_token>
        Payload: {
            "upload": {"approach": "tus", "size": filesize},
            "name": "Lesson {lesson_id} - {filename}",
            "privacy": {"view": "unlisted", "embed": "whitelist"},
            "embed_domains": [allowed_domain]
        }
        """
        await self.initialize()
        if not self.access_token:
            raise ValueError(
                "Vimeo access_token must be configured in SystemSettings or ENV."
            )

        url = "https://api.vimeo.com/me/videos"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.vimeo.*+json;version=3.4",
        }
        payload = {
            "upload": {"approach": "tus", "size": str(filesize)},
            "name": f"Lesson {lesson_id or 'Upload'} - {filename}",
            "privacy": {
                "view": "unlisted",
                "embed": "whitelist",
            },
            "embed_domains": [self.allowed_domain],
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        upload_data = data.get("upload", {})
        upload_link = upload_data.get("upload_link", "")
        uri = data.get("uri", "")  # e.g., "/videos/123456789"
        video_id = uri.split("/")[-1] if "/" in uri else uri

        return {
            "tus_endpoint": upload_link,
            "video_id": video_id,
            "headers": {},
            "provider": "vimeo",
        }

    async def upload_video_stream(
        self, file_obj, filename: str, lesson_id: str
    ) -> Dict[str, Any]:
        """Fallback server-side stream upload for Vimeo."""
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
            content = file_obj.read()
        else:
            content = file_obj

        intent = await self.create_direct_tus_upload_intent(
            filename, len(content), lesson_id
        )
        upload_link = intent["tus_endpoint"]
        video_id = intent["video_id"]

        headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.patch(upload_link, content=content, headers=headers)
            resp.raise_for_status()

        return {"raw_path": video_id, "video_id": video_id, "storage_provider": "vimeo"}

    async def generate_signed_url(
        self,
        path_or_id: str,
        expire_minutes: int = 120,
        client_ip: str | None = None,
    ) -> str:
        """Return Vimeo iframe player URL."""
        video_id = path_or_id.strip("/").split("/")[-1]
        return f"https://player.vimeo.com/video/{video_id}?autopause=0&dnt=1"

    async def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        return ""

    async def submit_transcode_job(self, raw_path_or_id: str, lesson_id: str) -> str:
        video_id = raw_path_or_id.strip("/").split("/")[-1]
        return f"vimeo_{video_id}"

    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Check Vimeo video transcode status via Vimeo API v3."""
        await self.initialize()
        clean_id = job_id.replace("vimeo_", "").strip()
        if not self.access_token or not clean_id:
            return {"status": "completed", "progress": 100}

        url = f"https://api.vimeo.com/videos/{clean_id}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/vnd.vimeo.*+json;version=3.4",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    f"Vimeo API returned {resp.status_code} for video {clean_id}"
                )
                return {"status": "processing", "progress": 50}

            data = resp.json()
            transcode_status = data.get("transcode", {}).get("status", "complete")
            if transcode_status == "complete":
                return {"status": "completed", "progress": 100}
            elif transcode_status == "error":
                return {"status": "failed", "progress": 0}
            else:
                return {"status": "processing", "progress": 50}

    async def test_connection(self) -> Dict[str, Any]:
        """Test Vimeo API v3 authentication and account reachability."""
        import time

        await self.initialize()
        if not self.access_token:
            return {
                "success": False,
                "provider": "vimeo",
                "error": "Vimeo access_token must be configured in SystemSettings or environment.",
            }

        start = time.perf_counter()
        url = "https://api.vimeo.com/oauth/verify"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/vnd.vimeo.*+json;version=3.4",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                latency_ms = round((time.perf_counter() - start) * 1000, 1)

                if resp.status_code == 200:
                    data = resp.json()
                    user = data.get("user", {})
                    account_name = user.get("name", "Vimeo Account")
                    account_tier = user.get("account", "basic")
                    return {
                        "success": True,
                        "provider": "vimeo",
                        "message": f"Successfully authenticated with Vimeo ({account_name}, Plan: {account_tier}). Domain whitelist: '{self.allowed_domain}'.",
                        "latency_ms": latency_ms,
                        "details": {
                            "account_name": account_name,
                            "account_tier": account_tier,
                            "embed_domain": self.allowed_domain,
                        },
                    }
                elif resp.status_code == 401:
                    return {
                        "success": False,
                        "provider": "vimeo",
                        "error": "Vimeo access token is unauthorized. Please verify your token permissions.",
                        "latency_ms": latency_ms,
                    }
                else:
                    return {
                        "success": False,
                        "provider": "vimeo",
                        "error": f"Vimeo API returned HTTP {resp.status_code}: {resp.text[:200]}",
                        "latency_ms": latency_ms,
                    }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(f"Vimeo connection test failed: {e}")
            return {
                "success": False,
                "provider": "vimeo",
                "error": f"Network error reaching Vimeo API: {str(e)}",
                "latency_ms": latency_ms,
            }

    async def delete_video(self, video_id_or_path: str) -> bool:
        """Delete a video asset from Vimeo by ID."""
        await self.initialize()
        clean_id = video_id_or_path.strip("/").split("/")[-1].replace("vimeo_", "")
        if not self.access_token or not clean_id:
            return False

        url = f"https://api.vimeo.com/videos/{clean_id}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/vnd.vimeo.*+json;version=3.4",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(url, headers=headers)
                return resp.status_code in (200, 204, 404)
        except Exception as e:
            logger.warning(f"Failed to delete Vimeo video {clean_id}: {e}")
            return False
