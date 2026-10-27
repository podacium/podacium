"""Celery task to migrate a single lesson's video from Supabase to AWS S3 + HLS."""

import logging
import httpx
from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import prisma, connect_prisma, disconnect_prisma
from app.tasks.video_tasks import check_transcode_status

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.video_tasks.migrate_lesson_to_aws")
def migrate_lesson_to_aws(lesson_id: str):
    """Download video from Supabase signed URL, upload to S3, trigger transcoding."""
    import os
    from supabase import create_client

    async def _migrate():
        try:
            await connect_prisma()
            lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
            if not lesson or not lesson.videoUrl:
                logger.warning(f"Lesson {lesson_id} has no video to migrate")
                return
            if lesson.storageProvider == "aws":
                logger.info(f"Lesson {lesson_id} already on AWS")
                return

            # Get signed URL from Supabase
            supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_STORAGE_KEY")
            if not supabase_url or not supabase_key:
                logger.error("Supabase storage credentials not configured")
                return

            sb = create_client(supabase_url, supabase_key)
            file_path = lesson.videoUrl
            if file_path.startswith("http"):
                logger.info(f"Lesson {lesson_id} video is external URL, skipping")
                return

            signed = sb.storage.from_("Lesson").create_signed_url(file_path, 3600)
            download_url = signed.get("signedURL") or signed.get("signedUrl")
            if not download_url:
                logger.error(f"Failed to get signed URL for {file_path}")
                return

            # Download video
            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.get(download_url)
                resp.raise_for_status()
                content = resp.content

            # Upload to S3 and transcode
            from app.services.aws_video_service import aws_video_service

            filename = file_path.split("/")[-1] or "video.mp4"
            result = await aws_video_service.upload_video(content, filename, lesson_id)
            raw_path = result["raw_path"]

            job_id = aws_video_service.submit_transcode_job(raw_path, lesson_id)

            await prisma.lesson.update(
                where={"id": lesson_id},
                data={
                    "storageProvider": "aws",
                    "rawPath": raw_path,
                    "transcodingStatus": "processing",
                },
            )

            # Start polling
            check_transcode_status.delay(job_id, lesson_id)
            logger.info(f"Migration started for lesson {lesson_id}: job {job_id}")

        finally:
            await disconnect_prisma()

    run_async_in_worker(_migrate())
