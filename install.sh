#!/usr/bin/env bash
# Skill Builder — Install
# Copies the 5-skill system to a target project AND syncs to ~/.claude/skills/ runtime.
# Claude Code reads skills from ~/.claude/skills/ — both locations must be populated.
#
# Usage:
#   ./install.sh /path/to/target-project
#   ./install.sh .   (current directory)

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; }

# ── Args ─────────────────────────────────────────────────────────────────────
TARGET="${1:-}"
if [ -z "${TARGET}" ]; then
    echo "Usage: ./install.sh /path/to/target-project"
    exit 1
fi
TARGET="$(cd "${TARGET}" && pwd)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_SKILLS="${HOME}/.claude/skills"

echo "════════════════════════════════════════════"
echo "║   Skill Builder — Install                ║"
echo "════════════════════════════════════════════"
echo "  Project : ${TARGET}"
echo "  Runtime : ${GLOBAL_SKILLS}"
echo ""

# ── Check Node.js ────────────────────────────────────────────────────────────
if command -v node &>/dev/null; then
    ok "Node.js $(node --version) found"
else
    warn "Node.js not found — scripts (static-scan.js, generate-seed-evals.js, etc.) will not run"
    warn "Install from https://nodejs.org/ before using skill-audit or skill-eval"
fi
echo ""

# ── Existing installation check ──────────────────────────────────────────────
if [ -d "${TARGET}/skills" ]; then
    EXISTING="$(ls "${TARGET}/skills" 2>/dev/null | tr '\n' ' ')"
    warn "Existing skills/ found in target: ${EXISTING}"
    read -r -p "  Overwrite? [y/N] " confirm
    [[ "${confirm}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
    echo ""
fi

# ── Discover skills dynamically ──────────────────────────────────────────────
SKILL_NAMES=()
while IFS= read -r dir; do
    SKILL_NAMES+=("$(basename "${dir}")")
done < <(find "${REPO_DIR}/skills" -mindepth 1 -maxdepth 1 -type d | sort)

# ── 1. Project-scoped skills (source of truth) ───────────────────────────────
echo "→ [1/4] Copying skills to project"
mkdir -p "${TARGET}/skills"
cp -R "${REPO_DIR}/skills/." "${TARGET}/skills/"
for skill in "${SKILL_NAMES[@]}"; do
    ok "${skill}  →  ${TARGET}/skills/${skill}"
done
echo ""

# ── 2. Runtime sync (~/.claude/skills/) ─────────────────────────────────────
echo "→ [2/4] Syncing skills to runtime"
mkdir -p "${GLOBAL_SKILLS}"
for skill in "${SKILL_NAMES[@]}"; do
    cp -R "${REPO_DIR}/skills/${skill}" "${GLOBAL_SKILLS}/"
    ok "${skill}  →  ${GLOBAL_SKILLS}/${skill}"
done
echo ""

# ── 3. Skill-guardian agent (project-scoped only) ────────────────────────────
echo "→ [3/4] Installing skill-guardian agent"
mkdir -p "${TARGET}/.claude/agents"
cp "${REPO_DIR}/.claude/agents/skill-guardian.md" "${TARGET}/.claude/agents/skill-guardian.md"
ok "project  →  ${TARGET}/.claude/agents/skill-guardian.md"
echo ""

# ── 4. Evals workspace + .gitignore ─────────────────────────────────────────
echo "→ [4/4] Setting up evals/ workspace and .gitignore"
mkdir -p "${TARGET}/evals"
ok "created  ${TARGET}/evals/"

# Entries to ignore: generated artifacts that should not be committed
IGNORE_ENTRIES=(
    "# skill-builder generated artifacts"
    "evals/"
    "skills/*-backup-*/"
    "skills/*-eval-snapshot/"
    "skills/*.baseline"
)

GITIGNORE="${TARGET}/.gitignore"
touch "${GITIGNORE}"
ADDED=()
for entry in "${IGNORE_ENTRIES[@]}"; do
    if ! grep -qF "${entry}" "${GITIGNORE}" 2>/dev/null; then
        printf '%s\n' "${entry}" >> "${GITIGNORE}"
        [[ "${entry}" != "#"* ]] && ADDED+=("${entry}")
    fi
done

if [ ${#ADDED[@]} -gt 0 ]; then
    ok "added to .gitignore: ${ADDED[*]}"
else
    ok ".gitignore already up to date"
fi
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}✓ Install complete.${RESET}"
echo ""
echo "  Skills are live in Claude Code."
echo ""
echo "  Pipeline:"
echo "    skill-scout  → find an existing skill on GitHub"
echo "    skill-audit  → security-gate it before install"
echo "    skill-adapt  → adapt it to this project"
echo "    skill-eval   → measure its effectiveness"
echo "    skill-refine → auto-improve until targets are met"
echo ""
echo "  Start with: 'find a skill for <capability>'"
echo "           or 'audit the skill at <path>'"
echo ""
