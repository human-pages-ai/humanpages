#!/bin/bash
set -e
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

pm2 restart human-pages
echo "Deployed successfully"
