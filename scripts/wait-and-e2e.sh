#!/bin/sh
# wait-and-e2e.sh — Wait for dev servers, then run Playwright e2e tests.
# Used by .husky/pre-push heavy checks. Extracted for readability + debugging.
#
# Usage: sh scripts/wait-and-e2e.sh [upstream-ref]
#   upstream-ref: git ref to compare against for --only-changed (optional)

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
UPSTREAM="${1:-}"
WAIT_TIMEOUT=30  # seconds per server

# ── Wait for backend ──
echo "  [e2e] Waiting for backend (max ${WAIT_TIMEOUT}s)..."
i=0
while [ $i -lt $WAIT_TIMEOUT ]; do
  curl -sf http://localhost:3001/health >/dev/null 2>&1 && break
  i=$((i + 1))
  sleep 1
done
if [ $i -eq $WAIT_TIMEOUT ]; then
  echo "Backend failed to start within ${WAIT_TIMEOUT}s" >&2
  exit 1
fi
echo "  [e2e] Backend ready (${i}s)"

# ── Wait for frontend ──
echo "  [e2e] Waiting for frontend (max ${WAIT_TIMEOUT}s)..."
i=0
while [ $i -lt $WAIT_TIMEOUT ]; do
  curl -sf http://localhost:3000 >/dev/null 2>&1 && break
  i=$((i + 1))
  sleep 1
done
if [ $i -eq $WAIT_TIMEOUT ]; then
  echo "Frontend failed to start within ${WAIT_TIMEOUT}s" >&2
  exit 1
fi
echo "  [e2e] Frontend ready (${i}s)"

# ── Run Playwright ──
# Use --only-changed if we have an upstream ref and Playwright supports it (v1.46+)
if [ -n "$UPSTREAM" ]; then
  PW_VERSION=$(npx playwright --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
  PW_MAJOR=$(echo "$PW_VERSION" | cut -d. -f1)
  PW_MINOR=$(echo "$PW_VERSION" | cut -d. -f2)

  if [ "${PW_MAJOR:-0}" -gt 1 ] || { [ "${PW_MAJOR:-0}" -eq 1 ] && [ "${PW_MINOR:-0}" -ge 46 ]; }; then
    echo "  [e2e] Running Playwright with --only-changed=$UPSTREAM"
    exec npx playwright test --config e2e/playwright.config.ts --only-changed="$UPSTREAM"
  fi
fi

echo "  [e2e] Running full Playwright suite"
exec npx playwright test --config e2e/playwright.config.ts
