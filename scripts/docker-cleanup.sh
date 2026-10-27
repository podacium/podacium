#!/bin/bash
set -euo pipefail

echo "=== Podacium Docker Cleanup ==="
echo ""

echo "Stopping all containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

echo "Removing unused images..."
docker image prune -f

echo "Removing unused volumes..."
docker volume prune -f

echo "Removing build cache..."
docker builder prune -f

echo ""
echo "Cleanup complete!"
