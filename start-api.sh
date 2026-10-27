#!/bin/bash
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

# Build DATABASE_URL — but only if not already set (e.g. in .env.prod)
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://${DB_USER:-podacium}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-podacium}?schema=public"
fi

# Fix CORS_ORIGINS: if it's a stringified JSON list, convert to proper JSON array string
if [[ "$CORS_ORIGINS" =~ ^\[.*\]$ ]]; then
  CORS_ORIGINS=$(echo "$CORS_ORIGINS" | sed "s/'/\"/g")
fi
export CORS_ORIGINS

# Log connectivity info WITHOUT the password
echo "DB_HOST=$DB_HOST DB_PORT=${DB_PORT:-5432} DB_NAME=${DB_NAME:-podacium} DB_USER=${DB_USER:-podacium}" >&2
echo "CORS_ORIGINS=$CORS_ORIGINS" >&2

# Bypass Prisma engine version mismatch check
export PRISMA_PY_DEBUG_GENERATOR=1
export MALLOC_TRIM_THRESHOLD_=100000
export PYTHONUNBUFFERED=1

# Resolve Uvicorn binary across common virtual environment locations
UVICORN_BIN=""
for path in \
  "/opt/podacium/services/api/podacium/bin/uvicorn" \
  "/opt/podacium/services/api/venv312/bin/uvicorn" \
  "/opt/podacium/services/api/venv/bin/uvicorn" \
  "$(which uvicorn 2>/dev/null)"; do
  if [ -x "$path" ]; then
    UVICORN_BIN="$path"
    break
  fi
done

if [ -z "$UVICORN_BIN" ]; then
  echo "FATAL: Could not find uvicorn binary in podacium/ venv312/ venv/ or PATH!" >&2
  exit 1
fi

echo "Starting Uvicorn using $UVICORN_BIN with ${API_WORKERS:-2} workers..." >&2
exec "$UVICORN_BIN" app.main:app --host 0.0.0.0 --port 8000 --workers "${API_WORKERS:-2}" --limit-concurrency 1000 --backlog 2048
