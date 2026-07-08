# Second Brain Phase 2 — Capture Hooks + Self-install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Phase 1 capture scripts into Claude Code's lifecycle via 4 hooks and manually self-install the brain onto claude_code itself — after this phase, the repo is remembering things.

**Architecture:** Bash hooks in `hooks/brain/` parse hook-event JSON (via embedded `node -e`, since Node ≥ 18 is a repo requirement), resolve brain scripts **relative to the hook file's own location** (`../../scripts/brain/`) so they work both in this repo and in any target project install, and resolve the capsule from `$CLAUDE_PROJECT_DIR`. Only `brain-security-guard.sh` may block; every other hook always exits 0. `brain-self-install.sh` performs the Task-1 install recipe + hook merge and is the dry run for install.sh step 8 (Phase 5 retires it).

**Tech Stack:** Bash + Node ≥ 18, zero dependencies. Hook JSON contract per Claude Code hooks reference (PreCompact `trigger`, PreToolUse `tool_name`/`tool_input`, `hookSpecificOutput.permissionDecision` / `additionalContext`).

## Global Constraints

- Phase 1 must be complete (all 5 scripts + tests green) before starting
- Hooks: non-blocking (`exit 0` always) except `brain-security-guard.sh`, which denies via `hookSpecificOutput.permissionDecision: "deny"` and still exits 0; a crashed guard fails open with a stderr warning (never brick the session)
- Hooks resolve scripts via their own path, capsule via `$CLAUDE_PROJECT_DIR` (fallback `pwd`); missing capsule → silent exit 0 (brain not installed ⇒ hooks are no-ops)
- Self-install merges hooks into `.claude/settings.local.json` (machine-local), reusing install.sh's telemetry `ensureHookEntry` merge pattern — never clobber existing hooks
- Do NOT touch: `install.sh`, `uninstall.sh`, `CLAUDE.md`, eval-team files (see Phase 1 plan list)
- All timestamps UTC; no network

## Preflight — re-verify before executing

- [ ] Phase 1 committed: `for t in scripts/brain/*.test.js; do node "$t" || exit 1; done` passes
- [ ] Hook events unchanged in current Claude Code: PreCompact, SessionEnd, Stop, PreToolUse, PostToolUse all listed in `/hooks` docs; `hookSpecificOutput.permissionDecision` still the PreToolUse deny shape
- [ ] `.claude/settings.local.json` exists in this repo; note its current hook events so the post-install assertion (Task 3) can check nothing was lost

---

### Task 1: Hook scripts

**Files:**
- Create: `hooks/brain/brain-pre-compact.sh`, `hooks/brain/brain-session-end.sh`, `hooks/brain/brain-security-guard.sh`, `hooks/brain/brain-post-lint.sh`
- Test: `scripts/brain/brain-hooks.test.js`

**Interfaces:**
- Consumes: Phase 1 scripts (`brain-capture.js`, `brain-compile.js`, `brain-lint.js`); hook JSON on stdin
- Produces: 4 executable hooks. Registration matrix (consumed by Task 2's self-install and Phase 5's installer):
  - PreCompact (no matcher) → `brain-pre-compact.sh`
  - SessionEnd (no matcher) → `brain-session-end.sh` · Stop (no matcher) → `brain-session-end.sh`
  - PreToolUse matcher `Write|Edit|NotebookEdit|Bash` → `brain-security-guard.sh`
  - PostToolUse matcher `Write|Edit` → `brain-post-lint.sh`

- [ ] **Step 1: Write the failing test `scripts/brain/brain-hooks.test.js`**

```js
// scripts/brain/brain-hooks.test.js — hooks parse event JSON, are no-ops without
// a capsule, capture/compile/lint through the Phase 1 scripts, and only the
// security guard ever denies.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..', '..');
const HOOKS = path.join(REPO, 'hooks', 'brain');
const TMP = path.join(__dirname, '__hooks_test_tmp__');
const BRAIN = path.join(TMP, '.project-brain');
const today = new Date().toISOString().slice(0, 10);

function runHook(name, event, root = TMP) {
  const r = spawnSync('bash', [path.join(HOOKS, name)], {
    encoding: 'utf8', input: JSON.stringify(event),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function seedCapsule() {
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const d of ['sessions/daily', 'decisions/candidates', 'decisions/active',
    'lessons/memories', 'canon', 'synthesis', 'reports']) {
    fs.mkdirSync(path.join(BRAIN, d), { recursive: true });
  }
  fs.writeFileSync(path.join(BRAIN, 'log.md'), '# Brain Log\n');
}

try {
  // 1. No capsule → every hook is a silent no-op, exit 0
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  for (const h of ['brain-pre-compact.sh', 'brain-session-end.sh', 'brain-post-lint.sh']) {
    const r = runHook(h, { hook_event_name: 'x' });
    assert.strictEqual(r.status, 0, `${h} must exit 0 without capsule: ${r.stderr}`);
    assert.strictEqual(r.stdout.trim(), '', `${h} must stay silent without capsule`);
  }

  // 2. PreCompact appends a snapshot note to today's log
  seedCapsule();
  let r = runHook('brain-pre-compact.sh', { hook_event_name: 'PreCompact', trigger: 'auto' });
  assert.strictEqual(r.status, 0, r.stderr);
  const log = path.join(BRAIN, 'sessions', 'daily', `${today}.md`);
  assert.ok(fs.existsSync(log), 'daily log created');
  assert.ok(fs.readFileSync(log, 'utf8').includes('pre-compact snapshot (auto)'));

  // 3. SessionEnd compiles: plant a decision entry, expect a candidate afterward
  seedCapsule();
  fs.writeFileSync(log, `# Session log — ${today}\n\n## 10:00 [decision] Hook test decision\n\nBody.\n`);
  r = runHook('brain-session-end.sh', { hook_event_name: 'SessionEnd' });
  assert.strictEqual(r.status, 0, r.stderr);
  const cands = fs.readdirSync(path.join(BRAIN, 'decisions', 'candidates')).filter(f => f.endsWith('.md'));
  assert.strictEqual(cands.length, 1, 'SessionEnd compiled the decision');

  // 4. Stop suggests exactly once when uncompiled entries exist
  seedCapsule();
  fs.writeFileSync(log, `# Session log — ${today}\n\n## 10:00 [lesson] L\n\nBody.\n`);
  r = runHook('brain-session-end.sh', { hook_event_name: 'Stop' });
  assert.ok(r.stdout.includes('additionalContext'), 'first Stop suggests');
  r = runHook('brain-session-end.sh', { hook_event_name: 'Stop' });
  assert.strictEqual(r.stdout.trim(), '', 'second Stop same day is silent');

  // 5. Security guard denies Write into canon/, allows normal writes
  seedCapsule();
  r = runHook('brain-security-guard.sh', {
    hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(BRAIN, 'canon', 'x.md'), content: 'hi' },
  });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('"permissionDecision":"deny"'), `canon write must be denied: ${r.stdout}`);
  r = runHook('brain-security-guard.sh', {
    hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(TMP, 'src', 'app.js'), content: 'hi' },
  });
  assert.strictEqual(r.stdout.trim(), '', 'normal write passes silently');

  // 6. Guard: Bash touching canon denied unless brain-promote --approve; rm -rf on capsule denied
  const denyBash = cmd => runHook('brain-security-guard.sh',
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: cmd } });
  assert.ok(denyBash('echo x >> .project-brain/canon/y.md').stdout.includes('deny'));
  assert.strictEqual(denyBash('node scripts/brain/brain-promote.js decisions/candidates/a.md --approve --to canon').stdout.trim(), '');
  assert.ok(denyBash('rm -rf .project-brain').stdout.includes('deny'));

  // 7. Post-lint: always exit 0; warns via additionalContext only on sensitive content
  seedCapsule();
  fs.writeFileSync(path.join(BRAIN, 'sessions', 'daily', `${today}.md`),
    '# log\n\n## 10:00 [note]\n\nleak sk-ant-abc123def456ghi789\n');
  r = runHook('brain-post-lint.sh', {
    hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(BRAIN, 'sessions', 'daily', `${today}.md`) },
  });
  assert.strictEqual(r.status, 0, 'post-lint never blocks');
  assert.ok(r.stdout.includes('SENSITIVE'), 'sensitive content surfaces a warning');
  r = runHook('brain-post-lint.sh', {
    hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(TMP, 'README.md') },
  });
  assert.strictEqual(r.stdout.trim(), '', 'non-brain writes are ignored');

  console.log('brain-hooks.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-hooks.test.js`
Expected: FAIL (hooks missing)

- [ ] **Step 3: Write `hooks/brain/brain-pre-compact.sh`**

```bash
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
```

- [ ] **Step 4: Write `hooks/brain/brain-session-end.sh`**

```bash
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
```

- [ ] **Step 5: Write `hooks/brain/brain-security-guard.sh`**

```bash
#!/usr/bin/env bash
# hooks/brain/brain-security-guard.sh — PreToolUse guard. The ONLY blocking brain
# hook. Denies: direct Write/Edit into .project-brain/canon/; Bash mutations of
# canon/ not going through brain-promote --approve; destructive rm on the capsule.
# Fails OPEN on parser errors (a broken guard must not brick the session) with a
# stderr warning. Always exits 0 — denial is expressed via permissionDecision.
set -u
INPUT="$(cat)"
DECISION="$(BRAIN_HOOK_INPUT="${INPUT}" node -e '
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
  const fp = String(inp.file_path || "");
  if (/\.project-brain\/canon(\/|$)/.test(fp))
    deny("Direct writes to .project-brain/canon/ are forbidden. Promote a reviewed candidate instead: node scripts/brain/brain-promote.js <candidate> --approve --to canon");
}
if (tool === "Bash") {
  const cmd = String(inp.command || "");
  const touchesCanon = /\.project-brain\/canon/.test(cmd);
  const isApprovedPromote = /brain-promote(\.js)?\b[\s\S]*--approve/.test(cmd);
  const mutates = /(>>?|\btee\b|\bmv\b|\bcp\b|\brm\b|\bsed\b[^|]*-i)/.test(cmd);
  if (touchesCanon && mutates && !isApprovedPromote)
    deny("Only brain-promote.js --approve may modify .project-brain/canon/");
  if (/\brm\b[^|;&]*\.project-brain/.test(cmd))
    deny("Destructive command targeting .project-brain/ blocked — the capsule is governed memory");
}
' 2>/dev/null)" || { echo "brain-security-guard: parser error — failing open" >&2; exit 0; }
[ -n "${DECISION}" ] && printf '%s' "${DECISION}"
exit 0
```

- [ ] **Step 6: Write `hooks/brain/brain-post-lint.sh`**

```bash
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
```

- [ ] **Step 7: Make hooks executable, run test to verify it passes**

```bash
chmod +x hooks/brain/*.sh
node scripts/brain/brain-hooks.test.js
```

Expected: `brain-hooks.test.js: all assertions passed`, exit 0

- [ ] **Step 8: Commit**

```bash
git add hooks/brain scripts/brain/brain-hooks.test.js
git commit -m "feat(brain): capture + security hooks — PreCompact/SessionEnd/Stop/PreToolUse/PostToolUse"
```

---

### Task 2: brain-self-install.sh

**Files:**
- Create: `scripts/brain/brain-self-install.sh`
- Test: `scripts/brain/brain-self-install.test.js`

**Interfaces:**
- Consumes: Task 1 hooks + registration matrix; Phase 1 template + `brain-verify.js`; install.sh's telemetry `ensureHookEntry` merge pattern (reused verbatim against `settings.local.json`)
- Produces: `bash scripts/brain/brain-self-install.sh [target-dir]` (default: repo root). Idempotent. Phase 5 retires this into install.sh step 8 — keep its body structured as one self-contained block to lift wholesale.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-self-install.test.js`**

```js
// scripts/brain/brain-self-install.test.js — installs a capsule into a temp
// target, merges hooks into settings.local.json without clobbering, is
// idempotent, and passes brain-verify.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..', '..');
const SCRIPT = path.join(__dirname, 'brain-self-install.sh');
const TMP = path.join(__dirname, '__selfinstall_test_tmp__');

function run() {
  const r = spawnSync('bash', [SCRIPT, TMP], { encoding: 'utf8', cwd: REPO });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, '.claude'), { recursive: true });
  // Pre-existing hook that must survive the merge untouched
  fs.writeFileSync(path.join(TMP, '.claude', 'settings.local.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo preexisting' }] }] },
  }, null, 2));
  fs.writeFileSync(path.join(TMP, '.gitignore'), 'node_modules/\n');

  // 1. Install succeeds; capsule verifies; placeholders filled
  let r = run();
  assert.strictEqual(r.status, 0, `install failed:\n${r.stdout}\n${r.stderr}`);
  const brain = path.join(TMP, '.project-brain');
  const verify = spawnSync('node', [path.join(__dirname, 'brain-verify.js'), '--target', brain], { encoding: 'utf8' });
  assert.strictEqual(verify.status, 0, verify.stderr);
  const brainMd = fs.readFileSync(path.join(brain, 'BRAIN.md'), 'utf8');
  assert.ok(!brainMd.includes('{{PROJECT_NAME}}'), 'placeholders filled');
  const profile = JSON.parse(fs.readFileSync(path.join(brain, 'context', 'brain-profile.json'), 'utf8'));
  assert.strictEqual(profile.project_name, path.basename(TMP));
  assert.ok(/^\d{4}-\d{2}-\d{2}/.test(profile.created_at));

  // 2. Hooks merged: 5 brain registrations present, pre-existing hook intact
  const settings = JSON.parse(fs.readFileSync(path.join(TMP, '.claude', 'settings.local.json'), 'utf8'));
  const flat = JSON.stringify(settings.hooks);
  for (const h of ['brain-pre-compact.sh', 'brain-session-end.sh', 'brain-security-guard.sh', 'brain-post-lint.sh']) {
    assert.ok(flat.includes(h), `${h} registered`);
  }
  assert.ok(flat.includes('echo preexisting'), 'pre-existing hook survived');
  assert.ok(Array.isArray(settings.hooks.Stop) && Array.isArray(settings.hooks.SessionEnd),
    'session-end script registered on both SessionEnd and Stop');

  // 3. .gitignore gained the sessions line exactly once
  const gi = fs.readFileSync(path.join(TMP, '.gitignore'), 'utf8');
  assert.strictEqual((gi.match(/^\.project-brain\/sessions\/$/gm) || []).length, 1);

  // 4. Idempotent: re-run changes nothing
  const settingsBefore = fs.readFileSync(path.join(TMP, '.claude', 'settings.local.json'), 'utf8');
  const brainMdBefore = fs.readFileSync(path.join(brain, 'BRAIN.md'), 'utf8');
  r = run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(fs.readFileSync(path.join(TMP, '.claude', 'settings.local.json'), 'utf8'), settingsBefore);
  assert.strictEqual(fs.readFileSync(path.join(brain, 'BRAIN.md'), 'utf8'), brainMdBefore);
  assert.strictEqual((fs.readFileSync(path.join(TMP, '.gitignore'), 'utf8').match(/\.project-brain\/sessions\//g) || []).length, 1);

  console.log('brain-self-install.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-self-install.test.js`
Expected: FAIL (script missing)

- [ ] **Step 3: Write `scripts/brain/brain-self-install.sh`**

```bash
#!/usr/bin/env bash
# scripts/brain/brain-self-install.sh — Phase 2 manual installer: capsule +
# hook registration + .gitignore, ending with brain-verify. Idempotent.
# Usage: bash scripts/brain/brain-self-install.sh [target-dir]   (default: this repo)
# NOTE: retired into install.sh step 8 (--with-second-brain) in Phase 5.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="$(cd "${1:-${REPO_DIR}}" && pwd)"
BRAIN="${TARGET}/.project-brain"
T="${REPO_DIR}/templates/second-brain"

# 1. Capsule from template (install recipe from templates/second-brain/README.md)
if [ ! -d "${BRAIN}" ]; then
  cp -R "${T}/project-brain" "${BRAIN}"
  cp "${T}/BRAIN.md" "${T}/MEMORY.md" "${T}/README.md" "${BRAIN}/"
  cp "${T}/brain-profile.json" "${BRAIN}/context/brain-profile.json"
  NAME="$(basename "${TARGET}")"
  TODAY="$(date -u +%F)"
  node -e '
const fs = require("fs");
const [brain, name, today] = process.argv.slice(1);
const bm = brain + "/BRAIN.md";
fs.writeFileSync(bm, fs.readFileSync(bm, "utf8")
  .replaceAll("{{PROJECT_NAME}}", name).replaceAll("{{CREATED_AT}}", today));
const pf = brain + "/context/brain-profile.json";
const p = JSON.parse(fs.readFileSync(pf, "utf8"));
p.project_name = name;
p.project_slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
p.created_at = today;
fs.writeFileSync(pf, JSON.stringify(p, null, 2) + "\n");
' "${BRAIN}" "${NAME}" "${TODAY}"
  echo "✓ capsule created at ${BRAIN}"
else
  echo "✓ capsule already present — skipping template copy"
fi

# 2. Hook registration → .claude/settings.local.json (merge, never clobber —
#    same ensureHookEntry pattern as install.sh's telemetry step)
mkdir -p "${TARGET}/.claude"
ADDED="$(node -e '
const fs = require("fs");
const file = process.argv[1] + "/.claude/settings.local.json";
let settings = {};
if (fs.existsSync(file)) { try { settings = JSON.parse(fs.readFileSync(file, "utf8")); } catch { settings = {}; } }
settings.hooks = settings.hooks || {};
function ensureHookEntry(eventName, matcher, command) {
  settings.hooks[eventName] = settings.hooks[eventName] || [];
  const list = settings.hooks[eventName];
  const already = list.some((entry) =>
    (entry.matcher || null) === (matcher || null) &&
    Array.isArray(entry.hooks) && entry.hooks.some((h) => h && h.command === command));
  if (already) return false;
  list.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: "command", command }] });
  return true;
}
const H = (name) => `bash "$CLAUDE_PROJECT_DIR/hooks/brain/${name}"`;
let added = 0;
if (ensureHookEntry("PreCompact", null, H("brain-pre-compact.sh"))) added++;
if (ensureHookEntry("SessionEnd", null, H("brain-session-end.sh"))) added++;
if (ensureHookEntry("Stop", null, H("brain-session-end.sh"))) added++;
if (ensureHookEntry("PreToolUse", "Write|Edit|NotebookEdit|Bash", H("brain-security-guard.sh"))) added++;
if (ensureHookEntry("PostToolUse", "Write|Edit", H("brain-post-lint.sh"))) added++;
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
process.stdout.write(String(added));
' "${TARGET}")"
echo "✓ hook entries merged (${ADDED} added)"

# 3. .gitignore — session logs are local-only by default
touch "${TARGET}/.gitignore"
grep -qxF '.project-brain/sessions/' "${TARGET}/.gitignore" \
  || echo '.project-brain/sessions/' >> "${TARGET}/.gitignore"
echo "✓ .gitignore covers .project-brain/sessions/"

# 4. Acceptance: structural verify (fails loudly on a bad install)
node "${REPO_DIR}/scripts/brain/brain-verify.js" --target "${BRAIN}"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
chmod +x scripts/brain/brain-self-install.sh
node scripts/brain/brain-self-install.test.js
```

Expected: `brain-self-install.test.js: all assertions passed`, exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-self-install.sh scripts/brain/brain-self-install.test.js
git commit -m "feat(brain): brain-self-install — capsule + hook merge + verify, idempotent"
```

---

### Task 3: Self-install on claude_code and live smoke test

**Files:**
- Modify: `.claude/settings.local.json` (hook merge — via the script, not by hand), `.gitignore` (one line, via the script)
- Create: `.project-brain/` in this repo (capsule content is real memory from here on)

**Interfaces:**
- Consumes: Task 2's installer
- Produces: a live brain on claude_code. Phase 3's skills and Phase 4's retrieval operate on this capsule.

- [ ] **Step 1: Record pre-install hook state**

```bash
node -e "const s=require('./.claude/settings.local.json'); console.log(Object.keys(s.hooks||{}).map(k=>k+':'+s.hooks[k].length).join(' '))" > /tmp/hooks-before.txt
cat /tmp/hooks-before.txt
```

- [ ] **Step 2: Run the self-install against the repo**

```bash
bash scripts/brain/brain-self-install.sh
```

Expected: `✓ capsule created`, `✓ hook entries merged (5 added)`, `brain-verify: OK`

- [ ] **Step 3: Assert every pre-existing hook survived**

```bash
node -e "
const s = require('./.claude/settings.local.json');
const before = require('fs').readFileSync('/tmp/hooks-before.txt', 'utf8').trim();
for (const pair of before.split(' ').filter(Boolean)) {
  const [k, n] = pair.split(':');
  if (!s.hooks[k] || s.hooks[k].length < Number(n)) { console.error('LOST HOOKS on ' + k); process.exit(1); }
}
console.log('all pre-existing hooks intact');
"
```

Expected: `all pre-existing hooks intact`

- [ ] **Step 4: Live smoke — capture and compile a real entry**

```bash
node scripts/brain/brain-capture.js --type decision --title "Second brain self-installed" \
  --message "Phase 2 complete: capsule live on claude_code, capture hooks registered. Governance: canon only via brain-promote --approve."
node scripts/brain/brain-compile.js
ls .project-brain/decisions/candidates/
node scripts/brain/brain-lint.js
```

Expected: capture appends · compile writes 1 candidate · lint exits 0 with 0 security findings

- [ ] **Step 5: Commit the capsule (sessions/ stays gitignored)**

```bash
git add .project-brain .gitignore .claude/settings.local.json
git status --porcelain   # confirm .project-brain/sessions/ is NOT staged
git commit -m "feat(brain): self-install second brain capsule on claude_code (Phase 2 live)"
```

**Note:** if `.claude/settings.local.json` is gitignored in this repo, drop it from the `git add` — the hook registration is machine-local by design.

---

## Deferred

Skills wrapping these flows (Phase 3) · SessionStart brain-load hook (Phase 4 — nothing to load until retrieval exists) · install.sh step 8 (Phase 5 retires brain-self-install.sh).
