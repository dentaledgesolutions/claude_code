#!/usr/bin/env bash
# hooks/brain/brain-session-end.sh — dual-registered:
#   SessionEnd → run brain-compile on today's log (candidates only, never promotes).
#   Stop       → if today's log holds uncompiled [decision]/[lesson] entries,
#                suggest compiling via additionalContext — at most once per day.
# Non-blocking: always exits 0.
set -u
INPUT="$(cat)"
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="${HOOK_DIR}/../../scripts/brain"
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BRAIN="${ROOT}/.project-brain"
[ -d "${BRAIN}/sessions/daily" ] || exit 0
EVENT="$(BRAIN_HOOK_INPUT="${INPUT}" node -e '
try { process.stdout.write(JSON.parse(process.env.BRAIN_HOOK_INPUT).hook_event_name || ""); }
catch { process.stdout.write(""); }' 2>/dev/null || echo "")"
TODAY="$(date -u +%F)"
LOG="${BRAIN}/sessions/daily/${TODAY}.md"

if [ "${EVENT}" = "SessionEnd" ]; then
  node "${SCRIPTS}/brain-compile.js" --target "${BRAIN}" --date "${TODAY}" >/dev/null 2>&1 || true
  exit 0
fi
# Stop: suggest once per day, only when compile hasn't run over today's entries yet.
MARKER="${BRAIN}/reports/.stop-suggested-${TODAY}"
if [ -f "${LOG}" ] && [ ! -f "${MARKER}" ] && [ ! -f "${BRAIN}/reports/compile/${TODAY}.json" ] \
   && grep -qE '^## [0-9]{2}:[0-9]{2} \[(decision|lesson)\]' "${LOG}"; then
  mkdir -p "${BRAIN}/reports" && touch "${MARKER}" 2>/dev/null || true
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"The brain session log has uncompiled decision/lesson entries. Consider running: node scripts/brain/brain-compile.js — candidates then await human review via brain-promote --approve."}}'
fi
exit 0
