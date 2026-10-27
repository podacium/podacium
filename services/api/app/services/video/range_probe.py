"""HTTP Range ffprobe metadata extraction service (<100KB overhead)."""

import shutil
import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class RangeProbeService:
    """Extracts video duration, codecs, resolution, and aspect ratio via HTTP Range requests."""

    @staticmethod
    async def probe_video_metadata(video_url: str) -> Dict[str, Any]:
        """Runs ffprobe on remote HTTP URL using Range requests without downloading full file."""
        if not video_url:
            return {"duration_seconds": 0, "width": 0, "height": 0, "codec": "unknown"}

        ffprobe_path = shutil.which("ffprobe")
        if not ffprobe_path:
            logger.warning(
                "ffprobe binary not found on PATH; returning default metadata"
            )
            return {"duration_seconds": 0, "width": 0, "height": 0, "codec": "h264"}

        cmd = [
            ffprobe_path,
            "-v",
            "error",
            "-show_entries",
            "format=duration,size:stream=width,height,codec_name,r_frame_rate",
            "-of",
            "json",
            video_url,
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10.0)

            if proc.returncode == 0 and stdout:
                import json

                data = json.loads(stdout.decode("utf-8"))
                format_info = data.get("format", {})
                duration = float(format_info.get("duration", 0))

                streams = data.get("streams", [])
                v_stream = next((s for s in streams if "width" in s), {})

                return {
                    "duration_seconds": int(round(duration)),
                    "width": v_stream.get("width", 0),
                    "height": v_stream.get("height", 0),
                    "codec": v_stream.get("codec_name", "h264"),
                    "frame_rate": v_stream.get("r_frame_rate", "30/1"),
                }
        except Exception as e:
            logger.warning(f"Range ffprobe failed for '{video_url}': {e}")

        return {"duration_seconds": 0, "width": 0, "height": 0, "codec": "h264"}


range_probe_service = RangeProbeService()
