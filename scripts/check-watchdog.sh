#!/bin/bash
# Quick diagnostic: is Watch Dog running and configured correctly?
set -e

echo "═══════════════════════════════════════"
echo "  Watch Dog Health Check"
echo "═══════════════════════════════════════"
echo ""

# 1. Check PM2 process
echo "1. PM2 process"
if pm2 list 2>/dev/null | grep -q "human-pages"; then
  echo "   ✓ human-pages is running"
else
  echo "   ✗ human-pages not found in PM2"
fi
echo ""

# 2. Check PM2 log files exist
echo "2. PM2 log files"
APP_NAME="${PM2_APP_NAME:-human-pages}"
LOG_DIR="${PM2_LOG_DIR:-$HOME/.pm2/logs}"
for suffix in out error; do
  FILE="$LOG_DIR/${APP_NAME}-${suffix}.log"
  if [ -f "$FILE" ]; then
    SIZE=$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE" 2>/dev/null || echo "?")
    echo "   ✓ $FILE ($SIZE bytes)"
  else
    echo "   ✗ $FILE not found"
  fi
done
echo ""

# 3. Check cursor file
echo "3. Cursor tracking"
CURSOR_FILE="$LOG_DIR/.watchdog-cursors.json"
if [ -f "$CURSOR_FILE" ]; then
  echo "   ✓ $CURSOR_FILE exists"
  cat "$CURSOR_FILE" | head -5
else
  echo "   - No cursor file yet (will be created on first run)"
fi
echo ""

# 4. Check secrets
echo "4. Environment / secrets"
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "   ✓ ANTHROPIC_API_KEY is set (${#ANTHROPIC_API_KEY} chars)"
else
  echo "   ✗ ANTHROPIC_API_KEY not set — Claude analysis won't work"
fi
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  echo "   ✓ TELEGRAM_BOT_TOKEN is set"
else
  echo "   ✗ TELEGRAM_BOT_TOKEN not set — Telegram alerts won't work"
fi
if [ -n "$TELEGRAM_ADMIN_CHAT_ID" ]; then
  echo "   ✓ TELEGRAM_ADMIN_CHAT_ID is set ($TELEGRAM_ADMIN_CHAT_ID)"
else
  echo "   ✗ TELEGRAM_ADMIN_CHAT_ID not set — Telegram alerts won't work"
fi
echo ""

# 5. Check Claude CLI
echo "5. Claude Code CLI"
if command -v claude &>/dev/null; then
  echo "   ✓ claude CLI found at $(which claude)"
else
  echo "   ✗ claude CLI not on PATH — auto-fix won't work"
  echo "     Install with: npm install -g @anthropic-ai/claude-code"
fi
echo ""

# 6. Check migration applied
echo "6. Database migration"
if [ -f "backend/prisma/migrations/20260313101300_add_autofix_fields/migration.sql" ]; then
  echo "   ✓ Migration file exists"
  # Check if column exists in DB
  cd backend 2>/dev/null
  if npx prisma migrate status 2>&1 | grep -q "20260313101300"; then
    echo "   ✓ Migration applied"
  else
    echo "   ? Run: cd backend && npx prisma migrate deploy"
  fi
  cd .. 2>/dev/null
fi
echo ""

# 7. Check recent logs for Watch Dog messages
echo "7. Recent Watch Dog activity (last 20 log lines)"
LOG_FILE="$LOG_DIR/${APP_NAME}-out.log"
if [ -f "$LOG_FILE" ]; then
  grep -i "watch dog" "$LOG_FILE" | tail -5 || echo "   No Watch Dog log entries found yet"
else
  echo "   Log file not found"
fi
echo ""

echo "═══════════════════════════════════════"
echo "  Done. To test the full pipeline:"
echo "  curl -X POST /api/admin/watchdog/test-alert"
echo "═══════════════════════════════════════"
