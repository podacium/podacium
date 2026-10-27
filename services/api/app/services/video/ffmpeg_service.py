"""Local FFmpeg transcoding, ABR ladder packaging, and storyboard thumbnail generation."""

import os
import json
import shutil
import logging
import subprocess
import hmac
import hashlib
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class FFmpegService:
    def __init__(self):
        self.ffmpeg_bin = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
        self.ffprobe_bin = shutil.which("ffprobe") or "/usr/bin/ffprobe"

    def is_available(self) -> bool:
        """Check if FFmpeg and FFprobe binaries are present."""
        return os.path.isfile(self.ffmpeg_bin) and os.path.isfile(self.ffprobe_bin)

    def probe_video(self, video_path: str) -> Dict[str, Any]:
        """Inspect video streams, resolution, fps, duration, and codecs via ffprobe."""
        if not self.is_available():
            raise RuntimeError("ffprobe is not installed on system")

        cmd = [
            self.ffprobe_bin,
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            video_path,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)

        video_stream = next(
            (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
            None,
        )
        audio_stream = next(
            (s for s in data.get("streams", []) if s.get("codec_type") == "audio"),
            None,
        )
        fmt = data.get("format", {})

        duration = float(fmt.get("duration", 0.0))
        width = int(video_stream.get("width", 0)) if video_stream else 0
        height = int(video_stream.get("height", 0)) if video_stream else 0

        # Calculate FPS safely
        fps = 30.0
        if video_stream and video_stream.get("r_frame_rate"):
            r_rate = video_stream["r_frame_rate"]
            if "/" in r_rate:
                num, den = r_rate.split("/")
                fps = float(num) / float(den) if float(den) > 0 else 30.0
            else:
                fps = float(r_rate)

        return {
            "duration": duration,
            "width": width,
            "height": height,
            "fps": fps,
            "video_codec": video_stream.get("codec_name") if video_stream else None,
            "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
            "size_bytes": int(fmt.get("size", 0)),
        }

    def generate_hls_key_info(
        self,
        output_dir: str,
        lesson_id: str,
        key_url: Optional[str] = None,
    ) -> str:
        """
        Generate a 16-byte AES-128 encryption key and FFmpeg key info file for DRM packaging.
        The key is deterministically derived using HMAC-SHA256 matching get_hls_aes128_key.
        Returns the path to the written .keyinfo file.
        """
        from app.core.config import setting

        secret = (
            getattr(setting, "JWT_SECRET_KEY", "")
            or getattr(setting, "SECRET_KEY", "podacium_aes_key")
        ).encode()
        derived_key = hmac.new(
            secret, f"video_aes128:{lesson_id}".encode(), hashlib.sha256
        ).digest()[:16]

        keys_dir = os.path.join(output_dir, ".keys")
        os.makedirs(keys_dir, exist_ok=True)
        key_file_path = os.path.join(keys_dir, f"{lesson_id}.key")
        with open(key_file_path, "wb") as kf:
            kf.write(derived_key)

        key_uri = key_url or f"/api/v1/education/video/key/{lesson_id}"
        key_info_path = os.path.join(keys_dir, f"{lesson_id}.keyinfo")
        with open(key_info_path, "w", encoding="utf-8") as kif:
            kif.write(f"{key_uri}\n{key_file_path}\n")

        return key_info_path

    def transcode_to_hls_ladder(
        self,
        input_path: str,
        output_dir: str,
        lesson_id: str,
        segment_time: int = 4,
        key_url: Optional[str] = None,
        key_info_file: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transcode raw video into a multi-bitrate HLS ladder (1080p, 720p, 480p, 360p)
        with strictly synchronized IDR keyframes for seamless adaptive bitrate (ABR) switching,
        encrypted with AES-128 via -hls_key_info_file.
        """
        if not self.is_available():
            raise RuntimeError("ffmpeg is not installed on system")

        os.makedirs(output_dir, exist_ok=True)
        probe = self.probe_video(input_path)
        fps = probe["fps"]
        src_width = probe["width"] or 1920
        src_height = probe["height"] or 1080

        # Inject AES-128 key info file for DRM segment encryption
        if not key_info_file:
            key_info_file = self.generate_hls_key_info(
                output_dir=output_dir, lesson_id=lesson_id, key_url=key_url
            )

        # 2-second synchronized GOP interval with scene-cut detection disabled
        gop_size = max(30, int(round(fps * 2.0)))

        all_ladders: list[dict[str, Any]] = [
            {
                "name": "1080p",
                "w": 1920,
                "h": 1080,
                "v_br": "5000k",
                "max_br": "5350k",
                "buf": "7500k",
                "a_br": "128k",
            },
            {
                "name": "720p",
                "w": 1280,
                "h": 720,
                "v_br": "2800k",
                "max_br": "3000k",
                "buf": "4200k",
                "a_br": "128k",
            },
            {
                "name": "480p",
                "w": 854,
                "h": 480,
                "v_br": "1400k",
                "max_br": "1500k",
                "buf": "2100k",
                "a_br": "96k",
            },
            {
                "name": "360p",
                "w": 640,
                "h": 360,
                "v_br": "800k",
                "max_br": "850k",
                "buf": "1200k",
                "a_br": "64k",
            },
        ]

        # Only transcode renditions up to the input video dimensions (no upscale degradation)
        active_ladders = [
            l
            for l in all_ladders
            if int(l["h"]) <= src_height and int(l["w"]) <= src_width
        ]
        if not active_ladders:
            active_ladders = [all_ladders[-1]]  # At least 360p

        master_lines = [
            "#EXTM3U",
            "#EXT-X-VERSION:6",
            "#EXT-X-INDEPENDENT-SEGMENTS",
        ]

        rendition_outputs = []

        for lad in active_ladders:
            name = str(lad["name"])
            lad_w = int(lad["w"])
            lad_h = int(lad["h"])
            v_br = str(lad["v_br"])
            max_br = str(lad["max_br"])
            buf = str(lad["buf"])
            a_br = str(lad["a_br"])

            rendition_dir = os.path.join(output_dir, name)
            os.makedirs(rendition_dir, exist_ok=True)
            playlist_name = f"{name}.m3u8"
            playlist_path = os.path.join(rendition_dir, playlist_name)
            segment_pattern = os.path.join(rendition_dir, "segment_%03d.ts")

            # Strict keyframe alignment across renditions: -g, -keyint_min, -sc_threshold 0
            # and AES-128 segment encryption via -hls_key_info_file
            cmd = [
                self.ffmpeg_bin,
                "-y",
                "-i",
                input_path,
                "-vf",
                f"scale=w={lad_w}:h={lad_h}:force_original_aspect_ratio=decrease,pad={lad_w}:{lad_h}:(ow-iw)/2:(oh-ih)/2",
                "-c:v",
                "libx264",
                "-profile:v",
                "main",
                "-preset",
                "veryfast",
                "-b:v",
                v_br,
                "-maxrate",
                max_br,
                "-bufsize",
                buf,
                "-g",
                str(gop_size),
                "-keyint_min",
                str(gop_size),
                "-sc_threshold",
                "0",
                "-c:a",
                "aac",
                "-b:a",
                a_br,
                "-ar",
                "48000",
                "-hls_key_info_file",
                key_info_file,
                "-hls_time",
                str(segment_time),
                "-hls_playlist_type",
                "vod",
                "-hls_flags",
                "independent_segments",
                "-hls_segment_filename",
                segment_pattern,
                playlist_path,
            ]
            logger.info(f"Transcoding rendition {name} for lesson {lesson_id}")
            subprocess.run(cmd, capture_output=True, text=True, check=True)

            bandwidth = (
                int(v_br.replace("k", "")) * 1000 + int(a_br.replace("k", "")) * 1000
            )
            master_lines.append(
                f'#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={lad_w}x{lad_h},NAME="{name}"'
            )
            master_lines.append(f"{name}/{playlist_name}")

            rendition_outputs.append(
                {
                    "name": name,
                    "width": lad_w,
                    "height": lad_h,
                    "playlist": f"{name}/{playlist_name}",
                }
            )

        # Write master playlist
        master_path = os.path.join(output_dir, "master.m3u8")
        with open(master_path, "w", encoding="utf-8") as f:
            f.write("\n".join(master_lines) + "\n")

        logger.info(f"Generated ABR HLS ladder master playlist at {master_path}")
        return {
            "master_playlist": master_path,
            "renditions": rendition_outputs,
            "duration": probe["duration"],
            "is_encrypted": True,
            "key_info_file": key_info_file,
        }

    def generate_storyboard_sprites(
        self,
        input_path: str,
        output_dir: str,
        interval_seconds: int = 5,
        thumb_w: int = 160,
        thumb_h: int = 90,
        cols: int = 10,
        rows: int = 10,
    ) -> Dict[str, Any]:
        """
        Generate tiled JPEG sprite sheets and a WebVTT timeline preview cue file
        for player scrubber hover thumbnails.
        """
        if not self.is_available():
            raise RuntimeError("ffmpeg is not installed on system")

        os.makedirs(output_dir, exist_ok=True)
        probe = self.probe_video(input_path)
        total_duration = probe["duration"]
        if total_duration <= 0:
            return {"vtt_file": None, "cues": 0}

        thumbs_per_sheet = cols * rows
        sprite_pattern = os.path.join(output_dir, "sprite_%03d.jpg")

        # Extract frames at interval_seconds into tiled 10x10 sprites
        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-i",
            input_path,
            "-vf",
            f"fps=1/{interval_seconds},scale={thumb_w}:{thumb_h},tile={cols}x{rows}",
            "-q:v",
            "3",
            sprite_pattern,
        ]
        logger.info(f"Generating storyboard sprites for {input_path}")
        subprocess.run(cmd, capture_output=True, text=True, check=True)

        # Generate WebVTT cue list
        vtt_lines = ["WEBVTT", ""]
        current_time = 0.0
        cue_idx = 0

        def _fmt_vtt_time(seconds: float) -> str:
            h = int(seconds // 3600)
            m = int((seconds % 3600) // 60)
            s = int(seconds % 60)
            ms = int(round((seconds - int(seconds)) * 1000))
            return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

        while current_time < total_duration:
            sheet_idx = cue_idx // thumbs_per_sheet + 1
            pos_in_sheet = cue_idx % thumbs_per_sheet
            x_idx = pos_in_sheet % cols
            y_idx = pos_in_sheet // cols

            x = x_idx * thumb_w
            y = y_idx * thumb_h

            start_t = _fmt_vtt_time(current_time)
            end_time = min(total_duration, current_time + interval_seconds)
            end_t = _fmt_vtt_time(end_time)

            sprite_filename = f"sprite_{sheet_idx:03d}.jpg"
            vtt_lines.append(f"{start_t} --> {end_t}")
            vtt_lines.append(f"{sprite_filename}#xywh={x},{y},{thumb_w},{thumb_h}")
            vtt_lines.append("")

            current_time = end_time
            cue_idx += 1

        vtt_path = os.path.join(output_dir, "storyboard.vtt")
        with open(vtt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(vtt_lines))

        logger.info(f"Generated storyboard WebVTT with {cue_idx} cues at {vtt_path}")
        return {
            "vtt_file": vtt_path,
            "cues": cue_idx,
            "interval_seconds": interval_seconds,
        }


ffmpeg_service = FFmpegService()
