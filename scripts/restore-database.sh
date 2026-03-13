#!/bin/bash
# ─── Database Restore — Download from R2 & pg_restore ───────────────
# Disaster recovery script. Lists available backups on R2, downloads
# a selected backup, and restores it to the database.
#
# Usage:
#   sh scripts/restore-database.sh --list                    # list backups
#   sh scripts/restore-database.sh <filename>                # restore specific
#   sh scripts/restore-database.sh --latest                  # restore most recent
#
# CAUTION: Restoring REPLACES the current database contents.
#          The script will stop PM2, restore, and restart.
#
# Environment variables (same as backup-database.sh):
#   DATABASE_URL, R2_BACKUP_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY_ID,
#   R2_BACKUP_SECRET_ACCESS_KEY, DB_BACKUP_ENCRYPTION_KEY
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESTORE_DIR="${PROJECT_DIR}/backups/restore-tmp"
R2_BUCKET="hp-db-backups"
R2_PREFIX="postgres"

# ── Color helpers (disabled when not a terminal) ─────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' NC=''
fi

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Load configuration ───────────────────────────────────────────────
load_config() {
  if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "${PROJECT_DIR}/backend/.env" ]]; then
    info "Loading credentials from backend/.env"
    while IFS= read -r line; do
      [[ -z "$line" || "$line" =~ ^# ]] && continue
      local key="${line%%=*}"
      local value="${line#*=}"
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      case "$key" in
        DATABASE_URL|DIRECT_DATABASE_URL|R2_BACKUP_ACCOUNT_ID|R2_BACKUP_ACCESS_KEY_ID|R2_BACKUP_SECRET_ACCESS_KEY|DB_BACKUP_ENCRYPTION_KEY)
          export "$key=$value"
          ;;
      esac
    done < "${PROJECT_DIR}/backend/.env"
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    error "DATABASE_URL is not set"
    exit 1
  fi

  # Use full connection URL to avoid parsing issues with special chars in passwords
  PG_CONN_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"
  local display_url="${PG_CONN_URL%%\?*}"
  DB_DISPLAY=$(echo "$display_url" | sed -E 's|(://[^:]+:)[^@]+(@)|\1***\2|')

  if [[ -z "${R2_BACKUP_ACCOUNT_ID:-}" || -z "${R2_BACKUP_ACCESS_KEY_ID:-}" || -z "${R2_BACKUP_SECRET_ACCESS_KEY:-}" ]]; then
    error "R2 backup credentials not configured (R2_BACKUP_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY_ID, R2_BACKUP_SECRET_ACCESS_KEY)"
    exit 1
  fi

  R2_ENDPOINT="https://${R2_BACKUP_ACCOUNT_ID}.r2.cloudflarestorage.com"
  export AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="auto"

  # Encryption key required for decrypting backups
  if [[ -z "${DB_BACKUP_ENCRYPTION_KEY:-}" ]]; then
    error "DB_BACKUP_ENCRYPTION_KEY is not set. Cannot decrypt backups."
    exit 1
  fi
}

# ── List available backups ───────────────────────────────────────────
list_backups() {
  load_config

  info "Available backups in R2 (${R2_BUCKET}/${R2_PREFIX}/):"
  echo ""
  printf "  %-45s %s\n" "FILENAME" "SIZE"
  printf "  %-45s %s\n" "--------" "----"

  aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/" \
    --endpoint-url "$R2_ENDPOINT" 2>/dev/null | sort -r | while read -r line; do
    local date_str
    date_str=$(echo "$line" | awk '{print $1, $2}')
    local size_bytes
    size_bytes=$(echo "$line" | awk '{print $3}')
    local filename
    filename=$(echo "$line" | awk '{print $4}')

    [[ -z "$filename" ]] && continue

    local size_hr
    size_hr=$(numfmt --to=iec "$size_bytes" 2>/dev/null || echo "${size_bytes}B")
    printf "  %-45s %s\n" "$filename" "$size_hr"
  done

  echo ""
  info "To restore: sh scripts/restore-database.sh <filename>"
  info "To restore latest: sh scripts/restore-database.sh --latest"
}

# ── Get latest backup filename ───────────────────────────────────────
get_latest_backup() {
  aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/" \
    --endpoint-url "$R2_ENDPOINT" 2>/dev/null | sort -r | head -1 | awk '{print $4}'
}

# ── Download backup from R2 ─────────────────────────────────────────
download_backup() {
  local filename="$1"
  local dest="${RESTORE_DIR}/${filename}"

  mkdir -p "$RESTORE_DIR"

  info "Downloading: ${filename}"
  aws s3 cp "s3://${R2_BUCKET}/${R2_PREFIX}/${filename}" "$dest" \
    --endpoint-url "$R2_ENDPOINT" \
    --no-progress

  # Validate
  local file_size
  file_size=$(stat -f%z "$dest" 2>/dev/null || stat -c%s "$dest" 2>/dev/null)

  if [[ "$file_size" -lt 1024 ]]; then
    error "Downloaded file is suspiciously small (${file_size} bytes)"
    rm -f "$dest"
    exit 1
  fi

  local size_hr
  size_hr=$(numfmt --to=iec "$file_size" 2>/dev/null || echo "${file_size} bytes")
  info "Downloaded: ${size_hr}"

  echo "$dest"
}

# ── Decrypt backup ────────────────────────────────────────────────────
decrypt_backup() {
  local encrypted_file="$1"
  local decrypted_file="${encrypted_file%.enc}"

  # If file is not encrypted (.dump.enc), skip decryption
  if [[ "$encrypted_file" != *.enc ]]; then
    info "File is not encrypted, skipping decryption"
    echo "$encrypted_file"
    return 0
  fi

  info "Decrypting backup with AES-256-CBC..."

  if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
    -in "$encrypted_file" \
    -out "$decrypted_file" \
    -pass env:DB_BACKUP_ENCRYPTION_KEY 2>/dev/null; then
    error "Decryption failed — wrong encryption key or corrupted file"
    rm -f "$decrypted_file"
    exit 1
  fi

  # Remove encrypted file, keep only decrypted
  rm -f "$encrypted_file"

  local dec_size
  dec_size=$(stat -f%z "$decrypted_file" 2>/dev/null || stat -c%s "$decrypted_file" 2>/dev/null)
  local dec_hr
  dec_hr=$(numfmt --to=iec "$dec_size" 2>/dev/null || echo "${dec_size} bytes")
  info "Decrypted: ${dec_hr}"

  echo "$decrypted_file"
}

# ── Restore database ────────────────────────────────────────────────
restore_database() {
  local backup_file="$1"

  echo ""
  echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              DANGER: DATABASE RESTORE            ║${NC}"
  echo -e "${RED}╠══════════════════════════════════════════════════╣${NC}"
  echo -e "${RED}║                                                  ║${NC}"
  echo -e "${RED}║  This will REPLACE the current database.         ║${NC}"
  echo -e "${RED}║  Target: ${DB_DISPLAY}${NC}"
  echo -e "${RED}║  From: $(basename "$backup_file")${NC}"
  echo -e "${RED}║                                                  ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -n "Type 'RESTORE' to confirm: "
  read -r confirm

  if [[ "$confirm" != "RESTORE" ]]; then
    info "Restore cancelled."
    rm -f "$backup_file"
    exit 0
  fi

  # Stop application
  info "Stopping application (pm2 stop human-pages)..."
  pm2 stop human-pages 2>/dev/null || warn "PM2 stop failed (app may not be running)"
  sleep 2

  # Create a safety backup before restoring
  info "Creating safety backup of current database..."
  local safety_file="${RESTORE_DIR}/pre-restore-safety-$(date +%Y%m%d-%H%M%S).dump"
  pg_dump "$PG_CONN_URL" \
    -Fc --no-owner --no-privileges \
    -f "$safety_file" 2>/dev/null || warn "Safety backup failed (proceeding anyway)"

  if [[ -f "$safety_file" ]]; then
    local safety_size
    safety_size=$(stat -f%z "$safety_file" 2>/dev/null || stat -c%s "$safety_file" 2>/dev/null || echo "0")
    local safety_hr
    safety_hr=$(numfmt --to=iec "$safety_size" 2>/dev/null || echo "${safety_size} bytes")
    info "Safety backup saved: ${safety_file} (${safety_hr})"
  fi

  # Restore — pg_restore returns non-zero on warnings (e.g. dropping non-existent objects)
  # which is expected with --clean --if-exists, so we check for actual failure separately
  info "Restoring database from backup..."
  local restore_output
  restore_output=$(pg_restore \
    -d "$PG_CONN_URL" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "$backup_file" 2>&1) || true

  # Check if restore actually failed (look for FATAL or connection errors)
  if echo "$restore_output" | grep -qi "FATAL\|could not connect\|authentication failed"; then
    error "Restore FAILED:"
    echo "$restore_output"
    warn "Starting PM2 with previous database state..."
    pm2 restart human-pages 2>/dev/null || true
    exit 1
  fi

  if [[ -n "$restore_output" ]]; then
    warn "pg_restore completed with warnings (usually harmless):"
    echo "$restore_output" | head -10
  fi

  # Restart application
  info "Restarting application (pm2 restart human-pages)..."
  pm2 restart human-pages 2>/dev/null || pm2 start human-pages 2>/dev/null || warn "PM2 restart failed — start manually"

  # Cleanup downloaded file
  rm -f "$backup_file"

  echo ""
  info "Restore complete!"
  info "Safety backup saved at: ${safety_file}"
  echo ""
  info "Verify the restore:"
  info "  1. Check app: pm2 logs human-pages --lines 20"
  info "  2. Test DB: psql '${PG_CONN_URL}' -c 'SELECT count(*) FROM \"Human\";'"
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
  if [[ $# -eq 0 ]]; then
    echo "Usage:"
    echo "  sh scripts/restore-database.sh --list              # list available backups"
    echo "  sh scripts/restore-database.sh --latest            # restore most recent backup"
    echo "  sh scripts/restore-database.sh <filename>          # restore specific backup"
    exit 0
  fi

  case "$1" in
    --list|-l)
      list_backups
      ;;
    --latest)
      load_config
      local latest
      latest=$(get_latest_backup)
      if [[ -z "$latest" ]]; then
        error "No backups found in R2"
        exit 1
      fi
      info "Latest backup: ${latest}"
      local downloaded
      downloaded=$(download_backup "$latest")
      local decrypted
      decrypted=$(decrypt_backup "$downloaded")
      restore_database "$decrypted"
      ;;
    *)
      load_config
      local filename="$1"
      # Check if it exists in R2
      if ! aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/${filename}" --endpoint-url "$R2_ENDPOINT" &>/dev/null; then
        error "Backup not found in R2: ${filename}"
        info "Run --list to see available backups"
        exit 1
      fi
      local downloaded
      downloaded=$(download_backup "$filename")
      local decrypted
      decrypted=$(decrypt_backup "$downloaded")
      restore_database "$decrypted"
      ;;
  esac
}

main "$@"
