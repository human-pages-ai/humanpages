#!/bin/sh
# git-session-merge — Merge the current session branch back into master and push.
#
# This is the counterpart to git-session.sh. Run it when you're done
# with your changes and want to ship them.
#
# Usage:
#   sh scripts/git-session-merge.sh                    # auto-commit with branch name as message
#   sh scripts/git-session-merge.sh "Custom message"   # custom commit message
#
# What it does:
#   1. Commits any uncommitted changes on the session branch
#   2. Fetches latest origin/master
#   3. Rebases the session branch onto origin/master
#   4. Switches to master and fast-forward merges
#   5. Pushes master to origin
#   6. Deletes the session branch (cleanup)
#
# If there are rebase conflicts, the script stops and asks you to resolve them.
# After resolving: git rebase --continue, then re-run this script.
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
# Check we're on a session branch
# -------------------------------------------------------------------
CURRENT="$(git branch --show-current 2>/dev/null)"

if [ -z "$CURRENT" ]; then
  echo "Error: Not on any branch (detached HEAD?). Aborting." >&2
  exit 1
fi

case "$CURRENT" in
  session/*)
    echo "╔══════════════════════════════════════════════════╗"
    echo "║  git-session-merge: Merging $CURRENT"
    echo "╚══════════════════════════════════════════════════╝"
    echo ""
    ;;
  master|main)
    echo "Error: You're already on $CURRENT. This script merges session/* branches into master." >&2
    echo "Did you forget to run: sh scripts/git-session.sh <description> ?" >&2
    exit 1
    ;;
  *)
    echo "Warning: Current branch '$CURRENT' doesn't follow the session/* naming convention." >&2
    printf "Continue anyway? [y/N] " >&2
    read -r answer
    case "$answer" in
      [yY]*) ;;
      *) exit 1 ;;
    esac
    ;;
esac

# -------------------------------------------------------------------
# Step 1: Commit any uncommitted changes
# -------------------------------------------------------------------
DIRTY="$(git status --porcelain 2>/dev/null | head -1)"
if [ -n "$DIRTY" ]; then
  echo "→ Committing uncommitted changes on $CURRENT..."
  # Extract description from branch name for commit message
  BRANCH_DESC="$(echo "$CURRENT" | sed 's|^session/[0-9]*-[0-9]*-||')"
  COMMIT_MSG="${1:-$BRANCH_DESC}"
  safe_git add -A
  safe_git commit -m "$COMMIT_MSG"
fi

# -------------------------------------------------------------------
# Step 2: Fetch latest origin/master
# -------------------------------------------------------------------
echo "→ Fetching latest origin/master..."
safe_git fetch origin master 2>/dev/null || echo "  (fetch failed — using local state)"

# -------------------------------------------------------------------
# Step 3: Rebase onto origin/master (keeps history linear)
# -------------------------------------------------------------------
echo "→ Rebasing onto origin/master..."
if ! safe_git rebase origin/master 2>/dev/null; then
  # Try local master as fallback
  if ! safe_git rebase master; then
    echo "" >&2
    echo "╔══════════════════════════════════════════════════╗" >&2
    echo "║  REBASE CONFLICT — manual resolution needed      ║" >&2
    echo "╚══════════════════════════════════════════════════╝" >&2
    echo "" >&2
    echo "  1. Resolve the conflicts in the listed files" >&2
    echo "  2. git add <resolved-files>" >&2
    echo "  3. git rebase --continue" >&2
    echo "  4. Re-run: sh scripts/git-session-merge.sh" >&2
    exit 1
  fi
fi

# -------------------------------------------------------------------
# Step 4: Switch to master and fast-forward merge
# -------------------------------------------------------------------
echo "→ Switching to master and merging..."
safe_git checkout master
safe_git merge --ff-only "$CURRENT" || {
  # If ff-only fails, do a regular merge (shouldn't happen after rebase but just in case)
  echo "  (fast-forward not possible — doing merge commit)"
  safe_git merge "$CURRENT" --no-edit
}

# -------------------------------------------------------------------
# Step 5: Push to origin
# -------------------------------------------------------------------
echo "→ Pushing master to origin..."
if safe_git push origin master; then
  PUSHED=1
else
  echo "  (push failed — you may need to push manually: git push origin master)"
  PUSHED=0
fi

# -------------------------------------------------------------------
# Step 6: Delete the session branch
# -------------------------------------------------------------------
echo "→ Cleaning up session branch..."
safe_git branch -d "$CURRENT" 2>/dev/null || true

# Also delete remote session branch if it was pushed
if git ls-remote --heads origin "$CURRENT" 2>/dev/null | grep -q "$CURRENT"; then
  safe_git push origin --delete "$CURRENT" 2>/dev/null || true
fi

# -------------------------------------------------------------------
# Done
# -------------------------------------------------------------------
echo ""
if [ "$PUSHED" -eq 1 ]; then
  echo "✓ Session merged and pushed to origin/master successfully!"
else
  echo "✓ Session merged into local master. Push manually when ready:"
  echo "    git push origin master"
fi
echo ""
