#!/bin/bash
# ─── Database Backup Setup — One-Time Installation ──────────────────
# Installs prerequisites, configures R2 access, creates directories,
# sets up a daily cron job, and runs a test backup.
#
# Run once on the production server:
#   sh scripts/setup-db-backups.sh
#
# Prerequisites:
#   - PostgreSQL client tools (pg_dump)
#   - AWS CLI (for S3-compatible R2 access)
#   - Database credentials in environment or backend/.env
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-database.sh"
CRON_LOG="${PROJECT_DIR}/logs/backup-cron.log"

echo "╔══════════════════════════════════════════════════╗"
echo "║      Database Backup — One-Time Setup            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Check prerequisites ──────────────────────────────────────────
echo "→ Step 1/6: Checking prerequisites..."

missing=()

if ! command -v pg_dump &>/dev/null; then
  missing+=("postgresql-client")
fi

if ! command -v aws &>/dev/null; then
  missing+=("awscli")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "  Missing packages: ${missing[*]}"
  echo "  Attempting to install..."

  if command -v apt &>/dev/null; then
    sudo apt update -qq
    sudo apt install -y -qq "${missing[@]}"
  elif command -v yum &>/dev/null; then
    sudo yum install -y -q "${missing[@]}"
  else
    echo "  ERROR: Cannot auto-install. Please install manually: ${missing[*]}"
    exit 1
  fi

  echo "  Packages installed successfully"
else
  echo "  All prerequisites found (pg_dump, aws)"
fi
echo ""

# ── 2. Ensure encryption key exists ──────────────────────────────────
echo "→ Step 2/6: Checking encryption key..."

# Load .env to check for existing key
ENV_FILE="${PROJECT_DIR}/backend/.env"
HAS_ENC_KEY=false
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^DB_BACKUP_ENCRYPTION_KEY=" "$ENV_FILE" 2>/dev/null; then
    HAS_ENC_KEY=true
  fi
fi

# Also check environment
if [[ -n "${DB_BACKUP_ENCRYPTION_KEY:-}" ]]; then
  HAS_ENC_KEY=true
fi

if [[ "$HAS_ENC_KEY" == "false" ]]; then
  echo "  No encryption key found. Generating one..."
  NEW_KEY=$(openssl rand -base64 32)
  echo "" >> "$ENV_FILE"
  echo "# AES-256 encryption key for database backups (DO NOT LOSE — backups are unrecoverable without it)" >> "$ENV_FILE"
  echo "DB_BACKUP_ENCRYPTION_KEY=${NEW_KEY}" >> "$ENV_FILE"
  echo ""
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║  IMPORTANT: Encryption key generated and saved to    ║"
  echo "  ║  backend/.env. You MUST also add it to Infisical:    ║"
  echo "  ║                                                      ║"
  echo "  ║  Key: DB_BACKUP_ENCRYPTION_KEY                       ║"
  echo "  ║  Value: ${NEW_KEY}"
  echo "  ║                                                      ║"
  echo "  ║  SAVE THIS KEY SECURELY — without it, encrypted      ║"
  echo "  ║  backups cannot be restored.                         ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo ""
else
  echo "  Encryption key found"
fi

# Check for R2 backup credentials
HAS_R2_BACKUP=false
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^R2_BACKUP_ACCESS_KEY_ID=" "$ENV_FILE" 2>/dev/null; then
    HAS_R2_BACKUP=true
  fi
fi
if [[ -n "${R2_BACKUP_ACCESS_KEY_ID:-}" ]]; then
  HAS_R2_BACKUP=true
fi

if [[ "$HAS_R2_BACKUP" == "false" ]]; then
  echo ""
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║  WARNING: R2 backup credentials not found.           ║"
  echo "  ║                                                      ║"
  echo "  ║  Create an R2 API token in Cloudflare Dashboard      ║"
  echo "  ║  scoped to the 'hp-db-backups' bucket only,          ║"
  echo "  ║  then add to Infisical and backend/.env:             ║"
  echo "  ║                                                      ║"
  echo "  ║    R2_BACKUP_ACCOUNT_ID=<your-cf-account-id>         ║"
  echo "  ║    R2_BACKUP_ACCESS_KEY_ID=<token>                   ║"
  echo "  ║    R2_BACKUP_SECRET_ACCESS_KEY=<secret>              ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo ""
else
  echo "  R2 backup credentials found"
fi
echo ""

# ── 3. Create directories ───────────────────────────────────────────
echo "→ Step 3/6: Creating directories..."

mkdir -p "${PROJECT_DIR}/backups/postgres"
mkdir -p "${PROJECT_DIR}/logs"

echo "  Created: backups/postgres/"
echo "  Created: logs/"
echo ""

# ── 4. Make backup script executable ────────────────────────────────
echo "→ Step 4/6: Setting permissions..."

chmod +x "$BACKUP_SCRIPT"
chmod +x "${SCRIPT_DIR}/restore-database.sh" 2>/dev/null || true

echo "  backup-database.sh → executable"
echo ""

# ── 5. Install cron job ─────────────────────────────────────────────
echo "→ Step 5/6: Installing cron job..."

CRON_CMD="0 2 * * * cd ${PROJECT_DIR} && ${BACKUP_SCRIPT} >> ${CRON_LOG} 2>&1"
CRON_MARKER="# human-pages-db-backup"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "human-pages-db-backup"; then
  echo "  Cron job already installed. Updating..."
  # Remove old entry and add new one
  (crontab -l 2>/dev/null | grep -v "human-pages-db-backup"; echo "${CRON_CMD} ${CRON_MARKER}") | crontab -
else
  # Add to existing crontab
  (crontab -l 2>/dev/null; echo "${CRON_CMD} ${CRON_MARKER}") | crontab -
fi

echo "  Cron job installed: daily at 2:00 AM"
echo "  Entry: ${CRON_CMD}"
echo ""

# ── 6. Test run ──────────────────────────────────────────────────────
echo "→ Step 6/6: Running validation..."

cd "$PROJECT_DIR"
if bash "$BACKUP_SCRIPT" --dry-run; then
  echo ""
  echo "  Validation passed!"
else
  echo ""
  echo "  WARNING: Dry run failed. Check configuration before relying on cron."
  echo "  Fix issues, then run: sh scripts/backup-database.sh --dry-run"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║          Backup Setup Complete!                  ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  Schedule: Daily at 2:00 AM                      ║"
echo "║  Encryption: AES-256-CBC                         ║"
echo "║  R2 bucket: hp-db-backups/postgres/              ║"
echo "║  R2 retention: set via bucket lifecycle (30d)     ║"
echo "║  Local retention: 7 days                         ║"
echo "║                                                  ║"
echo "║  MANUAL STEP REQUIRED:                           ║"
echo "║  Set a 30-day lifecycle rule on the               ║"
echo "║  'hp-db-backups' R2 bucket in Cloudflare:         ║"
echo "║  Dashboard → R2 → hp-db-backups → Settings →      ║"
echo "║  Object lifecycle → Add rule → Delete after 30d  ║"
echo "║                                                  ║"
echo "║  Useful commands:                                ║"
echo "║    sh scripts/backup-database.sh        # manual ║"
echo "║    sh scripts/backup-database.sh --dry-run       ║"
echo "║    sh scripts/restore-database.sh --list         ║"
echo "║    crontab -l | grep backup             # verify ║"
echo "║    tail -f logs/backup.log              # watch  ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
