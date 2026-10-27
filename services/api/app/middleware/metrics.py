"""
Prometheus metrics middleware.

Exposes /metrics endpoint with:
- HTTP request count (by method, path, status)
- HTTP request duration histogram
- Active requests gauge
- Business-level metrics (signups, payments, lessons, active users)
- Celery task duration histogram
- Payment flow duration histogram
"""
from prometheus_client import Counter, Gauge, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

# Create instrumentator instance (configured in main.py)
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=False,
    excluded_handlers=["/health", "/healthz", "/metrics"],
    env_var_name="ENABLE_METRICS",
    inprogress_name="http_requests_inprogress",
    inprogress_labels=True,
)

# Business metrics
USER_SIGNUPS = Counter('podacium_user_signups_total', 'Total user signups', ['method'])
PAYMENTS_PROCESSED = Counter('podacium_payments_processed_total', 'Total payments processed', ['status', 'method'])
LESSONS_COMPLETED = Counter('podacium_lessons_completed_total', 'Total lessons completed')
ACTIVE_USERS = Gauge('podacium_active_users', 'Currently active users')

# Celery metrics
CELERY_TASK_DURATION = Histogram(
    'celery_task_duration_seconds',
    'Celery task duration in seconds',
    ['task_name'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0],
)
CELERY_QUEUE_DEPTH = Gauge(
    'celery_queue_depth',
    'Celery queue depth by queue name',
    ['queue'],
)

# Payment flow metrics
PAYMENT_DURATION = Histogram(
    'payment_flow_duration_seconds',
    'Payment flow duration from initiation to webhook confirmation',
    ['provider', 'status'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600],
)
PAYMENT_ATTEMPT = Counter(
    'payment_flow_attempts_total',
    'Payment flow attempts',
    ['provider', 'status'],  # status: initiated, confirmed, failed, disputed
)

# Flywheel / cross-pillar metrics
FLYWHEEL_EDTECH_TO_FREELANCING = Counter(
    'flywheel_edtech_to_freelancing_total',
    'User completed a course then applied to a project'
)
FLYWHEEL_FREELANCING_TO_BI = Counter(
    'flywheel_freelancing_to_bi_total',
    'User completed a project then created a dashboard'
)
FLYWHEEL_PASSPORT_ISSUED = Counter(
    'flywheel_passport_issued_total',
    'Skill passports issued'
)
FLYWHEEL_PASSPORT_UTILIZED = Counter(
    'flywheel_passport_utilized_total',
    'Passports used in proposals'
)
FLYWHEEL_VELOCITY = Histogram(
    'flywheel_conversion_duration_seconds',
    'Time between completing one pillar and starting the next',
    ['from_pillar', 'to_pillar'],
    buckets=[86400, 604800, 2592000, 7776000, 15552000, 31536000],
)
PILLAR_RETENTION_30D = Gauge(
    'pillar_active_users_30d',
    'Users active in last 30 days',
    ['pillar']
)
FLYWHEEL_MAU = Gauge(
    'flywheel_mau',
    'MAU by number of pillars used',
    ['pillars_used']
)

# Live-session infrastructure gauges (B7)
LIVEKIT_ROOMS_ACTIVE = Gauge(
    'livekit_rooms_active',
    'LiveKit rooms currently active (created but not yet closed)'
)
PRISMA_POOL_WAITING_QUERIES = Gauge(
    'prisma_pool_waiting_queries',
    'Prisma queries currently waiting for a database connection'
)
