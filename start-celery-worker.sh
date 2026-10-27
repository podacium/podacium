#!/bin/bash
cd /opt/podacium/services/api

if [ -f /opt/podacium/.env.prod ]; then
  set -a
  source /opt/podacium/.env.prod
  set +a
elif [ -f /opt/podacium/.env ]; then
  set -a
  source /opt/podacium/.env
  set +a
fi

export DB_HOST=127.0.0.1
export REDIS_HOST=127.0.0.1

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://${DB_USER:-podacium}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-podacium}?schema=public"
fi

export PRISMA_PY_DEBUG_GENERATOR=1
export MALLOC_TRIM_THRESHOLD_=100000
export PYTHONUNBUFFERED=1

CELERY_BIN="/opt/podacium/services/api/venv312/bin/celery"
exec "$CELERY_BIN" -A app.core.celery.celery_app worker -l info -c 2 -Q celery,heavy_processing,notifications_high,notifications_default
