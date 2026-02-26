#!/bin/bash
# Setup PM2 log rotation with compression
# Run once on the server: sh scripts/setup-logrotate.sh
#
# What this does:
#   - Installs pm2-logrotate module (if not already installed)
#   - Configures: max 10MB per file, keep 30 days, compress old logs with gzip
#   - PM2 handles rotation automatically — no cron needed
#
# Log files end up in ~/.pm2/logs/ as:
#   human-pages-out.log        (current)
#   human-pages-out__2026-02-26_15-30-00.log.gz  (rotated + compressed)

set -e

echo "=== Setting up PM2 log rotation ==="

# Install pm2-logrotate if not present
if ! pm2 describe pm2-logrotate > /dev/null 2>&1; then
  echo "Installing pm2-logrotate..."
  pm2 install pm2-logrotate
else
  echo "pm2-logrotate already installed"
fi

# Configure rotation settings
echo "Configuring rotation settings..."

# Max size per log file before rotation (10MB)
pm2 set pm2-logrotate:max_size 10M

# Keep rotated files for 30 days
pm2 set pm2-logrotate:retain 30

# Enable gzip compression for rotated files
pm2 set pm2-logrotate:compress true

# Rotate on an interval check (every 30 seconds by default, but rotation
# only happens when max_size is exceeded)
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

# Use date-based filenames for rotated logs
pm2 set pm2-logrotate:dateFormat 'YYYY-MM-DD_HH-mm-ss'

# Also rotate PM2's own internal logs
pm2 set pm2-logrotate:rotateModule true

# Limit total number of rotated files as a safety net
pm2 set pm2-logrotate:max_size 10M

echo ""
echo "=== Current pm2-logrotate config ==="
pm2 conf pm2-logrotate

echo ""
echo "=== Done ==="
echo "Logs will auto-rotate at 10MB, keep 30 days, and compress old files with gzip."
echo "Log location: ~/.pm2/logs/"
echo ""
echo "Useful commands:"
echo "  pm2 logs human-pages --lines 50    # view recent logs"
echo "  ls -lah ~/.pm2/logs/               # see all log files"
echo "  pm2 flush                           # clear all current logs"
