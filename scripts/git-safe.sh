#!/bin/sh
# git-safe — Serialize concurrent git access across multiple Claude/CI sessions.
#
# Problem: Multiple Claude Cowork sessions running git commands on the same repo
# causes .git/index.lock conflicts. Git only allows one writer at a time.
#
# Solution: Uses an atomic mkdir-based mutex (works on macOS + Linux without
# installing anything) to ensure only one git operation runs at a time.
# Other callers wait and retry with backoff.
#
# Usage:
#   sh scripts/git-safe.sh status             # wraps: git status
#   sh scripts/git-safe.sh add -A             # wraps: git add -A
#   sh scripts/git-safe.sh commit -m "msg"    # wraps: git commit -m "msg"
#   sh scripts/git-safe.sh stash              # wraps: git stash
#   sh scripts/git-safe.sh pull --rebase      # wraps: git pull --rebase
#
# The script also cleans stale .git/index.lock files before running.
#
# npm script:
#   npm run git:safe -- status
#
# -------------------------------------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
LOCK_DIR="$REPO_ROOT/.git/claude-git.lock"
LOCK_FILE="$REPO_ROOT/.git/index.lock"
STALE_LOCK_SEC=60          # index.lock older than this is considered stale
MAX_WAIT_SEC=30            # max time to wait for another session to finish
RETRY_INTERVAL_SEC=1       # time between retries

# -------------------------------------------------------------------
# Step 1: Clean stale .git/index.lock if present
# -------------------------------------------------------------------
clean_stale_lock() {
  [ ! -f "$LOCK_FILE" ] && return 0

  if [ "$(uname)" = "Darwin" ]; then
    lock_age=$(( $(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || echo "0") ))
  else
    lock_age=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo "0") ))
  fi

  if [ "$lock_age" -gt "$STALE_LOCK_SEC" ]; then
    echo "git-safe: Removing stale .git/index.lock (${lock_age}s old)" >&2
    rm -f "$LOCK_FILE" 2>/dev/null || true
  fi
}

# -------------------------------------------------------------------
# Step 2: Acquire mutex using atomic mkdir
# -------------------------------------------------------------------
acquire_lock() {
  waited=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    # Check if the lock holder is still alive (stale mutex)
    if [ -f "$LOCK_DIR/pid" ]; then
      holder_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
      if [ -n "$holder_pid" ] && ! kill -0 "$holder_pid" 2>/dev/null; then
        echo "git-safe: Lock holder (PID $holder_pid) is gone — reclaiming" >&2
        if rm -rf "$LOCK_DIR" 2>/dev/null && [ ! -d "$LOCK_DIR" ]; then
          continue
        fi
        # Can't remove (permissions) — overwrite the PID and proceed
        echo $$ > "$LOCK_DIR/pid" 2>/dev/null || true
        break
      fi
    fi

    if [ "$waited" -ge "$MAX_WAIT_SEC" ]; then
      echo "git-safe: Timed out waiting ${MAX_WAIT_SEC}s for git lock. Forcing." >&2
      rm -rf "$LOCK_DIR" 2>/dev/null || true
      mkdir "$LOCK_DIR" 2>/dev/null || true
      break
    fi

    if [ "$waited" -eq 0 ]; then
      echo "git-safe: Another git operation in progress — waiting..." >&2
    fi

    sleep "$RETRY_INTERVAL_SEC"
    waited=$((waited + RETRY_INTERVAL_SEC))
  done

  # Record our PID so other sessions can detect stale locks
  echo $$ > "$LOCK_DIR/pid" 2>/dev/null || true
}

# -------------------------------------------------------------------
# Step 3: Release mutex on exit (always, even on error/signal)
# -------------------------------------------------------------------
release_lock() {
  rm -rf "$LOCK_DIR" 2>/dev/null || true
}
trap release_lock EXIT INT TERM HUP

# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

if [ $# -eq 0 ]; then
  echo "Usage: git-safe.sh <git-command> [args...]" >&2
  echo "Example: sh scripts/git-safe.sh commit -m 'my message'" >&2
  exit 1
fi

clean_stale_lock
acquire_lock

# Run git, capture exit code, release lock explicitly (trap is backup)
git_exit=0
git "$@" || git_exit=$?

release_lock
exit $git_exit
