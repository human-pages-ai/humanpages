# Fix: OG meta tags not working for /prompt-to-completion and /dev

## Problem
Facebook (and other social crawlers) show homepage OG tags instead of page-specific ones for `/prompt-to-completion` and `/dev`.

## Root cause
nginx's `try_files` in `/etc/nginx/sites-available/human-pages` serves `index.html` directly for non-file URLs, bypassing Express entirely. The Express SEO routes that inject correct OG meta tags never get hit.

```
try_files $uri /index.html;
```

## Fix
Update `/etc/nginx/sites-available/human-pages` to proxy non-static requests to Express instead of serving `index.html` directly.

**Replace:**
```nginx
try_files $uri /index.html;
```

**With:**
```nginx
try_files $uri @backend;
```

**Add a named location block** (inside the same `server` block):
```nginx
location @backend {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **Note:** Adjust the port (`3001`) to match whatever port the Express/PM2 process (`human-pages`) listens on. Check with: `pm2 show human-pages` or `grep PORT /opt/human-pages/backend/.env`.

## After applying

```bash
# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Verify the fix (should show /prompt-to-completion, not /)
curl -s https://humanpages.ai/prompt-to-completion | grep 'og:url'

# Clear Facebook cache
# Go to https://developers.facebook.com/tools/debug/
# Enter URL and click "Scrape Again"
```

## Why this works
Express already has a catch-all that serves `index.html` for unknown routes. But BEFORE the catch-all, it has dedicated route handlers for `/prompt-to-completion`, `/dev`, `/blog/:slug`, `/humans/:id`, etc. that inject page-specific OG meta tags. By letting Express handle the fallback instead of nginx, the SEO routes work and static files (JS, CSS, images) are still served directly by nginx.
