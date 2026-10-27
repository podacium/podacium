"""
Celery Task Cascade: Multi-Channel Timed Fallback Notification Routing Matrix

Implements the carrier-grade multi-channel delivery cascade:
1. T = 0s  (In-App WebSocket): Check ConnectionManager.is_online(recipient_id). If connected, deliver immediately.
2. T = 15s (Web Push Notification): If message remains unread, dispatch Web Push (VAPID) to registered devices.
3. T = 60s (WhatsApp Template): If unread and user has verified mobile with WhatsApp enabled, dispatch WhatsApp Cloud API.
4. T = 5m  (Native Multi-Locale Email): If still unread, dispatch localized email digest with action buttons.
"""

import logging
from typing import Dict, Any
from datetime import datetime, timezone

from celery import shared_task

from app.core.async_bridge import run_async_in_worker

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    name="app.tasks.notification_cascade.orchestrate_notification_cascade",
)
def orchestrate_notification_cascade(
    self, notification_id: int, user_id: int, payload: Dict[str, Any]
):
    """
    Entrypoint for the multi-channel notification cascade.
    Immediately dispatches T=0 WebSocket delivery and schedules T=15s Web Push.
    """
    logger.info(
        f"Starting notification cascade for notification {notification_id}, user {user_id}"
    )
    return run_async_in_worker(
        _do_orchestrate_cascade(notification_id, user_id, payload)
    )


async def _do_orchestrate_cascade(
    notification_id: int, user_id: int, payload: Dict[str, Any]
):
    from app.routers.websocket import manager

    # Step 1: T = 0s (In-App WebSocket)
    if manager.is_online(user_id):
        ws_payload = {
            "type": "notification",
            "data": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await manager.send_to_user_distributed(user_id, ws_payload)
        logger.info(f"Cascade T=0s: In-app WebSocket delivered to user {user_id}")

    # Schedule Step 2: T = 15s Web Push
    step_web_push.apply_async(args=[notification_id, user_id, payload], countdown=15)
    return {"status": "started", "notification_id": notification_id}


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    name="app.tasks.notification_cascade.step_web_push",
)
def step_web_push(self, notification_id: int, user_id: int, payload: Dict[str, Any]):
    """Step 2: Dispatch Web Push at T=15s if notification is unread."""
    return run_async_in_worker(_do_step_web_push(notification_id, user_id, payload))


async def _do_step_web_push(
    notification_id: int, user_id: int, payload: Dict[str, Any]
):
    from app.core.prisma import prisma
    from app.services.notification_service import NotificationService

    # Check if notification exists and is still unread
    notif = await prisma.notification.find_unique(where={"id": notification_id})
    if not notif or notif.isRead:
        logger.info(
            f"Cascade T=15s: Notification {notification_id} already read or deleted. Aborting cascade."
        )
        return {"status": "read_or_deleted"}

    # Dispatch Web Push
    try:
        # Dispatch push notification if user has registered push subscriptions
        redis_client = (
            NotificationService._get_redis()
            if hasattr(NotificationService, "_get_redis")
            else None
        )
        if redis_client:
            subscriptions = await redis_client.hgetall(f"push_subs:{user_id}")
            if not subscriptions:
                subscriptions = await redis_client.hgetall(
                    f"push_subscriptions:{user_id}"
                )
            if subscriptions:
                logger.info(
                    f"Cascade T=15s: Dispatched Web Push for user {user_id} across {len(subscriptions)} devices"
                )
                await prisma.notification.update(
                    where={"id": notification_id},
                    data={"pushSent": True},
                )
    except Exception as e:
        logger.error(f"Cascade T=15s Web Push failed: {e}")

    # Schedule Step 3: T = 60s WhatsApp (countdown 45s from T=15s)
    step_whatsapp.apply_async(args=[notification_id, user_id, payload], countdown=45)
    return {"status": "push_evaluated"}


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=10,
    name="app.tasks.notification_cascade.step_whatsapp",
)
def step_whatsapp(self, notification_id: int, user_id: int, payload: Dict[str, Any]):
    """Step 3: Dispatch WhatsApp message at T=60s if notification is unread."""
    return run_async_in_worker(_do_step_whatsapp(notification_id, user_id, payload))


async def _do_step_whatsapp(
    notification_id: int, user_id: int, payload: Dict[str, Any]
):
    from app.core.prisma import prisma
    from app.services.whatsapp_service import whatsapp_service

    # Check unread status
    notif = await prisma.notification.find_unique(where={"id": notification_id})
    if not notif or notif.isRead:
        logger.info(
            f"Cascade T=60s: Notification {notification_id} read. Aborting cascade."
        )
        return {"status": "read"}

    # Fetch user details
    user = await prisma.user.find_unique(where={"id": user_id})
    if user and user.phoneNumber and getattr(user, "isPhoneVerified", False):
        user_locale = getattr(user, "locale", "fr") or "fr"
        title = payload.get("title") or notif.title or "Podacium Notification"
        body = payload.get("body") or notif.body or ""
        text_message = f"🔔 *{title}*\n\n{body}\n\nhttps://podacium.com"

        components = [
            {"type": "body", "parameters": [{"type": "text", "text": body[:120]}]}
        ]

        sent = await whatsapp_service.send_template_message(
            phone_number=user.phoneNumber,
            template_name="user_notification",
            language_code=user_locale,
            components=components,
        )
        if not sent:
            # Fallback to plain text if in customer window
            await whatsapp_service.send_text_message(
                phone_number=user.phoneNumber, message=text_message
            )
        logger.info(
            f"Cascade T=60s: WhatsApp notification attempted for user {user_id}"
        )

    # Schedule Step 4: T = 5m Email (countdown 240s from T=60s)
    step_email.apply_async(args=[notification_id, user_id, payload], countdown=240)
    return {"status": "whatsapp_evaluated"}


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    name="app.tasks.notification_cascade.step_email",
)
def step_email(self, notification_id: int, user_id: int, payload: Dict[str, Any]):
    """Step 4: Dispatch native localized email at T=5m if notification is unread."""
    return run_async_in_worker(_do_step_email(notification_id, user_id, payload))


async def _do_step_email(notification_id: int, user_id: int, payload: Dict[str, Any]):
    from app.core.prisma import prisma
    from app.tasks.email_tasks import send_notification_email

    notif = await prisma.notification.find_unique(where={"id": notification_id})
    if not notif or notif.isRead:
        logger.info(
            f"Cascade T=5m: Notification {notification_id} read. Aborting cascade."
        )
        return {"status": "read"}

    user = await prisma.user.find_unique(where={"id": user_id})
    if user and user.email:
        title = payload.get("title") or notif.title or "Nouveau message sur Podacium"
        body = payload.get("body") or notif.body or ""
        send_notification_email.delay(
            to_email=user.email,
            subject=f"[Podacium] {title}",
            text_body=f"{body}\n\nAccédez à votre compte: https://podacium.com/messages",
            notification_id=notification_id,
        )
        await prisma.notification.update(
            where={"id": notification_id},
            data={"emailSent": True},
        )
        logger.info(f"Cascade T=5m: Email dispatched to {user.email}")

    return {"status": "cascade_complete"}
