"""Asynchronous Video Transcoder Webhook Receiver Router."""

import hmac
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header, status
from app.core.prisma import prisma
from app.services.system_settings_service import system_settings_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/video", tags=["video-webhooks"])


async def _verify_webhook_signature(
    request: Request,
    raw_body: bytes,
    bunny_signature: Optional[str],
    cloudflare_signature: Optional[str],
    vimeo_signature: Optional[str],
) -> bool:
    """Cryptographically verify webhook signatures from Bunny, Cloudflare, or Vimeo."""
    has_any_signature = bool(bunny_signature or cloudflare_signature or vimeo_signature)
    if not has_any_signature:
        logger.warning("Rejecting video webhook: No signature header provided")
        return False

    # 1. Bunny Webhook Signature (SHA256 of secret + body or secret header)
    if bunny_signature:
        bunny_secret = await system_settings_service.get_setting(
            "video.bunny.webhook_secret"
        ) or os.getenv("BUNNY_WEBHOOK_SECRET", "")
        if not bunny_secret:
            logger.warning("Bunny webhook rejected: secret not configured")
            return False
        expected_hash = hashlib.sha256(
            bunny_secret.encode("utf-8") + raw_body
        ).hexdigest()
        if not (
            hmac.compare_digest(bunny_signature, bunny_secret)
            or hmac.compare_digest(bunny_signature, expected_hash)
        ):
            logger.warning("Bunny webhook signature verification failed")
            return False
        return True

    # 2. Cloudflare Stream Webhook Signature (HMAC-SHA256 over time.body)
    if cloudflare_signature:
        cf_secret = await system_settings_service.get_setting(
            "video.cloudflare.webhook_secret"
        ) or os.getenv("CLOUDFLARE_WEBHOOK_SECRET", "")
        if not cf_secret:
            logger.warning("Cloudflare webhook rejected: secret not configured")
            return False
        parts = {}
        for kv in cloudflare_signature.split(","):
            if "=" in kv:
                k, v = kv.split("=", 1)
                parts[k.strip()] = v.strip()
        timestamp = parts.get("time")
        sig1 = parts.get("sig1")
        if not timestamp or not sig1:
            logger.warning("Cloudflare webhook missing time or sig1 in header")
            return False

        try:
            ts_int = int(timestamp)
            now = int(datetime.now(timezone.utc).timestamp())
            if abs(now - ts_int) > 300:
                logger.warning(
                    "Cloudflare webhook timestamp outside 300s replay window"
                )
                return False
        except ValueError:
            logger.warning("Cloudflare webhook invalid timestamp format")
            return False

        to_sign = f"{timestamp}.".encode("utf-8") + raw_body
        expected_sig = hmac.new(
            cf_secret.encode("utf-8"), to_sign, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig1, expected_sig):
            logger.warning("Cloudflare webhook signature verification failed")
            return False
        return True

    # 3. Vimeo Webhook Signature (HMAC-SHA256)
    if vimeo_signature:
        vimeo_secret = await system_settings_service.get_setting(
            "video.vimeo.webhook_secret"
        ) or os.getenv("VIMEO_WEBHOOK_SECRET", "")
        if not vimeo_secret:
            logger.warning("Vimeo webhook rejected: secret not configured")
            return False
        expected_vimeo = hmac.new(
            vimeo_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(vimeo_signature, expected_vimeo):
            logger.warning("Vimeo webhook signature verification failed")
            return False
        return True

    return False


@router.post("/status")
async def receive_video_transcode_webhook(
    request: Request,
    bunny_signature: Optional[str] = Header(None, alias="Bunny-Signature"),
    cloudflare_signature: Optional[str] = Header(
        None, alias="Cloudflare-Webhook-Signature"
    ),
    vimeo_signature: Optional[str] = Header(None, alias="X-Vimeo-Signature"),
):
    """Receive asynchronous transcoding completion webhooks from Bunny, Cloudflare Stream, or Vimeo."""
    raw_body = await request.body()
    is_valid = await _verify_webhook_signature(
        request, raw_body, bunny_signature, cloudflare_signature, vimeo_signature
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook cryptographic signature",
        )

    import json

    try:
        body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Support Vimeo webhook payloads (uri="/videos/123456789", event="video.transcode.completed")
    vimeo_uri = body.get("uri") or (body.get("clip") or {}).get("uri")
    vimeo_id = vimeo_uri.split("/")[-1] if vimeo_uri and "/" in vimeo_uri else None

    video_id = (
        body.get("video_id")
        or body.get("VideoId")
        or body.get("uid")
        or body.get("guid")
        or vimeo_id
    )

    event_type = body.get("event") or ""
    status_str = (body.get("status") or body.get("Status") or "").lower()
    if event_type == "video.transcode.completed":
        status_str = "completed"

    if not video_id:
        logger.warning("Received video webhook without video_id identifier")
        return {"status": "ignored", "reason": "missing_video_id"}

    # Map raw status strings
    normalized_status = "COMPLETED"
    if status_str in ("failed", "error", "5"):
        normalized_status = "FAILED"
    elif status_str in ("processing", "transcoding", "1", "2", "3"):
        normalized_status = "PROCESSING"

    logger.info(f"Webhook update for video {video_id}: status={normalized_status}")

    # Update Lesson records matching this provider asset ID or video URL
    lessons = await prisma.lesson.find_many(
        where={
            "OR": [
                {"rawPath": video_id},
                {"videoUrl": {"contains": video_id}},
                {"hlsPath": {"contains": video_id}},
            ]
        }
    )

    for lesson in lessons:
        await prisma.lesson.update(
            where={"id": lesson.id},
            data={"transcodingStatus": normalized_status.lower()},
        )

    return {
        "status": "processed",
        "video_id": video_id,
        "normalized_status": normalized_status,
        "affected_lessons": len(lessons),
    }


education_webhook_router = APIRouter(
    prefix="/education/video/webhook", tags=["education-video-webhook"]
)


@education_webhook_router.post("/{provider}")
async def receive_education_video_webhook(
    provider: str,
    request: Request,
    bunny_signature: Optional[str] = Header(None, alias="Bunny-Signature"),
    cloudflare_signature: Optional[str] = Header(
        None, alias="Cloudflare-Webhook-Signature"
    ),
    vimeo_signature: Optional[str] = Header(None, alias="X-Vimeo-Signature"),
    webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
):
    """Receive authenticated video provider transcode webhook callbacks."""
    raw_body = await request.body()

    # 1. Check provider-specific signatures
    is_valid_provider = await _verify_webhook_signature(
        request, raw_body, bunny_signature, cloudflare_signature, vimeo_signature
    )

    # 2. Check generic secret / signature if provider signature not matched
    is_valid_secret = False
    if not is_valid_provider:
        secret = (
            await system_settings_service.get_setting("video.webhook_secret")
            or os.getenv("VIDEO_WEBHOOK_SECRET", "")
            or os.getenv("SECRET_KEY", "")
        )
        if secret and webhook_secret and hmac.compare_digest(webhook_secret, secret):
            is_valid_secret = True
        elif secret and webhook_signature:
            expected_sig = hmac.new(
                secret.encode("utf-8"), raw_body, hashlib.sha256
            ).hexdigest()
            if hmac.compare_digest(webhook_signature, expected_sig):
                is_valid_secret = True

    if not (is_valid_provider or is_valid_secret):
        logger.warning(
            f"Rejecting unauthenticated education video webhook for provider '{provider}'"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing webhook cryptographic signature / secret",
        )

    import json

    try:
        body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    lesson_id = body.get("lesson_id")
    status_input = (body.get("status") or "").upper()
    hls_path = body.get("hls_path")

    if not lesson_id:
        raise HTTPException(status_code=400, detail="Missing lesson_id")

    lesson = await prisma.lesson.find_unique(where={"id": lesson_id})
    if not lesson:
        raise HTTPException(status_code=404, detail=f"Lesson {lesson_id} not found")

    transcoding_status = (
        "completed"
        if status_input in ("COMPLETED", "FINISHED", "SUCCESS")
        else "failed"
    )
    update_data: dict = {
        "transcodingStatus": transcoding_status,
    }
    if hls_path and transcoding_status == "completed":
        update_data["hlsPath"] = hls_path

    await prisma.lesson.update(
        where={"id": lesson_id},
        data=update_data,
    )

    return {
        "status": "success",
        "lesson_id": lesson_id,
        "transcoding_status": transcoding_status,
    }
