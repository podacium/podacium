#!/bin/bash
set -euo pipefail

BACKUP_DIR=/opt/podacium/backups
DB_NAME=podacium
DB_USER=podacium
DB_HOST=127.0.0.1
RETENTION_DAYS=7
S3_RETENTION_DAYS=30
GPG_RECIPIENT="${GPG_RECIPIENT:-backups@podacium.com}"

ENV_FILE=/opt/podacium/.env.prod
if [ -f "$ENV_FILE" ]; then
  DB_PASS=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
fi
if [ -z "${DB_PASS:-}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: DB_PASSWORD not found in $ENV_FILE" >> "$LOG"
  exit 1
fi
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RAW_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
FILENAME="${RAW_FILE}.gpg"
LOG="${BACKUP_DIR}/backup.log"
ENVIRONMENT="${ENVIRONMENT:-production}"
S3_BACKUP_BUCKET="podacium-backups-${ENVIRONMENT}"
S3_PATH="s3://${S3_BACKUP_BUCKET}/db/"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..." >> "$LOG"

# Validate IAM permissions before doing work
if ! aws s3 ls "s3://${S3_BACKUP_BUCKET}" &>/dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Cannot access s3://${S3_BACKUP_BUCKET} — will try uploading anyway" >> "$LOG"
fi

PGPASSWORD="$DB_PASS" pg_dump \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-owner \
  --no-privileges \
  --compress=9 \
  --file="$RAW_FILE"

# Verify backup is valid
if [ ! -f "$RAW_FILE" ] || [ ! -s "$RAW_FILE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup file is empty or missing!" >> "$LOG"
  exit 1
fi
SIZE=$(du -h "$RAW_FILE" | cut -f1)

# Encrypt with GPG before upload
gpg --batch --yes --trust-model always \
  --recipient "$GPG_RECIPIENT" \
  --output "$FILENAME" \
  --encrypt "$RAW_FILE"
rm -f "$RAW_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup encrypted: $FILENAME ($SIZE raw)" >> "$LOG"

# Validate encrypted file integrity
if ! gpg --batch --list-packets "$FILENAME" &>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Encrypted file integrity check failed" >> "$LOG"
  exit 1
fi

# Upload to S3 (offsite backup)
aws s3 cp "$FILENAME" "$S3_PATH" 2>> "$LOG"
if [ $? -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploaded to ${S3_PATH}$(basename $FILENAME)" >> "$LOG"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: S3 upload failed" >> "$LOG"
  exit 1
fi

# Restore test — download and verify checksum
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running restore test (dry-run decrypt)..." >> "$LOG"
DOWNLOAD_CHECK=$(mktemp)
aws s3 cp "${S3_PATH}$(basename $FILENAME)" "$DOWNLOAD_CHECK" 2>> "$LOG"
gpg --batch --decrypt "$DOWNLOAD_CHECK" | gzip -d -t 2>> "$LOG" && \
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore test PASSED" >> "$LOG" || \
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] RESTORE TEST FAILED — backup may be corrupt" >> "$LOG"
rm -f "$DOWNLOAD_CHECK"

# Clean old backups (local)
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz.gpg" -mtime +$RETENTION_DAYS -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaned local backups older than ${RETENTION_DAYS} days" >> "$LOG"

# Clean old S3 backups (S3 lifecycle handles this, but enforce locally too)
aws s3 ls "${S3_PATH}" --recursive 2>/dev/null | while read -r line; do
  key=$(echo "$line" | awk '{print $4}')
  date=$(echo "$line" | awk '{print $1" "$2}')
  age=$(( ($(date +%s) - $(date -d "$date" +%s)) / 86400 ))
  if [ "$age" -gt "$S3_RETENTION_DAYS" ]; then
    aws s3 rm "s3://${S3_BACKUP_BUCKET}/$key" 2>/dev/null
  fi
done
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaned S3 backups older than ${S3_RETENTION_DAYS} days" >> "$LOG"
