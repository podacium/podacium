#!/bin/bash
set -euo pipefail

# Install Podacium DB backup cron job
# Run: sudo bash scripts/setup-cron.sh

CRON_FILE="/etc/cron.d/podacium-backup"
BACKUP_SCRIPT="/opt/podacium/scripts/db-backup.sh"
LOG_FILE="/opt/podacium/backups/backup.log"

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "ERROR: $BACKUP_SCRIPT not found. Run from /opt/podacium"
  exit 1
fi

chmod 700 "$BACKUP_SCRIPT"
mkdir -p /opt/podacium/backups

cat > "$CRON_FILE" << 'CRONEOF'
# Podacium DB backup — runs daily at 3:00 AM UTC
# Encrypted to S3 with GPG. Retention: 7 days local, 30 days S3.
0 3 * * * root /opt/podacium/scripts/db-backup.sh >> /opt/podacium/backups/cron.log 2>&1
CRONEOF

chmod 644 "$CRON_FILE"

echo "Cron job installed at $CRON_FILE"
echo "Backups run daily at 3:00 AM UTC"
