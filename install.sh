#!/usr/bin/env bash
# Skill Builder — Install
# Copies all skills to a target project AND syncs to ~/.claude/skills/ runtime.
# Claude Code reads skills from ~/.claude/skills/ — both locations must be populated.
# Skills are discovered dynamically from the skills/ directory — no hardcoded list.
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

# ── 3. Agents (project-scoped only) ─────────────────────────────────────────
echo "→ [3/4] Installing agents"
mkdir -p "${TARGET}/.claude/agents"
for agent_file in "${REPO_DIR}/.claude/agents/"*.md; do
    agent_name="$(basename "${agent_file}")"
    cp "${agent_file}" "${TARGET}/.claude/agents/${agent_name}"
    ok "project  →  ${TARGET}/.claude/agents/${agent_name}"
done
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

# ── 4b. Refresh project-context.json if stale ────────────────────────────────
# A pre-existing project-context.json may be missing the hooks/mcp_servers/plugins
# fields added in the June 2026 expansion. Detect and offer to regenerate.
CTX="${TARGET}/evals/project-context.json"
if [ -f "${CTX}" ] && command -v node &>/dev/null; then
    # Check for the presence of the "hooks" field (added in expansion)
    if ! node -e "const d=require('${CTX}'); process.exit(d.hooks !== undefined ? 0 : 1)" 2>/dev/null; then
        warn "project-context.json is missing the hooks/mcp_servers/plugins fields (pre-expansion format)"
        read -r -p "  Regenerate it now? [Y/n] " confirm_ctx
        if [[ ! "${confirm_ctx}" =~ ^[Nn]$ ]]; then
            (cd "${TARGET}" && node "${TARGET}/skills/skill-eval/scripts/extract-project-context.js" 2>/dev/null)
            ok "regenerated ${CTX}"
        else
            warn "Skipped — run '/project-setup' or 'node skills/skill-eval/scripts/extract-project-context.js' to refresh"
        fi
    else
        ok "project-context.json is current (hooks field present)"
    fi
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
echo "    project-setup  → configure CLAUDE.md and project context  ← start here"
echo "    project-audit  → scan .claude/ for secrets, permissions, hook risks"
echo "    skill-scout    → find an existing skill on GitHub"
echo "    skill-audit    → security-gate the sourced skill before install"
echo "    skill-adapt    → adapt it to this project"
echo "    skill-eval     → measure its effectiveness"
echo "    skill-refine   → auto-improve until targets are met"
echo ""
echo "  Start with: '/project-setup' to configure your project context"
echo "           or 'find a skill for <capability>' if already configured"
echo ""
