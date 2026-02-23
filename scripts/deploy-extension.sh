#!/usr/bin/env bash
# Deploy Chrome extension update to the server.
# Run from the project root: ./scripts/deploy-extension.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXT_DIR="$PROJECT_ROOT/chrome-extension"
DEST_DIR="$PROJECT_ROOT/backend/data/extension"

# Read version from manifest.json
VERSION=$(grep '"version"' "$EXT_DIR/manifest.json" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "ERROR: Could not read version from manifest.json"
  exit 1
fi

echo "Building extension v$VERSION..."

# Create destination directory
mkdir -p "$DEST_DIR"

# Build the zip
rm -f "$DEST_DIR/chrome-extension.zip"
cd "$EXT_DIR"
zip -r "$DEST_DIR/chrome-extension.zip" . -x '.*'
cd "$PROJECT_ROOT"

# Write version.json
cat > "$DEST_DIR/version.json" <<EOF
{
  "version": "$VERSION",
  "publishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "Deployed to $DEST_DIR/"
echo "  chrome-extension.zip ($VERSION)"
echo "  version.json"
echo ""
echo "Staff will see the update banner next time their extension checks (up to 1 hour)."
