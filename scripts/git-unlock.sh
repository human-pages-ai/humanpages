#!/bin/sh
# git-unlock — Remove stale git lock files (both index.lock and claude mutex).
#
# Usage:
#   sh scripts/git-unlock.sh          # Only removes stale locks (>60s old)
#   sh scripts/git-unlock.sh --force  # Removes all locks regardless of age

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
LOCK_FILE="$REPO_ROOT/.git/index.lock"
MUTEX_DIR="$REPO_ROOT/.git/claude-git.lock"
STALE_THRESHOLD_SEC=60

removed=0

# --- Helper: get file age in seconds (portable macOS + Linux) ---
file_age_sec() {
  if [ "$(uname)" = "Darwin" ]; then
    echo $(( $(date +%s) - $(stat -f %m "$1" 2>/dev/null || echo "0") ))
  else
    echo $(( $(date +%s) - $(stat -c %Y "$1" 2>/dev/null || echo "0") ))
  fi
}

# --- Clean .git/index.lock ---
if [ -f "$LOCK_FILE" ]; then
  age=$(file_age_sec "$LOCK_FILE")
  if [ "$1" = "--force" ] || [ "$age" -gt "$STALE_THRESHOLD_SEC" ]; then
    echo "git-unlock: Removing .git/index.lock (${age}s old)"
    rm -f "$LOCK_FILE" 2>/dev/null || true
    removed=$((removed + 1))
  else
    echo "git-unlock: .git/index.lock exists (${age}s old, threshold: ${STALE_THRESHOLD_SEC}s). Use --force."
  fi
fi

# --- Clean .git/claude-git.lock mutex ---
if [ -d "$MUTEX_DIR" ]; then
  if [ "$1" = "--force" ]; then
    echo "git-unlock: Removing claude-git.lock mutex"
    rm -rf "$MUTEX_DIR" 2>/dev/null || true
    removed=$((removed + 1))
  elif [ -f "$MUTEX_DIR/pid" ]; then
    holder_pid=$(cat "$MUTEX_DIR/pid" 2>/dev/null || echo "")
    if [ -n "$holder_pid" ] && ! kill -0 "$holder_pid" 2>/dev/null; then
      echo "git-unlock: Removing stale claude-git.lock (PID $holder_pid is gone)"
      rm -rf "$MUTEX_DIR" 2>/dev/null || true
      removed=$((removed + 1))
    else
      echo "git-unlock: claude-git.lock held by PID $holder_pid (still running). Use --force."
    fi
  else
    echo "git-unlock: Removing claude-git.lock (no PID file)"
    rm -rf "$MUTEX_DIR" 2>/dev/null || true
    removed=$((removed + 1))
  fi
fi

if [ "$removed" -eq 0 ] && [ ! -f "$LOCK_FILE" ] && [ ! -d "$MUTEX_DIR" ]; then
  echo "git-unlock: No locks found."
fi
