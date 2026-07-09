#!/usr/bin/env bash
# hooks/brain/brain-pre-compact.sh — PreCompact: drop a snapshot marker into
# today's session log so post-compaction sessions know context was lost here.
# Non-blocking: always exits 0.
set -u
INPUT="$(cat)"
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="${HOOK_DIR}/../../scripts/brain"
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BRAIN="${ROOT}/.project-brain"
[ -d "${BRAIN}/sessions/daily" ] || exit 0
TRIGGER="$(BRAIN_HOOK_INPUT="${INPUT}" node -e '
try { process.stdout.write(JSON.parse(process.env.BRAIN_HOOK_INPUT).trigger || "unknown"); }
catch { process.stdout.write("unknown"); }' 2>/dev/null || echo unknown)"
node "${SCRIPTS}/brain-capture.js" --target "${BRAIN}" --type note \
  --title "pre-compact snapshot (${TRIGGER})" \
  --message "Context compaction (${TRIGGER}) is about to run. Decisions or lessons from the compacted span should be captured before they are lost — review and run brain-compile." \
  >/dev/null 2>&1 || true
exit 0
