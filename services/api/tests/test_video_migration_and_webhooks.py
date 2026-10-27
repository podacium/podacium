# services/api/tests/test_video_migration_and_webhooks.py
"""
Unit tests for Video Asset Migration Service and Webhook Event Receiver.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.video.migration_service import VideoMigrationService


@pytest.mark.asyncio
async def test_migration_service_lesson_not_found():
    service = VideoMigrationService()
    with patch(
        "app.core.prisma.prisma.lesson.find_unique", new=AsyncMock(return_value=None)
    ):
        with pytest.raises(ValueError, match="not found"):
            await service.migrate_lesson_video("nonexistent_id")


@pytest.mark.asyncio
async def test_migration_service_no_video_url():
    service = VideoMigrationService()
    fake_lesson = MagicMock()
    fake_lesson.id = "lesson_1"
    fake_lesson.videoUrl = None
    fake_lesson.hlsPath = None

    with patch(
        "app.core.prisma.prisma.lesson.find_unique",
        new=AsyncMock(return_value=fake_lesson),
    ):
        with pytest.raises(ValueError, match="does not have an existing video URL"):
            await service.migrate_lesson_video("lesson_1")


@pytest.mark.asyncio
async def test_migration_service_success():
    service = VideoMigrationService()

    fake_lesson = MagicMock()
    fake_lesson.id = "lesson_100"
    fake_lesson.videoUrl = (
        "https://supabase.co/storage/v1/object/public/videos/lesson100.mp4"
    )
    fake_lesson.hlsPath = None
    fake_lesson.storageProvider = "supabase"

    fake_updated_lesson = MagicMock()
    fake_updated_lesson.id = "lesson_100"
    fake_updated_lesson.storageProvider = "bunny"
    fake_updated_lesson.hlsPath = "https://vz-12345.b-cdn.net/lesson_100/playlist.m3u8"
    fake_updated_lesson.transcodingStatus = "PROCESSING"

    mock_provider = AsyncMock()
    mock_provider.provider_name = "bunny"
    mock_provider.submit_transcode_job.return_value = {
        "hls_path": "https://vz-12345.b-cdn.net/lesson_100/playlist.m3u8",
        "status": "PROCESSING",
    }

    with (
        patch(
            "app.core.prisma.prisma.lesson.find_unique",
            new=AsyncMock(return_value=fake_lesson),
        ),
        patch(
            "app.core.prisma.prisma.lesson.update",
            new=AsyncMock(return_value=fake_updated_lesson),
        ),
        patch(
            "app.services.video.factory.VideoProviderFactory.get_provider",
            return_value=mock_provider,
        ),
    ):
        result = await service.migrate_lesson_video(
            "lesson_100", target_provider_name="bunny"
        )

        assert result["success"] is True
        assert result["lesson_id"] == "lesson_100"
        assert result["previous_provider"] == "supabase"
        assert result["target_provider"] == "bunny"
        assert result["transcoding_status"] == "PROCESSING"


@pytest.mark.asyncio
async def test_video_webhook_completed():
    fake_lesson = MagicMock()
    fake_lesson.id = "lesson_200"
    fake_lesson.hlsPath = None

    client = TestClient(app)

    with (
        patch(
            "app.core.prisma.prisma.lesson.find_unique",
            new=AsyncMock(return_value=fake_lesson),
        ),
        patch(
            "app.core.prisma.prisma.lesson.update",
            new=AsyncMock(return_value=fake_lesson),
        ),
        patch(
            "app.routers.webhooks_video._verify_webhook_signature",
            new=AsyncMock(return_value=True),
        ),
    ):
        response = client.post(
            "/api/v1/education/video/webhook/bunny",
            json={
                "lesson_id": "lesson_200",
                "status": "COMPLETED",
                "hls_path": "https://vz-12345.b-cdn.net/lesson_200/playlist.m3u8",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["lesson_id"] == "lesson_200"
        assert data["transcoding_status"] == "completed"


@pytest.mark.asyncio
async def test_video_webhook_failed():
    fake_lesson = MagicMock()
    fake_lesson.id = "lesson_201"
    fake_lesson.hlsPath = None

    client = TestClient(app)

    with (
        patch(
            "app.core.prisma.prisma.lesson.find_unique",
            new=AsyncMock(return_value=fake_lesson),
        ),
        patch(
            "app.core.prisma.prisma.lesson.update",
            new=AsyncMock(return_value=fake_lesson),
        ),
        patch(
            "app.routers.webhooks_video._verify_webhook_signature",
            new=AsyncMock(return_value=True),
        ),
    ):
        response = client.post(
            "/api/v1/education/video/webhook/cloudflare",
            json={
                "lesson_id": "lesson_201",
                "status": "FAILED",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["transcoding_status"] == "failed"
