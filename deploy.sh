#!/bin/bash
set -e

echo "=== Deploying Human Pages ==="
cd /opt/human-pages
git pull

cd backend
npm ci --include=dev
echo "=== Running migrations ==="
npx prisma migrate deploy
npm run build

cd ../frontend
npm ci --include=dev
# Load Infisical credentials from backend .env
extract_env() { grep "^$1=" ../backend/.env | cut -d= -f2- | tr -d '"\r\n'"'"; }
export INFISICAL_CLIENT_ID=$(extract_env INFISICAL_CLIENT_ID)
export INFISICAL_CLIENT_SECRET=$(extract_env INFISICAL_CLIENT_SECRET)
export INFISICAL_PROJECT_ID=$(extract_env INFISICAL_PROJECT_ID)
node ../scripts/inject-frontend-env.mjs
npm run build
# Clean up JS/CSS assets older than 24h (keeps old chunks for users with stale HTML)
bash ../scripts/clean-old-assets.sh

echo ""
echo "=== Injecting secrets to all satellite repos ==="
cd /opt/human-pages
node scripts/inject-all-secrets.mjs

echo ""
echo "=== Deploying Video Pipeline ==="
cd /opt/video-pipeline
git pull

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt
deactivate

echo "Video pipeline dependencies installed"

# Restart video worker if running
systemctl --user restart video-worker 2>/dev/null || true

echo ""
echo "=== Deploying Photo Pipeline ==="
cd /opt/photo-pipeline
git pull

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt
deactivate

echo "Photo pipeline dependencies installed"

echo ""
echo "=== Deploying Lead Gen Pipeline ==="
if [ -d /opt/lead-gen-pipeline ]; then
  cd /opt/lead-gen-pipeline
  git pull
  npm install --no-fund --no-audit
  echo "Lead gen pipeline dependencies installed"
else
  echo "SKIP: /opt/lead-gen-pipeline not found"
fi

echo ""
echo "=== Deploying MCP Server ==="
if [ -d /opt/humanpages ]; then
  cd /opt/humanpages
  git pull
  npm ci --include=dev
  npm run build
  echo "MCP server updated"
else
  echo "SKIP: /opt/humanpages not found"
fi

echo ""
echo "=== Restarting services ==="
pm2 restart human-pages
echo "Deployed successfully"

# NOTE: Database backups run via system cron (daily at 2 AM).
# First-time setup on a new server:
#   sh scripts/setup-db-backups.sh
# Manual backup:
#   sh scripts/backup-database.sh
# List/restore backups:
#   sh scripts/restore-database.sh --list
