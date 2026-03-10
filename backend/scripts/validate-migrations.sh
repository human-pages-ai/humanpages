#!/usr/bin/env bash
# validate-migrations.sh — Catch schema drift issues before they reach production
# Run: bash scripts/validate-migrations.sh
# Add to CI: add this as a step before prisma migrate deploy

set -euo pipefail

MIGRATIONS_DIR="$(dirname "$0")/../prisma/migrations"
ERRORS=0

echo "=== Migration Validation ==="
echo ""

# 1. Check for multiple init migrations
INIT_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -type d -name "*_init" | wc -l)
if [ "$INIT_COUNT" -gt 1 ]; then
  echo "❌ CRITICAL: Found $INIT_COUNT init migrations (expected 1):"
  find "$MIGRATIONS_DIR" -maxdepth 1 -type d -name "*_init" | sort
  ERRORS=$((ERRORS + 1))
else
  echo "✅ Single init migration"
fi

# 2. Check for duplicate timestamps
TIMESTAMPS=$(find "$MIGRATIONS_DIR" -maxdepth 1 -type d ! -name migrations | sed 's|.*/||' | cut -d'_' -f1 | sort)
DUPES=$(echo "$TIMESTAMPS" | uniq -d)
if [ -n "$DUPES" ]; then
  echo "❌ CRITICAL: Duplicate migration timestamps found:"
  for ts in $DUPES; do
    echo "  Timestamp $ts:"
    find "$MIGRATIONS_DIR" -maxdepth 1 -type d -name "${ts}_*" | sed 's|.*/|    |'
  done
  ERRORS=$((ERRORS + 1))
else
  echo "✅ All migration timestamps are unique"
fi

# 3. Check for unguarded DROP COLUMN (not inside a DO $$ block)
UNGUARDED=$(grep -rn 'DROP COLUMN [^I]' "$MIGRATIONS_DIR" --include="*.sql" | grep -v 'IF EXISTS' | grep -v '^\s*--' || true)
if [ -n "$UNGUARDED" ]; then
  echo "❌ HIGH: Unguarded DROP COLUMN statements (missing IF EXISTS):"
  echo "$UNGUARDED" | head -20
  ERRORS=$((ERRORS + 1))
else
  echo "✅ All DROP COLUMN statements use IF EXISTS"
fi

# 4. Check for unguarded DROP INDEX
UNGUARDED_IDX=$(grep -rn '^DROP INDEX [^I]' "$MIGRATIONS_DIR" --include="*.sql" | grep -v 'IF EXISTS' | grep -v '^\s*--' || true)
if [ -n "$UNGUARDED_IDX" ]; then
  echo "❌ HIGH: Unguarded DROP INDEX statements (missing IF EXISTS):"
  echo "$UNGUARDED_IDX" | head -20
  ERRORS=$((ERRORS + 1))
else
  echo "✅ All DROP INDEX statements use IF EXISTS"
fi

# 5. Check for large ALTER TABLE blocks (>10 ADD COLUMN in one migration)
for f in "$MIGRATIONS_DIR"/*/migration.sql; do
  ADD_COUNT=$(grep -c 'ADD COLUMN' "$f" 2>/dev/null || true)
  ADD_COUNT=$(echo "$ADD_COUNT" | tr -d '[:space:]')
  ADD_COUNT=${ADD_COUNT:-0}
  if [ "$ADD_COUNT" -gt 10 ]; then
    echo "⚠️  MEDIUM: $(basename "$(dirname "$f")") has $ADD_COUNT ADD COLUMN ops (consider splitting)"
  fi
done

# 6. Verify Prisma schema is in sync (if prisma CLI available)
if command -v npx &>/dev/null; then
  echo ""
  echo "Checking Prisma schema sync..."
  cd "$(dirname "$0")/.."
  if npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code 2>/dev/null; then
    echo "✅ Prisma schema matches migrations"
  else
    echo "⚠️  Schema may have drifted from migrations (run 'npx prisma migrate dev' to reconcile)"
  fi
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "🔴 FAILED: $ERRORS issue(s) found. Fix before merging."
  exit 1
else
  echo "🟢 PASSED: All migration checks passed."
  exit 0
fi
