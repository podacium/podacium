"""Bunny.net Stream video provider implementation."""

import os
import time
import hashlib
import logging
from typing import Dict, Any
import httpx

from app.services.video.base import BaseVideoProvider
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)


class BunnyStreamVideoProvider(BaseVideoProvider):
    """Bunny.net Stream video provider implementation."""

    def __init__(self):
        self.library_id = os.getenv("BUNNY_LIBRARY_ID", "")
        self.api_key = os.getenv("BUNNY_API_KEY", "")
        self.cdn_hostname = os.getenv("BUNNY_CDN_HOSTNAME", "")
        self.token_auth_key = os.getenv("BUNNY_TOKEN_AUTH_KEY", "")

    @property
    def provider_name(self) -> str:
        return "bunny"

    async def initialize(self) -> None:
        """Fetch dynamic Bunny Stream credentials from system settings."""
        self.library_id = (
            await system_settings_service.get_setting(
                "video.bunny.library_id", self.library_id
            )
            or ""
        )
        self.api_key = (
            await system_settings_service.get_setting(
                "video.bunny.api_key", self.api_key
            )
            or ""
        )
        self.cdn_hostname = (
            await system_settings_service.get_setting(
                "video.bunny.cdn_hostname", self.cdn_hostname
            )
            or ""
        )
        self.token_auth_key = (
            await system_settings_service.get_setting(
                "video.bunny.token_auth_key", self.token_auth_key
            )
            or ""
        )

    async def upload_video_stream(
        self, file_obj, filename: str, lesson_id: str
    ) -> Dict[str, Any]:
        """Create video entry in Bunny Stream and upload raw bytes."""
        await self.initialize()
        if not self.library_id or not self.api_key:
            raise ValueError("Bunny Stream library_id and api_key must be configured.")

        # 1. Create Video Object in Bunny Stream
        url = f"https://video.bunnycdn.com/library/{self.library_id}/videos"
        headers = {
            "AccessKey": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {"title": f"Lesson {lesson_id} - {filename}"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            video_id = data["guid"]

            # 2. Upload video binary file content
            upload_url = f"https://video.bunnycdn.com/library/{self.library_id}/videos/{video_id}"

            if hasattr(file_obj, "read"):
                if hasattr(file_obj, "seek"):
                    file_obj.seek(0)
                content = file_obj.read()
            else:
                content = file_obj

            upload_headers = {
                "AccessKey": self.api_key,
                "Content-Type": "application/octet-stream",
            }
            upload_resp = await client.put(
                upload_url, content=content, headers=upload_headers
            )
            upload_resp.raise_for_status()

        logger.info(
            f"Successfully uploaded video to Bunny Stream. Video ID: {video_id}"
        )
        return {"raw_path": video_id, "video_id": video_id}

    async def create_direct_tus_upload_intent(
        self,
        filename: str,
        filesize: int,
        lesson_id: str = "",
        expire_minutes: int = 120,
    ) -> Dict[str, Any]:
        """Create Bunny Stream video object and generate client-side TUS authorization signature.

        Signature formula: SHA256(library_id + api_key + expiration_time + video_id)
        """
        await self.initialize()
        if not self.library_id or not self.api_key:
            raise ValueError("Bunny Stream library_id and api_key must be configured.")

        # 1. Create Video Object in Bunny Stream
        url = f"https://video.bunnycdn.com/library/{self.library_id}/videos"
        headers = {
            "AccessKey": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {"title": f"Lesson {lesson_id or 'Upload'} - {filename}"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            video_id = data["guid"]

        # 2. Calculate SHA256 signature
        expiration_time = int(time.time()) + (expire_minutes * 60)
        signature_raw = f"{self.library_id}{self.api_key}{expiration_time}{video_id}"
        signature = hashlib.sha256(signature_raw.encode("utf-8")).hexdigest()

        return {
            "tus_endpoint": "https://video.bunnycdn.com/tusupload",
            "video_id": video_id,
            "headers": {
                "AuthorizationSignature": signature,
                "AuthorizationExpire": str(expiration_time),
                "LibraryId": str(self.library_id),
                "VideoId": video_id,
            },
            "provider": "bunny",
        }

    async def generate_signed_url(
        self,
        path_or_id: str,
        expire_minutes: int = 120,
        client_ip: str | None = None,
    ) -> str:
        """Generate Bunny Stream Token Authentication signed URL.

        Format: https://{cdn_hostname}/{video_id}/playlist.m3u8?token={token}&expires={expires}
        Token hash: SHA256(token_auth_key + video_id + expires + [user_ip])
        """
        await self.initialize()
        clean_id = path_or_id.strip("/")
        if "/" in clean_id:
            clean_id = clean_id.split("/")[0]

        expires = int(time.time()) + (expire_minutes * 60)

        if self.token_auth_key:
            ip_suffix = (
                client_ip.split(",")[0].strip()
                if client_ip and client_ip not in ("127.0.0.1", "localhost", "::1")
                else ""
            )
            token_str = f"{self.token_auth_key}{clean_id}{expires}{ip_suffix}"
            token_hash = hashlib.sha256(token_str.encode("utf-8")).hexdigest()
            return f"https://{self.cdn_hostname}/{clean_id}/playlist.m3u8?token={token_hash}&expires={expires}"

        return f"https://{self.cdn_hostname}/{clean_id}/playlist.m3u8"

    async def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        """Generate segment token for Bunny Stream."""
        return await self.generate_signed_url(
            lesson_id, expire_minutes=max(1, expire_seconds // 60)
        )

    async def submit_transcode_job(self, raw_path_or_id: str, lesson_id: str) -> str:
        """Bunny Stream automatically begins encoding upon upload completion. Return video_id."""
        return raw_path_or_id

    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Check Bunny Stream encoding status for video_id.

        Bunny Status mapping:
        0: Created, 1: Uploading, 2: Processing, 3: Transcoding, 4: Finished, 5: Error
        """
        await self.initialize()
        if not self.library_id or not self.api_key:
            return {"status": "completed", "progress": 100}

        url = f"https://video.bunnycdn.com/library/{self.library_id}/videos/{job_id}"
        headers = {"AccessKey": self.api_key, "Accept": "application/json"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    f"Bunny API returned {resp.status_code} for video {job_id}"
                )
                return {"status": "processing", "progress": 50}

            data = resp.json()
            b_status = data.get("status", 4)
            encode_progress = data.get("encodeProgress", 0)

            if b_status in (0, 1, 2, 3):
                status_str = "processing"
                progress = encode_progress if encode_progress > 0 else 50
            elif b_status == 4:
                status_str = "completed"
                progress = 100
            else:
                status_str = "failed"
                progress = 0

            return {"status": status_str, "progress": progress}

    async def test_connection(self) -> Dict[str, Any]:
        """Test Bunny Stream API reachability and library credentials."""
        import time

        await self.initialize()
        if not self.library_id or not self.api_key:
            return {
                "success": False,
                "provider": "bunny",
                "error": "Bunny Stream library_id and api_key must be configured in SystemSettings or environment.",
            }

        start = time.perf_counter()
        url = f"https://video.bunnycdn.com/library/{self.library_id}/videos?page=1&itemsPerPage=1"
        headers = {"AccessKey": self.api_key, "Accept": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                latency_ms = round((time.perf_counter() - start) * 1000, 1)

                if resp.status_code == 200:
                    data = resp.json()
                    total_items = data.get("totalItems", 0)
                    return {
                        "success": True,
                        "provider": "bunny",
                        "message": f"Successfully authenticated with Bunny Stream Library #{self.library_id} ({total_items} total videos hosted).",
                        "latency_ms": latency_ms,
                        "details": {
                            "library_id": self.library_id,
                            "cdn_hostname": self.cdn_hostname or "b-cdn.net",
                            "total_videos": total_items,
                        },
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "success": False,
                        "provider": "bunny",
                        "error": f"Authentication failed (HTTP {resp.status_code}). Please verify your Bunny AccessKey and Library ID.",
                        "latency_ms": latency_ms,
                    }
                else:
                    return {
                        "success": False,
                        "provider": "bunny",
                        "error": f"Bunny Stream returned unexpected status HTTP {resp.status_code}: {resp.text[:200]}",
                        "latency_ms": latency_ms,
                    }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(f"Bunny connection test failed: {e}")
            return {
                "success": False,
                "provider": "bunny",
                "error": f"Network error reaching Bunny Stream API: {str(e)}",
                "latency_ms": latency_ms,
            }

    async def delete_video(self, video_id_or_path: str) -> bool:
        """Delete video from Bunny Stream library."""
        await self.initialize()
        if not self.library_id or not self.api_key or not video_id_or_path:
            return False

        clean_id = video_id_or_path.strip("/").split("/")[0]
        url = f"https://video.bunnycdn.com/library/{self.library_id}/videos/{clean_id}"
        headers = {"AccessKey": self.api_key, "Accept": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(url, headers=headers)
                if resp.status_code in (200, 204, 404):
                    logger.info(
                        f"Successfully deleted video {clean_id} from Bunny Stream"
                    )
                    return True
                logger.warning(
                    f"Failed to delete Bunny video {clean_id}: status={resp.status_code}"
                )
                return False
        except Exception as e:
            logger.error(f"Error deleting video from Bunny Stream: {e}")
            return False
