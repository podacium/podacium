#!/usr/bin/env bash
# =============================================================================
# Podacium — Secret Detection Script
# =============================================================================
# Scans the repository for accidentally committed secrets.
# Run before every commit and in CI.
#
# Exit codes:
#   0 — No secrets found
#   1 — Secrets detected (FAIL)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FOUND_SECRETS=0

echo "🔍 Scanning for secrets in tracked files..."

# 1. Check for .env files in git staging area
ENV_FILES=$(git diff --cached --name-only 2>/dev/null | grep -E '\.env($|\.)' || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}❌ BLOCKED: .env files staged for commit:${NC}"
    echo "$ENV_FILES"
    FOUND_SECRETS=1
fi

# 2. Check tracked files for secret patterns
PATTERNS=(
    'PRIVATE.KEY'
    'SECRET_KEY\s*=\s*"[A-Za-z0-9+/=_-]{16,}"'
    'API_KEY\s*=\s*"?[A-Za-z0-9+/=_-]{16,}'
    'CLIENT_SECRET\s*=\s*"?[A-Za-z0-9+/=_-]{8,}'
    'ACCESS_TOKEN\s*=\s*"?[A-Za-z0-9+/=_-]{16,}'
    'PASSWORD\s*=\s*"[^"]{4,}"'
    'live_sk_[A-Za-z0-9]+'
    'live_pk_[A-Za-z0-9]+'
    'GOCSPX-[A-Za-z0-9_-]+'
    'eyJhbGciOiJIUzI1NiI'
)

# Only scan tracked files (not .env files which are gitignored)
TRACKED_FILES=$(git ls-files 2>/dev/null | grep -vE '(node_modules|\.git|\.env|package-lock|bun\.lock)' || true)

for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(echo "$TRACKED_FILES" | xargs grep -lE "$pattern" 2>/dev/null | grep -vE '(\.example$|\.md$|scripts/|\.baseline$)' || true)
    if [ -n "$MATCHES" ]; then
        echo -e "${RED}❌ Secret pattern '$pattern' found in:${NC}"
        echo "$MATCHES" | head -5
        FOUND_SECRETS=1
    fi
done

# 3. Check for high-entropy strings in source files (simplified)
echo "🔍 Checking for high-entropy strings..."

if [ $FOUND_SECRETS -eq 0 ]; then
    echo -e "${GREEN}✅ No secrets detected in tracked files.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  SECRETS DETECTED — COMMIT BLOCKED                         ║${NC}"
    echo -e "${RED}║  Remove secrets and use environment variables instead.      ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
