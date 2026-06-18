#!/usr/bin/env bash
# Skill Builder — Uninstaller
# Removes the 5 skills and skill-guardian agent from your global Claude Code directories.

set -euo pipefail

SKILLS_DST="${HOME}/.claude/skills"
AGENTS_DST="${HOME}/.claude/agents"

SKILLS=(skill-audit skill-scout skill-adapt skill-eval skill-refine)

echo "════════════════════════════════════════"
echo "║   Skill Builder — Uninstaller        ║"
echo "════════════════════════════════════════"
echo ""

read -r -p "Remove all Skill Builder skills and agent? [y/N] " confirm
[[ "${confirm}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

echo ""
echo "→ Removing skills..."
for skill in "${SKILLS[@]}"; do
    target="${SKILLS_DST}/${skill}"
    if [ -d "${target}" ]; then
        rm -rf "${target}"
        echo "  ✓ removed ${skill}"
    else
        echo "  – ${skill} not found, skipping"
    fi
done

echo ""
echo "→ Removing agent..."
agent_file="${AGENTS_DST}/skill-guardian.md"
if [ -f "${agent_file}" ]; then
    rm -f "${agent_file}"
    echo "  ✓ removed skill-guardian"
else
    echo "  – skill-guardian not found, skipping"
fi

echo ""
echo "✓ Uninstall complete."
echo "  Note: project-level .claude/agents/skill-guardian.md copies are not removed."
