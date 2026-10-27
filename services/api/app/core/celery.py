import time as time_module
from celery import Celery
from celery.schedules import crontab
from celery.signals import task_prerun, task_postrun
from app.core.config import setting

# CLI apps use `celery -A app.core.celery` which finds `celery` or `app`.
# Expose both for compatibility.
celery_app = Celery(
    "podacium_tasks",
    broker=setting.CELERY_BROKER_URL,
    backend=setting.CELERY_RESULT_BACKEND,
)
app = celery_app

# Configuration
try:
    from celery.utils.log import LoggingProxy

    if not hasattr(LoggingProxy, "fileno"):
        LoggingProxy.fileno = lambda self: 1  # type: ignore[attr-defined]
except Exception:
    pass

celery_app.conf.update(
    worker_redirect_stdouts=False,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_always_eager=setting.CELERY_TASK_ALWAYS_EAGER,
    broker_connection_retry_on_startup=True,
    worker_max_tasks_per_child=100,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    # Safety net: no single task may occupy a worker slot forever. A task that
    # hangs (e.g. a Prisma engine wait or an unresponsive network peer) used to
    # block the whole pool until the worker was restarted manually. Long-running
    # task types override these limits on their own decorators.
    task_soft_time_limit=6900,
    task_time_limit=7200,
    task_routes={
        "app.tasks.email_tasks.*": {"queue": "notifications_high"},
        "app.tasks.financial_tasks.*": {"queue": "notifications_high"},
        "app.tasks.billing.*": {"queue": "notifications_high"},
        "app.tasks.dispute_tasks.*": {"queue": "notifications_default"},
        "app.tasks.support_tasks.*": {"queue": "notifications_default"},
        "app.tasks.video_tasks.*": {"queue": "heavy_processing"},
        "app.tasks.migrate_video_task.*": {"queue": "heavy_processing"},
        "app.tasks.bi_tasks.*": {"queue": "heavy_processing"},
        "app.tasks.dataset_tasks.*": {"queue": "heavy_processing"},
        "app.tasks.webhook_tasks.*": {"queue": "webhooks_outbound"},
    },
)

from celery.signals import worker_process_init, worker_process_shutdown


@worker_process_init.connect
def on_worker_process_init(**kwargs):
    """Initialize persistent event loop and Prisma client for worker process."""
    try:
        from app.core.async_bridge import get_worker_event_loop, run_async_in_worker
        from app.core.prisma import prisma, set_worker_process_mode

        set_worker_process_mode(True)
        get_worker_event_loop()

        async def _connect_worker_prisma():
            if not prisma.is_connected():
                await prisma.connect()

        run_async_in_worker(_connect_worker_prisma(), timeout=5.0)
    except Exception:
        pass


@worker_process_shutdown.connect
def on_worker_process_shutdown(**kwargs):
    """Cleanly disconnect Prisma when worker process terminates."""
    try:
        from app.core.async_bridge import run_async_in_worker
        from app.core.prisma import disconnect_prisma

        async def _disconnect_worker_prisma():
            await disconnect_prisma(force=True)

        run_async_in_worker(_disconnect_worker_prisma(), timeout=3.0)
    except Exception:
        pass


try:

    @celery_app.after_task_publish.connect
    def record_task_sent(sender=None, **kwargs):
        body = kwargs.get("body", {})
        if isinstance(body, dict):
            body["_sent_at"] = time_module.time()
except AttributeError:
    pass


@task_prerun.connect
def record_task_start(task=None, **kwargs):
    if task:
        task.request._started_at = time_module.time()


@task_postrun.connect
def record_task_duration(task=None, **kwargs):
    if task and hasattr(task.request, "_started_at"):
        try:
            from app.middleware.metrics import CELERY_TASK_DURATION

            elapsed = time_module.time() - task.request._started_at
            CELERY_TASK_DURATION.labels(task_name=task.name).observe(elapsed)
        except Exception:
            pass


# Task Autodiscovery
celery_app.autodiscover_tasks(
    [
        "app.tasks.cleanup_tasks",
        "app.tasks.financial_tasks",
        "app.tasks.education_tasks",
        "app.tasks.video_tasks",
        "app.tasks.migrate_video_task",
        "app.tasks.dataset_tasks",
        "app.tasks.bi_tasks",
        "app.tasks.billing",
        "app.tasks.webhook_tasks",
        "app.tasks.milestone_tasks",
        "app.tasks.oauth_refresh_tasks",
        "app.tasks.support_tasks",
        "app.tasks.dispute_tasks",
        "app.tasks.email_tasks",
        "app.tasks.mail_tasks",
        "app.tasks.refund_tasks",
        "app.tasks.waitlist_tasks",
        "app.tasks.live_session_tasks",
        "app.tasks.feature_tasks",
        "app.tasks.metrics_tasks",
        "app.tasks.reputation_tasks",
    ]
)

# Beat Schedule
celery_app.conf.beat_schedule = {
    "process-scheduled-reports-every-15min": {
        "task": "app.tasks.bi_tasks.process_scheduled_reports",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    "recompute-eigentrust-network-scores-every-6h": {
        "task": "app.tasks.reputation_tasks.recompute_eigentrust_network_scores",
        "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
    },
    "check-milestone-timeouts-every-6h": {
        "task": "app.tasks.milestone_tasks.check_milestone_timeouts",
        "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
    },
    "auto-refresh-oauth-tokens-hourly": {
        "task": "app.tasks.oauth_refresh_tasks.auto_refresh_expiring_tokens",
        "schedule": crontab(minute=10),  # 10 minutes past every hour
    },
    "cleanup-verifications-daily": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_verifications",
        "schedule": crontab(hour=0, minute=0),  # Daily at midnight
    },
    "cleanup-entitlements-hourly": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_entitlements",
        "schedule": crontab(minute=0),  # Hourly
    },
    "cleanup-expired-tokens-daily": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_tokens",
        "schedule": crontab(hour=1, minute=0),  # Daily at 1 AM
    },
    "cleanup-idempotency-keys-daily": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_idempotency_keys",
        "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM
    },
    "process-escrow-releases-quarter-hourly": {
        "task": "app.tasks.financial_tasks.process_scheduled_escrow_releases",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    "reconcile-payouts-hourly": {
        "task": "app.tasks.financial_tasks.reconcile_payout_statuses",
        "schedule": crontab(minute=5),  # 5 minutes past every hour
    },
    "expire-stale-poda-points-daily": {
        "task": "app.tasks.financial_tasks.expire_stale_poda_points",
        "schedule": crontab(hour=3, minute=30),  # Daily at 3:30 AM
    },
    "reconcile-orphaned-sessions-every-5min": {
        "task": "app.tasks.live_session_tasks.reconcile_orphaned_sessions",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    "process-subscription-renewals-hourly": {
        "task": "app.tasks.financial_tasks.process_subscription_renewals",
        "schedule": crontab(minute=30),  # 30 minutes past every hour
    },
    "process-dunning-retries-every-6h": {
        "task": "app.tasks.financial_tasks.process_dunning_retries",
        "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
    },
    # ── Support & CRM ──────────────────────────────────────────────────────
    "check-sla-breaches-every-15min": {
        "task": "app.tasks.support_tasks.check_sla_breaches_task",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    "send-csat-surveys-hourly": {
        "task": "app.tasks.support_tasks.send_csat_surveys_task",
        "schedule": crontab(minute=45),  # :45 every hour
    },
    "auto-close-inactive-tickets-daily": {
        "task": "app.tasks.support_tasks.auto_close_inactive_tickets_task",
        "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM
    },
    # ── Dispute Arbitration ────────────────────────────────────────────────
    "dispute-auto-resolution-every-6h": {
        "task": "app.tasks.dispute_tasks.process_dispute_auto_resolution",
        "schedule": crontab(minute=30, hour="*/6"),  # Every 6 hours at :30
    },
    # ── Waitlist Drip Emails ───────────────────────────────────────────────
    "process-waitlist-drips-daily": {
        "task": "app.tasks.waitlist_tasks.process_waitlist_drips",
        "schedule": crontab(hour=8, minute=0),  # Daily at 8 AM
    },
    # ── Live Sessions ─────────────────────────────────────────────────────
    "send-session-reminders-every-15min": {
        "task": "app.tasks.live_session_tasks.send_session_reminders",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    "process-no-show-refunds-every-30min": {
        "task": "app.tasks.live_session_tasks.process_no_show_refunds",
        "schedule": crontab(minute="*/30"),  # Every 30 minutes
    },
    "expire-replay-access-daily": {
        "task": "app.tasks.live_session_tasks.expire_replay_access",
        "schedule": crontab(hour=4, minute=0),  # Daily at 4 AM
    },
    # ── Feature Boosts & Decay ──────────────────────────────────────────────
    "decay-feature-boosts-hourly": {
        "task": "app.tasks.feature_tasks.decay_feature_boosts",
        "schedule": crontab(minute=0),  # Top of every hour
    },
    "expire-featured-items-hourly": {
        "task": "app.tasks.feature_tasks.expire_featured_items",
        "schedule": crontab(minute=15),  # :15 past every hour
    },
    "anti-gaming-daily": {
        "task": "app.tasks.feature_tasks.anti_gaming_check",
        "schedule": crontab(hour=6, minute=0),  # Daily at 6 AM
    },
    # ── Observability ────────────────────────────────────────────────────
    "record-celery-queue-depth-every-5min": {
        "task": "app.tasks.metrics_tasks.record_celery_queue_depth",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    # ── Corporate Mail Suite Sync ────────────────────────────────────────
    "sync-active-corporate-mail-accounts": {
        "task": "app.tasks.mail_tasks.sync_all_active_mail_accounts",
        "schedule": crontab(minute="*/30"),  # Every 30 minutes
    },
    # ── Executive Pulse & BI ─────────────────────────────────────────────
    "send-morning-executive-briefing-daily-8am": {
        "task": "app.tasks.bi_tasks.send_morning_executive_briefings",
        "schedule": crontab(
            hour=7, minute=0
        ),  # 08:00 AM Africa/Algiers (UTC+1 -> 07:00 UTC)
    },
    "run-bi-dataset-quality-scans": {
        "task": "app.tasks.bi_tasks.run_bi_quality_scans",
        "schedule": crontab(minute=0, hour=3),  # Daily at 03:00 UTC
    },
    "refresh-bi-metric-caches": {
        "task": "app.tasks.bi_tasks.refresh_bi_cache",
        "schedule": crontab(minute=0, hour="*/1"),  # Run hourly
    },
    # ── Video & Tus Staging Maintenance ───────────────────────────────────
    "purge-abandoned-tus-uploads-every-6h": {
        "task": "app.tasks.video_tasks.purge_abandoned_uploads",
        "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
    },
}

# Drop periodic messages that waited too long to be consumed. If the worker is
# down or starved, beat would otherwise enqueue days of duplicate periodic work
# (thousands of stale tasks), and the backlog would replay on recovery. One hour
# is well above the longest period in the schedule and keeps catch-up bounded.
for _beat_entry in celery_app.conf.beat_schedule.values():
    _beat_entry.setdefault("options", {}).setdefault("expires", 3600)

# Mail sync runs every 30 minutes; do not replay a sync trigger that is already
# older than the next tick.
celery_app.conf.beat_schedule["sync-active-corporate-mail-accounts"]["options"][
    "expires"
] = 1500
