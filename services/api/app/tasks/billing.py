"""
Celery Task Queue for Webhook Processing with Exponential Backoff & DLQ Persistence.
Guarantees at-least-once asynchronous processing for Chargily and local rail events.
"""

import logging
from typing import Any, Dict

from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.core.prisma import connect_prisma, disconnect_prisma, prisma
from app.generated.prisma import Json

logger = logging.getLogger("podacium.tasks.billing")


@celery_app.task(
    name="app.tasks.billing.process_webhook_event",
    bind=True,
    max_retries=5,
    default_retry_delay=10,
    retry_backoff=True,
    retry_jitter=True,
)
def process_webhook_event(self, event_data: Dict[str, Any]):
    """Process inbound webhook event with async execution, exponential backoff, and DLQ persistence."""
    from app.routers.billing_routers.webhook_router import process_chargily_event

    async def _execute():
        try:
            await connect_prisma()
            await process_chargily_event(event_data)
        finally:
            await disconnect_prisma()

    try:
        run_async_in_worker(_execute())
        return {"status": "PROCESSED", "event_id": event_data.get("id")}
    except Exception as exc:
        attempt = self.request.retries + 1
        logger.error(
            f"Webhook event {event_data.get('id')} processing failed (attempt {attempt}/5): {exc}"
        )

        if attempt >= self.max_retries:
            logger.critical(
                f"Webhook event {event_data.get('id')} permanently failed after {attempt} attempts. Persisting to DLQ."
            )

            # Persist to DLQ in audit log for manual intervention
            async def _write_dlq():
                try:
                    await connect_prisma()
                    await prisma.auditlog.create(
                        data={
                            "eventType": "WEBHOOK_DEAD_LETTER_QUEUE",
                            "entityType": "WebhookEvent",
                            "entityId": str(event_data.get("id") or "unknown"),
                            "metadata": Json(
                                {
                                    "event_data": event_data,
                                    "error": str(exc),
                                    "max_retries": self.max_retries,
                                    "permanent_failure": True,
                                }
                            ),
                        }
                    )
                except Exception as dlq_err:
                    logger.error(f"Failed to persist dead letter log: {dlq_err}")
                finally:
                    await disconnect_prisma()

            try:
                run_async_in_worker(_write_dlq())
            except Exception:
                pass

        raise self.retry(exc=exc)
