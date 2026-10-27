#!/usr/bin/env bash
# apps/web/scripts/pm2-start.sh
set -euo pipefail
cd /opt/podacium/apps/web 2>/dev/null || cd "$(cd "$(dirname "$0")/.." && pwd)"

# Load env file if present (same as start-api.sh)
if [ -f /opt/podacium/.env.prod ]; then
  set -a
  source /opt/podacium/.env.prod
  set +a
elif [ -f /opt/podacium/.env ]; then
  set -a
  source /opt/podacium/.env
  set +a
elif [ -f "$(dirname "$0")/../../../.env.prod" ]; then
  set -a
  source "$(dirname "$0")/../../../.env.prod"
  set +a
fi

exec npx next start -H 0.0.0.0 -p ${PORT:-3000}
