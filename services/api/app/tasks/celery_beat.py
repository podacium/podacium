"""
Celery Beat Periodic Scheduler configuration for Podacium platform.
Unifies all periodic tasks across the ecosystem, aligning with `app.core.celery`:
- Financial reconciliations, escrow releases, dunning
- Daily 08:00 AM Africa/Algiers Morning Executive Briefings
- BI report executions, dataset quality scans, metric cache warmups
- CRM / SLA breach checks, corporate mail sync, maintenance cleanups
"""

import logging
from celery.schedules import crontab
from app.core.celery import celery_app

logger = logging.getLogger(__name__)

# Ensure master schedule is preserved and unified
MASTER_SCHEDULE = getattr(celery_app.conf, "beat_schedule", {}) or {}

# Unified schedule additions & validations
UNIFIED_BEAT_SCHEDULE = {
    **MASTER_SCHEDULE,
    # Explicitly ensure 08:00 AM Africa/Algiers Morning Executive Briefing is registered
    "send-morning-executive-briefing-daily-8am": {
        "task": "app.tasks.bi_tasks.send_morning_executive_briefings",
        "schedule": crontab(
            hour=7, minute=0
        ),  # 08:00 AM Africa/Algiers (UTC+1 -> 07:00 UTC)
    },
    "process-scheduled-reports-every-15min": {
        "task": "app.tasks.bi_tasks.process_scheduled_reports",
        "schedule": crontab(minute="*/15"),
    },
    "run-bi-dataset-quality-scans": {
        "task": "app.tasks.bi_tasks.run_bi_quality_scans",
        "schedule": crontab(minute=0, hour=3),
    },
    "refresh-bi-metric-caches": {
        "task": "app.tasks.bi_tasks.refresh_bi_cache",
        "schedule": crontab(minute=0, hour="*/1"),
    },
    "sync-active-corporate-mail-accounts": {
        "task": "app.tasks.mail_tasks.sync_all_active_mail_accounts",
        "schedule": crontab(minute="*/2"),
    },
}

celery_app.conf.beat_schedule = UNIFIED_BEAT_SCHEDULE

logger.info(
    "Celery Beat schedule successfully unified with %d periodic tasks registered.",
    len(UNIFIED_BEAT_SCHEDULE),
)
