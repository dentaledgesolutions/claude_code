# Second Brain Implementation Plan
**Repo:** dentaledgesolutions/claude_code | **Ref:** Second Brain Build Reference v3 | **Date:** 2026-07-02

---

## Context

The claude_code Skill & Agent Pipeline Toolkit needs a governed, Git-backed Second Brain to give Claude Code durable operating memory across projects. The reference doc (v3) defines a three-layer architecture: **brain-kernel** (required internal runtime), **GBrain + gbrain-evals** (optional advanced retrieval), and a **Reference Repository Library** (controlled external source material). This plan extends the existing pipeline without replacing it.

**Team note:** Ongoing eval work (Codex external layer) is active on this repo. This plan avoids touching skill-eval, agent-eval, skill-refine, agent-refine, scripts/codex/, and schemas/codex/.

---

## Current Baseline & Gaps

### What exists
- **15 skills**: skill-scout, skill-audit, skill-adapt, skill-eval, skill-refine, agent-scout, agent-audit, agent-adapt, agent-eval, agent-refine, project-setup, project-audit, skill-discovery, repo-audit, project-idea
- **16 agents**: skill-eval-agent, skill-refine-agent, skill-guardian, agent-eval-agent, agent-refine-agent, skill-scout-agent, skill-synthesizer-agent, skill-needs-analysis-agent, 8× repo-audit-* specialists
- **install.sh** (6 steps): skills → runtime sync → agents → codex scripts → evals workspace → CLAUDE.md injection (marker pattern `# >>> skill-builder >>>` / `# <<< skill-builder <<<`)
- **uninstall.sh** mirrors install.sh dynamically
- **scripts/codex/** (6 scripts) + **schemas/codex/** (4 schemas)
- **evals/project-context.json** (9 required fields + 5 security fields)
- **logs/** created by project-setup (decisions.md, agent-handoffs.md, skill-improvement-backlog.md)
- **11 hooks** (SessionStart ×3, PreToolUse ×3, PostToolUse ×4) — all GSD/context-mode managed

### Gaps (nothing brain-related exists)
- No `.project-brain/` template or bootstrap logic
- No brain-kernel skills (20 defined in ref doc §6.3)
- No `scripts/brain/` scripts (14 defined in §6.4)
- No brain hooks (§6.5)
- No `reference-repositories/` structure
- No GStack pattern files
- No SecondBrainBench harness
- No `--with-second-brain` flag in install.sh
- project-setup does not ask about brain mode
- No docs/SECOND_BRAIN*.md
- `brain_mode` field missing from project-context.json

---

## Target Architecture

```
brain-kernel (required)
  - local Markdown search           brain-search.js
  - context packing                 brain-context-pack.js
  - session capture                 brain-capture.js + hooks
  - session compile                 brain-compile.js
  - linting                         brain-lint.js
  - canon promotion (approval gate) brain-promote.js
  - verification                    brain-verify.js
  - reference repo management       brain-reference-repo-*.js

GBrain + gbrain-evals (optional, off by default)
  - controlled via brain-profile.json: gbrain_enabled: false
  - SecondBrainBench: evals/brain/secondbrainbench/

Reference Repository Library (required)
  - reference-repositories/registry.json + sources/
  - GStack as first entry (source-only, do-not-install-directly)

Claude Code pipeline integration
  - install.sh --with-second-brain flag (opt-in, not default)
  - project-setup brain mode question
  - Second Brain Protocol injected into CLAUDE.md via new marker
```

**Source of truth: Markdown + Git. brain-kernel writes and governs. GBrain retrieves only. Canon requires explicit human approval.**

---

## Required Folders and Files

### New in repo root

```
reference-repositories/
  README.md
  registry.json                   # machine-readable, §9.5 schema
  registry.md                     # human-readable index table
  sources/
    gstack/
      source-card.md              # §9.4 template filled for GStack
      methodology-map.md          # Think→Plan→Build→Review→Test→Ship→Reflect
      skill-candidate-map.md
      agent-role-map.md
      install-risk-analysis.md
      adaptation-plan.md
      eval-scenarios.md
      extracted-patterns/         # subdirs with .gitkeep

scripts/brain/
  brain-search.js                 # scan .project-brain/ Markdown, rank by authority
  brain-index.js                  # build local FTS index
  brain-context-pack.js           # output context JSON (§7.3 schema)
  brain-capture.js                # append to sessions/daily/YYYY-MM-DD.md
  brain-compile.js                # extract decisions/lessons/patterns from logs
  brain-lint.js                   # quality check: frontmatter, stale dates, orphans
  brain-promote.js                # ONLY writer to canon; requires --approve flag
  brain-verify.js                 # structural integrity check, exit 1 on failure
  brain-reference-repo-add.js     # add entry to registry.json
  brain-reference-repo-map.js     # produce map of patterns from source-card
  brain-reference-repo-audit.js   # security check on a reference repo entry
  brain-reference-repo-refresh.js # refresh last_reviewed date

schemas/brain/
  brain-profile.schema.json       # validates §17 brain-profile.json
  reference-repo.schema.json      # validates §9.4 source-card frontmatter

templates/second-brain/
  BRAIN.md                        # project brain status page template
  MEMORY.md                       # memory routing rules template
  README.md                       # .project-brain README
  brain-profile.json              # defaults from §17 (gbrain_enabled: false)
  project-brain/                  # installs as .project-brain/ in target
    index.md
    log.md
    context/
      stack.md, commands.md, conventions.md
      installed-skills.md, installed-agents.md, reference-repositories.md
    sessions/daily/.gitkeep + closed/.gitkeep
    decisions/active/.gitkeep + superseded/.gitkeep + candidates/.gitkeep
    lessons/memories/.gitkeep + anti-patterns/.gitkeep + skill-stubs/.gitkeep
    synthesis/               # 7 subdirs, all .gitkeep
    support/sources/.gitkeep + extracted/.gitkeep
    reference-repositories/registry.md + selected-sources.md + 3× .gitkeep dirs
    reports/                 # 6 subdirs, all .gitkeep

hooks/brain/
  brain-load.sh             # SessionStart: load BRAIN.md, brain-profile.json
  brain-pre-compact.sh      # PreCompact: capture context before compaction
  brain-session-end.sh      # PostToolUse Stop: extract decisions, suggest canon candidates
  brain-security-guard.sh   # PreToolUse: block sensitive paths + direct canon writes
  brain-post-lint.sh        # PostToolUse Write|Edit on .project-brain/: run brain-lint
  brain-stop-suggest.sh     # Stop event: suggest capture-learning if lessons detected
```

### New skills (20 total, built in two phases)

**Phase 2 — Core 9 (brain-kernel runtime):**
```
skills/brain-kernel/           # orchestrator; routes to other brain skills
skills/project-brain-bootstrap/ # creates .project-brain/ from template
skills/brain-search/           # local Markdown + JSON search with authority ranking
skills/brain-context-pack/     # builds context object for current task
skills/brain-capture/          # writes session log entry
skills/brain-compile/          # extracts structured items from session logs
skills/brain-lint/             # quality gate on brain content
skills/brain-promote/          # guided canon promotion with approval gate
skills/second-brain-setup/     # sets up brain-profile.json + project brain
```

**Phase 6 — Reference repo + utility skills (11):**
```
skills/reference-repo-add/
skills/reference-repo-audit/
skills/reference-repo-map/
skills/reference-repo-pattern-extract/
skills/reference-repo-skill-scout/
skills/reference-repo-agent-scout/
skills/reference-repo-to-eval-scenarios/
skills/gstack-pattern-audit/
skills/graphify-project/
skills/gbrain-adapter-eval/
skills/capture-learning/
```

Each SKILL.md must include: frontmatter, description, when-to-use, inputs, outputs, files-may-edit, files-must-not-edit, safety rules, success criteria, failure modes, eval scenarios.

### Modified files

| File | Change |
|------|--------|
| `install.sh` | Add step 7: `--with-second-brain` flag handling (new marker `# >>> second-brain >>>`) |
| `uninstall.sh` | Mirror step 7 |
| `skills/project-setup/SKILL.md` | Add brain mode question + reference repos question to interview |
| `scripts/skill-eval/extract-project-context.js` | Read brain-profile.json → populate `brain_mode` field |
| `.claude/settings.local.json` | Add brain hooks after `./install.sh . --with-second-brain` in Phase 8 |
| `.gitignore` | Add `.project-brain/sessions/` and `evals/brain/` |
| `CLAUDE.md` | Append Second Brain Protocol section via install.sh |

### New docs

```
docs/SECOND_BRAIN.md
docs/BRAIN_KERNEL.md
docs/SECOND_BRAIN_SECURITY.md
docs/REFERENCE_REPOSITORY_LIBRARY.md
docs/SECOND_BRAIN_PIPELINE.md
docs/GSTACK_INTEGRATION.md
```

---

## Integration with Existing Pipeline

### CLAUDE.md injection
Existing marker: `# >>> skill-builder >>>` / `# <<< skill-builder <<<`
New marker: `# >>> second-brain >>>` / `# <<< second-brain <<<`
Same idempotency: `grep -qF` check before append. Content = Second Brain Protocol section from ref doc §16.

### Hook merge
Brain hooks are **additive** — they do not replace GSD hooks. SessionStart currently has 3 hooks; brain-load.sh becomes hook 4. All use distinct script names. PostToolUse brain hooks are non-blocking (exit 0 on soft failures).

### skill-eval pipeline for brain skills
Brain skills are built from scratch (no external source). Per CLAUDE.md global rules, run a quick `skill-scout` before writing each — these skills are specialized enough that no existing candidates will match, but the step is required. After building: write SKILL.md → `generate-seed-evals.js --context evals/project-context.json` → `skill-eval` → `skill-refine` if any metric below threshold.

### project-context.json
Add `brain_mode` field. extract-project-context.js reads brain-profile.json if present and writes `brain_mode` into the JSON. Default: `"standard"`.

---

## brain-kernel Runtime Rules

- `brain-verify.js` runs at install time; fails loudly (exit 1) if .project-brain/ structure is invalid
- All brain scripts: no external network by default; refuse to overwrite user content without `--force`; write reports to `.project-brain/reports/`; exit nonzero on security failures; fail open for non-security optional tasks
- `brain-promote.js` is the **only** script that writes to any canon location; requires `--approve` flag
- Sensitive paths never entered into brain: `.env`, `.env.*`, `secrets/`, `credentials/`, `private/`, `*.key`, `*.pem`, `*token*`, `*api-key*`
- Authority ranking: `canon > active decision > validated lesson > synthesis > session note > raw source`
- Knowledge lifecycle: `scratch → candidate → validated → canon_candidate → canon → retired/superseded`

---

## GBrain + gbrain-evals (Optional Layer)

- Controlled by `brain-profile.json`: `gbrain_enabled: false` (default, never auto-enabled)
- When enabled: brain-search falls back to GBrain adapter after local search exhausted
- GBrain is never source of truth; brain-kernel writes/governs; GBrain retrieves only
- SecondBrainBench: `evals/brain/secondbrainbench/adapters/brain-kernel-adapter.js` (Phase 7)
- Pass gates (ref doc §8.4): Recall@5 ≥ 90%, Precision@5 ≥ 45%, citation accuracy ≥ 90%, sensitive data leakage = 0, canon precedence failures = 0
- `gbrain-adapter.js` and `hybrid-adapter.js` are stubs until GBrain is installed

---

## Reference Repository Library

### Structure
```
reference-repositories/
  registry.json     # machine-readable, §9.5 schema
  registry.md       # human table: name | status | types | install_policy | last_reviewed
  sources/gstack/   # first and only entry in Phase 1
```

### GStack source card (sources/gstack/source-card.md)
Key fields from §9.4 + §10.3:
- `status: reference` / `install_policy: do-not-install-directly`
- `allowed_uses`: extract methodology, analyze skill design, analyze agent roles, generate eval scenarios, source candidate skills for audit
- `prohibited_uses`: direct install, global install without approval, bypass skill-audit, bypass agent-audit
- Methodology map: Think→Plan→Build→Review→Test→Ship→Reflect mapped to brain loop phases

### Future entries (Phase 6+)
infinite-brain-os, claude-memory-compiler, aprende-skill, gbrain, gbrain-evals, graphify, karpathy-llm-wiki, lightrag, rag-anything, second-brain-starter

---

## Security & Governance

### brain-security-guard.sh (PreToolUse) blocks
- Reading any sensitive path (`.env`, `secrets/`, `*.key`, etc.)
- Writing to `.project-brain/canon/` without `--approve` present in command
- Installing from `reference-repositories/sources/` without an audit completion flag
- Destructive shell commands targeting `.project-brain/`
- Posting/sending content externally without approval

### Canon protection
Only `brain-promote.js --approve` can write to canon. No autonomous promotion. No AI process promotes without explicit human confirmation.

### .gitignore additions
```
.project-brain/sessions/      # session logs are local-only by default
evals/brain/                  # brain eval artifacts generated, not versioned
```

---

## Phased Roadmap

### Phase 1 — Foundation: Templates, Scripts, Schemas, Reference Repos
**Scope:** `templates/second-brain/`, `scripts/brain/` (12 scripts), `schemas/brain/` (2), `reference-repositories/` (GStack entry)
**Files:** ~50 new files
**Acceptance criteria:**
- `node scripts/brain/brain-verify.js` exits 0 on a skeleton `.project-brain/`
- `registry.json` validates against `schemas/brain/reference-repo.schema.json`
- `brain-profile.json` defaults validate against `schemas/brain/brain-profile.schema.json`

### Phase 2 — Core Brain Skills (9 skills)
**Scope:** skills/brain-kernel/ through skills/second-brain-setup/
**Build order:** brain-kernel → project-brain-bootstrap → brain-search → brain-context-pack → brain-capture → brain-compile → brain-lint → brain-promote → second-brain-setup
**Acceptance criteria:** Each skill passes skill-eval (pass rate ≥ 80%, trigger accuracy ≥ 85%, resilience ≥ 8/10, project fit ≥ 7/10); skill-refine run if below threshold

### Phase 3 — Brain Hooks (6 scripts)
**Scope:** `hooks/brain/` (6 shell scripts) + settings.json merge logic
**Acceptance criteria:**
- `brain-load.sh` successfully loads BRAIN.md and brain-profile.json on SessionStart
- `brain-security-guard.sh` blocks a test `.env` read attempt with exit 1
- Brain hooks are additive (existing GSD hooks still fire)

### Phase 4 — install.sh Extension
**Scope:** `--with-second-brain` flag (new step 7), `--brain-mode` flag, uninstall.sh mirror, Second Brain Protocol CLAUDE.md injection
**Acceptance criteria:**
- `./install.sh --dry-run /tmp/test-project --with-second-brain` prints 7-step preview
- `./install.sh /tmp/test-project --with-second-brain` creates `.project-brain/`, merges hooks, injects CLAUDE.md section with correct markers
- Re-running install is idempotent (markers already present → skip)
- uninstall.sh removes all second-brain artifacts cleanly

### Phase 5 — project-setup Extension
**Scope:** Brain mode question (none/lightweight/standard/enhanced-with-gbrain/enhanced-with-graphify/lab-multimodal), reference repos question; brain-profile.json written; extract-project-context.js gains `brain_mode` field
**Acceptance criteria:** Running project-setup on a fresh project creates `brain-profile.json` with `brain_mode: "standard"` default; field appears in generated `project-context.json`

### Phase 6 — Reference Repo Skills (11 skills)
**Scope:** skills/reference-repo-add/ through skills/capture-learning/
**Acceptance criteria:** Each skill passes skill-eval; `reference-repo-add` creates a valid registry entry; `gstack-pattern-audit` reads `sources/gstack/` and produces synthesis output in `.project-brain/synthesis/gstack-patterns/`

### Phase 7 — SecondBrainBench Harness (Optional Layer)
**Scope:** `evals/brain/secondbrainbench/` with `brain-kernel-adapter.js`; 10 scenario types from §8.1; `secondbrainbench-run.js` and `secondbrainbench-report.js`
**Acceptance criteria:** `node scripts/brain/secondbrainbench-run.js --adapter brain-kernel --mode smoke` exits 0 and writes report to `.project-brain/reports/brain-evals/`

### Phase 8 — Docs + Self-Install
**Scope:** 6 docs/SECOND_BRAIN*.md + README.md update; `./install.sh . --with-second-brain` on claude_code itself
**Acceptance criteria:** All docs exist; self-install creates `.project-brain/` in claude_code; `brain-verify.js` passes; no sensitive data in `.project-brain/`; brain hooks registered in `.claude/settings.local.json`

---

## Risks, Open Questions & Decisions Requiring Approval

| # | Item | Type | Default assumption |
|---|------|------|-------------------|
| 1 | **Central Operator Brain** (`~/DES/second-brain/`) — scaffold as part of this plan or defer to a separate session after Phase 8? | Decision | Deferred. `second-brain-setup` skill is built here but targets `.project-brain/` by default. Central brain is a follow-up. |
| 2 | **20 skills × skill-eval** is significant time. Phase 2 does 9 core, Phase 6 does 11. Accept this split? | Decision | Yes — split accepted. |
| 3 | **Eval work conflict**: team member may modify install.sh or CLAUDE.md. Phase 4 (install.sh extension) should be done only after their work merges. | Risk | Phase 4 is last before docs/self-install. |
| 4 | **Brain hook + GSD hook conflicts** on same events (SessionStart, PreToolUse, PostToolUse). Brain hooks are additive and non-blocking, but order matters. | Risk | Brain hooks append last; brain-post-lint.sh exits 0 on soft failures. |
| 5 | **skill-scout for brain skills** — CLAUDE.md global rule says to run skill-scout before writing any skill from scratch. These are highly specialized; no candidates expected. Run a lightweight search per skill? | Decision | Yes. Lightweight skill-scout run for each skill group before building; results documented in Phase 2 session. |
| 6 | **GStack source card accuracy** — full GStack repo analysis requires reading github.com/garrytan/gstack. Do this live during Phase 1 (requires WebFetch) or stub with ref doc §10.3 content? | Decision | Use ref doc §10.3 content for Phase 1 stub; full analysis via `gstack-pattern-audit` skill in Phase 6. |

---

## Next Prompt (paste after approval)

```
Implement Second Brain Phase 1 — Foundation.

Working in /Users/erick/projects/claude_code.

Create (do not touch existing skills/, agents/, install.sh, uninstall.sh, scripts/codex/, schemas/codex/, or evals/):

1. templates/second-brain/ — full directory tree from §15 of the reference doc.
   - All subdirectory placeholders use .gitkeep.
   - BRAIN.md, MEMORY.md, README.md: use the templates from §16 and the project brain capsule pattern (§5.2).
   - brain-profile.json: use exact §17 defaults (gbrain_enabled: false, brain_mode: "standard").

2. scripts/brain/ — 12 core scripts: brain-search.js, brain-index.js, brain-context-pack.js, brain-capture.js, brain-compile.js, brain-lint.js, brain-promote.js, brain-verify.js, brain-reference-repo-add.js, brain-reference-repo-map.js, brain-reference-repo-audit.js, brain-reference-repo-refresh.js.
   Requirements for ALL scripts: no external network calls, refuse overwrite without --force, write reports to .project-brain/reports/, exit nonzero on security failures, fail open for non-security optional tasks.

3. schemas/brain/ — brain-profile.schema.json (validates §17 structure) and reference-repo.schema.json (validates §9.4 frontmatter fields).

4. reference-repositories/ — README.md, registry.json (empty repositories array, matching schema), registry.md (human table), sources/gstack/ with source-card.md filled from §9.4 template + §10.3 GStack data, methodology-map.md stub, and remaining files from §10.3 as stubs.

Acceptance test:
- node scripts/brain/brain-verify.js --target /tmp/test-second-brain exits 0
- registry.json validates against schemas/brain/reference-repo.schema.json

After creating all files, run brain-verify.js as the acceptance test and report the result.
```
