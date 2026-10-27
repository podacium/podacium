"""Cloudflare Stream video provider implementation."""

import os
import time
import logging
from typing import Dict, Any
import httpx

from app.services.video.base import BaseVideoProvider
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)


class CloudflareStreamVideoProvider(BaseVideoProvider):
    """Cloudflare Stream video provider implementation."""

    def __init__(self):
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN", "")
        self.subdomain = os.getenv("CLOUDFLARE_STREAM_DOMAIN", "videodelivery.net")

    @property
    def provider_name(self) -> str:
        return "cloudflare"

    async def initialize(self) -> None:
        """Fetch dynamic Cloudflare credentials from system settings."""
        self.account_id = (
            await system_settings_service.get_setting(
                "video.cloudflare.account_id", self.account_id
            )
            or ""
        )
        self.api_token = (
            await system_settings_service.get_setting(
                "video.cloudflare.api_token", self.api_token
            )
            or ""
        )
        self.subdomain = (
            await system_settings_service.get_setting(
                "video.cloudflare.subdomain", self.subdomain
            )
            or "videodelivery.net"
        )

    async def upload_video_stream(
        self, file_obj, filename: str, lesson_id: str
    ) -> Dict[str, Any]:
        """Upload video binary to Cloudflare Stream API."""
        await self.initialize()
        if not self.account_id or not self.api_token:
            raise ValueError("Cloudflare account_id and api_token must be configured.")

        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/stream"
        headers = {"Authorization": f"Bearer {self.api_token}"}

        if hasattr(file_obj, "read"):
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            content = file_obj.read()
        else:
            content = file_obj

        files = {"file": (filename, content, "video/mp4")}

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, files=files)
            resp.raise_for_status()
            data = resp.json()
            video_id = data["result"]["uid"]

        logger.info(
            f"Successfully uploaded video to Cloudflare Stream. Video UID: {video_id}"
        )
        return {"raw_path": video_id, "video_id": video_id}

    async def create_direct_tus_upload_intent(
        self,
        filename: str,
        filesize: int,
        lesson_id: str = "",
        expire_minutes: int = 120,
    ) -> Dict[str, Any]:
        """Request a one-time TUS upload location URL from Cloudflare Stream API.

        Endpoint: POST https://api.cloudflare.com/client/v4/accounts/{account_id}/stream
        Headers: Authorization: Bearer <token>, Tus-Resumable: 1.0.0, Upload-Length: <size>
        """
        await self.initialize()
        if not self.account_id or not self.api_token:
            raise ValueError("Cloudflare account_id and api_token must be configured.")

        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/stream"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Tus-Resumable": "1.0.0",
            "Upload-Length": str(filesize),
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers)
            resp.raise_for_status()
            upload_url = resp.headers.get("Location") or resp.headers.get(
                "location", ""
            )
            video_uid = resp.headers.get("stream-media-id", "")

        return {
            "tus_endpoint": upload_url,
            "video_id": video_uid,
            "headers": {"Tus-Resumable": "1.0.0"},
            "provider": "cloudflare",
        }

    async def generate_signed_url(
        self,
        path_or_id: str,
        expire_minutes: int = 120,
        client_ip: str | None = None,
    ) -> str:
        """Generate Cloudflare Stream HLS manifest playback URL with signed token when configured.

        Format: https://{subdomain}/{token_or_id}/manifest/video.m3u8
        """
        await self.initialize()
        clean_id = path_or_id.strip("/")
        if "/" in clean_id:
            clean_id = clean_id.split("/")[0]

        if self.account_id and self.api_token:
            url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/stream/{clean_id}/token"
            headers = {"Authorization": f"Bearer {self.api_token}"}
            exp = int(time.time()) + (expire_minutes * 60)
            token_payload: dict = {"exp": exp}
            if client_ip and client_ip not in ("127.0.0.1", "localhost", "::1"):
                clean_ip = client_ip.split(",")[0].strip()
                cidr = clean_ip if "/" in clean_ip else f"{clean_ip}/32"
                token_payload["accessRules"] = [
                    {"type": "ip.src", "action": "allow", "value": [cidr]}
                ]
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(url, headers=headers, json=token_payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        token = data.get("result", {}).get("token")
                        if token:
                            return (
                                f"https://{self.subdomain}/{token}/manifest/video.m3u8"
                            )
            except Exception as e:
                logger.warning(f"Cloudflare stream token generation fallback: {e}")

        return f"https://{self.subdomain}/{clean_id}/manifest/video.m3u8"

    async def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        """Generate segment playback token for Cloudflare Stream."""
        return await self.generate_signed_url(
            lesson_id, expire_minutes=max(1, expire_seconds // 60)
        )

    async def submit_transcode_job(self, raw_path_or_id: str, lesson_id: str) -> str:
        """Cloudflare Stream automatically encodes uploaded videos. Return video UID."""
        return raw_path_or_id

    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Check Cloudflare Stream status.

        Cloudflare status states:
        "downloading", "queued", "inprogress" -> processing
        "ready" -> completed
        "error" -> failed
        """
        await self.initialize()
        if not self.account_id or not self.api_token:
            return {"status": "completed", "progress": 100}

        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/stream/{job_id}"
        headers = {"Authorization": f"Bearer {self.api_token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    f"Cloudflare API returned {resp.status_code} for video {job_id}"
                )
                return {"status": "processing", "progress": 50}

            data = resp.json()
            result = data.get("result", {})
            status_obj = result.get("status", {})
            state = status_obj.get("state", "ready")
            pct = status_obj.get("pctComplete", "100")

            try:
                progress = int(float(pct))
            except (ValueError, TypeError):
                progress = 100

            if state in ("downloading", "queued", "inprogress"):
                status_str = "processing"
            elif state == "ready":
                status_str = "completed"
                progress = 100
            else:
                status_str = "failed"
                progress = 0

            return {"status": status_str, "progress": progress}

    async def test_connection(self) -> Dict[str, Any]:
        """Test Cloudflare Stream API reachability and Account/Token credentials."""
        import time

        await self.initialize()
        if not self.account_id or not self.api_token:
            return {
                "success": False,
                "provider": "cloudflare",
                "error": "Cloudflare account_id and api_token must be configured in SystemSettings or environment.",
            }

        start = time.perf_counter()
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/stream?limit=1"
        headers = {"Authorization": f"Bearer {self.api_token}"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                latency_ms = round((time.perf_counter() - start) * 1000, 1)

                if resp.status_code == 200:
                    data = resp.json()
                    success_flag = data.get("success", True)
                    total = data.get("result_info", {}).get("total_count", 0)
                    return {
                        "success": success_flag,
                        "provider": "cloudflare",
                        "message": f"Successfully authenticated with Cloudflare Stream (Account ID: {self.account_id[:8]}..., {total} videos indexed).",
                        "latency_ms": latency_ms,
                        "details": {
                            "account_id": f"{self.account_id[:6]}...{self.account_id[-4:]}",
                            "subdomain": self.subdomain,
                            "total_videos": total,
                        },
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "success": False,
                        "provider": "cloudflare",
                        "error": f"Authentication failed (HTTP {resp.status_code}). Please verify your Cloudflare API Token and Stream Account permissions.",
                        "latency_ms": latency_ms,
                    }
                else:
                    return {
                        "success": False,
                        "provider": "cloudflare",
                        "error": f"Cloudflare API returned status HTTP {resp.status_code}: {resp.text[:200]}",
                        "latency_ms": latency_ms,
                    }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.error(f"Cloudflare connection test failed: {e}")
            return {
                "success": False,
                "provider": "cloudflare",
                "error": f"Network error reaching Cloudflare Stream API: {str(e)}",
                "latency_ms": latency_ms,
            }

    async def delete_video(self, video_id_or_path: str) -> bool:
        """Delete video from Cloudflare Stream."""
        await self.initialize()
        if not self.account_id or not self.api_token or not video_id_or_path:
            return False

        clean_id = video_id_or_path.strip("/").split("/")[0]
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/stream/{clean_id}"
        headers = {"Authorization": f"Bearer {self.api_token}"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.delete(url, headers=headers)
                if resp.status_code in (200, 204, 404):
                    logger.info(
                        f"Successfully deleted video {clean_id} from Cloudflare Stream"
                    )
                    return True
                logger.warning(
                    f"Failed to delete Cloudflare video {clean_id}: status={resp.status_code}"
                )
                return False
        except Exception as e:
            logger.error(f"Error deleting video from Cloudflare Stream: {e}")
            return False
