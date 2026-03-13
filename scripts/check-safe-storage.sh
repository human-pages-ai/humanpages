#!/bin/bash
#
# check-safe-storage.sh — Prevent raw localStorage/sessionStorage usage.
#
# In-app browsers (Facebook, Instagram, TikTok, Snapchat) block Web Storage
# APIs. All storage access MUST go through the safe wrappers in lib/safeStorage.ts.
#
# Run: bash scripts/check-safe-storage.sh
# Called by: .husky/pre-push (migration-structure stage)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SRC="$REPO_ROOT/frontend/src"
EXIT_CODE=0

# Search for raw localStorage/sessionStorage usage in production code
# Exclude: safeStorage.ts (the wrapper itself), test files, mocks
VIOLATIONS=$(grep -rn \
  'localStorage\.\|sessionStorage\.' \
  "$SRC" \
  --include="*.ts" --include="*.tsx" \
  --exclude="safeStorage.ts" \
  | grep -v '\.test\.' \
  | grep -v '__mocks__' \
  | grep -v '// safe-storage-ok' \
  | grep -v '^\s*//' \
  || true)

# Filter out comments-only lines
REAL_VIOLATIONS=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  # Extract the code part (after filename:lineno:)
  code=$(echo "$line" | sed 's/^[^:]*:[0-9]*://')
  # Skip if it's just a comment
  stripped=$(echo "$code" | sed 's/^[[:space:]]*//')
  if [[ "$stripped" == "//"* ]] || [[ "$stripped" == "*"* ]] || [[ "$stripped" == "/*"* ]]; then
    continue
  fi
  REAL_VIOLATIONS="$REAL_VIOLATIONS
$line"
done <<< "$VIOLATIONS"

REAL_VIOLATIONS=$(echo "$REAL_VIOLATIONS" | sed '/^$/d')

if [ -n "$REAL_VIOLATIONS" ]; then
  echo "❌ Raw localStorage/sessionStorage usage detected!"
  echo ""
  echo "These calls will CRASH in Facebook/Instagram/TikTok in-app browsers."
  echo "Use safeLocalStorage or safeSessionStorage from 'lib/safeStorage' instead."
  echo ""
  echo "$REAL_VIOLATIONS"
  echo ""
  echo "To fix: import { safeLocalStorage, safeSessionStorage } from '../lib/safeStorage';"
  echo "Then replace localStorage.X() → safeLocalStorage.X() and sessionStorage.X() → safeSessionStorage.X()"
  echo ""
  echo "To suppress a false positive, add // safe-storage-ok at the end of the line."
  EXIT_CODE=1
fi

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ No raw storage usage found — all calls use safe wrappers"
fi

exit $EXIT_CODE
