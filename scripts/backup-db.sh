#!/bin/bash
set -euo pipefail

# Database backup script for Podacium
# Usage: ./scripts/backup-db.sh
# Cron: 0 2 * * * /home/zuikre/podacium/scripts/backup-db.sh

ENV_FILE="${ENV_FILE:-/home/zuikre/podacium/.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/opt/podacium/backups}"
S3_BUCKET="${S3_BACKUP_BUCKET:-podacium-backups}"
S3_PREFIX="${S3_BACKUP_PREFIX:-db/}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_RETENTION_DAYS="${S3_BACKUP_RETENTION_DAYS:-30}"
LOG_FILE="${BACKUP_DIR}/backup.log"

mkdir -p "${BACKUP_DIR}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log "Starting database backup..."

# Load environment variables
if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck source=/dev/null
    source "${ENV_FILE}"
else
    log "ERROR: Environment file ${ENV_FILE} not found"
    exit 1
fi

# Validate required variables
: "${DB_HOST:?DB_HOST not set}"
: "${DB_USER:?DB_USER not set}"
: "${DB_NAME:?DB_NAME not set}"
: "${DB_PASSWORD:?DB_PASSWORD not set}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID not set}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY not set}"
: "${AWS_DEFAULT_REGION:?AWS_DEFAULT_REGION not set}"

TIMESTAMP=$(date +%F_%H-%M-%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"
S3_PATH="s3://${S3_BUCKET}/${S3_PREFIX}backup_${TIMESTAMP}.sql.gz"

# Dump database
log "Dumping database ${DB_NAME} from ${DB_HOST}..."
export PGPASSWORD="${DB_PASSWORD}"
if ! pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges | gzip > "${BACKUP_FILE}"; then
    log "ERROR: pg_dump failed"
    exit 1
fi

# Verify backup
if [[ ! -f "${BACKUP_FILE}" ]] || [[ ! -s "${BACKUP_FILE}" ]]; then
    log "ERROR: Backup file is empty or missing"
    exit 1
fi

SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${SIZE})"

# Upload to S3/Backblaze B2
log "Uploading to ${S3_PATH}..."
if ! aws s3 cp "${BACKUP_FILE}" "${S3_PATH}" --storage-class STANDARD_IA; then
    log "ERROR: S3 upload failed"
    exit 1
fi
log "Uploaded to ${S3_PATH}"

# Verify S3 object
log "Verifying S3 object..."
if ! aws s3 ls "${S3_PATH}" >/dev/null 2>&1; then
    log "ERROR: S3 object verification failed"
    exit 1
fi
log "S3 object verified"

# Clean local backups older than RETENTION_DAYS
log "Cleaning local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
log "Local cleanup complete"

# Clean S3 backups older than S3_RETENTION_DAYS (using lifecycle policy is preferred, but manual cleanup as fallback)
log "Cleaning S3 backups older than ${S3_RETENTION_DAYS} days..."
CUTOFF=$(date -d "-${S3_RETENTION_DAYS} days" +%s)
aws s3 ls "${S3_PATH}" --recursive | while read -r line; do
    FILE_DATE=$(echo "${line}" | awk '{print $1" "$2}')
    FILE_EPOCH=$(date -d "${FILE_DATE}" +%s 2>/dev/null || echo "0")
    if [[ "${FILE_EPOCH}" -gt 0 ]] && [[ "${FILE_EPOCH}" -lt "${CUTOFF}" ]]; then
        FILE_KEY=$(echo "${line}" | awk '{print $4}')
        if [[ -n "${FILE_KEY}" ]]; then
            aws s3 rm "s3://${S3_BUCKET}/${FILE_KEY}" && log "Deleted old S3 backup: ${FILE_KEY}"
        fi
    fi
done

log "Backup completed successfully"