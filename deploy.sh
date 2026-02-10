#!/bin/bash
set -e
cd /opt/human-pages
git pull

cd backend
npm ci
echo "=== Running migrations ==="
npx prisma migrate deploy
npm run build

cd ../frontend
npm ci
node ../scripts/inject-frontend-env.mjs
npm run build

pm2 restart human-pages
echo "Deployed successfully"
