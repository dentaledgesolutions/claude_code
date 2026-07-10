#!/usr/bin/env bash
# hooks/brain/brain-load.sh — SessionStart: inject the brain protocol and
# top-authority titles into session context. ≤ 8000 chars. Always exits 0.
set -u
INPUT="$(cat)"
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BRAIN="${ROOT}/.project-brain"
[ -f "${BRAIN}/BRAIN.md" ] || exit 0
node -e '
const fs = require("fs");
const path = require("path");
const lib = require(process.argv[2] + "/../../scripts/brain/brain-lib.js");
const brain = process.argv[1];
const parts = [];
parts.push(fs.readFileSync(path.join(brain, "BRAIN.md"), "utf8").slice(0, 3000));
function titles(dir, label) {
  const files = lib.walkMarkdown(path.join(brain, dir)).slice(0, 10);
  if (!files.length) return;
  parts.push(`\n${label}:`);
  for (const f of files) {
    const { fields } = lib.parseFrontmatter(fs.readFileSync(f, "utf8"));
    parts.push(`- ${path.relative(brain, f)} — ${(fields && fields.title) || path.basename(f, ".md")}`);
  }
}
titles("canon", "Canon (highest authority)");
titles("decisions/active", "Active decisions");
parts.push("\nRetrieve more: node scripts/brain/brain-search.js --query \"<terms>\" · context pack: brain-context-pack.js --intent \"<task>\"");
const ctx = parts.join("\n").slice(0, 8000);
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } }));
' "${BRAIN}" "${HOOK_DIR}" 2>/dev/null || true
exit 0
