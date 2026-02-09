# Deployment Guide

Production server runs at `/opt/human-pages` on an Ubuntu VPS behind Cloudflare.

## Architecture

```
User -> Cloudflare (DNS + SSL) -> Nginx (443) -> Frontend (static) / Backend (port 3001)
```

- **Frontend**: Static files served by Nginx from `/opt/human-pages/frontend/dist`
- **Backend**: Node.js on port 3001, managed by pm2, proxied via Nginx at `/api`
- **Database**: PostgreSQL on localhost
- **SSL**: Cloudflare origin certificate (Full Strict mode)

## Server Layout

```
/opt/human-pages/
  backend/
    .env              # Production environment variables
    dist/             # Compiled backend
  frontend/
    dist/             # Built frontend assets
  deploy.sh           # One-command deploy script

```

## Initial Setup

### 1. Cloudflare

At https://dash.cloudflare.com:

- Add domain, replace nameservers at registrar with Cloudflare's
- Wait for "Active" status

DNS records:
```
A    @     <server-ip>    (Proxied)
A    api   <server-ip>    (Proxied)
```

SSL/TLS:
- Mode: Full (Strict)
- Origin Server -> Create Certificate -> save cert and key

### 2. Clone and Build

```bash
cd /opt
sudo mkdir human-pages && sudo chown deploy:deploy human-pages
git clone git@github.com:evyatar-code/humans.git human-pages
cd human-pages

cd backend
npm ci
npx prisma generate
```

Create `backend/.env`:
```
NODE_ENV=production
DATABASE_URL="postgresql://humans:DB_PASSWORD@localhost:5432/humans_marketplace?schema=public"
JWT_SECRET="generated-secret"
PORT=3001
FRONTEND_URL=https://humanpages.ai
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

Build:
```bash
npx prisma migrate deploy
npm run build

cd ../frontend
npm ci
npm run build
```

### 3. Nginx

Install Cloudflare origin certificate:
```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/cert.pem    # paste certificate
sudo nano /etc/ssl/cloudflare/key.pem     # paste private key
sudo chmod 600 /etc/ssl/cloudflare/key.pem
```

Create `/etc/nginx/sites-available/human-pages`:
```nginx
server {
    listen 443 ssl;
    server_name humanpages.ai www.humanpages.ai;

    ssl_certificate /etc/ssl/cloudflare/cert.pem;
    ssl_certificate_key /etc/ssl/cloudflare/key.pem;

    root /opt/human-pages/frontend/dist;
    index index.html;

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name humanpages.ai www.humanpages.ai;
    return 301 https://$host$request_uri;
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/human-pages /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Start Backend with pm2

```bash
cd /opt/human-pages/backend
NODE_ENV=production pm2 start dist/index.js --name human-pages
pm2 save
pm2 startup    # run the sudo command it prints
```

### 5. Deploy Script

Already at `/opt/human-pages/deploy.sh`:
```bash
#!/bin/bash
set -e
cd /opt/human-pages
git pull

cd backend
npm ci
npx prisma migrate deploy
npm run build

cd ../frontend
npm ci
npm run build

pm2 restart human-pages
echo "Deployed successfully"
```

## Deploying Updates

From dev machine:
```bash
ssh deploy@<server-ip> /opt/human-pages/deploy.sh
```

Or on the server directly:
```bash
/opt/human-pages/deploy.sh
```

## Verify Checklist

- [ ] https://humanpages.ai loads the frontend
- [ ] https://humanpages.ai/api/humans/search returns JSON
- [ ] `pm2 status` shows "online"
- [ ] `pm2 logs human-pages` shows no errors
- [ ] Cloudflare SSL shows "Full (Strict)"

## Google OAuth Setup

In Google Cloud Console, add these **Authorized redirect URIs**:
```
https://humanpages.ai/auth/google/callback
http://localhost:3000/auth/google/callback
```

Both work with the same client ID/secret. The backend builds the redirect URI from `FRONTEND_URL`.

## Useful Commands

```bash
pm2 logs human-pages          # View backend logs
pm2 restart human-pages       # Restart backend
pm2 monit                     # Live monitoring
sudo nginx -t                 # Test nginx config
sudo systemctl restart nginx  # Restart nginx
```
