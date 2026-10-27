"""Base interface for video streaming infrastructure providers."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple


class BaseVideoProvider(ABC):
    """Abstract Base Class for Video Infrastructure Providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Provider unique identifier: 'aws', 'bunny', 'cloudflare'."""
        pass

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize client connections and fetch settings from SystemSettingsService."""
        pass

    @abstractmethod
    async def upload_video_stream(
        self, file_obj, filename: str, lesson_id: str
    ) -> Dict[str, Any]:
        """Upload raw or managed video stream.

        Returns:
            Dict containing 'raw_path' or 'video_id' and provider metadata.
        """
        pass

    @abstractmethod
    async def generate_signed_url(
        self,
        path_or_id: str,
        expire_minutes: int = 120,
        client_ip: str | None = None,
    ) -> str:
        """Generate a secure signed URL or manifest token for video playback."""
        pass

    @abstractmethod
    async def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        """Generate short-lived authorization token for individual HLS segments."""
        pass

    @abstractmethod
    async def submit_transcode_job(self, raw_path_or_id: str, lesson_id: str) -> str:
        """Submit transcoding job or return video process ID."""
        pass

    @abstractmethod
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Check status of video processing/transcoding job.

        Returns:
            Dict containing 'status' ('processing', 'completed', 'failed') and 'progress' (0-100).
        """
        pass

    async def delete_video(self, video_id_or_path: str) -> bool:
        """Delete video asset from remote storage/CDN provider.

        Returns True if deleted or non-existent, False otherwise.
        """
        return True

    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection, credentials, and API reachability for this provider.

        Returns:
            Dict containing 'success' (bool), 'provider' (str), 'message' (str),
            and optional 'latency_ms' or 'error' (str).
        """
        pass

    def extract_video_duration(self, file_obj) -> Tuple[int, int, str]:
        """Extract video duration tuple (seconds, minutes, formatted_string).

        Default implementation uses tinytag on file stream position 0.
        """
        import logging

        logger = logging.getLogger(__name__)
        try:
            from tinytag import TinyTag

            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            tag = TinyTag.get(file_obj=file_obj)
            duration_secs = int(round(tag.duration)) if tag and tag.duration else 0
        except Exception as e:
            logger.warning(f"Could not extract video duration via tinytag: {e}")
            duration_secs = 0
        finally:
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)

        duration_mins = (
            max(1, int(round(duration_secs / 60.0))) if duration_secs > 0 else 0
        )
        h = duration_secs // 3600
        m = (duration_secs % 3600) // 60
        s = duration_secs % 60

        if h > 0:
            formatted = f"{h}h {m}m"
        elif m > 0:
            formatted = f"{m}m {s}s" if s > 0 else f"{m}m"
        elif s > 0:
            formatted = f"{s}s"
        else:
            formatted = "0s"

        return (duration_secs, duration_mins, formatted)
