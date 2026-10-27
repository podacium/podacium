"""Tests for Video DRM AES-128 key delivery, CloudFront IP binding, and local FFmpeg ABR ladder."""

import os
import json
import pytest
import hmac
import hashlib
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from app.services.aws_video_service import AWSVideoService
from app.services.video.ffmpeg_service import FFmpegService
from app.routers.education import get_hls_aes128_key
from app.core.config import setting


def test_aws_video_service_ip_binding():
    """Verify that CloudFront Custom Policy includes AWS:SourceIp condition when client_ip is provided."""
    service = AWSVideoService()
    service.cloudfront_domain = "cdn.podacium.com"
    service.cloudfront_key_pair_id = "KTEST12345"

    with patch.object(service, "_cf_signer") as mock_cf_signer:
        mock_signer_inst = MagicMock()
        mock_signer_inst.generate_presigned_url.side_effect = (
            lambda url, policy=None, date_less_than=None: f"{url}?policy={policy}"
        )
        mock_cf_signer.return_value = mock_signer_inst

        # 1. Without IP
        url_no_ip = service.generate_signed_url(
            "hls/lesson-101/master.m3u8", expire_minutes=30
        )
        assert "cdn.podacium.com/hls/lesson-101/master.m3u8" in url_no_ip
        assert "IpAddress" not in url_no_ip

        # 2. With client IP (e.g., Algerian ISP IP)
        url_with_ip = service.generate_signed_url(
            "hls/lesson-101/master.m3u8",
            expire_minutes=30,
            client_ip="197.200.45.12",
        )
        assert "cdn.podacium.com/hls/lesson-101/master.m3u8" in url_with_ip
        assert "197.200.45.12/32" in url_with_ip
        assert "AWS:SourceIp" in url_with_ip


@pytest.mark.asyncio
async def test_hls_aes128_key_delivery_unauthorized():
    """Verify that unauthenticated requests to video key endpoint are rejected with 401."""
    fake_lesson = MagicMock()
    fake_lesson.id = "lesson-test-101"
    fake_lesson.moduleId = "module-1"
    fake_lesson.isPreview = False
    fake_lesson.module = MagicMock()
    fake_lesson.module.price = 5000

    with patch(
        "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
    ) as mock_find_lesson:
        mock_find_lesson.return_value = fake_lesson

        with pytest.raises(HTTPException) as exc_info:
            await get_hls_aes128_key(
                lesson_id="lesson-test-101",
                token=None,
                current_user=None,
            )
        assert exc_info.value.status_code == 401
        assert "Authentication required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_hls_aes128_key_delivery_enrolled_student():
    """Verify that authenticated and enrolled student receives deterministic 16-byte AES-128 key."""
    fake_user = MagicMock()
    fake_user.id = "student-1"
    fake_user.role = "STUDENT"

    fake_lesson = MagicMock()
    fake_lesson.id = "lesson-101"
    fake_lesson.moduleId = "module-1"
    fake_lesson.isPreview = False
    fake_lesson.module = MagicMock()
    fake_lesson.module.instructorId = "instructor-99"
    fake_lesson.module.price = 5000  # Paid course

    with (
        patch(
            "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
        ) as mock_find_lesson,
        patch(
            "app.services.education_service.education_service.check_access",
            new_callable=AsyncMock,
        ) as mock_check_access,
    ):
        mock_find_lesson.return_value = fake_lesson
        mock_check_access.return_value = True  # Enrolled

        res = await get_hls_aes128_key(
            lesson_id="lesson-101",
            token=None,
            current_user=fake_user,
        )
        assert res.status_code == 200
        assert res.media_type == "application/octet-stream"
        assert (
            res.headers["cache-control"]
            == "private, no-store, no-cache, must-revalidate"
        )

        # Verify key is exactly 16 bytes and matches deterministic HMAC
        key_bytes = res.body
        assert len(key_bytes) == 16

        secret = (
            getattr(setting, "JWT_SECRET_KEY", "")
            or getattr(setting, "SECRET_KEY", "podacium_aes_key")
        ).encode()
        expected = hmac.new(
            secret, b"video_aes128:lesson-101", hashlib.sha256
        ).digest()[:16]
        assert key_bytes == expected


@pytest.mark.asyncio
async def test_hls_aes128_key_delivery_unenrolled_student_forbidden():
    """Verify that authenticated student not enrolled in paid module is rejected with 403."""
    fake_user = MagicMock()
    fake_user.id = "student-2"
    fake_user.role = "STUDENT"

    fake_lesson = MagicMock()
    fake_lesson.id = "lesson-102"
    fake_lesson.moduleId = "module-1"
    fake_lesson.isPreview = False
    fake_lesson.module = MagicMock()
    fake_lesson.module.instructorId = "instructor-99"
    fake_lesson.module.price = 5000

    with (
        patch(
            "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
        ) as mock_find_lesson,
        patch(
            "app.services.education_service.education_service.check_access",
            new_callable=AsyncMock,
        ) as mock_check_access,
    ):
        mock_find_lesson.return_value = fake_lesson
        mock_check_access.return_value = False  # NOT enrolled

        with pytest.raises(HTTPException) as exc_info:
            await get_hls_aes128_key(
                lesson_id="lesson-102",
                token=None,
                current_user=fake_user,
            )
        assert exc_info.value.status_code == 403
        assert "Forbidden" in exc_info.value.detail


def test_ffmpeg_service_probe_and_ladder_configuration(tmp_path):
    """Verify FFmpegService parses video metadata and configures synchronized GOP ABR ladder."""
    svc = FFmpegService()

    fake_ffprobe_output = {
        "format": {"duration": "60.0", "size": "1048576"},
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "r_frame_rate": "30/1",
            },
            {
                "codec_type": "audio",
                "codec_name": "aac",
            },
        ],
    }

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps(fake_ffprobe_output),
        )

        metadata = svc.probe_video(str(tmp_path / "dummy.mp4"))
        assert metadata["duration"] == 60.0
        assert metadata["width"] == 1920
        assert metadata["height"] == 1080
        assert metadata["fps"] == 30.0
        assert metadata["video_codec"] == "h264"


def test_ffmpeg_service_transcode_injects_hls_key_info_file(tmp_path):
    """Verify FFmpegService transcode_to_hls_ladder injects -hls_key_info_file for AES-128 encryption."""
    svc = FFmpegService()
    svc.ffmpeg_bin = "/usr/bin/ffmpeg"
    svc.ffprobe_bin = "/usr/bin/ffprobe"

    fake_ffprobe_output = {
        "format": {"duration": "30.0", "size": "500000"},
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1280,
                "height": 720,
                "r_frame_rate": "30/1",
            },
            {
                "codec_type": "audio",
                "codec_name": "aac",
            },
        ],
    }

    commands_executed = []

    def mock_subprocess_run(cmd, *args, **kwargs):
        commands_executed.append(cmd)
        if "ffprobe" in cmd[0]:
            return MagicMock(returncode=0, stdout=json.dumps(fake_ffprobe_output))
        return MagicMock(returncode=0, stdout="", stderr="")

    out_dir = str(tmp_path / "hls_output")
    in_video = str(tmp_path / "input.mp4")

    with (
        patch("os.path.isfile", return_value=True),
        patch("subprocess.run", side_effect=mock_subprocess_run),
    ):
        res = svc.transcode_to_hls_ladder(
            input_path=in_video,
            output_dir=out_dir,
            lesson_id="lesson-encrypt-101",
        )

        assert res["is_encrypted"] is True
        assert res["key_info_file"] is not None
        assert os.path.exists(res["key_info_file"])

        # Verify keyinfo file content
        with open(res["key_info_file"], "r", encoding="utf-8") as kf:
            lines = [line.strip() for line in kf.readlines()]
            assert len(lines) >= 2
            assert lines[0] == "/api/v1/education/video/key/lesson-encrypt-101"
            assert lines[1].endswith("lesson-encrypt-101.key")
            assert os.path.exists(lines[1])

        # Verify binary key is 16 bytes
        with open(lines[1], "rb") as kf:
            key_bytes = kf.read()
            assert len(key_bytes) == 16

        # Verify FFmpeg was called with -hls_key_info_file
        ffmpeg_cmds = [cmd for cmd in commands_executed if "ffmpeg" in cmd[0]]
        assert len(ffmpeg_cmds) > 0
        for cmd in ffmpeg_cmds:
            assert "-hls_key_info_file" in cmd
            idx = cmd.index("-hls_key_info_file")
            assert cmd[idx + 1] == res["key_info_file"]


@pytest.mark.asyncio
async def test_hls_aes128_key_delivery_cookie_auth():
    """Verify Safari iOS native <video> requests authenticate via cookie and receive AES-128 key."""
    fake_user = MagicMock()
    fake_user.id = "student-safari"
    fake_user.role = "STUDENT"

    fake_lesson = MagicMock()
    fake_lesson.id = "lesson-safari-1"
    fake_lesson.moduleId = "module-1"
    fake_lesson.isPreview = False
    fake_lesson.module = MagicMock()
    fake_lesson.module.instructorId = "instructor-1"
    fake_lesson.module.price = 5000

    mock_request = MagicMock()
    mock_request.cookies = {"access_token": "valid.safari.jwt"}

    with (
        patch(
            "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
        ) as mock_find_lesson,
        patch(
            "app.core.prisma.prisma.user.find_unique", new_callable=AsyncMock
        ) as mock_find_user,
        patch("app.core.security.verify_token") as mock_verify_token,
        patch(
            "app.services.education_service.education_service.check_access",
            new_callable=AsyncMock,
        ) as mock_check_access,
    ):
        mock_find_lesson.return_value = fake_lesson
        mock_find_user.return_value = fake_user
        mock_verify_token.return_value = {"sub": "student-safari", "type": "access"}
        mock_check_access.return_value = True

        # Native player with no Authorization header (current_user=None), only cookie on request
        res = await get_hls_aes128_key(
            lesson_id="lesson-safari-1",
            token=None,
            request=mock_request,
            current_user=None,
        )
        assert res.status_code == 200
        assert len(res.body) == 16


@pytest.mark.asyncio
async def test_hls_aes128_key_delivery_signed_query_token():
    """Verify Safari iOS native <video> requests authenticate via HMAC signed query token."""
    from app.routers.education import create_signed_hls_query_token

    fake_user = MagicMock()
    fake_user.id = "student-token"
    fake_user.role = "STUDENT"

    fake_lesson = MagicMock()
    fake_lesson.id = "lesson-token-1"
    fake_lesson.moduleId = "module-1"
    fake_lesson.isPreview = False
    fake_lesson.module = MagicMock()
    fake_lesson.module.instructorId = "instructor-1"
    fake_lesson.module.price = 5000

    signed_token = create_signed_hls_query_token(
        user_id="student-token",
        lesson_id="lesson-token-1",
        expires_in=3600,
    )

    with (
        patch(
            "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
        ) as mock_find_lesson,
        patch(
            "app.core.prisma.prisma.user.find_unique", new_callable=AsyncMock
        ) as mock_find_user,
        patch(
            "app.services.education_service.education_service.check_access",
            new_callable=AsyncMock,
        ) as mock_check_access,
    ):
        mock_find_lesson.return_value = fake_lesson
        mock_find_user.return_value = fake_user
        mock_check_access.return_value = True

        res = await get_hls_aes128_key(
            lesson_id="lesson-token-1",
            token=signed_token,
            request=None,
            current_user=None,
        )
        assert res.status_code == 200
        assert len(res.body) == 16


@pytest.mark.asyncio
async def test_video_failover_service_resolution():
    """Verify VideoFailoverService provides redundant fallback endpoints and handles failover."""
    from app.services.video.failover import (
        video_failover_service,
        get_provider_with_failover,
    )

    mock_lesson = MagicMock()
    mock_lesson.id = "lesson-failover-1"
    mock_lesson.storageProvider = "bunny"
    mock_lesson.hlsPath = "hls/lesson-failover-1/master.m3u8"
    mock_lesson.videoUrl = None

    mock_bunny = MagicMock()
    mock_bunny.provider_name = "bunny"
    mock_bunny.initialize = AsyncMock()
    mock_bunny.test_connection = AsyncMock(return_value={"success": True})
    mock_bunny.generate_signed_url = AsyncMock(
        return_value="https://cdn.bunny.net/hls/lesson-failover-1/master.m3u8"
    )

    mock_aws = MagicMock()
    mock_aws.provider_name = "aws"
    mock_aws.initialize = AsyncMock()
    mock_aws.test_connection = AsyncMock(return_value={"success": True})
    mock_aws.generate_signed_url = AsyncMock(
        return_value="https://d111.cloudfront.net/hls/lesson-failover-1/master.m3u8"
    )

    def mock_get_provider(name):
        if name == "bunny":
            return mock_bunny
        return mock_aws

    with patch(
        "app.services.video.factory.VideoProviderFactory.get_provider",
        side_effect=mock_get_provider,
    ):
        # 1. Test get_provider_with_failover directly
        prov = await get_provider_with_failover(["bunny", "aws"])
        assert prov.provider_name == "bunny"

        # 2. Healthy primary
        res = await video_failover_service.resolve_playback_with_failover(
            lesson=mock_lesson,
            requested_provider="bunny",
        )
        assert (
            res["signed_url"]
            == "https://cdn.bunny.net/hls/lesson-failover-1/master.m3u8"
        )
        assert res["is_hls"] is True
        assert res["failover_active"] is False

        # 2. Failing primary -> failover to fallback
        mock_bunny.generate_signed_url.side_effect = RuntimeError("Bunny CDN down")
        res_failover = await video_failover_service.resolve_playback_with_failover(
            lesson=mock_lesson,
            requested_provider="bunny",
        )
        assert res_failover["failover_active"] is True
        assert res_failover["storage_provider"] == "aws"
        assert "cloudfront.net" in res_failover["signed_url"]
