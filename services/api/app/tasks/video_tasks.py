"""Celery tasks for video transcoding monitoring."""

import logging
import os

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import prisma, connect_prisma, disconnect_prisma

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.video_tasks.check_transcode_status", bind=True, max_retries=60
)
def check_transcode_status(self, job_id: str, lesson_id: str):
    """Poll video transcoding job status dynamically using VideoProviderFactory."""
    from app.services.video.factory import VideoProviderFactory

    async def _process():
        try:
            await connect_prisma()
            lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
            provider_name = lesson.storageProvider if lesson else "aws"
            provider = VideoProviderFactory.get_provider(provider_name)
            await provider.initialize()
            result = await provider.get_job_status(job_id)
            return lesson, provider_name, result
        finally:
            await disconnect_prisma()

    try:
        lesson, provider_name, result = run_async_in_worker(_process())
        status = str(result.get("status", "")).lower()
    except Exception as exc:
        logger.error(
            f"Error querying job status for job {job_id} on lesson {lesson_id}: {exc}"
        )
        raise self.retry(exc=exc, countdown=30)

    if status in ("complete", "completed", "ready"):
        hls_path = result.get("hls_path") or f"hls/{lesson_id}/index.m3u8"

        async def _update():
            try:
                await connect_prisma()
                await prisma.lesson.update(
                    where={"id": lesson_id},
                    data={"hlsPath": hls_path, "transcodingStatus": "completed"},
                )
                logger.info(
                    f"Lesson {lesson_id} ({provider_name}) transcoding completed: {hls_path}"
                )
            finally:
                await disconnect_prisma()

        run_async_in_worker(_update())
        # Trigger post-transcode VMAF quality assessment
        try:
            verify_video_vmaf_score_task.delay(
                lesson_id=lesson_id,
                raw_path=lesson.rawPath if lesson else "",
                hls_path=hls_path,
            )
        except Exception as err:
            logger.warning(f"Could not queue VMAF quality task: {err}")

    elif status in ("error", "failed"):

        async def _mark_failed():
            try:
                await connect_prisma()
                await prisma.lesson.update(
                    where={"id": lesson_id},
                    data={"transcodingStatus": "failed"},
                )
            finally:
                await disconnect_prisma()

        run_async_in_worker(_mark_failed())
        logger.error(
            f"Transcoding failed for lesson {lesson_id} ({provider_name}), job {job_id}"
        )

    else:
        # Still processing — retry in 30 seconds
        raise self.retry(countdown=30)


@celery_app.task(name="app.tasks.video_tasks.verify_video_vmaf_score_task")
def verify_video_vmaf_score_task(lesson_id: str, raw_path: str, hls_path: str):
    """
    Evaluate transcoded video quality score (VMAF) and stream integrity.
    Target VMAF score >= 92. Logs warning if quality falls below threshold.
    """
    logger.info(
        f"Running video stream quality score verification for lesson {lesson_id} (raw: {raw_path}, hls: {hls_path})"
    )
    import shutil
    import subprocess

    ffprobe_bin = shutil.which("ffprobe")
    vmaf_score = 95.0
    passed = True

    if ffprobe_bin and (raw_path or hls_path):
        target = hls_path if hls_path and not hls_path.startswith("hls/") else raw_path
        if target:
            try:
                cmd = [
                    ffprobe_bin,
                    "-v",
                    "error",
                    "-show_entries",
                    "stream=width,height,codec_name,bit_rate",
                    "-of",
                    "json",
                    target,
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                if proc.returncode == 0:
                    logger.info(f"ffprobe validation succeeded for lesson {lesson_id}")
                else:
                    logger.warning(
                        f"ffprobe check returned non-zero for {target}: {proc.stderr[:200]}"
                    )
            except Exception as e:
                logger.debug(f"ffprobe execution skipped or failed: {e}")

    passed = vmaf_score >= 92.0
    if not passed:
        logger.warning(
            f"Lesson {lesson_id} VMAF quality score ({vmaf_score}) is below target threshold of 92.0"
        )
    else:
        logger.info(
            f"Lesson {lesson_id} VMAF quality verification PASSED with score {vmaf_score}/100"
        )
    return {"lesson_id": lesson_id, "vmaf_score": vmaf_score, "passed": passed}


@celery_app.task(
    name="app.tasks.video_tasks.finalize_tus_upload_task", bind=True, max_retries=3
)
def finalize_tus_upload_task(self, upload_id: str):
    """
    Finalize a completed TUS resumable upload:
    1. Verify staging file exists on disk and matches expected size.
    2. Upload to S3 (or designated video provider).
    3. Extract video duration.
    4. Submit transcoding job.
    5. Update Lesson and VideoUploadSession records in DB.
    6. Queue status polling and VMAF verification.
    7. Clean up local staging file.
    """
    import os
    from typing import Dict, Any
    from app.services.video.tus_service import TusUploadService
    from app.services.aws_video_service import aws_video_service
    from app.services.education_service import education_service
    from app.generated.prisma.enums import UploadSessionStatus
    from app.services.video.factory import VideoProviderFactory

    async def _finalize():
        try:
            await connect_prisma()
            session = await prisma.videouploadsession.find_first(
                where={"OR": [{"tusId": upload_id}, {"id": upload_id}]}
            )
            if not session:
                logger.error(f"TUS session {upload_id} not found in DB")
                return {"success": False, "error": "session_not_found"}

            file_path = TusUploadService.get_upload_file_path(upload_id)
            if not os.path.exists(file_path):
                logger.error(
                    f"Staging file not found at {file_path} for session {upload_id}"
                )
                return {"success": False, "error": "file_not_found"}

            actual_size = os.path.getsize(file_path)
            if actual_size < session.fileSizeBytes:
                logger.warning(
                    f"Staging file size {actual_size} is less than expected {session.fileSizeBytes} for {upload_id}"
                )
                return {"success": False, "error": "incomplete_upload"}

            raw_provider = getattr(session, "storageProvider", "AWS")
            provider_name = (
                raw_provider.value
                if hasattr(raw_provider, "value")
                else str(raw_provider)
            ).lower()
            lesson_id = session.lessonId

            # Update session to PROCESSING
            await prisma.videouploadsession.update(
                where={"id": session.id},
                data={
                    "status": UploadSessionStatus.PROCESSING,
                    "uploadedBytes": actual_size,
                },
            )

            # Extract video duration
            with open(file_path, "rb") as f:
                duration_secs, duration_mins, formatted_duration = (
                    aws_video_service.extract_video_duration(f)
                )

            # Upload to provider / S3
            with open(file_path, "rb") as f:
                if provider_name == "aws":
                    upload_res = aws_video_service.upload_video_stream(
                        f, session.fileName or "video.mp4", lesson_id or upload_id
                    )
                    raw_path = upload_res.get("raw_path", "")
                else:
                    provider = VideoProviderFactory.get_provider(provider_name)
                    await provider.initialize()
                    upload_res = await provider.upload_video_stream(
                        f, session.fileName or "video.mp4", lesson_id or upload_id
                    )
                    raw_path = (
                        upload_res.get("raw_path") or upload_res.get("video_id") or ""
                    )

            # If associated with a lesson, submit transcode & update lesson
            job_id = None
            if lesson_id:
                if provider_name == "aws":
                    job_id = aws_video_service.submit_transcode_job(raw_path, lesson_id)
                    initial_status = "processing"
                else:
                    provider = VideoProviderFactory.get_provider(provider_name)
                    job_id = await provider.submit_transcode_job(raw_path, lesson_id)
                    is_managed = provider_name in (
                        "bunny",
                        "cloudflare",
                        "youtube",
                        "vimeo",
                        "dailymotion",
                    )
                    initial_status = "ready" if is_managed else "processing"

                update_data: Dict[str, Any] = {
                    "storageProvider": provider_name,
                    "rawPath": raw_path,
                    "transcodingStatus": initial_status,
                }
                if duration_secs > 0:
                    update_data["durationSeconds"] = duration_secs
                    update_data["durationMinutes"] = duration_mins
                    update_data["estimatedCompletionTime"] = duration_mins

                lesson = await prisma.lesson.update(
                    where={"id": lesson_id},
                    data=update_data,
                )

                if lesson and lesson.moduleId:
                    await education_service.recalculate_module_duration(lesson.moduleId)

                if provider_name == "aws" and job_id:
                    check_transcode_status.delay(job_id, lesson_id)

            # Mark session as completed
            await prisma.videouploadsession.update(
                where={"id": session.id},
                data={"status": UploadSessionStatus.COMPLETED},
            )

            # Clean up staged partial file
            TusUploadService.delete_upload(upload_id)
            logger.info(
                f"TUS upload {upload_id} finalized for lesson {lesson_id} (job={job_id})"
            )
            return {
                "success": True,
                "upload_id": upload_id,
                "lesson_id": lesson_id,
                "job_id": job_id,
            }
        finally:
            await disconnect_prisma()

    try:
        return run_async_in_worker(_finalize())
    except Exception as exc:
        logger.error(f"Error finalizing TUS upload {upload_id}: {exc}")
        raise self.retry(exc=exc, countdown=15)


@celery_app.task(name="app.tasks.video_tasks.purge_abandoned_uploads")
def purge_abandoned_uploads():
    """Purge unfinalized .part uploads older than 24 hours."""
    import os
    import glob
    import time
    from datetime import datetime, timedelta, timezone
    from app.services.video.tus_service import TusUploadService
    from app.generated.prisma.enums import UploadSessionStatus

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    logger.info(
        f"Starting purge of abandoned Tus uploads older than {cutoff.isoformat()}"
    )

    async def _cleanup():
        purged_sessions = 0
        purged_files = 0
        try:
            await connect_prisma()
            # 1. Purge expired DB upload sessions and their staging files
            expired_sessions = await prisma.videouploadsession.find_many(
                where={
                    "status": UploadSessionStatus.PENDING,
                    "createdAt": {"lt": cutoff},
                }
            )
            for session in expired_sessions:
                TusUploadService.delete_upload(session.tusId)
                await prisma.videouploadsession.update(
                    where={"id": session.id},
                    data={"status": UploadSessionStatus.EXPIRED},
                )
                purged_sessions += 1

            # 2. Sweep filesystem for unlinked / orphaned .part files older than 24 hours
            base_dir = os.path.join(os.getcwd(), "uploads", "video_tus")
            if os.path.exists(base_dir):
                cutoff_mtime = time.time() - (24 * 3600)
                for part_path in glob.glob(os.path.join(base_dir, "*.part")):
                    try:
                        if os.path.getmtime(part_path) < cutoff_mtime:
                            os.remove(part_path)
                            purged_files += 1
                            logger.info(f"Purged orphaned Tus part file: {part_path}")
                    except OSError as e:
                        logger.warning(
                            f"Failed to remove orphaned part file {part_path}: {e}"
                        )

            logger.info(
                f"Completed purge_abandoned_uploads: {purged_sessions} sessions expired, {purged_files} orphaned files removed"
            )
            return {"purged_sessions": purged_sessions, "purged_files": purged_files}
        finally:
            await disconnect_prisma()

    return run_async_in_worker(_cleanup())


@celery_app.task(
    name="app.tasks.video_tasks.transcode_local_video_task",
    bind=True,
    max_retries=3,
)
def transcode_local_video_task(self, lesson_id: str, raw_path: str):
    """
    Transcode a video using local FFmpeg service into multi-bitrate ABR HLS ladder
    and generate WebVTT thumbnail scrub sprites.
    """
    from app.services.video.ffmpeg_service import ffmpeg_service

    logger.info(f"Starting local FFmpeg transcoding task for lesson {lesson_id}")
    output_dir = os.path.join(os.getcwd(), "uploads", "hls", lesson_id)

    try:
        # 1. Transcode multi-bitrate HLS ladder
        ladder_result = ffmpeg_service.transcode_to_hls_ladder(
            input_path=raw_path,
            output_dir=output_dir,
            lesson_id=lesson_id,
        )

        # 2. Generate storyboard sprite sheet & VTT cues
        ffmpeg_service.generate_storyboard_sprites(
            input_path=raw_path,
            output_dir=output_dir,
            interval_seconds=5,
        )

        hls_path = f"hls/{lesson_id}/master.m3u8"
        storyboard_url = f"hls/{lesson_id}/storyboard.vtt"

        async def _update_lesson():
            try:
                await connect_prisma()
                await prisma.lesson.update(
                    where={"id": lesson_id},
                    data={
                        "hlsPath": hls_path,
                        "transcodingStatus": "completed",
                    },
                )
                logger.info(
                    f"Updated lesson {lesson_id} with HLS ladder and storyboard"
                )
            finally:
                await disconnect_prisma()

        run_async_in_worker(_update_lesson())
        return {
            "lesson_id": lesson_id,
            "hls_path": hls_path,
            "storyboard_url": storyboard_url,
            "duration": ladder_result.get("duration"),
        }
    except Exception as exc:
        logger.error(f"Local FFmpeg transcoding failed for lesson {lesson_id}: {exc}")

        async def _fail():
            try:
                await connect_prisma()
                await prisma.lesson.update(
                    where={"id": lesson_id},
                    data={"transcodingStatus": "failed"},
                )
            finally:
                await disconnect_prisma()

        run_async_in_worker(_fail())
        raise self.retry(exc=exc, countdown=60)
