"""Video Provider Factory for instantiating and switching provider strategies."""

import os
import logging
from typing import Dict
from app.services.video.base import BaseVideoProvider
from app.services.video.aws_provider import AWSVideoProvider
from app.services.video.bunny_provider import BunnyStreamVideoProvider
from app.services.video.cloudflare_provider import CloudflareStreamVideoProvider
from app.services.video.youtube_provider import YouTubeVideoProvider
from app.services.video.vimeo_provider import VimeoVideoProvider
from app.services.video.dailymotion_provider import DailymotionVideoProvider
from app.services.video.supabase_provider import SupabaseVideoProvider
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)


class VideoProviderFactory:
    """Factory for obtaining video streaming provider implementations."""

    _instances: Dict[str, BaseVideoProvider] = {}

    @classmethod
    def get_provider(cls, provider_name: str = "aws") -> BaseVideoProvider:
        """Get or instantiate a specific provider by name ('aws', 'bunny', 'cloudflare', 'youtube', 'vimeo', 'dailymotion', 'supabase')."""
        key = (provider_name or "aws").lower().strip()
        if key not in cls._instances:
            if key == "bunny":
                cls._instances[key] = BunnyStreamVideoProvider()
            elif key == "cloudflare":
                cls._instances[key] = CloudflareStreamVideoProvider()
            elif key == "youtube":
                cls._instances[key] = YouTubeVideoProvider()
            elif key == "vimeo":
                cls._instances[key] = VimeoVideoProvider()
            elif key == "dailymotion":
                cls._instances[key] = DailymotionVideoProvider()
            elif key == "supabase":
                cls._instances[key] = SupabaseVideoProvider()
            else:
                cls._instances[key] = AWSVideoProvider()
        return cls._instances[key]

    @classmethod
    async def get_provider_with_failover(
        cls, preferred_providers: list[str] = None
    ) -> BaseVideoProvider:
        """Retrieve the first healthy provider from a prioritized list, falling back across providers."""
        order = preferred_providers or ["bunny", "cloudflare", "aws", "supabase"]
        for name in order:
            try:
                p = cls.get_provider(name)
                await p.initialize()
                status = await p.test_connection()
                if status.get("success", False):
                    return p
            except Exception as e:
                logger.warning(
                    f"Provider {name} failed health check: {e}. Trying fallback..."
                )
        default_p = cls.get_provider("aws")
        await default_p.initialize()
        return default_p

    @classmethod
    async def get_active_provider(cls) -> BaseVideoProvider:
        """Fetch the default active provider specified in SystemSettings ('video.active_provider' or 'video.paid_provider')."""
        active_name = await system_settings_service.get_setting(
            "video.paid_provider",
            await system_settings_service.get_setting(
                "video.active_provider", os.getenv("VIDEO_PROVIDER", "bunny")
            ),
        )
        provider = cls.get_provider(active_name or "bunny")
        await provider.initialize()
        return provider

    @classmethod
    async def get_provider_for_content(
        cls, is_free_tier: bool = False
    ) -> BaseVideoProvider:
        """
        Smart-route video uploads:
        - If content is free tier (free course or free preview lesson): routes to 'video.free_provider' (default: 'youtube')
        - If content is paid tier: routes to 'video.paid_provider' (default: 'bunny')
        """
        if is_free_tier:
            target_name = await system_settings_service.get_setting(
                "video.free_provider", "youtube"
            )
        else:
            target_name = await system_settings_service.get_setting(
                "video.paid_provider",
                await system_settings_service.get_setting(
                    "video.active_provider", os.getenv("VIDEO_PROVIDER", "bunny")
                ),
            )

        provider = cls.get_provider(
            target_name or ("youtube" if is_free_tier else "bunny")
        )
        await provider.initialize()
        return provider


video_provider_factory = VideoProviderFactory()
