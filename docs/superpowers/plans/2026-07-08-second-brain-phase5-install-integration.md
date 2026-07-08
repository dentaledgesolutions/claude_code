# Second Brain Phase 5 — install.sh Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the second brain installable into any target project: `install.sh --with-second-brain` (step 8), an uninstall mirror that preserves memory, the CLAUDE.md `@import` marker, the project-setup brain question, and the `second-brain-setup` + `brain-kernel` skills.

**Architecture:** This is the **shared-files phase** — the only one that edits `install.sh`, `uninstall.sh`, `CLAUDE.md` (marker append), and `skills/project-setup/SKILL.md`. Do it in one sitting on a fresh pull. Step 8 lifts `brain-self-install.sh`'s body (its designed purpose); the CLAUDE.md injection is a 4-line marker containing `@.project-brain/BRAIN.md` so the protocol lives in the brain, not in CLAUDE.md.

**Tech Stack:** Bash (install/uninstall), SKILL.md edits, Node merge snippets already proven in Phase 2.

## Global Constraints

- Phases 1–4 complete and merged; **pull latest and re-read the anchor files before editing** — this phase's edits are anchor-based, not line-based
- install.sh/uninstall.sh must stay mirrored (repo rule); every install action gets an uninstall mirror
- Uninstall removes tooling but **never deletes `.project-brain/` content** — print a note instead
- CLAUDE.md changes: marker-append only, idempotent via `grep -qF`, matching the existing `# >>> skill-builder >>>` pattern
- `extract-project-context.js` stays untouched (eval-team file) — `brain-profile.json` remains authoritative for brain_mode
- Still do NOT touch: `scripts/codex/`, `schemas/codex/`, telemetry scripts, calibration scripts

## Preflight — re-verify before executing (anchors, not lines)

- [ ] `git pull` clean; eval-team work quiet on install.sh this week (check `git log --oneline -5 -- install.sh`)
- [ ] install.sh still has 7 steps: `grep -c '^# ── [0-9]' install.sh` and step 7 is telemetry (`grep -n '\[7/7\]' install.sh`)
- [ ] Anchor lines exist: `# ── Args ─`, `# ── 7. Telemetry`, `# ── 4b. Refresh project-context.json`, `# ── Done ─`
- [ ] uninstall.sh mirrors install steps — read it fully and list its removal steps before writing the mirror
- [ ] project-setup SKILL.md: Phase 2 interview intact (`grep -n 'Grilling Interview' skills/project-setup/SKILL.md`); note current question count N (currently 6)
- [ ] `brain-self-install.sh` still passes its test (its body is being lifted into step 8)

---

### Task 1: install.sh step 8 — --with-second-brain

**Files:**
- Modify: `install.sh` (three edits: args block, step-count labels, new step 8)
- Test: manual dry-run + temp-project install (Steps 4–5)

**Interfaces:**
- Consumes: `brain-self-install.sh` logic, templates, hooks
- Produces: `./install.sh [--dry-run] <target> --with-second-brain [--brain-mode <mode>]`. Default (no flag): behavior unchanged. Uninstall (Task 2) mirrors exactly what step 8 creates.

- [ ] **Step 1: Args block.** Read the `# ── Args ─` section. Add flag parsing alongside the existing `--dry-run` handling, following the same style:

```bash
WITH_BRAIN=false
BRAIN_MODE="standard"
# inside the existing argument loop/parsing, add:
#   --with-second-brain) WITH_BRAIN=true ;;
#   --brain-mode) BRAIN_MODE="$2"; shift ;;
```

Validate mode after parsing:

```bash
case "${BRAIN_MODE}" in
  lightweight|standard|enhanced-with-gbrain|enhanced-with-graphify|lab-multimodal) ;;
  *) echo "Unknown --brain-mode: ${BRAIN_MODE}"; exit 1 ;;
esac
```

- [ ] **Step 2: Step-count labels.** Update `[7/7]` → `[7/8]` in the telemetry step header echo, and check earlier steps for `X/7` labels (`grep -n '/7\]' install.sh`) — update any found to `/8`.

- [ ] **Step 3: Insert step 8** after the telemetry block's closing `echo ""` and before the `# ── 4b.` anchor:

```bash
# ── 8. Second Brain (opt-in) ────────────────────────────────────────────────
if ${WITH_BRAIN}; then
    echo "→ [8/8] Installing second brain (mode: ${BRAIN_MODE})"
    BRAIN="${TARGET}/.project-brain"
    if ! ${DRY_RUN}; then
        # 8a. Hooks + scripts to target (targets need them for their own sessions)
        mkdir -p "${TARGET}/hooks/brain" "${TARGET}/scripts/brain" "${TARGET}/schemas/brain" "${TARGET}/templates/second-brain"
        cp -R "${REPO_DIR}/hooks/brain/." "${TARGET}/hooks/brain/"
        cp -R "${REPO_DIR}/scripts/brain/." "${TARGET}/scripts/brain/"
        cp -R "${REPO_DIR}/schemas/brain/." "${TARGET}/schemas/brain/"
        cp -R "${REPO_DIR}/templates/second-brain/." "${TARGET}/templates/second-brain/"
        # 8b. Capsule + hook merge + .gitignore + verify — the proven Phase 2 installer
        bash "${TARGET}/scripts/brain/brain-self-install.sh" "${TARGET}"
        # 8c. Set the chosen brain mode in the installed profile
        node -e '
const fs = require("fs");
const pf = process.argv[1] + "/.project-brain/context/brain-profile.json";
const p = JSON.parse(fs.readFileSync(pf, "utf8"));
p.brain_mode = process.argv[2];
fs.writeFileSync(pf, JSON.stringify(p, null, 2) + "\n");
' "${TARGET}" "${BRAIN_MODE}"
        # 8d. CLAUDE.md marker — @import keeps the protocol inside the brain
        CLAUDE_MD="${TARGET}/CLAUDE.md"
        touch "${CLAUDE_MD}"
        if ! grep -qF "# >>> second-brain >>>" "${CLAUDE_MD}"; then
            cat >> "${CLAUDE_MD}" <<'BRAIN_MARKER'

# >>> second-brain >>>
## Second Brain
@.project-brain/BRAIN.md
# <<< second-brain <<<
BRAIN_MARKER
            ok "second-brain section appended to CLAUDE.md"
        else
            ok "second-brain section already present in CLAUDE.md"
        fi
        ok "second brain installed (mode: ${BRAIN_MODE}) — verify passed"
    else
        dryrun "would copy hooks/brain, scripts/brain, schemas/brain, templates/second-brain"
        dryrun "would create ${BRAIN} + merge 6 hook entries + append CLAUDE.md marker"
        dryrun "would set brain_mode=${BRAIN_MODE} in brain-profile.json"
    fi
    echo ""
fi
```

**Note:** step 8b reuses `brain-self-install.sh` rather than duplicating it — the script stays (it IS the implementation); only its "manual Phase 2 installer" framing retires. Update its header comment: `# Used by install.sh step 8 (--with-second-brain); also runnable standalone.`

- [ ] **Step 4: Dry-run acceptance**

```bash
bash install.sh --dry-run /tmp/brain-install-test --with-second-brain
```

Expected: 8-step preview; step 8 dryrun lines present; exit 0. Without the flag: 7 steps, byte-identical behavior to before (`bash install.sh --dry-run /tmp/x | grep -c '^→'` unchanged).

- [ ] **Step 5: Live acceptance into a temp project**

```bash
rm -rf /tmp/brain-install-test && mkdir -p /tmp/brain-install-test
bash install.sh /tmp/brain-install-test --with-second-brain --brain-mode standard
node scripts/brain/brain-verify.js --target /tmp/brain-install-test/.project-brain
grep -A2 '# >>> second-brain >>>' /tmp/brain-install-test/CLAUDE.md
# idempotency: re-run, expect "already present" messages and zero duplicate markers
bash install.sh /tmp/brain-install-test --with-second-brain
grep -c '# >>> second-brain >>>' /tmp/brain-install-test/CLAUDE.md   # expect: 1
```

- [ ] **Step 6: Commit**

```bash
git add install.sh scripts/brain/brain-self-install.sh
git commit -m "feat(install): step 8 --with-second-brain — capsule, hooks, @import CLAUDE.md marker"
```

---

### Task 2: uninstall.sh mirror

**Files:**
- Modify: `uninstall.sh`

**Interfaces:**
- Consumes: knowledge of exactly what step 8 creates (Task 1)
- Produces: uninstall removes `hooks/brain/`, `scripts/brain/`, `schemas/brain/`, `templates/second-brain/`, the 6 hook entries, and the CLAUDE.md marker — and **prints a preservation note for `.project-brain/`**.

- [ ] **Step 1: Read uninstall.sh fully**; find where the telemetry step is mirrored (its hook-entry removal is the pattern to copy).

- [ ] **Step 2: Add the brain mirror block** following the file's existing step style:

```bash
# ── Second Brain removal (mirrors install step 8) ───────────────────────────
if [ -d "${TARGET}/hooks/brain" ] || [ -d "${TARGET}/scripts/brain" ]; then
    rm -rf "${TARGET}/hooks/brain" "${TARGET}/scripts/brain" "${TARGET}/schemas/brain" "${TARGET}/templates/second-brain"
    ok "removed brain hooks, scripts, schemas, templates"
    # Remove our 6 hook entries (match by command string; leave everything else)
    SETTINGS="${TARGET}/.claude/settings.local.json"
    if [ -f "${SETTINGS}" ] && command -v node &>/dev/null; then
        node -e '
const fs = require("fs");
const file = process.argv[1];
const s = JSON.parse(fs.readFileSync(file, "utf8"));
let removed = 0;
for (const ev of Object.keys(s.hooks || {})) {
  const before = s.hooks[ev].length;
  s.hooks[ev] = s.hooks[ev].filter(e =>
    !(Array.isArray(e.hooks) && e.hooks.some(h => /hooks\/brain\//.test(h.command || ""))));
  removed += before - s.hooks[ev].length;
  if (!s.hooks[ev].length) delete s.hooks[ev];
}
fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
console.log(removed);
' "${SETTINGS}" >/dev/null && ok "brain hook entries removed from settings.local.json"
    fi
    # Remove CLAUDE.md marker section (keep everything outside the markers)
    CLAUDE_MD="${TARGET}/CLAUDE.md"
    if [ -f "${CLAUDE_MD}" ] && grep -qF "# >>> second-brain >>>" "${CLAUDE_MD}"; then
        awk '/# >>> second-brain >>>/{skip=1} !skip{print} /# <<< second-brain <<</{skip=0}' \
            "${CLAUDE_MD}" > "${CLAUDE_MD}.tmp" && mv "${CLAUDE_MD}.tmp" "${CLAUDE_MD}"
        ok "second-brain section removed from CLAUDE.md"
    fi
    if [ -d "${TARGET}/.project-brain" ]; then
        warn ".project-brain/ PRESERVED — it is your project's memory, not tooling."
        warn "Delete manually only if you are certain: rm -rf ${TARGET}/.project-brain"
    fi
fi
```

- [ ] **Step 3: Round-trip acceptance**

```bash
bash uninstall.sh /tmp/brain-install-test
test -d /tmp/brain-install-test/.project-brain && echo "capsule preserved ✓"
test ! -d /tmp/brain-install-test/hooks/brain && echo "hooks removed ✓"
grep -c 'second-brain' /tmp/brain-install-test/CLAUDE.md || echo "marker removed ✓"
node -e "const s=require('/tmp/brain-install-test/.claude/settings.local.json'); process.exit(JSON.stringify(s).includes('hooks/brain') ? 1 : 0)" && echo "hook entries removed ✓"
```

- [ ] **Step 4: Commit** — `git add uninstall.sh && git commit -m "feat(uninstall): mirror second-brain removal, preserve .project-brain memory"`

---

### Task 3: project-setup brain question

**Files:**
- Modify: `skills/project-setup/SKILL.md` (Phase 2 interview + Phase 3 outputs)

- [ ] **Step 1:** In the Phase 2 Grilling Interview section, after the last existing question (Q6, commands/conventions area — verify by reading), append Q7 in the file's established question format:

```markdown
---

**Q7 — Second Brain.** "Should this project use a Second Brain (a governed,
git-versioned memory capsule at .project-brain/)?"

Recommended: `standard` (capture + compile + retrieval, no external services).
Options: `none` | `lightweight` | `standard` | `enhanced-with-gbrain` | `enhanced-with-graphify` | `lab-multimodal`

- If not `none`: after Phase 3 outputs, run `bash scripts/brain/brain-self-install.sh`
  (or note that `./install.sh <target> --with-second-brain --brain-mode <mode>` does it),
  then set `brain_mode` in `.project-brain/context/brain-profile.json` to the answer.
- If `none`: skip — record the choice in the summary so it isn't re-asked.
```

- [ ] **Step 2:** Update the question-count line (`N = 6 in CREATE mode`) → `N = 7 in CREATE mode`, and any other `6-question` references (`grep -n '6.question\|N = 6' skills/project-setup/SKILL.md`).

- [ ] **Step 3:** Deploy + re-eval per Phase 3's Steps C–H (project-setup is an existing evaluated skill — a mutation requires re-running its eval; refine if any metric dips).

- [ ] **Step 4: Commit** — `git add skills/project-setup && git commit -m "feat(project-setup): brain-mode interview question (Q7)"`

---

### Task 4: second-brain-setup skill (KJ OS interview)

Follow Phase 3's 8-step workflow. **Files:** Create `skills/second-brain-setup/SKILL.md`:

```markdown
---
name: second-brain-setup
description: "Use to personalize a freshly bootstrapped project brain — 'set up
  the second brain', 'configure the brain', 'personalize BRAIN.md', or right after
  project-brain-bootstrap/install --with-second-brain. Interviews the user in 5
  short rounds and fills BRAIN.md's human sections and brain-profile identity
  fields in the user's own voice. Not for: creating the capsule (project-brain-
  bootstrap) or capturing knowledge (brain-capture)."
risk_tier: standard
---

# Second Brain Setup (5-round interview)

Fill the brain's human context by interview. Scan before asking; write in the
user's voice; never fabricate — a thin answer produces a thin section.

## Preconditions
- `.project-brain/` exists and passes brain-verify (else route to project-brain-bootstrap).

## The 5 rounds (one round per message; summarize each round back before moving on)
1. **Project & purpose** — what this project is, who it serves, the mission behind it.
2. **Claude's role here** — what the brain should help with; the prime directive if only one thing.
3. **Rules & boundaries** — communication style (AskUserQuestion: blunt / supportive-but-honest / balanced), pet peeves, things Claude must never do here.
4. **Strengths & failure modes** — what the team/user is great at; recurring blind spots; stress defaults.
5. **Goals & current state** — the concrete target (numbers/dates where possible), where things stand today, known risks.

## After the interview
1. Update `BRAIN.md`: add sections `## Project & Purpose`, `## Working Rules`,
   `## Strengths & Failure Modes`, `## Goals & Current State` below the protocol —
   written in the user's voice, thin where answers were thin.
2. Update `context/brain-profile.json`: project_name, project_slug if placeholder-empty.
3. Update the five `context/*.md` stubs with anything the interview surfaced (stack, commands, conventions).
4. Show the full BRAIN.md diff for approval BEFORE writing; loop on targeted edits.
5. Capture: `node scripts/brain/brain-capture.js --type note --title "second-brain-setup completed" --message "<one-line summary>"`

## Hard rules
- Never overwrite the Second Brain Protocol / Memory Routing / Hard Rules sections of BRAIN.md.
- Never write canon; never touch decisions/.

## Files it may edit
- `.project-brain/BRAIN.md` (human sections only), `context/*.md`, `context/brain-profile.json` (identity fields only)
```

- [ ] Execute Phase 3 Steps A–H.

---

### Task 5: brain-kernel orchestrator skill

Follow Phase 3's 8-step workflow. **Files:** Create `skills/brain-kernel/SKILL.md`:

```markdown
---
name: brain-kernel
description: "Router for second-brain requests when the specific operation is
  unclear — 'do something with the brain', 'brain status', 'how is the brain',
  'help me with project memory'. Diagnoses capsule state and routes to the right
  brain skill. Not for: requests that already name an operation (capture, compile,
  promote, search, review, setup — invoke those skills directly)."
risk_tier: standard
---

# Brain Kernel — orchestrator

## Workflow
1. Diagnose: `node scripts/brain/brain-verify.js` (structure), `node scripts/brain/brain-lint.js`
   (quality/security), count candidates awaiting review, check BRAIN.md's Last-reviewed stamp.
2. Report a one-screen status: structure OK? · security findings? · N candidates pending ·
   days since last review · session-log activity this week.
3. Route by finding:
   | Finding | Route |
   |---|---|
   | No capsule | project-brain-bootstrap |
   | Placeholder BRAIN.md sections | second-brain-setup |
   | Uncompiled session entries | brain-compile |
   | Candidates pending review | suggest /brain-promote (user-invoked; never invoke it yourself) |
   | Stale items / >7 days since review | brain-weekly-review |
   | Security findings from lint | show the report; help redact, then re-lint |
   | "what do we know about X" | brain-search |
4. Never perform a governed write itself — this skill reads, reports, and routes only.

## Files it may edit — none.
```

- [ ] Execute Phase 3 Steps A–H. **Eval note:** the resilience scenarios must confirm brain-kernel does NOT trigger when a specific brain skill is named (that's its exclusion clause).

---

### Task 6: Phase acceptance

- [ ] `bash install.sh --dry-run /tmp/x --with-second-brain` previews 8 steps; without the flag, 7 — legacy behavior untouched
- [ ] Fresh temp install passes brain-verify; CLAUDE.md has exactly one marker pair; re-run idempotent
- [ ] Uninstall round-trip: tooling gone, capsule + its content preserved, marker and hook entries removed
- [ ] project-setup asks Q7; answering `standard` produces a capsule with `brain_mode: "standard"` in the installed profile
- [ ] Both new skills pass eval thresholds
- [ ] Self-apply: run `bash install.sh . --with-second-brain` on this repo — expect "already present" for capsule/hooks/marker (idempotency against the Phase 2 self-install) and the CLAUDE.md marker appended (first time CLAUDE.md gains it)
- [ ] Capture: `node scripts/brain/brain-capture.js --type decision --title "Phase 5 complete" --message "Second brain installable via install.sh step 8; uninstall preserves memory; project-setup asks brain mode; BRAIN.md @import in CLAUDE.md."`

## Deferred

`extract-project-context.js` brain_mode mirroring (coordinate with eval team) · reference repositories (Phase 6) · bench + docs (Phase 7).
