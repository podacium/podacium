#!/usr/bin/env bash
# =============================================================================
# purge-secrets-from-history.sh — Remove ALL .env files from git history
# =============================================================================
#
# ⚠️  THIS IS A DESTRUCTIVE OPERATION ⚠️
#
# This script uses git-filter-repo to permanently remove all .env files
# (and their contents) from the entire git history. After running this:
#
#   1. All collaborators must re-clone the repository
#   2. You must force-push to the remote: git push --force --all
#   3. All previously exposed secrets are STILL COMPROMISED and must be rotated
#
# Prerequisites:
#   pip install git-filter-repo
#   OR: apt install git-filter-repo
#
# Usage:
#   ./scripts/purge-secrets-from-history.sh
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  GIT HISTORY REWRITE — DESTRUCTIVE OPERATION                   ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  This will permanently remove ALL .env files from git history.     ║"
echo "║  All collaborators must re-clone after this operation.             ║"
echo "║  You must force-push to remote afterwards.                         ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check for git-filter-repo
if ! command -v git-filter-repo &> /dev/null; then
    echo "❌ git-filter-repo is not installed."
    echo ""
    echo "Install it with one of:"
    echo "  pip install git-filter-repo"
    echo "  apt install git-filter-repo"
    echo "  brew install git-filter-repo"
    echo ""
    exit 1
fi

# Confirm
read -p "Are you sure you want to rewrite git history? (type 'YES' to confirm): " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "📋 Creating backup of current state..."
BACKUP_BRANCH="backup-before-purge-$(date +%Y%m%d-%H%M%S)"
git -C "$ROOT_DIR" branch "$BACKUP_BRANCH" 2>/dev/null || true
echo "   Backup branch: $BACKUP_BRANCH"

echo ""
echo "🗑️  Removing .env files from ALL git history..."
echo ""

# Remove all .env variants from history
git -C "$ROOT_DIR" filter-repo --force --invert-paths \
    --path-glob '**/.env' \
    --path-glob '**/.env.*' \
    --path-glob '.env' \
    --path-glob '.env.*' \
    --path-glob 'services/api/.env' \
    --path-glob 'services/api/.env.production' \
    --path-glob 'services/api/.env.local' \
    --path-glob 'apps/web/.env.local' \
    --path-glob 'apps/web/.env.production' \
    --path 'services/api/.env' \
    --path 'services/api/.env.production' \
    --path 'apps/web/.env.local' \
    --path 'apps/web/.env.production'

echo ""
echo "✅ Git history rewritten successfully."
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  NEXT STEPS (REQUIRED):"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "  1. Force-push to remote:"
echo "     git push --force --all"
echo "     git push --force --tags"
echo ""
echo "  2. All collaborators must re-clone:"
echo "     rm -rf podacium && git clone <repo-url>"
echo ""
echo "  3. ROTATE ALL CREDENTIALS (secrets are still compromised!):"
echo "     - Chargily API keys (live_pk_*, live_sk_*)"
echo "     - Google OAuth client secret"
echo "     - GitHub OAuth client secret"
echo "     - LinkedIn OAuth client secret"
echo "     - WhatsApp access token"
echo "     - SMTP app password"
echo "     - JWT secret key"
echo "     - OAuth state secret"
echo "     - Application SECRET_KEY"
echo "     - Supabase keys (if still used)"
echo "     - Any database passwords"
echo ""
echo "  4. Generate new local secrets:"
echo "     ./scripts/rotate-secrets.sh"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
