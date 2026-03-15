#!/bin/sh
# git-workflow-lock.sh — Workflow-level mutex for multi-step git operations.
#
# Problem: git-safe.sh locks per-command, but multi-step workflows like
# git-session-merge.sh (stash → fetch → rebase → checkout → merge → push)
# can be interleaved by other sessions between steps.
#
# Solution: A separate atomic-mkdir mutex that holds for the entire workflow.
# Source this file, then call acquire_workflow_lock / release_workflow_lock.
#
# Usage:
#   . scripts/git-workflow-lock.sh
#   acquire_workflow_lock
#   trap 'release_workflow_lock' EXIT INT TERM HUP
#   ... do multi-step git work ...
#   release_workflow_lock
# -------------------------------------------------------------------

_WF_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
_WF_LOCK_DIR="$_WF_REPO_ROOT/.git/claude-workflow.lock"
_WF_MAX_WAIT=120    # seconds
_WF_RETRY=1         # seconds between retries

acquire_workflow_lock() {
  _wf_waited=0
  while ! mkdir "$_WF_LOCK_DIR" 2>/dev/null; do
    # Check if the lock holder is still alive
    if [ -f "$_WF_LOCK_DIR/pid" ]; then
      _wf_holder=$(cat "$_WF_LOCK_DIR/pid" 2>/dev/null || echo "")
      if [ -n "$_wf_holder" ] && ! kill -0 "$_wf_holder" 2>/dev/null; then
        echo "workflow-lock: Holder (PID $_wf_holder) is gone — reclaiming" >&2
        rm -rf "$_WF_LOCK_DIR" 2>/dev/null || true
        continue
      fi
    fi

    if [ "$_wf_waited" -ge "$_WF_MAX_WAIT" ]; then
      echo "workflow-lock: Timed out after ${_WF_MAX_WAIT}s. Forcing." >&2
      rm -rf "$_WF_LOCK_DIR" 2>/dev/null || true
      mkdir "$_WF_LOCK_DIR" 2>/dev/null || true
      break
    fi

    if [ "$_wf_waited" -eq 0 ]; then
      _wf_branch=""
      [ -f "$_WF_LOCK_DIR/branch" ] && _wf_branch=" ($(cat "$_WF_LOCK_DIR/branch" 2>/dev/null))"
      echo "workflow-lock: Another session workflow in progress${_wf_branch} — waiting..." >&2
    fi

    sleep "$_WF_RETRY"
    _wf_waited=$((_wf_waited + _WF_RETRY))
  done

  echo $$ > "$_WF_LOCK_DIR/pid" 2>/dev/null || true
  git branch --show-current > "$_WF_LOCK_DIR/branch" 2>/dev/null || true
}

release_workflow_lock() {
  rm -rf "$_WF_LOCK_DIR" 2>/dev/null || true
}
