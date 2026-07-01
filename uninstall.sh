#!/usr/bin/env bash
# Skill Builder — Uninstall
# Mirrors install.sh: removes all discovered skills from project AND ~/.claude/ runtime.
# Skills and agents are discovered dynamically from the repo — no hardcoded list.
#
# Usage:
#   ./uninstall.sh /path/to/target-project
#   ./uninstall.sh .   (current directory)

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
skip() { echo -e "  ${YELLOW}–${RESET} $*"; }

# ── Args ─────────────────────────────────────────────────────────────────────
TARGET="${1:-}"
if [ -z "${TARGET}" ]; then
    echo "Usage: ./uninstall.sh /path/to/target-project"
    exit 1
fi
TARGET="$(cd "${TARGET}" && pwd)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_SKILLS="${HOME}/.claude/skills"

# ── Discover skills + agents from repo (same source as install.sh) ───────────
SKILL_NAMES=()
while IFS= read -r dir; do
    SKILL_NAMES+=("$(basename "${dir}")")
done < <(find "${REPO_DIR}/skills" -mindepth 1 -maxdepth 1 -type d | sort)

AGENT_FILES=()
while IFS= read -r f; do
    AGENT_FILES+=("$(basename "${f}")")
done < <(find "${REPO_DIR}/.claude/agents" -name "*.md" | sort)

echo "════════════════════════════════════════════"
echo "║   Skill Builder — Uninstall              ║"
echo "════════════════════════════════════════════"
echo "  Project : ${TARGET}"
echo "  Runtime : ${GLOBAL_SKILLS}"
echo ""
echo "  Will remove:"
echo "    • ${TARGET}/skills/  (${#SKILL_NAMES[@]} skills: ${SKILL_NAMES[*]})"
echo "    • ${GLOBAL_SKILLS}/<each skill above>"
echo "    • ${TARGET}/.claude/agents/  (${#AGENT_FILES[@]} agents: ${AGENT_FILES[*]})"
echo ""

read -r -p "Proceed? [y/N] " confirm
[[ "${confirm}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
echo ""

# ── 1. Project skills ────────────────────────────────────────────────────────
echo "→ [1/6] Removing project skills"
if [ -d "${TARGET}/skills" ]; then
    rm -rf "${TARGET}/skills"
    ok "removed  ${TARGET}/skills/"
else
    skip "skills/ not found in project"
fi
echo ""

# ── 2. Runtime skills (~/.claude/skills/) ───────────────────────────────────
echo "→ [2/6] Removing runtime skills"
for skill in "${SKILL_NAMES[@]}"; do
    runtime_skill="${GLOBAL_SKILLS}/${skill}"
    if [ -d "${runtime_skill}" ]; then
        rm -rf "${runtime_skill}"
        ok "removed  ${runtime_skill}"
    else
        skip "${skill} not found in runtime"
    fi
done
echo ""

# ── 3. Agents (project-scoped only) ─────────────────────────────────────────
echo "→ [3/6] Removing agents"
for agent_file in "${AGENT_FILES[@]}"; do
    project_agent="${TARGET}/.claude/agents/${agent_file}"
    if [ -f "${project_agent}" ]; then
        rm -f "${project_agent}"
        ok "removed  ${project_agent}"
    else
        skip "${agent_file} not found in project"
    fi
done
echo ""

# ── 4. Codex eval scripts + schemas ─────────────────────────────────────────
echo "→ [4/6] Removing Codex external eval scripts and schemas"
for d in scripts/codex schemas/codex; do
    target_dir="${TARGET}/${d}"
    if [ -d "${target_dir}" ]; then
        rm -rf "${target_dir}"
        ok "removed  ${target_dir}"
    else
        skip "${d} not found in project"
    fi
done
echo ""

# ── 5. CLAUDE.md pipeline section ────────────────────────────────────────────
echo "→ [5/6] Removing pipeline section from CLAUDE.md"
CLAUDE_MD="${TARGET}/CLAUDE.md"
if [ -f "${CLAUDE_MD}" ] && grep -qF "# >>> skill-builder >>>" "${CLAUDE_MD}" 2>/dev/null; then
    sed -i '' '/^# >>> skill-builder >>>/,/^# <<< skill-builder <<</d' "${CLAUDE_MD}"
    ok "removed pipeline section from CLAUDE.md"
else
    skip "CLAUDE.md pipeline section not found"
fi
echo ""

echo "→ [6/6] Evals workspace"
if [ -d "${TARGET}/evals" ]; then
    echo "  evals/ contains generated data: scenario runs, timing, project-context.json."
    read -r -p "  Remove evals/ too? [y/N] " confirm_evals
    if [[ "${confirm_evals}" =~ ^[Yy]$ ]]; then
        rm -rf "${TARGET}/evals"
        ok "removed  ${TARGET}/evals/"
    else
        skip "evals/ kept"
    fi
else
    skip "evals/ not found"
fi
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}✓ Uninstall complete.${RESET}"
echo ""
echo "  Note: .gitignore entries added during install were not removed."
echo ""
