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
export INFISICAL_CLIENT_ID=$(grep '^INFISICAL_CLIENT_ID=' ../backend/.env | cut -d= -f2-)
export INFISICAL_CLIENT_SECRET=$(grep '^INFISICAL_CLIENT_SECRET=' ../backend/.env | cut -d= -f2-)
export INFISICAL_PROJECT_ID=$(grep '^INFISICAL_PROJECT_ID=' ../backend/.env | cut -d= -f2-)
node ../scripts/inject-frontend-env.mjs
npm run build

pm2 restart human-pages
echo "Deployed successfully"
