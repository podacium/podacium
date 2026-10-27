"""Video CDN failover manager and multi-provider playback resolution."""

import logging
from typing import Any, Dict, List, Optional
from app.services.video.factory import VideoProviderFactory
from app.services.video.base import BaseVideoProvider

logger = logging.getLogger(__name__)


async def get_provider_with_failover(
    preferred_providers: Optional[List[str]] = None,
) -> BaseVideoProvider:
    """
    Retrieve the first healthy video provider from a prioritized list, falling back across providers.
    Delegates to VideoProviderFactory.get_provider_with_failover.
    """
    return await VideoProviderFactory.get_provider_with_failover(preferred_providers)


class VideoFailoverService:
    """Manages CDN failover and fallback playback resolution for resilient video streaming."""

    def __init__(self) -> None:
        self.default_order = ["bunny", "cloudflare", "aws", "supabase"]

    async def get_provider_with_failover(
        self, preferred_providers: Optional[List[str]] = None
    ) -> BaseVideoProvider:
        """Retrieve the first healthy provider from prioritized candidates."""
        return await get_provider_with_failover(preferred_providers)

    async def resolve_playback_with_failover(
        self,
        lesson: Any,
        requested_provider: Optional[str] = None,
        client_ip: Optional[str] = None,
        expire_minutes: int = 120,
    ) -> Dict[str, Any]:
        """
        Resolve primary playback signed URL and generate redundant fallback endpoints
        across alternate providers if the primary CDN/provider experiences failure.
        """
        primary_name = (
            (requested_provider or getattr(lesson, "storageProvider", None) or "aws")
            .lower()
            .strip()
        )

        failover_order = [primary_name] + [
            p for p in self.default_order if p != primary_name
        ]

        active_provider: Optional[BaseVideoProvider] = None
        signed_url: Optional[str] = None
        used_provider_name = primary_name
        fallback_urls: List[Dict[str, str]] = []

        path = (
            getattr(lesson, "hlsPath", None)
            or getattr(lesson, "videoUrl", None)
            or getattr(lesson, "rawPath", None)
        )
        if not path:
            raise ValueError("Lesson has no video")

        # 1. Try to get healthy provider
        try:
            active_provider = await get_provider_with_failover(failover_order)
            used_provider_name = getattr(active_provider, "provider_name", primary_name)
        except Exception as e:
            logger.warning(
                f"Error selecting provider with failover: {e}. Falling back to {primary_name}."
            )
            active_provider = VideoProviderFactory.get_provider(primary_name)
            await active_provider.initialize()

        # 2. Generate signed URL with primary/active provider
        try:
            signed_url = await active_provider.generate_signed_url(
                path, expire_minutes=expire_minutes, client_ip=client_ip
            )
        except Exception as primary_err:
            logger.warning(
                f"Primary provider {used_provider_name} failed to sign URL: {primary_err}. Triggering failover..."
            )
            remaining = [p for p in failover_order if p != used_provider_name]
            fallback_provider = await get_provider_with_failover(remaining)
            used_provider_name = getattr(fallback_provider, "provider_name", "aws")
            signed_url = await fallback_provider.generate_signed_url(
                path, expire_minutes=expire_minutes, client_ip=client_ip
            )

        # 3. Generate redundant fallback endpoints for client-side multi-CDN failover
        for alt_name in self.default_order:
            if alt_name == used_provider_name:
                continue
            try:
                alt_p = VideoProviderFactory.get_provider(alt_name)
                await alt_p.initialize()
                alt_url = await alt_p.generate_signed_url(
                    path, expire_minutes=expire_minutes, client_ip=client_ip
                )
                if alt_url and alt_url != signed_url:
                    fallback_urls.append({"provider": alt_name, "url": alt_url})
            except Exception as alt_err:
                logger.debug(
                    f"Redundant fallback URL generation skipped for {alt_name}: {alt_err}"
                )

        is_hls = bool(
            getattr(lesson, "hlsPath", None) or (signed_url and ".m3u8" in signed_url)
        )

        return {
            "signed_url": signed_url,
            "storage_provider": used_provider_name,
            "is_hls": is_hls,
            "failover_active": used_provider_name != primary_name,
            "fallback_urls": fallback_urls,
        }


video_failover_service = VideoFailoverService()
