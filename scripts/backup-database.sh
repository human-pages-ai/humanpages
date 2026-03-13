#!/bin/bash
# ─── Database Backup — pg_dump → encrypt → Cloudflare R2 ────────────
# Dumps the PostgreSQL database, encrypts it (AES-256), uploads to a
# dedicated R2 bucket with a 30-day lifecycle TTL, and notifies via
# Telegram. The script has upload-only permissions — R2 handles expiry.
#
# Can be run manually or via cron (see setup-db-backups.sh).
#
# Usage:
#   sh scripts/backup-database.sh                  # normal backup
#   sh scripts/backup-database.sh --dry-run        # validate config only
#
# Environment variables (loaded from Infisical or backend/.env):
#   DATABASE_URL                  — PostgreSQL connection string
#   R2_BACKUP_ACCOUNT_ID          — Cloudflare account ID for backup bucket
#   R2_BACKUP_ACCESS_KEY_ID       — R2 API token (scoped to hp-db-backups bucket)
#   R2_BACKUP_SECRET_ACCESS_KEY   — R2 API token secret
#   DB_BACKUP_ENCRYPTION_KEY      — AES-256 passphrase for encrypting backups
#   TELEGRAM_BOT_TOKEN            — (optional) for failure/success notifications
#   TELEGRAM_ADMIN_CHAT_ID        — (optional) Telegram chat for notifications
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups/postgres"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup.log"
R2_BUCKET="hp-db-backups"
R2_PREFIX="postgres"
LOCAL_RETENTION_DAYS=7
DRY_RUN=false
TIMESTAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_FILENAME="humans_marketplace-${TIMESTAMP}.dump"
ENCRYPTED_FILENAME="humans_marketplace-${TIMESTAMP}.dump.enc"
START_TIME="$(date +%s)"

# ── Parse arguments ──────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)    DRY_RUN=true; shift ;;
    *)            echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Logging ──────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

log() {
  local level="$1"; shift
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

log_info()  { log "INFO"  "$@"; }
log_error() { log "ERROR" "$@"; }
log_warn()  { log "WARN"  "$@"; }

# ── Cleanup trap ─────────────────────────────────────────────────────
cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    log_error "Backup failed with exit code $exit_code"
    send_telegram "BACKUP FAILED" "Exit code: $exit_code\nCheck logs: $LOG_FILE"
  fi
  # Remove partial/unencrypted files on failure
  if [[ -f "${BACKUP_DIR}/${BACKUP_FILENAME}" ]]; then
    # Plaintext dump should never remain — always remove on exit
    rm -f "${BACKUP_DIR}/${BACKUP_FILENAME}"
    log_warn "Removed plaintext dump file"
  fi
  if [[ -f "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" ]]; then
    local size
    size=$(stat -f%z "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" 2>/dev/null || stat -c%s "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" 2>/dev/null || echo "0")
    if [[ "$size" -lt 1024 ]]; then
      rm -f "${BACKUP_DIR}/${ENCRYPTED_FILENAME}"
      log_warn "Removed partial/empty encrypted file"
    fi
  fi
}
trap cleanup EXIT

# ── Load configuration ───────────────────────────────────────────────
load_config() {
  # Try environment variables first (Infisical injects these in production)
  # Fall back to backend/.env
  if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "${PROJECT_DIR}/backend/.env" ]]; then
    log_info "Loading credentials from backend/.env"
    # Source only the vars we need — read full line and split on first '=' only
    while IFS= read -r line; do
      # Skip comments and empty lines
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      local key="${line%%=*}"
      local value="${line#*=}"
      # Remove surrounding quotes from value
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      case "$key" in
        DATABASE_URL|DIRECT_DATABASE_URL|R2_BACKUP_ACCOUNT_ID|R2_BACKUP_ACCESS_KEY_ID|R2_BACKUP_SECRET_ACCESS_KEY|DB_BACKUP_ENCRYPTION_KEY|TELEGRAM_BOT_TOKEN|TELEGRAM_ADMIN_CHAT_ID)
          export "$key=$value"
          ;;
      esac
    done < "${PROJECT_DIR}/backend/.env"
  fi

  # Validate DATABASE_URL is set
  if [[ -z "${DATABASE_URL:-}" ]]; then
    log_error "DATABASE_URL is not set"
    exit 1
  fi

  # Use DIRECT_DATABASE_URL if available (bypasses connection pooler)
  # We'll pass the full URL to pg_dump to avoid parsing issues with
  # special characters in passwords (@ : = etc.)
  PG_CONN_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"
  # Strip query params for display purposes only
  local display_url="${PG_CONN_URL%%\?*}"
  # Mask password in display: postgresql://user:***@host:port/db
  DB_DISPLAY=$(echo "$display_url" | sed -E 's|(://[^:]+:)[^@]+(@)|\1***\2|')

  # Validate R2 backup credentials (separate from app R2 credentials)
  if [[ -z "${R2_BACKUP_ACCOUNT_ID:-}" || -z "${R2_BACKUP_ACCESS_KEY_ID:-}" || -z "${R2_BACKUP_SECRET_ACCESS_KEY:-}" ]]; then
    log_error "R2 backup credentials not configured (R2_BACKUP_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY_ID, R2_BACKUP_SECRET_ACCESS_KEY)"
    exit 1
  fi

  R2_ENDPOINT="https://${R2_BACKUP_ACCOUNT_ID}.r2.cloudflarestorage.com"

  # Validate encryption key
  if [[ -z "${DB_BACKUP_ENCRYPTION_KEY:-}" ]]; then
    log_error "DB_BACKUP_ENCRYPTION_KEY is not set. Backups must be encrypted."
    log_error "Generate one with: openssl rand -base64 32"
    log_error "Then add it to Infisical and backend/.env"
    exit 1
  fi
}

# ── Telegram notification ────────────────────────────────────────────
send_telegram() {
  local title="$1"
  local body="$2"

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_ADMIN_CHAT_ID:-}" ]]; then
    log_warn "Telegram not configured, skipping notification"
    return 0
  fi

  local message="*${title}*%0A%0A${body}"
  curl -s -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_ADMIN_CHAT_ID}" \
    -d "text=${message}" \
    -d "parse_mode=Markdown" \
    > /dev/null 2>&1 || log_warn "Failed to send Telegram notification"
}

# ── Pre-flight checks ───────────────────────────────────────────────
check_prerequisites() {
  local missing=()

  if ! command -v pg_dump &>/dev/null; then
    missing+=("pg_dump")
  fi

  if ! command -v aws &>/dev/null; then
    missing+=("aws (AWS CLI)")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing required tools: ${missing[*]}"
    log_error "Install them with: sudo apt install postgresql-client awscli"
    exit 1
  fi

  # Test database connection using full URL
  if ! psql "$PG_CONN_URL" -c "SELECT 1" &>/dev/null; then
    log_error "Cannot connect to database: ${DB_DISPLAY}"
    exit 1
  fi

  log_info "Pre-flight checks passed"
}

# ── Create backup ────────────────────────────────────────────────────
create_backup() {
  local backup_path="${BACKUP_DIR}/${BACKUP_FILENAME}"

  log_info "Creating backup: ${BACKUP_FILENAME}"
  log_info "Database: ${DB_DISPLAY}"

  pg_dump "$PG_CONN_URL" \
    -Fc \
    --no-owner \
    --no-privileges \
    -f "$backup_path"

  # Validate backup
  local file_size
  file_size=$(stat -f%z "$backup_path" 2>/dev/null || stat -c%s "$backup_path" 2>/dev/null)

  if [[ "$file_size" -lt 1024 ]]; then
    log_error "Backup file suspiciously small (${file_size} bytes). Aborting."
    exit 1
  fi

  # Convert to human-readable size
  BACKUP_SIZE_HR=$(numfmt --to=iec "$file_size" 2>/dev/null || echo "${file_size} bytes")
  log_info "Backup created: ${BACKUP_SIZE_HR}"
}

# ── Encrypt backup ───────────────────────────────────────────────────
encrypt_backup() {
  local backup_path="${BACKUP_DIR}/${BACKUP_FILENAME}"
  local encrypted_path="${BACKUP_DIR}/${ENCRYPTED_FILENAME}"

  log_info "Encrypting backup with AES-256-CBC..."

  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "$backup_path" \
    -out "$encrypted_path" \
    -pass env:DB_BACKUP_ENCRYPTION_KEY

  # Validate encrypted file
  local enc_size
  enc_size=$(stat -f%z "$encrypted_path" 2>/dev/null || stat -c%s "$encrypted_path" 2>/dev/null)

  if [[ "$enc_size" -lt 1024 ]]; then
    log_error "Encrypted file suspiciously small (${enc_size} bytes). Aborting."
    exit 1
  fi

  # Remove unencrypted dump — never leave plaintext on disk longer than needed
  rm -f "$backup_path"
  log_info "Encryption complete. Plaintext dump removed."
}

# ── Upload to R2 ─────────────────────────────────────────────────────
upload_to_r2() {
  local encrypted_path="${BACKUP_DIR}/${ENCRYPTED_FILENAME}"
  local s3_path="s3://${R2_BUCKET}/${R2_PREFIX}/${ENCRYPTED_FILENAME}"

  log_info "Uploading to R2: ${s3_path}"

  # Configure AWS CLI for R2 backup bucket (S3-compatible)
  export AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="auto"

  # Upload with retry
  local attempt=1
  local max_attempts=3

  while [[ $attempt -le $max_attempts ]]; do
    if aws s3 cp "$encrypted_path" "$s3_path" \
        --endpoint-url "$R2_ENDPOINT" \
        --no-progress 2>&1; then
      log_info "Upload complete (attempt $attempt)"
      return 0
    fi

    log_warn "Upload attempt $attempt failed, retrying..."
    attempt=$((attempt + 1))
    sleep 5
  done

  log_error "Upload failed after $max_attempts attempts"
  exit 1
}

# ── Clean up old local backups ───────────────────────────────────────
cleanup_old_local_backups() {
  log_info "Cleaning up local backups older than ${LOCAL_RETENTION_DAYS} days"

  local deleted=0
  while read -r file; do
    [[ -z "$file" ]] && continue
    log_info "Removing local: $(basename "$file")"
    rm -f "$file"
    deleted=$((deleted + 1))
  done < <(find "$BACKUP_DIR" -name "humans_marketplace-*.dump.enc" -type f -mtime "+${LOCAL_RETENTION_DAYS}" 2>/dev/null || true)

  log_info "Local cleanup done (removed $deleted files)"
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
  log_info "=========================================="
  log_info "Database Backup Starting"
  log_info "=========================================="

  load_config

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "Dry run — validating configuration only"
    check_prerequisites
    log_info "Configuration valid. Database: ${DB_DISPLAY}"
    log_info "R2 endpoint: ${R2_ENDPOINT}"
    log_info "R2 bucket: ${R2_BUCKET}/${R2_PREFIX}"
    log_info "Encryption: AES-256-CBC (key set)"
    log_info "R2 retention: managed by bucket lifecycle rule (set in Cloudflare dashboard)"
    log_info "Local retention: ${LOCAL_RETENTION_DAYS} days"
    log_info "Telegram: $([ -n "${TELEGRAM_BOT_TOKEN:-}" ] && echo 'configured' || echo 'not configured')"
    log_info "Dry run complete — all checks passed"
    exit 0
  fi

  check_prerequisites
  create_backup
  encrypt_backup
  upload_to_r2
  cleanup_old_local_backups

  local end_time
  end_time="$(date +%s)"
  local duration=$(( end_time - START_TIME ))

  log_info "Backup completed in ${duration}s"
  log_info "=========================================="

  # Success notification
  send_telegram "DB Backup OK" "File: ${ENCRYPTED_FILENAME}\nSize: ${BACKUP_SIZE_HR}\nEncrypted: AES-256\nDuration: ${duration}s"
}

main "$@"
