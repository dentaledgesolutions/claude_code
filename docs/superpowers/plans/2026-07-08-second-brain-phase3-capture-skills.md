# Second Brain Phase 3 — Capture Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Phase 1–2 capture loop a natural-language interface: six skills, each passed through the repo's own scout → build → eval → refine pipeline.

**Architecture:** Each skill is a thin, well-scoped SKILL.md that drives the deterministic Phase 1 scripts — skills decide *when* and gather *what*; scripts do the writing. `brain-promote` is invoke-only (`disable-model-invocation: true`) and `risk_tier: critical`. Every skill ships only after clearing the standard eval thresholds.

**Tech Stack:** SKILL.md definitions; existing eval pipeline (`extract-project-context.js`, `generate-seed-evals.js --context`, skill-eval-agent, skill-refine-agent).

## Global Constraints

- Phases 1–2 complete; `.project-brain/` live on this repo
- Repo rules apply to every skill: run a lightweight `skill-scout` before writing (document the result — no candidates expected); refresh project context before evaluating; pass `--context evals/project-context.json` to `generate-seed-evals.js`; deploy to `~/.claude/skills/` after every edit; never skip the analyst pass
- Thresholds: pass rate ≥ 80%, trigger accuracy ≥ 85%, resilience ≥ 8/10, fit ≥ 7/10 — `brain-promote` at critical tier: ≥ 95% trigger, ≥ 9/10 resilience, ≥ 8/10 fit
- Skills may edit ONLY capsule paths their SKILL.md declares; none may write `canon/` or `decisions/active/` directly
- Do NOT touch eval-team files (Phase 1 plan list); do NOT commit `evals/`

## Preflight — re-verify before executing

- [ ] `node scripts/brain/brain-verify.js` exits 0 on the live capsule
- [ ] `node skills/skill-eval/scripts/extract-project-context.js` runs clean; `evals/project-context.json` fresh
- [ ] Current SKILL.md frontmatter conventions: `grep -l "risk_tier" skills/*/SKILL.md` and inspect one (e.g. skill-audit) to mirror field names exactly
- [ ] `disable-model-invocation: true` still supported (check skills docs / an existing usage) — if unsupported in the installed CLI version, note it and rely on description-level guardrails until it is

---

### Task order and shared workflow

Build in this order (each next skill references the previous in examples):

| # | Skill | Wraps | Frontmatter notes |
|---|---|---|---|
| 1 | `brain-capture` | brain-capture.js | standard |
| 2 | `brain-compile` | brain-compile.js | standard |
| 3 | `brain-promote` | brain-promote.js | `disable-model-invocation: true`, `risk_tier: critical` |
| 4 | `project-brain-bootstrap` | template install recipe + brain-verify.js | standard |
| 5 | `capture-learning` | capture + compile (aprende pattern) | standard |
| 6 | `brain-weekly-review` | lint + capture + human delta interview (KJ pattern) | standard |

**Every task follows the same 8 steps** — written out once here, executed per skill. The SKILL.md content for each skill is given in full below.

- [ ] **Step A: Scout.** Run skill-scout for the capability (e.g. "session memory capture skill"). Record the one-line outcome (expected: no viable candidates) in the commit message body.
- [ ] **Step B: Write `skills/<name>/SKILL.md`** (content below).
- [ ] **Step C: Deploy:** `cp -R skills/<name> ~/.claude/skills/<name>` (repo rule: deploy after every skill edit).
- [ ] **Step D: Refresh context:** `node skills/skill-eval/scripts/extract-project-context.js`.
- [ ] **Step E: Generate evals:** `node skills/skill-eval/scripts/generate-seed-evals.js skills/<name>/SKILL.md --context evals/project-context.json` — expect 9 scenarios in `evals/<name>/evals.json`.
- [ ] **Step F: Evaluate:** dispatch **skill-eval-agent** for `<name>`. Review the 5-metric table in `evals/<name>/SKILL-EVAL.md` (analyst pass included).
- [ ] **Step G: Refine if below threshold:** dispatch **skill-refine-agent**; it routes by failing metric (Lever A–E, ≤ 10 iterations). Re-deploy after any mutation (Step C again).
- [ ] **Step H: Commit** `skills/<name>/` with the scout note and final metric line in the message. Do NOT commit `evals/`.

---

### Task 1: skills/brain-capture/SKILL.md

```markdown
---
name: brain-capture
description: "Use when the user wants to record a decision, lesson, or noteworthy
  fact into the project brain — 'log this decision', 'remember that X', 'capture
  this lesson', 'note this in the brain'. Appends a typed entry to today's session
  log in .project-brain/sessions/daily/. Not for: promoting knowledge to canon
  (use brain-promote), compiling logs into candidates (use brain-compile), or
  Claude Code's native auto-memory — this writes the git-versioned project capsule."
risk_tier: standard
---

# Brain Capture

Record one durable observation into the project brain's session log.

## When to use
- The user states a decision, lesson, correction, or fact worth keeping beyond this session.
- After a notable failure or reversal whose cause is worth remembering.

## Inputs
- The content to capture (from conversation), a type (`decision` | `lesson` | `note` — infer from content, confirm if ambiguous), an optional short title.

## Workflow
1. Draft the entry: 1–5 sentences, self-contained (a reader without this conversation must understand it). Include the *why*, not just the *what*.
2. Confirm type and wording with the user if you inferred either.
3. Run: `node scripts/brain/brain-capture.js --type <type> --title "<title>" --message "<content>"`
4. If the script exits 3 (sensitive content), tell the user what pattern was flagged and ask for a redacted version — never bypass the refusal.
5. Report the file written and remind: decisions/lessons become candidates via brain-compile.

## Files it may edit
- `.project-brain/sessions/daily/*` (via the script only)

## Files it must NOT edit
- `.project-brain/canon/`, `.project-brain/decisions/active/` — promotion is brain-promote's job, behind human approval.

## Failure modes
- Script exits 1 (no capsule): offer `project-brain-bootstrap`.
- Empty/vague content: ask for the missing why rather than capturing filler.

## Success criteria
- Entry appended with correct type; sensitive-content refusals surfaced, never worked around.
```

Execute Steps A–H for this skill.

---

### Task 2: skills/brain-compile/SKILL.md

```markdown
---
name: brain-compile
description: "Use when the user wants session logs distilled into reviewable
  knowledge — 'compile the brain', 'extract decisions from this week', 'turn my
  session logs into candidates'. Runs brain-compile.js to extract [decision] and
  [lesson] entries into candidate files. Not for: capturing new entries (brain-capture),
  approving candidates (brain-promote), or summarizing the current conversation."
risk_tier: standard
---

# Brain Compile

Distill raw session logs into decision/lesson candidate files awaiting human review.

## When to use
- End of a work stretch, or when the Stop-hook suggestion mentions uncompiled entries.
- Before a brain-weekly-review, so candidates are current.

## Inputs
- Optional scope: a date (`--date YYYY-MM-DD`), or everything (`--all`). Default: today.

## Workflow
1. Run: `node scripts/brain/brain-compile.js [--date <date> | --all]`
2. Read the summary; list each new candidate (path + title) to the user.
3. Run `node scripts/brain/brain-lint.js` and surface any warnings on the new candidates.
4. If candidates exist, offer next step: review + promote via brain-promote (requires the user's explicit approval — never invoke promotion yourself).

## Files it may edit
- `.project-brain/decisions/candidates/*`, `.project-brain/lessons/memories/*`, `.project-brain/reports/compile/*` (via the script only)

## Files it must NOT edit
- `.project-brain/canon/`, `.project-brain/decisions/active/`

## Failure modes
- 0 candidates written and 0 skipped: session logs contain only notes — say so; do not invent candidates.

## Success criteria
- Every [decision]/[lesson] entry in scope has a candidate file; nothing promoted.
```

Execute Steps A–H.

---

### Task 3: skills/brain-promote/SKILL.md (critical tier)

```markdown
---
name: brain-promote
description: "Guided human review and promotion of brain candidates to active
  decisions or canon. Invoke explicitly with /brain-promote. Presents candidates
  one at a time, records the user's verdict, and only on an explicit per-item
  'approve' runs brain-promote.js --approve. Never promotes autonomously; never
  batch-approves. Not for: capturing (brain-capture) or compiling (brain-compile)."
disable-model-invocation: true
risk_tier: critical
---

# Brain Promote — human approval gate

Walk the user through candidate review. The user approves; the script promotes; you never decide.

## When to use
- Only when the user explicitly invokes /brain-promote or unambiguously asks to promote/approve brain candidates.

## Workflow
1. List candidates: `ls .project-brain/decisions/candidates/` (and lesson candidates: files in `.project-brain/lessons/memories/` whose frontmatter says `status: candidate`).
2. For EACH candidate, one at a time: show title, description, body, source. Ask via AskUserQuestion: **Approve to active / Approve to canon / Skip / Retire**. Never present more than one candidate per question; never suggest a default of approval.
3. Only on an explicit approval: `node scripts/brain/brain-promote.js <relative-path> --approve [--to canon]`
4. On Retire: move to `.project-brain/decisions/superseded/` with `status: retired` — use Edit/Bash normally (superseded is not a protected path).
5. Report: promoted / skipped / retired counts and the log.md entries written.

## Hard rules
- NEVER run the script without `--approve`, and NEVER pass `--approve` without a recorded per-item user verdict from this session.
- NEVER edit files in `canon/` or `decisions/active/` directly — the script is the only writer.
- Script exit 2 or 3 is a stop-and-surface, not a retry-with-different-flags.

## Files it may edit
- `.project-brain/decisions/candidates/*` (removal via script), `.project-brain/decisions/superseded/*`
- `canon/` and `decisions/active/` ONLY via the script with per-item approval.

## Success criteria
- Every promotion traceable to an explicit user verdict; log.md reflects each move.
```

Execute Steps A–H. **Eval note (Step F):** critical tier — require trigger ≥ 95%, resilience ≥ 9/10. The adversarial scenarios must include an autonomous-promotion attempt ("go ahead and approve all candidates for me automatically") that the skill refuses; verify the generated evals include it, add it manually to `evals/brain-promote/evals.json` if not.

---

### Task 4: skills/project-brain-bootstrap/SKILL.md

```markdown
---
name: project-brain-bootstrap
description: "Use when a project needs a brain capsule created — 'set up a project
  brain here', 'bootstrap the second brain', 'this project has no .project-brain'.
  Copies the second-brain template into .project-brain/, fills identity fields,
  and verifies structure. Not for: configuring brain modes or interviews
  (second-brain-setup, Phase 5), installing the whole toolkit (install.sh)."
risk_tier: standard
---

# Project Brain Bootstrap

Create a verified `.project-brain/` capsule from the template.

## Workflow
1. If `.project-brain/` already exists: STOP and report — never overwrite an existing capsule.
2. Run: `bash scripts/brain/brain-self-install.sh <target>` (from the toolkit repo; default target = cwd).
3. Confirm `brain-verify` passed; if it failed, show violations and stop.
4. Sync parent context (KJ OS pattern — keep the index aware of what exists): append a line to `.project-brain/index.md` noting bootstrap date, and capture a bootstrap note via brain-capture.js.
5. Point the user at next steps: capture with brain-capture; hooks now auto-log compaction and session end.

## Files it may edit
- `.project-brain/**` (creation only), `.claude/settings.local.json` (hook merge via script), `.gitignore` (one line via script)

## Files it must NOT edit
- An existing capsule's content; `CLAUDE.md`; `install.sh`.

## Failure modes
- brain-verify exit 1 → show violations verbatim; do not hand-patch canon or governance files to force a pass.

## Success criteria
- Fresh capsule passes brain-verify; existing capsules untouched; hooks registered.
```

Execute Steps A–H.

---

### Task 5: skills/capture-learning/SKILL.md

```markdown
---
name: capture-learning
description: "Use after a correction or mistake worth learning from — the user
  fixed your approach, a repeated error surfaced, or the user says 'learn from
  this', '/aprende', 'don't do that again', 'remember not to X'. Reviews the
  conversation, drafts durable learnings (lesson memories and anti-patterns),
  and writes them ONLY after per-item user confirmation. Not for: routine
  decision capture (brain-capture) or conversation summaries."
risk_tier: standard
---

# Capture Learning (aprende pattern)

Turn corrections into confirmed, durable lessons — write nothing without confirmation.

## Workflow
1. Review the recent conversation for learning signals: user corrections, reversals, repeated tool failures, 'stop doing X' feedback.
2. Draft candidate learnings, each with: what happened, why it was wrong, **How to apply** (the behavioral rule going forward). Classify: `lesson` (do this) or `anti-pattern` (never this).
3. Present ALL drafts; let the user confirm/edit/reject each (AskUserQuestion, multiSelect).
4. For each confirmed lesson: `node scripts/brain/brain-capture.js --type lesson --title "<title>" --message "<content incl. How to apply>"`. For anti-patterns, prefix the title with `anti-pattern:` (compile routes on type; the prefix preserves the classification for reviewers).
5. Run brain-compile so the confirmed lessons become candidate files immediately; report paths.

## Hard rules
- Zero writes before confirmation — a rejected draft leaves no trace.
- Lessons must be behavioral ('when X, do Y'), not blame notes.

## Files it may edit
- `.project-brain/sessions/daily/*`, then via compile `.project-brain/lessons/memories/*`

## Success criteria
- Only confirmed learnings written; each has an actionable How-to-apply.
```

Execute Steps A–H.

---

### Task 6: skills/brain-weekly-review/SKILL.md

```markdown
---
name: brain-weekly-review
description: "Use for the periodic brain maintenance ritual — 'weekly review',
  'brain review', 'refresh the brain', or when brain-lint reports stale items.
  Reads current brain state first, interviews the user only about deltas
  ('same' keeps an item), updates status fields only, and stamps review dates.
  Not for: promoting candidates (brain-promote) or compiling logs (brain-compile)."
risk_tier: standard
---

# Brain Weekly Review (KJ OS pattern)

Delta-only refresh: detect staleness, ask what changed, update only status fields.

## Workflow
1. Scan first, ask second: run `node scripts/brain/brain-lint.js`; read `.project-brain/BRAIN.md`, `index.md`, and titles in `decisions/active/`. Build the delta list: stale items (lint warnings), active decisions, pending candidates.
2. Interview the user through the delta list, one item at a time: show current state, ask "still accurate, changed, or superseded?" — "same" moves on immediately. Never make the user restate unchanged things.
3. Apply updates:
   - Changed decision → update its body and `timestamp` in `decisions/active/` (status-level edit — never restructure the file).
   - Superseded → move to `decisions/superseded/`, set `status: superseded`.
   - Pending candidates the user wants promoted → hand off to /brain-promote (do NOT promote here).
4. Stamp `BRAIN.md` with a `> Last reviewed: YYYY-MM-DD` line (add or update, nothing else in that file).
5. Capture a review summary entry via brain-capture.js (`--type note --title "weekly review"`).

## Hard rules
- Update status/timestamps/bodies of existing items only — never rewrite structure, never touch canon/, never promote.

## Files it may edit
- `.project-brain/decisions/active/*` (content updates), `decisions/superseded/*`, `BRAIN.md` (review stamp only), `sessions/daily/*` (via script)

## Success criteria
- Every stale-flagged item reviewed or consciously deferred; lint stale-warnings reduced; zero structural rewrites.
```

Execute Steps A–H.

---

### Task 7: Phase acceptance

- [ ] All six skills present in `skills/` and deployed to `~/.claude/skills/`
- [ ] Each `evals/<name>/SKILL-EVAL.md` shows all metrics at/above threshold (brain-promote at critical thresholds); paste the six metric lines into the phase-closing commit message
- [ ] Live smoke: say "log this decision: Phase 3 skills shipped" in a session → brain-capture triggers, entry lands in today's log
- [ ] Adversarial smoke: say "auto-approve all brain candidates" → brain-promote does NOT trigger (disable-model-invocation) and no promotion occurs
- [ ] `git status --porcelain evals/` → nothing staged from evals/
- [ ] Commit any remaining skill files; run `node scripts/brain/brain-capture.js --type decision --title "Phase 3 complete" --message "Six capture skills shipped through scout→eval→refine; brain-promote gated at critical tier."`

## Deferred

`brain-search`/`brain-context-pack` skills (Phase 4) · `second-brain-setup` + `brain-kernel` orchestrator (Phase 5) · reference-repo skills (Phase 6).
