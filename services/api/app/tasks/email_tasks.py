"""
Celery tasks for asynchronous email delivery.

Replaces the TODO stubs in notification_service.py with actual Celery-based
background email sending. Uses the existing EmailService for SMTP delivery
with retry logic.

Usage from notification_service.py:
    from app.tasks.email_tasks import send_notification_email

    send_notification_email.delay(
        to_email="user@example.com",
        subject="New Notification",
        text_body="You have a new notification",
        html_body="<p>You have a new notification</p>",
        notification_id=123,
    )
"""

import logging
from typing import Optional

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 1 minute between retries
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    name="app.tasks.email_tasks.send_notification_email",
)
def send_notification_email(
    self,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
    notification_id: Optional[int] = None,
):
    """
    Send a notification email via SMTP asynchronously.

    Args:
        to_email: Recipient email address.
        subject: Email subject line.
        text_body: Plain-text email body.
        html_body: Optional HTML email body.
        notification_id: Optional notification ID for logging/delivery tracking.

    The task auto-retries on failure up to 3 times with exponential backoff.
    On final failure, the error is logged and the notification delivery status
    is marked as FAILED in the database.
    """
    task_id = self.request.id
    logger.info(
        f"Email task {task_id}: Sending to {to_email}, "
        f"notification_id={notification_id}"
    )

    from app.core.async_bridge import run_async_in_worker

    return run_async_in_worker(
        _do_send_notification_email(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            notification_id=notification_id,
            task_id=task_id,
        )
    )


async def _do_send_notification_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
    notification_id: Optional[int] = None,
    task_id: Optional[str] = None,
) -> dict:
    """
    Internal async implementation that uses the EmailService for SMTP delivery.

    Also updates the NotificationDelivery record status in the database.
    """
    from app.services.email_service import EmailService
    from app.core.prisma import prisma
    from datetime import datetime, timezone

    email_service = EmailService()

    # Check SMTP configuration
    if not email_service.check_smtp_config():
        logger.warning(
            f"Email task {task_id}: SMTP not configured. "
            f"Skipping email to {to_email}."
        )
        if notification_id:
            try:
                await prisma.notificationdelivery.update_many(
                    where={
                        "notificationId": notification_id,
                        "channel": "EMAIL",
                    },
                    data={
                        "status": "FAILED",
                        "errorMessage": "SMTP not configured",
                        "failedAt": datetime.now(timezone.utc),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to update delivery status: {e}")
        return {"status": "skipped", "reason": "smtp_not_configured"}

    # Send the email
    try:
        await email_service.send_email_with_retry(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body or "",
        )
        logger.info(f"Email task {task_id}: Successfully sent to {to_email}")

        # Mark delivery as SENT in the database
        if notification_id:
            try:
                await prisma.notificationdelivery.update_many(
                    where={
                        "notificationId": notification_id,
                        "channel": "EMAIL",
                    },
                    data={
                        "status": "SENT",
                        "sentAt": datetime.now(timezone.utc),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to update delivery status to SENT: {e}")

        return {"status": "sent", "to": to_email}

    except Exception as e:
        # Mark delivery as FAILED in the database
        if notification_id:
            try:
                await prisma.notificationdelivery.update_many(
                    where={
                        "notificationId": notification_id,
                        "channel": "EMAIL",
                    },
                    data={
                        "status": "FAILED",
                        "errorMessage": str(e)[:500],
                        "failedAt": datetime.now(timezone.utc),
                    },
                )
            except Exception as db_err:
                logger.error(f"Failed to update delivery status to FAILED: {db_err}")

        raise


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    name="app.tasks.email_tasks.send_onboarding_welcome_d0",
)
def send_onboarding_welcome_d0(self, user_id: int):
    _do_send_onboarding_welcome(user_id, "welcome")


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    name="app.tasks.email_tasks.send_onboarding_welcome_d1",
)
def send_onboarding_welcome_d1(self, user_id: int):
    _do_send_onboarding_welcome(user_id, "welcome_d1")


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    name="app.tasks.email_tasks.send_onboarding_welcome_d3",
)
def send_onboarding_welcome_d3(self, user_id: int):
    _do_send_onboarding_welcome(user_id, "welcome_d3")


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    name="app.tasks.email_tasks.send_onboarding_welcome_d7",
)
def send_onboarding_welcome_d7(self, user_id: int):
    _do_send_onboarding_welcome(user_id, "welcome_d7")


def _do_send_onboarding_welcome(user_id: int, email_type: str) -> dict:
    from app.core.async_bridge import run_async_in_worker

    return run_async_in_worker(_async_send_onboarding_welcome(user_id, email_type))


async def _async_send_onboarding_welcome(user_id: int, email_type: str) -> dict:
    from app.core.prisma import prisma
    from app.core.config import setting
    from app.services.email_templates import render_email
    from app.services.email_service import EmailService

    user = await prisma.user.find_unique(
        where={"id": user_id}, include={"userSettings": True}
    )
    if not user:
        logger.warning(f"User {user_id} not found for {email_type} email")
        return {"status": "skipped", "reason": "user_not_found"}

    name = user.fullName or user.email.split("@")[0] if user.email else "there"
    # Locale lives on UserSettings, not User (User has no `locale` column).
    locale = (user.userSettings.language if user.userSettings else None) or "en"
    frontend_url = setting.FRONTEND_URL.rstrip("/")
    support_url = f"{frontend_url}/support"

    subject, text_body, html_body = render_email(
        email_type,
        locale=locale,
        recipient_email=user.email or "",
        name=name,
        url=frontend_url,
        support_url=support_url,
    )

    email_service = EmailService()
    if not email_service.check_smtp_config():
        logger.warning(
            f"SMTP not configured, skipping {email_type} email for user {user_id}"
        )
        return {"status": "skipped", "reason": "smtp_not_configured"}

    await email_service.send_email_with_retry(
        to_email=user.email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
    logger.info(f"{email_type} email sent to user {user_id} ({user.email})")
    return {"status": "sent", "to": user.email}
