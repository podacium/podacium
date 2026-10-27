"""Unit tests for Admin Video Settings API endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.routers.admin import (
    get_admin_video_settings,
    update_admin_video_settings,
    test_admin_video_provider,
    VideoSettingsUpdateRequest,
)


@pytest.mark.asyncio
async def test_get_admin_video_settings(monkeypatch):
    from app.services.system_settings_service import system_settings_service

    monkeypatch.setattr(
        system_settings_service,
        "get_all_settings",
        AsyncMock(
            return_value={
                "video.active_provider": "bunny",
                "video.bunny.library_id": "12345",
            }
        ),
    )
    monkeypatch.setattr(
        system_settings_service,
        "get_audit_logs",
        AsyncMock(return_value=[]),
    )

    admin_user = MagicMock(id="super-admin-1", role="SUPER_ADMIN")
    res = await get_admin_video_settings(admin=admin_user)

    assert res["active_provider"] == "bunny"
    assert res["settings"]["video.bunny.library_id"] == "12345"


@pytest.mark.asyncio
async def test_update_admin_video_settings(monkeypatch):
    from app.services.system_settings_service import system_settings_service

    mock_set = AsyncMock(return_value={})
    monkeypatch.setattr(system_settings_service, "set_setting", mock_set)

    admin_user = MagicMock(id="super-admin-1", role="SUPER_ADMIN")
    payload = VideoSettingsUpdateRequest(
        free_provider="youtube",
        paid_provider="bunny",
        settings={
            "video.cloudflare.account_id": "cf_acc_123",
            "video.cloudflare.api_token": "secret_token",
        },
    )

    res = await update_admin_video_settings(payload=payload, admin=admin_user)

    assert res["success"] is True
    assert res["free_provider"] == "youtube"
    assert res["paid_provider"] == "bunny"
    assert "video.free_provider" in res["updated_keys"]
    assert "video.paid_provider" in res["updated_keys"]
    assert "video.cloudflare.account_id" in res["updated_keys"]


@pytest.mark.asyncio
async def test_test_admin_video_provider(monkeypatch):
    from app.services.video.factory import VideoProviderFactory

    mock_provider = MagicMock()
    mock_provider.test_connection = AsyncMock(
        return_value={
            "success": True,
            "message": "AWS connection verified successfully",
            "latency_ms": 12.5,
        }
    )
    monkeypatch.setattr(
        VideoProviderFactory, "get_provider", lambda name: mock_provider
    )

    admin_user = MagicMock(id="super-admin-1", role="SUPER_ADMIN")
    res = await test_admin_video_provider(provider_name="aws", admin=admin_user)

    assert res["success"] is True
    assert res["provider"] == "aws"
