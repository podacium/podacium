"""Celery tasks for observability metrics collection."""

import logging
from celery import shared_task
from app.core.config import setting

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.metrics_tasks.record_celery_queue_depth")
def record_celery_queue_depth():
    """Query Redis broker for queue depths and expose via Prometheus gauge."""
    try:
        import redis
        from app.middleware.metrics import CELERY_QUEUE_DEPTH

        r = redis.from_url(setting.CELERY_BROKER_URL)
        queues = [
            "celery",
            "celery:celery.pidbox",
        ]
        for q in queues:
            try:
                depth = r.llen(q)
                CELERY_QUEUE_DEPTH.labels(queue=q).set(depth or 0)
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"Failed to record queue depth: {e}")
