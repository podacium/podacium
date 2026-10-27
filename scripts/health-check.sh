#!/bin/bash
set -euo pipefail

API_URL="https://backend-api.podacium.com"
SITE_URL="https://podacium.com"
LOG="/opt/podacium/backups/monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$(dirname "$LOG")"

failures=0

check() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local result
  result=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>&1) || true
  if [ "$result" != "$expected" ]; then
    echo "[$TIMESTAMP] FAIL: $name - got $result, expected $expected" >> "$LOG"
    failures=$((failures + 1))
  else
    echo "[$TIMESTAMP] OK: $name ($result)" >> "$LOG"
  fi
}

check "API health" "$API_URL/health" "200"
check "API root" "$API_URL/" "200"
check "Main site" "$SITE_URL" "200"

# Disk usage
DISK=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK" -gt 85 ]; then
  echo "[$TIMESTAMP] FAIL: Disk at ${DISK}%" >> "$LOG"
  failures=$((failures + 1))
else
  echo "[$TIMESTAMP] OK: Disk at ${DISK}%" >> "$LOG"
fi

# Memory usage
MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
if [ "$MEM_PCT" -gt 85 ]; then
  echo "[$TIMESTAMP] FAIL: Memory at ${MEM_PCT}% (${MEM_USED}MB/${MEM_TOTAL}MB)" >> "$LOG"
  failures=$((failures + 1))
else
  echo "[$TIMESTAMP] OK: Memory at ${MEM_PCT}% (${MEM_USED}MB/${MEM_TOTAL}MB)" >> "$LOG"
fi

# K8s pod readiness
if command -v kubectl &>/dev/null; then
  for dep in podacium-api podacium-web podacium-api-canary; do
    ready=$(kubectl -n podacium get deployment "$dep" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "missing")
    desired=$(kubectl -n podacium get deployment "$dep" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    if [ "$ready" = "missing" ] || [ "$ready" -eq 0 ] 2>/dev/null; then
      echo "[$TIMESTAMP] FAIL: Deployment $dep has $ready ready replicas (desired: $desired)" >> "$LOG"
      failures=$((failures + 1))
    else
      echo "[$TIMESTAMP] OK: Deployment $dep has $ready/$desired ready replicas" >> "$LOG"
    fi
  done
else
  # Fallback: Docker container checks
  for container in podacium-redis-1 podacium-postgres-1 podacium-celery-worker-1 podacium-celery-beat-1; do
    status=$(docker inspect "$container" 2>/dev/null | python3 -c "import sys,json; o=json.load(sys.stdin); print(o[0]['State']['Status'])" 2>/dev/null || echo "missing")
    if [ "$status" != "running" ]; then
      echo "[$TIMESTAMP] FAIL: Container $container is $status" >> "$LOG"
      failures=$((failures + 1))
    else
      echo "[$TIMESTAMP] OK: Container $container is running" >> "$LOG"
    fi
  done
fi

echo "[$TIMESTAMP] Summary: $failures failures" >> "$LOG"

if [ "$failures" -gt 0 ]; then
  echo "[$TIMESTAMP] ALERT: $failures checks failed - review $LOG" >> "$LOG"
  exit 1
fi
