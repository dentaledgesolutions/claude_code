#!/usr/bin/env bash
# Skill Builder — Installer
# Copies the 5-skill system and skill-guardian agent into your global Claude Code directories.
# Safe to re-run: existing files are overwritten, nothing else is touched.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DST="${HOME}/.claude/skills"
AGENTS_DST="${HOME}/.claude/agents"

SKILLS=(skill-audit skill-scout skill-adapt skill-eval skill-refine)

echo "════════════════════════════════════════"
echo "║   Skill Builder — Installer          ║"
echo "════════════════════════════════════════"
echo ""

# ── Skills ──────────────────────────────────────────────────────────────────
echo "→ Installing skills to ${SKILLS_DST}/"
for skill in "${SKILLS[@]}"; do
    src="${REPO_DIR}/skills/${skill}"
    dst="${SKILLS_DST}/${skill}"
    mkdir -p "${dst}"
    cp -R "${src}/." "${dst}/"
    echo "  ✓ ${skill}"
done

# ── Agent ────────────────────────────────────────────────────────────────────
echo ""
echo "→ Installing agent to ${AGENTS_DST}/"
mkdir -p "${AGENTS_DST}"
cp "${REPO_DIR}/.claude/agents/skill-guardian.md" "${AGENTS_DST}/skill-guardian.md"
echo "  ✓ skill-guardian"

echo ""
echo "✓ Installation complete."
echo ""
echo "Skills available:  skill-audit · skill-scout · skill-adapt · skill-eval · skill-refine"
echo "Agent available:   skill-guardian  (copy .claude/agents/skill-guardian.md to any project)"
echo ""
echo "To use in a project, copy the agent:"
echo "  cp ${AGENTS_DST}/skill-guardian.md <your-project>/.claude/agents/"
