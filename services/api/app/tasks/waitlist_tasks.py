import logging
from datetime import datetime, timedelta

from app.core.async_bridge import run_async_in_worker
from celery import shared_task

logger = logging.getLogger(__name__)

DRIP_SCHEDULE = {
    3: "waitlist_drip_day3",
    7: "waitlist_drip_day7",
    14: "waitlist_drip_day14",
    30: "waitlist_drip_day30",
}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_waitlist_drip(self, entry_id: int, template_key: str):
    run_async_in_worker(_do_send_drip(entry_id, template_key))


async def _do_send_drip(entry_id: int, template_key: str):
    from app.core.prisma import connect_prisma, disconnect_prisma, prisma

    await connect_prisma()
    try:
        entry = await prisma.waitlistentry.find_unique(where={"id": entry_id})
        if not entry or entry.status in ("CONVERTED", "BOUNCED", "UNSUBSCRIBED"):
            return

        from app.services.email_service import email_service
        from app.services.email_templates import render_email

        subject, text_body, html_body = render_email(
            template_key,
            locale=entry.locale or "en",
            recipient_email=entry.email,
            name=entry.fullName,
            referral_code=entry.referralCode,
        )
        sent = await email_service._dispatch(
            template_key, entry.email, subject, text_body, html_body
        )
        if sent:
            await prisma.waitlistentry.update(
                where={"id": entry.id},
                data={"lastDripSentAt": datetime.utcnow()},
            )
    except Exception as e:
        logger.error(f"Failed to send drip {template_key} to entry {entry_id}: {e}")
        raise
    finally:
        await disconnect_prisma()


@shared_task
def process_waitlist_drips():
    run_async_in_worker(_do_process_drips())


async def _do_process_drips():
    from app.core.prisma import connect_prisma, disconnect_prisma, prisma

    await connect_prisma()
    try:
        now = datetime.utcnow()
        for day_offset, template_key in DRIP_SCHEDULE.items():
            cutoff = now - timedelta(days=day_offset)
            next_cutoff = now - timedelta(days=day_offset - 1)

            entries = await prisma.waitlistentry.find_many(
                where={
                    "status": {"in": ["PENDING", "VERIFIED"]},
                    "createdAt": {"gte": cutoff, "lt": next_cutoff},
                    "OR": [
                        {"lastDripSentAt": None},
                        {"lastDripSentAt": {"lt": cutoff}},
                    ],
                }
            )

            for entry in entries:
                send_waitlist_drip.delay(entry.id, template_key)
                logger.info(
                    f"Queued drip {template_key} for entry {entry.id} ({entry.email})"
                )
    finally:
        await disconnect_prisma()
