#!/usr/bin/env bash
#
# Install all Human Pages content automation services.
#
# Nightly schedule (staggered to avoid rate limit conflicts):
#   1:00 AM — Reply engine (search-once across 13 platforms)
#   2:00 AM — Blog engine (discover trending → generate drafts)
#   3:00 AM — YouTube outreach (discover channels → prep comments)
#   4:00 AM — Video batch (generate 15 nano concepts for review)
#
# All services use Claude Max subscription (Agent SDK or CLI).
# Model selection: Haiku for scoring, Sonnet for drafting/generation.
#
# Prerequisites:
#   - Node.js 20+ (via nvm)
#   - Python 3.10+ (for video-pipeline and photo-pipeline)
#   - Claude Max subscription (logged in via `claude`)
#   - .env file in each project directory (see PROD.md in each repo)
#
# Usage:
#   ./install-content-services.sh          # install deps + enable all timers
#   ./install-content-services.sh status   # check status of all services
#   ./install-content-services.sh stop     # stop all timers
#   ./install-content-services.sh run      # trigger all services NOW (manual)
#

set -euo pipefail

SYSTEMD_DIR="$HOME/.config/systemd/user"
PROJECTS="/opt"

ACTION="${1:-install}"

ALL_TIMERS="reply-engine.timer youtube-nightly.timer blog-nightly.timer video-nightly.timer video-batch.timer photo-batch.timer"
ALL_SERVICES="reply-engine.service youtube-nightly.service blog-nightly.service video-nightly.service video-batch.service photo-batch.service"

# ── Status ──────────────────────────────────────────────────
if [ "$ACTION" = "status" ]; then
    echo "=== Content Services Status ==="
    echo ""
    echo "Timers:"
    systemctl --user list-timers --no-pager 2>/dev/null || echo "  (none)"
    echo ""
    echo "Recent runs:"
    for svc in $ALL_SERVICES; do
        echo "── $svc ──"
        systemctl --user status "$svc" --no-pager 2>/dev/null | head -5 || echo "  not installed"
        echo ""
    done
    exit 0
fi

# ── Stop ────────────────────────────────────────────────────
if [ "$ACTION" = "stop" ]; then
    echo "Stopping all content timers..."
    for timer in $ALL_TIMERS; do
        systemctl --user stop "$timer" 2>/dev/null && echo "  Stopped $timer" || true
    done
    echo "Done. Services won't run until re-enabled."
    exit 0
fi

# ── Run (manual trigger) ───────────────────────────────────
if [ "$ACTION" = "run" ]; then
    SERVICE="${2:-all}"
    if [ "$SERVICE" = "all" ]; then
        echo "Triggering all services NOW..."
        for svc in $ALL_SERVICES; do
            systemctl --user start "$svc" 2>/dev/null && echo "  Started $svc" || echo "  Failed: $svc"
        done
    else
        echo "Triggering $SERVICE..."
        systemctl --user start "$SERVICE" 2>/dev/null && echo "  Started" || echo "  Failed"
    fi
    exit 0
fi

# ── Install ─────────────────────────────────────────────────
echo "=== Installing Content Services ==="
echo ""
echo "Schedule:"
echo "  1:00 AM — Reply engine (13-platform social scan)"
echo "  2:00 AM — Blog engine (trending content → drafts)"
echo "  3:00 AM — YouTube outreach (channel discovery → comments)"
echo "  4:00 AM — Video batch (generate 15 nano concepts for review)"
echo "  5:00 AM — Photo batch (generate 20 meme/post concepts for review)"
echo ""

mkdir -p "$SYSTEMD_DIR"

# Ensure log dirs exist
mkdir -p "$PROJECTS/reply-engine/logs"
mkdir -p "$PROJECTS/youtube-outreach/logs"
mkdir -p "$PROJECTS/blog-engine/logs"
mkdir -p "$PROJECTS/video-pipeline/logs"
mkdir -p "$PROJECTS/photo-pipeline/logs"

# ── Install dependencies ──────────────────────────────────
echo "── Installing dependencies ──"

for dir in reply-engine blog-engine youtube-outreach; do
    if [ -f "$PROJECTS/$dir/package.json" ]; then
        echo "  $dir: npm install..."
        (cd "$PROJECTS/$dir" && npm install --no-fund --no-audit 2>&1 | tail -1)
    fi
done

for pydir in video-pipeline photo-pipeline; do
    if [ -f "$PROJECTS/$pydir/requirements.txt" ]; then
        echo "  $pydir: setting up venv + pip install..."
        if [ ! -d "$PROJECTS/$pydir/venv" ]; then
            python3 -m venv "$PROJECTS/$pydir/venv"
        fi
        (cd "$PROJECTS/$pydir" && venv/bin/pip install -q -r requirements.txt 2>&1 | tail -1)
    fi
done

# ── Check .env files ──────────────────────────────────────
echo ""
echo "── Checking .env files ──"
for dir in reply-engine blog-engine youtube-outreach video-pipeline photo-pipeline; do
    if [ -f "$PROJECTS/$dir/.env" ]; then
        echo "  $dir: .env found"
    else
        echo "  $dir: WARNING — no .env file! Copy .env.example and fill in keys (see PROD.md)"
    fi
done

echo ""
# ── Link systemd service files ────────────────────────────

# 1. Reply Engine — 1 AM
if [ -f "$PROJECTS/reply-engine/reply-engine.service" ]; then
    echo "── Reply Engine (1 AM) ──"
    ln -sf "$PROJECTS/reply-engine/reply-engine.service" "$SYSTEMD_DIR/reply-engine.service"
    ln -sf "$PROJECTS/reply-engine/reply-engine.timer" "$SYSTEMD_DIR/reply-engine.timer"
    echo "  Linked"
else
    echo "  SKIP: reply-engine not found"
fi

# 2. Blog Engine — 2 AM
if [ -f "$PROJECTS/blog-engine/blog-nightly.service" ]; then
    echo "── Blog Engine (2 AM) ──"
    ln -sf "$PROJECTS/blog-engine/blog-nightly.service" "$SYSTEMD_DIR/blog-nightly.service"
    ln -sf "$PROJECTS/blog-engine/blog-nightly.timer" "$SYSTEMD_DIR/blog-nightly.timer"
    echo "  Linked"
else
    echo "  SKIP: blog-engine not found"
fi

# 3. YouTube Outreach — 3 AM
if [ -f "$PROJECTS/youtube-outreach/youtube-nightly.service" ]; then
    echo "── YouTube Outreach (3 AM) ──"
    ln -sf "$PROJECTS/youtube-outreach/youtube-nightly.service" "$SYSTEMD_DIR/youtube-nightly.service"
    ln -sf "$PROJECTS/youtube-outreach/youtube-nightly.timer" "$SYSTEMD_DIR/youtube-nightly.timer"
    echo "  Linked"
else
    echo "  SKIP: youtube-outreach not found"
fi

# 4. Video Pipeline — 4 AM (legacy single-video)
if [ -f "$PROJECTS/video-pipeline/video-nightly.service" ]; then
    echo "── Video Pipeline (legacy) ──"
    ln -sf "$PROJECTS/video-pipeline/video-nightly.service" "$SYSTEMD_DIR/video-nightly.service"
    ln -sf "$PROJECTS/video-pipeline/video-nightly.timer" "$SYSTEMD_DIR/video-nightly.timer"
    echo "  Linked"
else
    echo "  SKIP: video-pipeline not found"
fi

# 5. Video Batch — 4 AM (batch concept generation, replaces single-video)
if [ -f "$PROJECTS/video-pipeline/video-batch.service" ]; then
    echo "── Video Batch (4 AM) ──"
    ln -sf "$PROJECTS/video-pipeline/video-batch.service" "$SYSTEMD_DIR/video-batch.service"
    ln -sf "$PROJECTS/video-pipeline/video-batch.timer" "$SYSTEMD_DIR/video-batch.timer"
    echo "  Linked"
else
    echo "  SKIP: video-batch not found"
fi

# 6. Photo Pipeline — 5 AM (batch concept generation)
if [ -f "$PROJECTS/photo-pipeline/photo-batch.service" ]; then
    echo "── Photo Batch (5 AM) ──"
    ln -sf "$PROJECTS/photo-pipeline/photo-batch.service" "$SYSTEMD_DIR/photo-batch.service"
    ln -sf "$PROJECTS/photo-pipeline/photo-batch.timer" "$SYSTEMD_DIR/photo-batch.timer"
    echo "  Linked"
else
    echo "  SKIP: photo-pipeline not found"
fi

# Reload and enable
echo ""
echo "── Enabling timers ──"
systemctl --user daemon-reload

for timer in $ALL_TIMERS; do
    systemctl --user enable --now "$timer" 2>/dev/null && \
        echo "  $timer: enabled" || \
        echo "  $timer: enable failed"
done

# Enable linger so services run even when not logged in
loginctl enable-linger "$(whoami)" 2>/dev/null && \
    echo "  linger: enabled (services run after logout)" || \
    echo "  linger: may need sudo — run: sudo loginctl enable-linger $(whoami)"

echo ""
echo "=== Done ==="
echo ""
echo "Commands:"
echo "  Status:          $0 status"
echo "  Stop all:        $0 stop"
echo "  Run all now:     $0 run"
echo "  Run one now:     $0 run reply-engine.service"
echo "  Manual video:    /opt/video-pipeline/run-video.sh --concept 'your idea'"
echo ""
echo "Logs:"
echo "  Reply engine:    tail -f /opt/reply-engine/logs/nightly.log"
echo "  Blog engine:     tail -f /opt/blog-engine/logs/nightly.log"
echo "  YouTube:         tail -f /opt/youtube-outreach/logs/nightly-systemd.log"
echo "  Video pipeline:  tail -f /opt/video-pipeline/logs/nightly.log"
echo "  Photo pipeline:  tail -f /opt/photo-pipeline/logs/batch.log"
