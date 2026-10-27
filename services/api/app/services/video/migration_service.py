# services/api/app/services/video/migration_service.py
"""
Video Asset Migration Service.

Enables non-destructive, single-lesson or bulk migration of video assets
from legacy storage (e.g. Supabase, legacy S3) to a targeted modern video provider strategy
(e.g., Bunny Stream, Cloudflare Stream, or AWS S3+CloudFront).
"""

import logging
from typing import Optional, Dict, Any

from app.core.prisma import prisma
from app.services.video.factory import VideoProviderFactory

logger = logging.getLogger(__name__)


class VideoMigrationService:
    """Service to handle migrating lesson video assets between providers."""

    async def migrate_lesson_video(
        self,
        lesson_id: str,
        target_provider_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Migrates a lesson's video asset to the specified target provider
        (or active provider if none specified).
        Updates the lesson's storageProvider, videoUrl, hlsPath, and transcodingStatus.
        """
        lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
        if not lesson:
            raise ValueError(f"Lesson '{lesson_id}' not found")

        source_url = lesson.videoUrl or lesson.hlsPath
        if not source_url:
            raise ValueError(
                f"Lesson '{lesson_id}' does not have an existing video URL to migrate"
            )

        previous_provider = lesson.storageProvider or "supabase"

        # Determine target provider
        if target_provider_name:
            target_provider = VideoProviderFactory.get_provider(target_provider_name)
        else:
            target_provider = await VideoProviderFactory.get_active_provider()

        await target_provider.initialize()

        logger.info(
            f"Migrating lesson '{lesson_id}' video from {previous_provider} to {target_provider.provider_name}"
        )

        # Execute migration logic per provider
        # For remote asset transfer, submit transcode job or direct import
        # Initiate migration on target provider
        job_id = await target_provider.submit_transcode_job(
            raw_path_or_id=source_url,
            lesson_id=lesson_id,
        )

        if target_provider.provider_name in ("bunny", "cloudflare"):
            new_hls_path = f"{job_id}/playlist.m3u8"
        else:
            new_hls_path = f"hls/{lesson_id}/index.m3u8"
        transcode_status = "processing"

        # Dispatch background Celery task to monitor transcoding status
        try:
            from app.tasks.video_tasks import check_transcode_status

            check_transcode_status.delay(job_id, lesson_id)
        except Exception as celery_err:
            logger.warning(
                f"Failed to dispatch Celery transcode check task: {celery_err}"
            )

        # Update lesson record in Prisma DB with new provider stamp
        updated_lesson = await prisma.lesson.update(
            where={"id": lesson_id},
            data={
                "storageProvider": target_provider.provider_name,
                "hlsPath": new_hls_path,
                "transcodingStatus": transcode_status,
            },
        )

        return {
            "success": True,
            "lesson_id": lesson_id,
            "previous_provider": previous_provider,
            "target_provider": target_provider.provider_name,
            "hls_path": updated_lesson.hlsPath,
            "transcoding_status": updated_lesson.transcodingStatus,
        }


video_migration_service = VideoMigrationService()
