#!/bin/bash
set -e
cd /opt/human-pages
git pull

cd backend
npm ci
echo "=== Running migrations ==="
node migrate.js
npm run build

cd ../frontend
npm ci
npm run build

pm2 restart human-pages
echo "Deployed successfully"
