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
# Load only Infisical credentials needed by inject-frontend-env.mjs
extract_env() { grep "^$1=" ../backend/.env | cut -d= -f2- | tr -d '"\r\n'"'"; }
export INFISICAL_CLIENT_ID=$(extract_env INFISICAL_CLIENT_ID)
export INFISICAL_CLIENT_SECRET=$(extract_env INFISICAL_CLIENT_SECRET)
export INFISICAL_PROJECT_ID=$(extract_env INFISICAL_PROJECT_ID)
node ../scripts/inject-frontend-env.mjs
npm run build

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

echo ""
echo "=== Restarting services ==="
pm2 restart human-pages
echo "Deployed successfully"
