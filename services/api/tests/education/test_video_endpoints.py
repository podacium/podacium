from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException, status
from app.routers.education import get_video_signed_url, get_video_segment_token


@pytest.mark.asyncio
async def test_get_video_signed_url_hls_lesson_success():
    """Test get_video_signed_url returns enriched metadata for HLS lesson."""
    mock_lesson = MagicMock()
    mock_lesson.id = "lesson-hls-1"
    mock_lesson.moduleId = "module-1"
    mock_lesson.videoUrl = None
    mock_lesson.hlsPath = "hls/lesson-hls-1/index.m3u8"
    mock_lesson.storageProvider = "aws"
    mock_lesson.transcodingStatus = "completed"
    mock_lesson.module = MagicMock()
    mock_lesson.module.instructorId = "inst-1"

    user = MagicMock()
    user.id = "inst-1"
    user.role = "INSTRUCTOR"

    with patch(
        "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
    ) as mock_find:
        mock_find.return_value = mock_lesson
        with patch(
            "app.services.aws_video_service.aws_video_service.generate_signed_url"
        ) as mock_sign:
            mock_sign.return_value = (
                "https://d111.cloudfront.net/hls/lesson-hls-1/index.m3u8?Policy=xyz"
            )

            res = await get_video_signed_url("lesson-hls-1", None, current_user=user)

            assert (
                res["signed_url"]
                == "https://d111.cloudfront.net/hls/lesson-hls-1/index.m3u8?Policy=xyz"
            )
            assert res["is_hls"] is True
            assert res["expires_in"] == 7200
            assert res["storage_provider"] == "aws"
            assert res["transcoding_status"] == "completed"


@pytest.mark.asyncio
async def test_get_video_signed_url_denies_unauthorized_user():
    """Test get_video_signed_url raises HTTP 403 for user without module access."""
    mock_lesson = MagicMock()
    mock_lesson.id = "lesson-hls-1"
    mock_lesson.moduleId = "module-1"
    mock_lesson.videoUrl = "raw/lesson-1/video.mp4"
    mock_lesson.hlsPath = None
    mock_lesson.storageProvider = "aws"
    mock_lesson.transcodingStatus = "completed"
    mock_lesson.module = MagicMock()
    mock_lesson.module.instructorId = "other-instructor"

    user = MagicMock()
    user.id = "student-unauthorized"
    user.role = "STUDENT"

    with patch(
        "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
    ) as mock_find:
        mock_find.return_value = mock_lesson
        with patch(
            "app.services.education_service.education_service.check_access",
            new_callable=AsyncMock,
        ) as mock_access:
            mock_access.return_value = False

            with pytest.raises(HTTPException) as exc_info:
                await get_video_signed_url("lesson-hls-1", None, current_user=user)

            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_get_video_signed_url_not_found():
    """Test get_video_signed_url raises HTTP 404 if lesson does not exist."""
    user = MagicMock()
    user.id = "admin-1"
    user.role = "ADMIN"

    with patch(
        "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
    ) as mock_find:
        mock_find.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await get_video_signed_url("nonexistent-lesson", None, current_user=user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_get_video_segment_token_success():
    """Test get_video_segment_token returns short-lived signed URL for segment file."""
    mock_lesson = MagicMock()
    mock_lesson.id = "lesson-1"
    mock_lesson.moduleId = "module-1"
    mock_lesson.module = MagicMock()
    mock_lesson.module.instructorId = "inst-1"

    user = MagicMock()
    user.id = "inst-1"
    user.role = "INSTRUCTOR"

    with patch(
        "app.core.prisma.prisma.lesson.find_unique", new_callable=AsyncMock
    ) as mock_find:
        mock_find.return_value = mock_lesson
        with patch(
            "app.services.aws_video_service.aws_video_service.generate_segment_token"
        ) as mock_segment:
            mock_segment.return_value = (
                "https://d111.cloudfront.net/hls/lesson-1/720p_0001.ts?Signature=abc"
            )

            res = await get_video_segment_token(
                "lesson-1", "720p_0001.ts", current_user=user
            )
            assert (
                res["signed_url"]
                == "https://d111.cloudfront.net/hls/lesson-1/720p_0001.ts?Signature=abc"
            )
