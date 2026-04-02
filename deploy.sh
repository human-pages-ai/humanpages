#!/bin/bash
set -e

echo "=== Deploying Human Pages ==="
cd /opt/human-pages
git pull

cd backend
npm install --no-fund --no-audit --loglevel=error
echo "=== Running migrations ==="
npx prisma migrate deploy
npm run build

cd ../frontend
npm install --no-fund --no-audit --loglevel=error
# Load Infisical credentials from backend .env
extract_env() { grep "^$1=" ../backend/.env | cut -d= -f2- | tr -d '"\r\n'"'"; }
export INFISICAL_CLIENT_ID=$(extract_env INFISICAL_CLIENT_ID)
export INFISICAL_CLIENT_SECRET=$(extract_env INFISICAL_CLIENT_SECRET)
export INFISICAL_PROJECT_ID=$(extract_env INFISICAL_PROJECT_ID)
node ../scripts/inject-frontend-env.mjs
npm run build 2>&1 | grep -v "contains an annotation that Rollup cannot interpret"
# Clean up JS/CSS assets older than 24h (keeps old chunks for users with stale HTML)
DELETED=$(bash ../scripts/clean-old-assets.sh 2>&1 | grep -c "^/")
echo "Cleaned $DELETED old asset(s)"

echo ""
echo "=== Injecting secrets to all satellite repos ==="
cd /opt/human-pages
node scripts/inject-all-secrets.mjs

echo ""
echo "=== Deploying auxiliary services in parallel ==="

deploy_video() {
  echo "=== Deploying Video Pipeline ==="
  cd /opt/video-pipeline
  git pull
  if [ ! -d "venv" ]; then
    echo "Creating Python venv..."
    python3 -m venv venv
  fi
  # Only reinstall if requirements changed
  REQ_HASH=$(md5sum requirements.txt | cut -d' ' -f1)
  if [ ! -f "venv/.req_hash" ] || [ "$(cat venv/.req_hash)" != "$REQ_HASH" ]; then
    source venv/bin/activate
    pip install -q -r requirements.txt
    deactivate
    echo "$REQ_HASH" > venv/.req_hash
  fi
  echo "Video pipeline dependencies installed"
  systemctl --user restart video-worker 2>/dev/null || true
}

deploy_photo() {
  echo "=== Deploying Photo Pipeline ==="
  cd /opt/photo-pipeline
  git pull
  if [ ! -d "venv" ]; then
    echo "Creating Python venv..."
    python3 -m venv venv
  fi
  REQ_HASH=$(md5sum requirements.txt | cut -d' ' -f1)
  if [ ! -f "venv/.req_hash" ] || [ "$(cat venv/.req_hash)" != "$REQ_HASH" ]; then
    source venv/bin/activate
    pip install -q -r requirements.txt
    deactivate
    echo "$REQ_HASH" > venv/.req_hash
  fi
  echo "Photo pipeline dependencies installed"
}

deploy_leadgen() {
  echo "=== Deploying Lead Gen Pipeline ==="
  if [ -d /opt/lead-gen-pipeline ]; then
    cd /opt/lead-gen-pipeline
    git pull
    npm install --no-fund --no-audit --loglevel=error
    echo "Lead gen pipeline dependencies installed"
  else
    echo "SKIP: /opt/lead-gen-pipeline not found"
  fi
}

deploy_mcp() {
  echo "=== Deploying MCP Server ==="
  if [ -d /opt/humanpages ]; then
    cd /opt/humanpages
    git pull
    npm install --no-fund --no-audit --loglevel=error
    npm run build
    pm2 restart humanpages-mcp 2>/dev/null || API_BASE_URL=http://localhost:3001 HTTP_PORT=3002 pm2 start dist/http.js --name humanpages-mcp
    echo "MCP server updated & restarted"
  else
    echo "SKIP: /opt/humanpages not found"
  fi
}

# Run all four in parallel, wait for all to finish
deploy_video &
deploy_photo &
deploy_leadgen &
deploy_mcp &
wait

echo ""
echo "=== Deploying Solver LLM Service ==="
cd /opt/human-pages/services/solver-llm
npm install --no-fund --no-audit --loglevel=error
pm2 restart solver-llm --silent 2>/dev/null || pm2 start npx --name solver-llm -- tsx index.ts
echo "Solver LLM service restarted"

echo ""
echo "=== Restarting services ==="
pm2 restart human-pages --silent
echo "Deployed successfully"

# NOTE: Database backups run via system cron (daily at 2 AM).
# First-time setup on a new server:
#   sh scripts/setup-db-backups.sh
# Manual backup:
#   sh scripts/backup-database.sh
# List/restore backups:
#   sh scripts/restore-database.sh --list
