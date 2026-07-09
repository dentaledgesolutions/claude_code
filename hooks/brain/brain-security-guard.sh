#!/usr/bin/env bash
# hooks/brain/brain-security-guard.sh — PreToolUse guard. The ONLY blocking brain
# hook. Denies: direct Write/Edit into .project-brain/canon/; Bash mutations of
# canon/ not going through brain-promote --approve; destructive rm on the capsule.
# Fails OPEN on parser errors (a broken guard must not brick the session) with a
# stderr warning. Always exits 0 — denial is expressed via permissionDecision.
# Defense-in-depth only: brain-promote --approve + git history are the real
# canon boundary; this guard raises the cost of accidental/careless mutation.
set -u
INPUT="$(cat)"
DECISION="$(BRAIN_HOOK_INPUT="${INPUT}" node -e '
const path = require("path");
let j = {};
try { j = JSON.parse(process.env.BRAIN_HOOK_INPUT || "{}"); } catch { process.exit(0); }
const tool = j.tool_name || "";
const inp = j.tool_input || {};
const deny = (reason) => {
  console.log(JSON.stringify({ hookSpecificOutput: {
    hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
  process.exit(0);
};
if (["Write", "Edit", "NotebookEdit"].includes(tool)) {
  // Normalize first — "…/.project-brain/decisions/../canon/x.md" must not slip past.
  const fp = path.resolve(String(inp.file_path || ""));
  if (/\/\.project-brain\/canon(\/|$)/.test(fp) || /^\.project-brain\/canon(\/|$)/.test(fp))
    deny("Direct writes to .project-brain/canon/ are forbidden. Promote a reviewed candidate instead: node scripts/brain/brain-promote.js <candidate> --approve --to canon");
}
if (tool === "Bash") {
  const cmd = String(inp.command || "");
  // Direct reference, or split reference (e.g. "cd .project-brain && … >> canon/y.md").
  const touchesCanon = /\.project-brain\/canon/.test(cmd)
    || (/\bcanon\//.test(cmd) && /\.project-brain/.test(cmd));
  const isApprovedPromote = /brain-promote(\.js)?\b[\s\S]*--approve/.test(cmd);
  const mutates = /(>>?|\btee\b|\bmv\b|\bcp\b|\brm\b|\bsed\b[^|]*-i)/.test(cmd)
    || /\bnode\s+(-e|--eval)\b|\bpython3?\s+-c\b|\bperl\s+-e\b/.test(cmd)
    || /writeFileSync|\bopen\(/.test(cmd);
  if (touchesCanon && mutates && !isApprovedPromote)
    deny("Only brain-promote.js --approve may modify .project-brain/canon/");
  if (/\brm\b[^|;&]*\.project-brain/.test(cmd))
    deny("Destructive command targeting .project-brain/ blocked — the capsule is governed memory");
}
' 2>/dev/null)" || { echo "brain-security-guard: parser error — failing open" >&2; exit 0; }
[ -n "${DECISION}" ] && printf '%s' "${DECISION}"
exit 0
