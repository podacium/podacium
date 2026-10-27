#!/usr/bin/env bash
# =============================================================================
# Podacium — CloudFront CDN Invalidation
# =============================================================================
# Invalidates CloudFront cache after deployment.
#
# USAGE:
#   ./scripts/invalidate-cdn.sh [paths...]
#
# EXAMPLES:
#   ./scripts/invalidate-cdn.sh                    # Invalidate everything
#   ./scripts/invalidate-cdn.sh /static/* /api/*   # Specific paths
#
# PREREQUISITES:
#   - AWS CLI configured
#   - CLOUDFRONT_DISTRIBUTION_ID environment variable set
# =============================================================================

set -euo pipefail

DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"
REGION="${AWS_REGION:-us-east-1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$DISTRIBUTION_ID" ]; then
    # Try to get from Terraform output
    DISTRIBUTION_ID=$(cd infra/terraform && terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
fi

if [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${RED}ERROR: CLOUDFRONT_DISTRIBUTION_ID not set and could not be determined from Terraform.${NC}"
    echo "Set it with: export CLOUDFRONT_DISTRIBUTION_ID=E1234567890"
    exit 1
fi

# Default to invalidating everything
PATHS="${@:-/*}"

echo -e "${YELLOW}Invalidating CloudFront cache...${NC}"
echo "  Distribution: $DISTRIBUTION_ID"
echo "  Paths: $PATHS"

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths $PATHS \
    --query 'Invalidation.Id' \
    --output text \
    --region "$REGION")

echo -e "${GREEN}✓ Invalidation created: $INVALIDATION_ID${NC}"

# Wait for completion (optional, with timeout)
echo "Waiting for invalidation to complete (max 5 minutes)..."
aws cloudfront wait invalidation-completed \
    --distribution-id "$DISTRIBUTION_ID" \
    --id "$INVALIDATION_ID" \
    --region "$REGION" 2>/dev/null || echo -e "${YELLOW}⚠️  Timed out waiting — invalidation still in progress.${NC}"

echo -e "${GREEN}✅ CDN invalidation complete.${NC}"
