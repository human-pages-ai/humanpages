#!/bin/sh
# git-session — Start a new isolated feature branch for a Claude session.
#
# Every Claude session MUST run this at the very start before making any
# code changes. It creates a unique branch off the latest master so that
# multiple sessions never collide on the same branch.
#
# Usage:
#   sh scripts/git-session.sh <short-description>
#
# Examples:
#   sh scripts/git-session.sh rate-limit-handling
#   sh scripts/git-session.sh fix-login-bug
#   sh scripts/git-session.sh add-webhook-support
#
# What it does:
#   1. Stashes any uncommitted changes (safety net)
#   2. Fetches latest origin/master
#   3. Creates branch:  session/<timestamp>-<description>
#   4. Prints the branch name for reference
#
# When you're done, use:
#   sh scripts/git-session-merge.sh   — to merge back into master and push
# -------------------------------------------------------------------

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
SAFE="$REPO_ROOT/scripts/git-safe.sh"

# Helper: use git-safe.sh if available, otherwise fall back to raw git
safe_git() {
  if [ -f "$SAFE" ]; then
    sh "$SAFE" "$@"
  else
    git "$@"
  fi
}

# -------------------------------------------------------------------
# Acquire workflow lock — prevents other sessions from interleaving
# their git workflows (stash, checkout, merge, push) with ours.
# -------------------------------------------------------------------
WF_LOCK="$REPO_ROOT/scripts/git-workflow-lock.sh"
if [ -f "$WF_LOCK" ]; then
  . "$WF_LOCK"
  acquire_workflow_lock
  trap 'release_workflow_lock' EXIT INT TERM HUP
fi

# -------------------------------------------------------------------
# Validate arguments
# -------------------------------------------------------------------
if [ $# -eq 0 ]; then
  echo "Usage: sh scripts/git-session.sh <short-description>" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  sh scripts/git-session.sh fix-login-bug" >&2
  echo "  sh scripts/git-session.sh add-rate-limiting" >&2
  echo "  sh scripts/git-session.sh update-email-templates" >&2
  exit 1
fi

# Sanitize the description: lowercase, replace spaces/underscores with hyphens, strip non-alphanumeric
DESC="$(echo "$*" | tr '[:upper:]' '[:lower:]' | tr ' _' '-' | sed 's/[^a-z0-9-]//g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')"
if [ -z "$DESC" ]; then
  echo "Error: Description must contain at least one alphanumeric character." >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="session/${TIMESTAMP}-${DESC}"

echo "╔══════════════════════════════════════════════════╗"
echo "║  git-session: Setting up isolated branch         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# -------------------------------------------------------------------
# Step 1: Stash any uncommitted work (so checkout is clean)
# -------------------------------------------------------------------
DIRTY="$(git status --porcelain 2>/dev/null | head -1)"
if [ -n "$DIRTY" ]; then
  echo "→ Stashing uncommitted changes..."
  safe_git stash push -m "auto-stash before session: $DESC"
  STASHED=1
else
  STASHED=0
fi

# -------------------------------------------------------------------
# Step 2: Fetch latest master (non-fatal if offline)
# -------------------------------------------------------------------
echo "→ Fetching latest origin/master..."
safe_git fetch origin master 2>/dev/null || echo "  (fetch failed — working with local state)"

# -------------------------------------------------------------------
# Step 3: Create the session branch off origin/master
# -------------------------------------------------------------------
echo "→ Creating branch: $BRANCH"
safe_git checkout -b "$BRANCH" origin/master 2>/dev/null || {
  # Fallback: if origin/master isn't available, branch off local master
  echo "  (origin/master not reachable — branching off local master)"
  safe_git checkout -b "$BRANCH" master
}

# -------------------------------------------------------------------
# Step 4: Pop stash if we stashed earlier (onto new branch)
# -------------------------------------------------------------------
if [ "$STASHED" -eq 1 ]; then
  echo "→ Restoring stashed changes onto new branch..."
  safe_git stash pop || echo "  (stash pop had conflicts — resolve manually)"
fi

# -------------------------------------------------------------------
# Done
# -------------------------------------------------------------------
echo ""
echo "✓ Session branch ready: $BRANCH"
echo ""
echo "  Work on this branch normally. When done:"
echo "    sh scripts/git-session-merge.sh"
echo ""
