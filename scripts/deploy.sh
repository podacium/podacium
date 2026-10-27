#!/usr/bin/env bash
# deploy.sh — Gated, intelligent one-command deploy of podacium-web + podacium-api
# to the production VPS (pm2).
#
# Usage:
#   ./scripts/deploy.sh               # Gated deploy (auto-detects modified components)
#   ./scripts/deploy.sh --no-push     # Only run remote pipeline (assume already pushed)
#   ./scripts/deploy.sh --sha <sha>   # Deploy specific commit
#   ./scripts/deploy.sh --force-all   # Force all gates: migrations, seeds, web build, restarts
#   ./scripts/deploy.sh --force-db    # Force migration run + Prisma generate
#   ./scripts/deploy.sh --force-seed  # Force platform, account, course & RBAC seeds
#   ./scripts/deploy.sh --skip-seed   # Never run the (destructive) seed pipeline
#   ./scripts/deploy.sh --force-web   # Force frontend rebuild
#   ./scripts/deploy.sh --force-api   # Force backend restart
#
# Env overrides:
#   REMOTE="v1"              # git remote (default: v1)
#   BRANCH="main"            # branch to deploy (default: main)
#   SSH_TARGET="root@212.47.79.68" # ssh target (default alias or IP)
#
set -euo pipefail

REMOTE="${REMOTE:-v1}"
BRANCH="${BRANCH:-main}"
SSH_TARGET="${SSH_ALIAS:-root@212.47.79.68}"
DO_PUSH=1
SHA=""

FORCE_ALL=0
FORCE_DB=0
FORCE_SEED=0
SKIP_SEED=0
FORCE_WEB=0
FORCE_API=0

for a in "$@"; do
  case "$a" in
    --no-push)    DO_PUSH=0 ;;
    --sha=*)      SHA="${a#--sha=}" ;;
    --sha)        : "${2:?--sha requires a commit SHA}"; SHA="$2"; shift ;;
    --force-all)  FORCE_ALL=1 ;;
    --force-db)   FORCE_DB=1 ;;
    --force-seed) FORCE_SEED=1 ;;
    --skip-seed)  SKIP_SEED=1 ;;
    --force-web)  FORCE_WEB=1 ;;
    --force-api)  FORCE_API=1 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

if [ "$FORCE_ALL" -eq 1 ]; then
  FORCE_DB=1
  FORCE_SEED=1
  FORCE_WEB=1
  FORCE_API=1
fi

step(){ printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

cd "$(git rev-parse --show-toplevel)"

if [ "$DO_PUSH" -eq 1 ] && [ -z "$SHA" ]; then
  step "Checking uncommitted changes..."
  git status --porcelain | grep -q . && { echo "Uncommitted changes — commit before deploying."; exit 1; }
  step "Pushing current ${BRANCH} to ${REMOTE}"
  git push "$REMOTE" "$BRANCH"
  SHA="$(git rev-parse "$BRANCH")"
fi
: "${SHA:=$(git rev-parse "$BRANCH")}"

step "Deploying ${REMOTE}/${BRANCH} @ ${SHA} to ${SSH_TARGET} (Gated Pipeline)"

ssh -o ConnectTimeout=25 "$SSH_TARGET" "bash -s" <<REMOTE
set -euo pipefail
cd /opt/podacium

step(){ printf '\n\033[1;36m-> %s\033[0m\n' "\$*"; }
info(){ printf '   \033[0;32m✓ %s\033[0m\n' "\$*"; }
skip(){ printf '   \033[0;33m⏭  %s\033[0m\n' "\$*"; }

PREV_SHA=\$(git rev-parse HEAD 2>/dev/null || echo "")

step "Fetching & resetting to ${SHA}"
git fetch origin
git reset --hard "${SHA}"
git clean -fdq 2>/dev/null || true

# Determine diffs if PREV_SHA is valid and differs
CHANGED_FILES=""
if [ -n "\$PREV_SHA" ] && [ "\$PREV_SHA" != "${SHA}" ]; then
  CHANGED_FILES=\$(git diff --name-only "\$PREV_SHA" "${SHA}" 2>/dev/null || echo "")
else
  # Fresh checkout or identical commit — default to inspection
  CHANGED_FILES="FORCE_CHECK"
fi

# Gate evaluations
SHOULD_SYNC_DB=$FORCE_DB
SHOULD_SEED=$FORCE_SEED
SHOULD_BUILD_WEB=$FORCE_WEB
SHOULD_RESTART_API=$FORCE_API
SHOULD_RESTART_WEB=0

if [ "$FORCE_ALL" -eq 1 ]; then
  SHOULD_SYNC_DB=1
  SHOULD_SEED=1
  SHOULD_BUILD_WEB=1
  SHOULD_RESTART_API=1
  SHOULD_RESTART_WEB=1
else
  # DB Schema Gate
  if echo "\$CHANGED_FILES" | grep -qE "^services/api/(prisma/(schema\.prisma|migrations/)|app/generated/prisma/)"; then
    SHOULD_SYNC_DB=1
    SHOULD_RESTART_API=1
  fi

  # Seed Gate
  if echo "\$CHANGED_FILES" | grep -qE "(seed_platform_config\.py|seed_accounts\.py|seed_courses\.py|seed_rbac\.py)"; then
    SHOULD_SEED=1
    SHOULD_RESTART_API=1
  fi

  # Backend Gate
  if echo "\$CHANGED_FILES" | grep -qE "^(services/api/app/|services/api/start-api\.sh|\.env\.prod)"; then
    SHOULD_RESTART_API=1
  fi

  # Frontend Gate
  if echo "\$CHANGED_FILES" | grep -qE "^apps/web/"; then
    SHOULD_BUILD_WEB=1
    SHOULD_RESTART_WEB=1
  fi
fi

# Explicit operator override: the course seed clears education tables, so allow
# skipping it even when seed files changed (or when --force-all is used).
if [ "$SKIP_SEED" -eq 1 ]; then
  SHOULD_SEED=0
fi

# -------------------------------------------------------------
# GATE 1: Database Schema Sync & Prisma Client Generation
# -------------------------------------------------------------
if [ "\$SHOULD_SYNC_DB" -eq 1 ]; then
  step "Gate 1 [ACTIVE]: Syncing Database Schema & Generating Prisma Client"
  cd /opt/podacium/services/api
  export PATH="\$PWD/venv312/bin:\$PATH"
  prod_url=\$(grep -E "^DATABASE_URL=" /opt/podacium/.env.prod | sed -E "s|^DATABASE_URL=['\"]?([^'\"]*)['\"]?|\1|")
  export DATABASE_URL="\$prod_url"

  # Apply versioned migrations only. Production history was baselined on
  # 2026-10-21 (27/27), so `migrate deploy` is authoritative from now on;
  # `db push` is deliberately not used because it never records history and
  # silently drops columns Prisma does not know about.
  ./venv312/bin/prisma migrate deploy --schema prisma/schema.prisma
  ./venv312/bin/prisma generate --schema prisma/schema.prisma

  migrate_status=\$(./venv312/bin/prisma migrate status --schema prisma/schema.prisma 2>&1)
  echo "\$migrate_status"
  case "\$migrate_status" in
    *"Database schema is up to date!"*) ;;
    *) echo "ERROR: pending or diverged migrations after deploy." >&2; exit 1 ;;
  esac
  info "Migrations applied and Prisma client generated."
else
  skip "Gate 1 [BYPASS]: No schema.prisma changes detected."
fi

# -------------------------------------------------------------
# GATE 2: Seeding Configurations & Core Records
# -------------------------------------------------------------
if [ "\$SHOULD_SEED" -eq 1 ]; then
  step "Gate 2 [ACTIVE]: Running Seed Pipeline"
  cd /opt/podacium/services/api
  export PATH="\$PWD/venv312/bin:\$PATH"
  prod_url=\$(grep -E "^DATABASE_URL=" /opt/podacium/.env.prod | sed -E "s|^DATABASE_URL=['\"]?([^'\"]*)['\"]?|\1|")
  export DATABASE_URL="\$prod_url"

  ./venv312/bin/python scripts/seed_platform_config.py
  SEED_ALLOW_PROD=1 ./venv312/bin/python seed_accounts.py
  ./venv312/bin/python scripts/seed_courses.py
  ./venv312/bin/python -m app.core.seed_rbac
  info "Database seeds verified and updated."
else
  if [ "$SKIP_SEED" -eq 1 ]; then
    skip "Gate 2 [BYPASS]: Seed pipeline skipped by --skip-seed."
  else
    skip "Gate 2 [BYPASS]: No seed modifications detected."
  fi
fi

# -------------------------------------------------------------
# GATE 3: Frontend Build & Asset Compilation
# -------------------------------------------------------------
if [ "\$SHOULD_BUILD_WEB" -eq 1 ]; then
  step "Gate 3 [ACTIVE]: Building Next.js Frontend"
  cd /opt/podacium/apps/web
  npm install --ignore-scripts --no-audit --no-fund

  # Next.js needs ~3 GB for a production build. The API runs two workers that
  # hold ~3 GB combined, so on a memory-tight host pause it for the build and
  # always resume it afterwards (including on failure) to avoid an outage.
  API_PAUSED=0
  avail_kb=\$(awk '/MemAvailable/ {print \$2}' /proc/meminfo)
  api_pid=\$(pm2 pid podacium-api 2>/dev/null | tr -d '[:space:]' || true)
  if [ "\$avail_kb" -lt 4194304 ] && [ "\$api_pid" != "0" ] && [ -n "\$api_pid" ]; then
    step "Pausing podacium-api to free memory for the build (available: \$((avail_kb / 1024)) MiB)"
    pm2 stop podacium-api
    API_PAUSED=1
  fi

  if ! npm run build; then
    if [ "\$API_PAUSED" -eq 1 ]; then
      pm2 start podacium-api --update-env
      info "podacium-api resumed after failed build."
    fi
    echo "ERROR: frontend build failed — deploy aborted." >&2
    exit 1
  fi

  if [ "\$API_PAUSED" -eq 1 ]; then
    pm2 start podacium-api --update-env
    info "podacium-api resumed after build."
  fi

  SHOULD_RESTART_WEB=1
  info "Frontend built successfully."
else
  skip "Gate 3 [BYPASS]: No frontend changes detected."
fi

# -------------------------------------------------------------
# GATE 4: Process Restarts (pm2) & Health Verification
# -------------------------------------------------------------
step "Gate 4: Process Management & Health Checks"
cd /opt/podacium

if [ "\$SHOULD_RESTART_API" -eq 1 ]; then
  pm2 restart podacium-api --update-env
  info "podacium-api restarted."

  # Celery runs from the same source tree. Without a restart the worker keeps
  # executing the previous revision, and a hung task keeps its slot forever.
  pm2 restart podacium-celery-worker podacium-celery-beat --update-env
  info "podacium-celery-worker and podacium-celery-beat restarted."
else
  skip "podacium-api restart skipped (no backend changes)."
fi

if [ "\$SHOULD_RESTART_WEB" -eq 1 ]; then
  pm2 restart podacium-web --update-env
  info "podacium-web restarted."
else
  skip "podacium-web restart skipped (no frontend changes)."
fi

sleep 3
pm2 status

# Verify local & public health. The API loads a large app (two workers), so
# allow up to two minutes before declaring the deploy failed.
step "Verifying Endpoint Health"
api_ok=0
for i in {1..40}; do
  if curl -sf --max-time 5 http://127.0.0.1:8000/healthz >/dev/null 2>&1; then
    info "Local API (:8000/healthz) is healthy."
    api_ok=1
    break
  fi
  sleep 3
done
if [ "\$api_ok" -ne 1 ]; then
  echo "ERROR: local API did not become healthy — deploy failed." >&2
  exit 1
fi

curl -sf --max-time 10 -o /dev/null -w "Local Web Status: %{http_code}\n" http://127.0.0.1:3000 \
  || { echo "ERROR: local web is not responding — deploy failed." >&2; exit 1; }
curl -sf --max-time 10 -o /dev/null -w "Public Web Status: %{http_code}\n" https://podacium.com \
  || { echo "ERROR: public web is not responding — deploy failed." >&2; exit 1; }

public_api_ok=0
for i in {1..20}; do
  if curl -sf --max-time 5 https://backend-api.podacium.com/healthz >/dev/null 2>&1; then
    info "Public API (backend-api.podacium.com/healthz) is healthy."
    public_api_ok=1
    break
  fi
  sleep 3
done
if [ "\$public_api_ok" -ne 1 ]; then
  echo "ERROR: public API did not become healthy — deploy failed." >&2
  exit 1
fi
REMOTE

step "Deployment Completed Successfully for ${BRANCH}@${SHA} on ${SSH_TARGET}"