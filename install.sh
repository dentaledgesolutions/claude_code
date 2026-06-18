#!/usr/bin/env bash
# Skill Builder — Project Setup
# Copies the project-scoped skill system into a target project directory.
# Skills live inside the project, not in ~/.claude/skills/.
#
# Usage:
#   ./install.sh /path/to/target-project
#   ./install.sh .   (set up in current directory)

set -euo pipefail

TARGET="${1:-}"
if [ -z "${TARGET}" ]; then
    echo "Usage: ./install.sh /path/to/target-project"
    exit 1
fi

TARGET="$(cd "${TARGET}" && pwd)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "════════════════════════════════════════"
echo "║   Skill Builder — Project Setup      ║"
echo "════════════════════════════════════════"
echo "Target: ${TARGET}"
echo ""

# ── Skills (project-scoped) ──────────────────────────────────────────────────
echo "→ Copying skills/ to ${TARGET}/skills/"
mkdir -p "${TARGET}/skills"
cp -R "${REPO_DIR}/skills/." "${TARGET}/skills/"
echo "  ✓ skill-audit · skill-scout · skill-adapt · skill-eval · skill-refine"

# ── Agent ────────────────────────────────────────────────────────────────────
echo ""
echo "→ Copying skill-guardian agent to ${TARGET}/.claude/agents/"
mkdir -p "${TARGET}/.claude/agents"
cp "${REPO_DIR}/.claude/agents/skill-guardian.md" "${TARGET}/.claude/agents/skill-guardian.md"
echo "  ✓ skill-guardian"

echo ""
echo "✓ Done. Skills are project-scoped — no global install needed."
echo ""
echo "To activate: open ${TARGET} in Claude Code and say 'run skill guardian'."
