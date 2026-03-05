#!/bin/bash
# Remove JS/CSS assets from frontend/dist/assets that are older than 1 day.
# Run this AFTER the new build so the current index.html references are fresh.
# Old chunks are kept around so users with stale HTML can still load them.

DIST_ASSETS="${1:-/opt/human-pages/frontend/dist/assets}"
MAX_AGE_MINUTES="${2:-1440}"  # 24 hours

if [ ! -d "$DIST_ASSETS" ]; then
  echo "Assets directory not found: $DIST_ASSETS"
  exit 0
fi

echo "Cleaning assets older than ${MAX_AGE_MINUTES}m from $DIST_ASSETS"
find "$DIST_ASSETS" -type f \( -name '*.js' -o -name '*.css' -o -name '*.js.map' -o -name '*.css.map' \) -mmin +"$MAX_AGE_MINUTES" -print -delete
echo "Done"
