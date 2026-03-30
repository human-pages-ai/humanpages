#!/bin/bash
# Install spec-dev and feature-monitor skills into the project's .claude/skills/ directory
# Run from the HumanPages repo root: sh install-skills.sh

SKILLS_DIR=".claude/skills"

if [ ! -d "$SKILLS_DIR" ]; then
  echo "Error: $SKILLS_DIR not found. Run this from the HumanPages repo root."
  exit 1
fi

cp -r humans/.claude/skills/spec-dev "$SKILLS_DIR/spec-dev" 2>/dev/null && echo "✓ spec-dev installed" || echo "✗ spec-dev failed"
cp -r humans/.claude/skills/feature-monitor "$SKILLS_DIR/feature-monitor" 2>/dev/null && echo "✓ feature-monitor installed" || echo "✗ feature-monitor failed"

echo ""
echo "Installed skills:"
ls "$SKILLS_DIR"
echo ""
echo "Restart your Cowork/Claude Code session to see them in /skill"
