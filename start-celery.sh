#!/bin/bash
MODE="${1:-worker}"
cd /opt/podacium/services/api

# Load env file if present
if [ -f /opt/podacium/.env.prod ]; then
  set -a
  source /opt/podacium/.env.prod
  set +a
elif [ -f /opt/podacium/.env ]; then
  set -a
  source /opt/podacium/.env
  set +a
fi

# Override Docker service names with localhost
export DB_HOST=127.0.0.1
export REDIS_HOST=127.0.0.1

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://${DB_USER:-podacium}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-podacium}?schema=public"
fi

export PRISMA_PY_DEBUG_GENERATOR=1
export MALLOC_TRIM_THRESHOLD_=100000
export PYTHONUNBUFFERED=1

CELERY_BIN=""
for path in \
  "/opt/podacium/services/api/venv312/bin/celery" \
  "/opt/podacium/services/api/podacium/bin/celery" \
  "/opt/podacium/services/api/venv/bin/celery" \
  "$(which celery 2>/dev/null)"; do
  if [ -x "$path" ]; then
    CELERY_BIN="$path"
    break
  fi
done

if [ -z "$CELERY_BIN" ]; then
  echo "FATAL: Could not find celery binary!" >&2
  exit 1
fi

if [ "$MODE" = "beat" ]; then
  echo "Starting Celery Beat with $CELERY_BIN..."
  exec "$CELERY_BIN" -A app.core.celery.celery_app beat -l info --schedule=/tmp/celerybeat-schedule
else
  echo "Starting Celery Worker with $CELERY_BIN..."
  exec "$CELERY_BIN" -A app.core.celery.celery_app worker -l info -c 2 -Q celery,heavy_processing,notifications_high,notifications_default
fi
