"""Unit tests for multi-provider video streaming strategy and factory."""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.video.aws_provider import AWSVideoProvider
from app.services.video.bunny_provider import BunnyStreamVideoProvider
from app.services.video.cloudflare_provider import CloudflareStreamVideoProvider
from app.services.video.youtube_provider import YouTubeVideoProvider
from app.services.video.factory import VideoProviderFactory


@pytest.mark.asyncio
async def test_aws_provider_signed_url():
    provider = AWSVideoProvider()
    with patch.object(
        provider._service,
        "generate_signed_url",
        return_value="https://cf.example.com/signed",
    ):
        url = await provider.generate_signed_url("hls/lesson-1/index.m3u8")
        assert url == "https://cf.example.com/signed"


@pytest.mark.asyncio
async def test_bunny_provider_signed_url():
    provider = BunnyStreamVideoProvider()
    provider.cdn_hostname = "vz-12345.b-cdn.net"
    provider.token_auth_key = "test_token_secret"

    url = await provider.generate_signed_url("video-guid-123", expire_minutes=60)
    assert "https://vz-12345.b-cdn.net/video-guid-123/playlist.m3u8?token=" in url
    assert "expires=" in url


@pytest.mark.asyncio
async def test_cloudflare_provider_signed_url():
    provider = CloudflareStreamVideoProvider()
    provider.subdomain = "videodelivery.net"

    url = await provider.generate_signed_url("cf-video-uid-999")
    assert url == "https://videodelivery.net/cf-video-uid-999/manifest/video.m3u8"


@pytest.mark.asyncio
async def test_factory_get_provider():
    aws_inst = VideoProviderFactory.get_provider("aws")
    assert isinstance(aws_inst, AWSVideoProvider)

    bunny_inst = VideoProviderFactory.get_provider("bunny")
    assert isinstance(bunny_inst, BunnyStreamVideoProvider)

    cf_inst = VideoProviderFactory.get_provider("cloudflare")
    assert isinstance(cf_inst, CloudflareStreamVideoProvider)

    # Unknown defaults to AWS
    unknown_inst = VideoProviderFactory.get_provider("unknown_provider")
    assert isinstance(unknown_inst, AWSVideoProvider)


@pytest.mark.asyncio
async def test_factory_get_active_provider(monkeypatch):
    from app.services.system_settings_service import system_settings_service

    monkeypatch.setattr(
        system_settings_service,
        "get_setting",
        AsyncMock(return_value="bunny"),
    )

    active_provider = await VideoProviderFactory.get_active_provider()
    assert isinstance(active_provider, BunnyStreamVideoProvider)


@pytest.mark.asyncio
async def test_factory_get_provider_for_content(monkeypatch):
    from app.services.system_settings_service import system_settings_service

    async def mock_get_setting(key, default=None):
        if key == "video.free_provider":
            return "youtube"
        if key == "video.paid_provider":
            return "bunny"
        return default

    monkeypatch.setattr(system_settings_service, "get_setting", mock_get_setting)

    free_prov = await VideoProviderFactory.get_provider_for_content(is_free_tier=True)
    assert isinstance(free_prov, YouTubeVideoProvider)

    paid_prov = await VideoProviderFactory.get_provider_for_content(is_free_tier=False)
    assert isinstance(paid_prov, BunnyStreamVideoProvider)
    assert paid_prov.provider_name == "bunny"
    assert free_prov.provider_name == "youtube"


@pytest.mark.asyncio
async def test_youtube_provider():
    from app.services.video.youtube_provider import YouTubeVideoProvider

    yt_provider = YouTubeVideoProvider()

    url = await yt_provider.generate_signed_url(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    )
    assert "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1" in url

    yt_inst = VideoProviderFactory.get_provider("youtube")
    assert isinstance(yt_inst, YouTubeVideoProvider)


def test_watched_interval_tracker():
    from app.services.video.interval_tracker import WatchedIntervalTracker

    # Merges overlapping intervals (0-10, 5-15, 20-30 -> 0-15, 20-30 = 25s total)
    intervals = [(0.0, 10.0), (5.0, 15.0), (20.0, 30.0)]
    unique = WatchedIntervalTracker.calculate_unique_watched_seconds(intervals)
    assert unique == 25.0

    res = WatchedIntervalTracker.verify_progress_heartbeat(
        existing_intervals=[(0.0, 100.0)],
        new_start=100.0,
        new_end=110.0,
        duration_seconds=120.0,
        time_elapsed_since_last_beacon=10.0,
    )
    assert res["is_valid"] is True
    assert res["is_completed"] is True  # 110/120 > 90%


def test_heatmap_service():
    from app.services.video.heatmap_service import heatmap_service

    bins = heatmap_service.record_interval_replay("lesson-test-1", 0.0, 50.0, 100.0)
    assert len(bins) == 100
    assert bins[0] == 1
    assert bins[49] == 1
    assert bins[51] == 0

    fetched = heatmap_service.get_lesson_heatmap("lesson-test-1")
    assert fetched == bins


@pytest.mark.asyncio
async def test_vimeo_provider():
    from app.services.video.vimeo_provider import VimeoVideoProvider

    provider = VimeoVideoProvider()

    url = await provider.generate_signed_url("https://vimeo.com/123456789")
    assert url == "https://player.vimeo.com/video/123456789?autopause=0&dnt=1"

    vimeo_inst = VideoProviderFactory.get_provider("vimeo")
    assert isinstance(vimeo_inst, VimeoVideoProvider)

    # delete without access token gracefully returns False
    from unittest.mock import patch

    with (
        patch.dict("os.environ", {"VIMEO_ACCESS_TOKEN": ""}),
        patch(
            "app.services.system_settings_service.system_settings_service.get_setting",
            AsyncMock(return_value=""),
        ),
    ):
        no_token_provider = VimeoVideoProvider()
        res = await no_token_provider.delete_video("123456789")
        assert res is False


@pytest.mark.asyncio
async def test_dailymotion_provider():
    from app.services.video.dailymotion_provider import DailymotionVideoProvider

    provider = DailymotionVideoProvider()

    url = await provider.generate_signed_url("x8abcde")
    assert (
        url
        == "https://www.dailymotion.com/embed/video/x8abcde?ui-highlight=3b82f6&sharing-enable=0"
    )

    dm_inst = VideoProviderFactory.get_provider("dailymotion")
    assert isinstance(dm_inst, DailymotionVideoProvider)

    # delete without access token gracefully returns False
    res = await provider.delete_video("x8abcde")
    assert res is False
