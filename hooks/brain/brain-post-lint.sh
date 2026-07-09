#!/usr/bin/env bash
# hooks/brain/brain-post-lint.sh — PostToolUse (Write|Edit): after any edit under
# .project-brain/, run brain-lint. NEVER blocks (always exit 0); if lint finds
# sensitive content (exit 3), surface a warning via additionalContext.
set -u
INPUT="$(cat)"
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="${HOOK_DIR}/../../scripts/brain"
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BRAIN="${ROOT}/.project-brain"
[ -d "${BRAIN}" ] || exit 0
FP="$(BRAIN_HOOK_INPUT="${INPUT}" node -e '
try { process.stdout.write(String((JSON.parse(process.env.BRAIN_HOOK_INPUT).tool_input || {}).file_path || "")); }
catch { process.stdout.write(""); }' 2>/dev/null || echo "")"
case "${FP}" in
  *".project-brain/"*)
    node "${SCRIPTS}/brain-lint.js" --target "${BRAIN}" >/dev/null 2>&1
    if [ "$?" = "3" ]; then
      printf '%s' '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"brain-lint found SENSITIVE content in .project-brain/ — see the latest report in .project-brain/reports/lint/ and remove the secret before it spreads."}}'
    fi
    ;;
esac
exit 0
