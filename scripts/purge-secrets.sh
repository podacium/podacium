#!/usr/bin/env bash
# =============================================================================
# PODACIUM — Emergency Secret Purge & Rotation Script
# =============================================================================
# This script removes the leaked .env.production from ALL git history
# and provides instructions for rotating every compromised credential.
#
# PREREQUISITES:
#   pip install git-filter-repo
#   (or: apt install git-filter-repo)
#
# USAGE:
#   chmod +x scripts/purge-secrets.sh
#   ./scripts/purge-secrets.sh
#
# ⚠️  WARNING: This rewrites git history. All collaborators must re-clone.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  PODACIUM EMERGENCY SECRET PURGE                           ║${NC}"
echo -e "${RED}║  This will REWRITE git history. All collaborators must     ║${NC}"
echo -e "${RED}║  re-clone after this operation.                            ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
if ! command -v git-filter-repo &> /dev/null; then
    echo -e "${RED}ERROR: git-filter-repo is not installed.${NC}"
    echo "Install with: pip install git-filter-repo"
    exit 1
fi

# Confirm
read -p "Are you sure you want to purge secrets from git history? (type YES): " confirm
if [ "$confirm" != "YES" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${YELLOW}Step 1: Removing .env.production from all git history...${NC}"

# Remove the leaked files from all commits
git-filter-repo --invert-paths \
    --path services/api/.env.production \
    --path services/api/.env \
    --path apps/web/.env.local \
    --path apps/web/.env.production \
    --path-glob '**/.env' \
    --path-glob '**/.env.*' \
    --force

echo -e "${GREEN}✓ File purged from history${NC}"
echo ""

echo -e "${YELLOW}Step 2: Force-push to remote...${NC}"
echo "Run manually:"
echo "  git push origin --force --all"
echo "  git push origin --force --tags"
echo ""

echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  CREDENTIAL ROTATION REQUIRED                              ║${NC}"
echo -e "${RED}║  The following credentials were exposed in commit b401ec0  ║${NC}"
echo -e "${RED}║  and MUST be rotated IMMEDIATELY:                          ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

cat << 'ROTATION'
┌─────────────────────────────────────────────────────────────────────────────┐
│ CREDENTIAL                │ WHERE TO ROTATE                                 │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ DATABASE_URL              │ Generate new credentials for your PostgreSQL    │
│                           │ instance (Docker or AWS RDS)                    │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ JWT_SECRET_KEY            │ Generate new: openssl rand -hex 64              │
│                           │ ⚠️  All existing sessions will be invalidated   │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ SECRET_KEY                │ Generate new: openssl rand -hex 32              │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ OAUTH_STATE_SECRET        │ Generate new: openssl rand -hex 32              │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ GOOGLE_CLIENT_SECRET      │ Google Cloud Console → APIs & Services →        │
│                           │ Credentials → Delete old, create new            │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ GITHUB_CLIENT_SECRET      │ github.com/settings/developers → OAuth Apps →   │
│                           │ Generate new client secret                      │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ LINKEDIN_CLIENT_SECRET    │ linkedin.com/developers → App → Auth →          │
│                           │ Generate new secret                             │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ CHARGILY_API_KEY          │ pay.chargily.com → API Keys → Regenerate        │
│ CHARGILY_SECRET_KEY       │ ⚠️  LIVE PAYMENT KEYS — rotate immediately     │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ WHATSAPP_ACCESS_TOKEN     │ Meta Business Suite → System Users →            │
│                           │ Generate new token                              │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ SMTP_PASSWORD             │ myaccount.google.com/apppasswords →             │
│                           │ Revoke old, generate new app password           │
├───────────────────────────┼─────────────────────────────────────────────────┤
│ POSTGRES_PASSWORD         │ Generate new: openssl rand -hex 16              │
│                           │ Update DATABASE_URL to match                    │
└─────────────────────────────────────────────────────────────────────────────┘
ROTATION

echo ""
echo -e "${YELLOW}Step 3: After rotating all credentials:${NC}"
echo "  1. Update services/api/.env with new values"
echo "  2. Update apps/web/.env.local if needed"
echo "  3. Restart all services: docker compose down && docker compose up -d"
echo "  4. Verify: curl https://backend-api.podacium.com/health"
echo ""
echo -e "${GREEN}Step 4: Notify all collaborators to re-clone:${NC}"
echo "  rm -rf podacium && git clone <repo-url> podacium"
echo ""
echo -e "${GREEN}Done. Secrets purged from history.${NC}"
echo -e "${RED}Remember: The old credentials are PERMANENTLY COMPROMISED.${NC}"
echo -e "${RED}Rotating them is NOT optional — attackers may have cached them.${NC}"
