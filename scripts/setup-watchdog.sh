#!/bin/bash
# ─── Watch Dog — Full Autonomous Setup ──────────────────────────────
# Run this on the deploy server. Does everything:
#   1. Pulls latest code
#   2. Adds missing secrets to Infisical (auto-discovers Telegram chat ID)
#   3. Runs DB migration (creates MonitoredError table)
#   4. Builds backend + frontend
#   5. Re-injects secrets to satellite repos
#   6. Restarts PM2
#
# Usage:
#   sh scripts/setup-watchdog.sh
#
# If ANTHROPIC_API_KEY isn't in Infisical yet, pass it:
#   ANTHROPIC_API_KEY=sk-ant-... sh scripts/setup-watchdog.sh
# ────────────────────────────────────────────────────────────────────
set -e

cd /opt/human-pages

echo "╔══════════════════════════════════════════════════╗"
echo "║        Watch Dog — Full Autonomous Setup         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Pull latest code ────────────────────────────────────────────
echo "→ Step 1/6: Pulling latest code..."
git pull
echo ""

# ── 2. Ensure secrets exist in Infisical ───────────────────────────
echo "→ Step 2/6: Configuring secrets in Infisical..."
# Load Infisical creds from backend .env
extract_env() { grep "^$1=" backend/.env 2>/dev/null | cut -d= -f2- | tr -d '"\r\n'"'"; }
export INFISICAL_CLIENT_ID=$(extract_env INFISICAL_CLIENT_ID)
export INFISICAL_CLIENT_SECRET=$(extract_env INFISICAL_CLIENT_SECRET)
export INFISICAL_PROJECT_ID=$(extract_env INFISICAL_PROJECT_ID)

cd backend
node ../scripts/ensure-watchdog-secrets.mjs
cd ..
echo ""

# ── 3. Install deps + run migration ───────────────────────────────
echo "→ Step 3/6: Backend — install, migrate, generate, build..."
cd backend
npm ci --include=dev
echo "  Running Prisma migrations..."
npx prisma migrate deploy
echo "  Generating Prisma client..."
npx prisma generate
echo "  Building backend..."
npm run build
cd ..
echo ""

# ── 4. Build frontend ─────────────────────────────────────────────
echo "→ Step 4/6: Frontend — install, inject env, build..."
cd frontend
npm ci --include=dev
node ../scripts/inject-frontend-env.mjs
npm run build
cd ..
echo ""

# ── 5. Re-inject secrets to satellite repos ───────────────────────
echo "→ Step 5/6: Injecting secrets to satellite repos..."
node scripts/inject-all-secrets.mjs
echo ""

# ── 6. Restart PM2 ───────────────────────────────────────────────
echo "→ Step 6/6: Restarting PM2..."
pm2 restart human-pages

# Wait a few seconds for the worker to start
sleep 5

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║          Watch Dog Setup Complete!               ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  DB migration applied                            ║"
echo "║  Secrets configured in Infisical                 ║"
echo "║  Backend + Frontend rebuilt                      ║"
echo "║  PM2 restarted                                   ║"
echo "║                                                  ║"
echo "║  The Watch Dog worker runs every 5 minutes.      ║"
echo "║  Dashboard: /admin/watchdog                      ║"
echo "║                                                  ║"
echo "║  Verify it's running:                            ║"
echo "║    pm2 logs human-pages --lines 20 | grep Watch  ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
