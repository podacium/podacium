import logging
from app.core.async_bridge import run_async_in_worker
from app.core.celery import celery_app
from app.services.feature_service import feature_service

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.feature_tasks.decay_feature_boosts")
def decay_feature_boosts():
    """Hourly decay of featured boost scores."""
    run_async_in_worker(feature_service.decay_all_boosts())
    logger.info("Feature boosts decayed")


@celery_app.task(name="app.tasks.feature_tasks.expire_featured_items")
def expire_featured_items():
    """Hourly expiry of boosted/featured items past their expiry."""
    run_async_in_worker(feature_service.expire_boosted_items())
    logger.info("Expired featured items cleaned up")


@celery_app.task(name="app.tasks.feature_tasks.anti_gaming_check")
def anti_gaming_check():
    """Check boosted items for low CTR and reduce boost if needed.

    Requires ProjectView/ProjectClick tracking to be active.
    Currently a no-op skeleton until view tracking infrastructure is added.
    """
    logger.info("Anti-gaming check: periodic pass complete")
