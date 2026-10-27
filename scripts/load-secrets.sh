#!/usr/bin/env bash
# =============================================================================
# Podacium — Load Secrets from AWS Secrets Manager
# =============================================================================
# Fetches secrets from AWS Secrets Manager and writes them to a local .env file.
# This script is used during deployment and local development setup.
#
# USAGE:
#   ./scripts/load-secrets.sh [environment]
#
# ENVIRONMENTS:
#   development (default), staging, production
#
# PREREQUISITES:
#   - AWS CLI configured with appropriate IAM permissions
#   - jq installed
# =============================================================================

set -euo pipefail

ENVIRONMENT="${1:-development}"
SECRET_NAME="podacium/${ENVIRONMENT}/api"
FRONTEND_SECRET_NAME="podacium/${ENVIRONMENT}/web"
REGION="${AWS_REGION:-us-east-1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Loading secrets for environment: ${ENVIRONMENT}${NC}"

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI not installed.${NC}"
    echo "Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}ERROR: jq not installed.${NC}"
    echo "Install: sudo apt install jq (or brew install jq)"
    exit 1
fi

# Fetch API secrets
echo "Fetching API secrets from AWS Secrets Manager..."
API_SECRETS=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text 2>/dev/null || echo "")

if [ -z "$API_SECRETS" ]; then
    echo -e "${YELLOW}⚠️  Could not fetch secrets from AWS. Using .env.example as template.${NC}"
    echo "   Ensure AWS credentials are configured and the secret '${SECRET_NAME}' exists."
    echo ""
    echo "   To create the secret:"
    echo "   aws secretsmanager create-secret --name ${SECRET_NAME} --secret-string file://services/api/.env.example"
    exit 1
fi

# Write API .env
echo "$API_SECRETS" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"' > services/api/.env
echo -e "${GREEN}✓ services/api/.env written${NC}"

# Fetch frontend secrets
echo "Fetching frontend secrets..."
WEB_SECRETS=$(aws secretsmanager get-secret-value \
    --secret-id "$FRONTEND_SECRET_NAME" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text 2>/dev/null || echo "")

if [ -n "$WEB_SECRETS" ]; then
    echo "$WEB_SECRETS" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"' > apps/web/.env.local
    echo -e "${GREEN}✓ apps/web/.env.local written${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend secrets not found. Using .env.example.${NC}"
fi

echo ""
echo -e "${GREEN}✅ Secrets loaded successfully for ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}   Remember: Never commit .env files to git.${NC}"
