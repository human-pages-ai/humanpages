#!/bin/bash
# ─── Watch Dog Setup ────────────────────────────────────────────────
# Run this on the deploy server to verify Watch Dog configuration.
# Prerequisites: ANTHROPIC_API_KEY and TELEGRAM_ADMIN_CHAT_ID must
# be set in Infisical (or backend/.env for dev).
# ────────────────────────────────────────────────────────────────────
set -e

cd /opt/human-pages

echo "╔══════════════════════════════════════════════════╗"
echo "║          Watch Dog Setup Verification            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Pull latest code ────────────────────────────────────────────
echo "→ Pulling latest code..."
git pull

# ── 2. Install deps + run migration ───────────────────────────────
echo ""
echo "→ Installing backend dependencies..."
cd backend
npm ci --include=dev

echo ""
echo "→ Running Prisma migrations (adds MonitoredError table)..."
npx prisma migrate deploy

echo ""
echo "→ Generating Prisma client..."
npx prisma generate

echo ""
echo "→ Building backend..."
npm run build

# ── 3. Build frontend ─────────────────────────────────────────────
echo ""
echo "→ Installing frontend dependencies..."
cd ../frontend
npm ci --include=dev

# Load Infisical credentials from backend .env
extract_env() { grep "^$1=" ../backend/.env | cut -d= -f2- | tr -d '"\r\n'"'"; }
export INFISICAL_CLIENT_ID=$(extract_env INFISICAL_CLIENT_ID)
export INFISICAL_CLIENT_SECRET=$(extract_env INFISICAL_CLIENT_SECRET)
export INFISICAL_PROJECT_ID=$(extract_env INFISICAL_PROJECT_ID)
node ../scripts/inject-frontend-env.mjs
npm run build

# ── 4. Verify secrets are configured ──────────────────────────────
cd /opt/human-pages
echo ""
echo "═══ Checking required secrets ═══"

MISSING=0

# Check via node - loads Infisical and checks env
CHECK_RESULT=$(cd backend && node -e "
  import('dotenv/config').then(async () => {
    const missing = [];
    const keys = ['AXIOM_TOKEN', 'AXIOM_DATASET', 'ANTHROPIC_API_KEY', 'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_BOT_TOKEN'];
    for (const key of keys) {
      if (!process.env[key]) missing.push(key);
    }
    if (missing.length > 0) {
      console.log('MISSING:' + missing.join(','));
    } else {
      console.log('ALL_OK');
    }
  });
" 2>/dev/null || echo "CHECK_FAILED")

if echo "$CHECK_RESULT" | grep -q "ALL_OK"; then
  echo "  ✅ All required secrets are configured"
elif echo "$CHECK_RESULT" | grep -q "MISSING:"; then
  KEYS=$(echo "$CHECK_RESULT" | sed 's/MISSING://')
  echo "  ⚠️  Missing secrets (add to Infisical):"
  IFS=',' read -ra ARR <<< "$KEYS"
  for key in "${ARR[@]}"; do
    echo "     - $key"
  done
  MISSING=1
else
  echo "  ⚠️  Could not verify secrets (Infisical may load them at runtime)"
  echo "     Make sure these are set in Infisical:"
  echo "     - ANTHROPIC_API_KEY (from console.anthropic.com)"
  echo "     - TELEGRAM_ADMIN_CHAT_ID (your admin Telegram chat ID)"
  echo "     - AXIOM_TOKEN (already configured)"
  echo "     - AXIOM_DATASET (already configured)"
  echo "     - TELEGRAM_BOT_TOKEN (already configured)"
fi

# ── 5. Help find Telegram chat ID if needed ───────────────────────
if [ $MISSING -eq 1 ] && echo "$CHECK_RESULT" | grep -q "TELEGRAM_ADMIN_CHAT_ID"; then
  echo ""
  echo "═══ How to get your TELEGRAM_ADMIN_CHAT_ID ═══"
  echo "  1. Open Telegram and message your bot"
  echo "  2. Run this command:"
  echo ""
  BOT_TOKEN=$(cd backend && node -e "import('dotenv/config').then(() => console.log(process.env.TELEGRAM_BOT_TOKEN || ''))" 2>/dev/null)
  if [ -n "$BOT_TOKEN" ]; then
    echo "     curl -s https://api.telegram.org/bot${BOT_TOKEN}/getUpdates | python3 -m json.tool | grep '\"id\"' | head -3"
  else
    echo "     curl -s https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/getUpdates | python3 -m json.tool | grep '\"id\"' | head -3"
  fi
  echo ""
  echo "  3. Copy the chat ID number and add it to Infisical as TELEGRAM_ADMIN_CHAT_ID"
fi

# ── 6. Restart PM2 ───────────────────────────────────────────────
echo ""
echo "→ Restarting PM2..."
pm2 restart human-pages

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║            Watch Dog Setup Complete!              ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  The worker runs every 5 minutes automatically.  ║"
echo "║  Check /admin/watchdog in the dashboard.         ║"
echo "║                                                  ║"
echo "║  To verify it's running, check logs:             ║"
echo "║    pm2 logs human-pages | grep 'Watch Dog'       ║"
echo "╚══════════════════════════════════════════════════╝"
