# Second Brain — Capture-First Design

**Repo:** dentaledgesolutions/claude_code | **Date:** 2026-07-08
**Supersedes the sequencing of:** `docs/superpowers/plans/2026-07-02-second-brain-implementation.md`
**Architecture reference (unchanged):** `docs/claude_code_second_brain_build_reference_v3.md`

---

## 1. Summary

Build the Second Brain for the claude_code toolkit as a **governed, Git-backed, Markdown-native operating memory system**, resequenced so that session-knowledge capture — the user's stated first win — lands in the first two phases instead of Phase 4+.

The v3 architecture stands: brain-kernel is required and internal; GBrain is optional and off by default; the Reference Repository Library governs external source material; Markdown + Git is the sole source of truth; canon promotion requires explicit human approval. What changes is the build order (capture → hooks → skills → retrieval → install → reference repos → bench) and eleven design deltas from a fresh review of all twenty sources (§3).

## 2. Decisions Locked In

| Decision | Choice |
|---|---|
| Session goal | Refresh plan against current repo state; produce a build-ready Phase 1 plan; no implementation yet |
| Eval-team files | **Avoid**: `skills/skill-eval/`, `skills/agent-eval/`, `scripts/codex/`, `schemas/codex/`, calibration + telemetry scripts. Brain work adds new files plus append-only changes to shared files, deferred to Phase 5 |
| Central Operator Brain (`~/DES/second-brain/`) | **Deferred** — own follow-up project after the capsule pattern is proven |
| First win | **Stop losing session knowledge** → capture → compile → promote prioritized |
| Approach | **A — capture-first vertical slice** (over the Jul 2 balanced foundation and a script-less minimal variant) |

Repo baseline at design time: 16 skills, 17 agents, install.sh has 7 steps (telemetry merged 2026-07-08), no brain artifacts exist.

## 3. Source Review (2026-07-08)

All twenty sources from the v3 registry plus five new ones were fetched and evaluated. Full findings live in the conversation record; the table records verdicts and what each source contributes.

### 3.1 Official Claude Code docs — platform facts the design must use

| Finding | Design consequence |
|---|---|
| Hook events confirmed: `SessionStart`/`SessionEnd` (per session), `Stop` (per turn), `PreCompact` (manual/auto matchers), `PreToolUse`/`PostToolUse` (per tool call) | Hook design valid as specified |
| **Native auto-memory** exists: `~/.claude/projects/<project>/memory/` with `MEMORY.md` index, first 200 lines/25KB auto-loaded, machine-local | New memory-routing section (§5) defining the boundary between auto-memory and `.project-brain/` |
| **CLAUDE.md `@import` syntax** loads referenced files at launch | install.sh injects a 3-line marker containing `@.project-brain/BRAIN.md` instead of inlining the protocol |
| **`additionalContext`** hook output (`hookSpecificOutput`) injects clean system-reminder context | `brain-load.sh` (Phase 4) and stop-suggestions use JSON output, not raw stdout |
| **`disable-model-invocation: true`** skill frontmatter blocks model-initiated triggering | Applied to the `brain-promote` skill — canon promotion becomes humanly-invoked only, enforced by the platform |

### 3.2 Architecture sources — v3 interpretation holds

| Source | Verdict | Contribution |
|---|---|---|
| Karpathy LLM Wiki | Confirmed | Required frontmatter set (`type, title, description, tags, timestamp, sources`) adopted as brain-lint's schema check; linter-agent pattern validates brain-lint |
| Infinite Brain OS | Confirmed | Namespaces + operator-approved canon + `_system/` contract/validator — matches brain-verify + promote gate |
| Claude Memory Compiler | Confirmed | Hooks→capture→compile pipeline is the Phase 1–2 shape; its LLM compiler maps to our deterministic-script + intelligent-skill split |
| Second Brain Starter | **Independent validation** | Its recommended build order (memory layer → hooks → search → rest) matches this design's resequencing. Later: CLI-wrapper pattern ("LLM never sees API keys") |
| KJ OS Template (local copy) | Evaluated 2026-07-08 | (a) 5-round brain-setup interview adopted into `second-brain-setup` (Phase 5): scan before asking, write in the user's voice, never fabricate; (b) **`brain-weekly-review` added to Phase 3** — delta-only status refresh ritual ("say 'same' to keep"), updates status sections only, never restructures; (c) parent-index sync after child scaffold adopted by `project-brain-bootstrap`. Security note: template bundles a vendored `.env.local` — real-world case for the sensitive-path guard |

### 3.3 Retrieval and evaluation sources

| Source | Verdict | Contribution |
|---|---|---|
| GBrain | Confirmed optional/off | Its own architecture ("brain repo is the system of record; GBrain syncs into Postgres for retrieval") is the adapter rule |
| gbrain-evals | Adopted | **Sealed-answer methodology** (corpus + questions + answer keys the system under test never sees) becomes SecondBrainBench's structure |
| LightRAG + RAG-Anything | **Merged upstream (2026-05)** | Collapse to one lab-layer registry entry |
| Graphify | Confirmed optional | Polished `/graphify` skill with incremental update + agent-navigable wiki output; stays the named graph layer |
| Understand-Anything (new) | Registry entry | Credible Graphify alternative; decided by audit when the graph phase arrives |

### 3.4 Methodology and research sources

| Source | Verdict | Contribution |
|---|---|---|
| Letta Code (new) | Registry entry | MemFS (git-tracked agent memory) validates Markdown+Git doctrine; sleeptime "dreaming" and `/doctor` noted as backlog extensions for brain-compile scheduling and brain-lint; self-editing memory blocks **rejected** for canon paths (bypass the approval gate) |
| aprende-skill | Confirmed | Confirm-before-write learnings model for `capture-learning` |
| GStack | Confirmed | Methodology reference (Think→Plan→Build→Review→Test→Ship→Reflect); reference-repo entry, never direct-installed |
| notebooklm-py, PleasePrompto notebooklm-skill, deep-research-notebooklm (new) | Registry entries | **NotebookLM research lane** (§7): grounded research output lands in `.project-brain/support/sources/` at raw-source authority, then flows through the normal compile→promote lifecycle. Any skill adoption goes through scout→audit→adapt→eval. Synergistic with the existing `notebooklm-research-os` skill |

### 3.5 The eleven design deltas

1. Memory-routing section defining native auto-memory vs `.project-brain/` (§5)
2. CLAUDE.md injection via `@import` marker instead of inlined protocol
3. Hook context injection via `additionalContext` JSON
4. `disable-model-invocation: true` on the `brain-promote` skill
5. Karpathy frontmatter set as brain-lint's required schema
6. Sealed-answer methodology for SecondBrainBench
7. Five new reference-registry entries (letta-code, understand-anything, notebooklm-py, pleaseprompto-notebooklm-skill, deep-research-notebooklm) plus KJ OS Template as human-workflow-source
8. LightRAG/RAG-Anything collapsed to one lab entry
9. Documented NotebookLM research-ingestion lane
10. `brain-weekly-review` skill added to Phase 3 (KJ OS weekly-update pattern)
11. `second-brain-setup` adopts the KJ OS 5-round interview for BRAIN.md's human sections

## 4. Architecture (unchanged from v3)

```text
brain-kernel (required)     — capture, compile, lint, promote, verify, search, context-pack
GBrain + gbrain-evals       — optional retrieval layer, gbrain_enabled: false, never source of truth
Reference Repository Library — governed external source material; GStack first entry
claude_code pipeline        — installer, auditor, evaluator, lifecycle manager for all of it
```

Invariants: Markdown + Git canonical; `brain-promote.js --approve` is the only writer to canon; authority ranking `canon > active decision > validated lesson > synthesis > session note > raw source`; lifecycle `scratch → candidate → validated → canon_candidate → canon → retired/superseded`; sensitive paths (`.env*`, `secrets/`, `credentials/`, `private/`, `*.key`, `*.pem`, `*token*`, `*api-key*`, patient/client/financial/legal data) never enter the brain.

## 5. Memory Routing (new)

Four tiers, from most ephemeral to most durable:

| Tier | Store | Scope | Governance |
|---|---|---|---|
| Session context | conversation | current task | none — stays in session |
| Native auto-memory | `~/.claude/projects/<project>/memory/` | machine-local, personal | Claude-managed; personal working notes, not project truth |
| **Project Brain Capsule** | `.project-brain/` (git) | travels with the repo, shared | brain-kernel scripts + hooks + approval gates |
| Central Operator Brain | `~/DES/second-brain/` | cross-project | deferred |

Routing rules (enter BRAIN.md and the Second Brain Protocol): durable project knowledge → `.project-brain/`; personal machine-local observations → native auto-memory; repeated corrections → `capture-learning` → lesson candidates; canon → only through `brain-promote --approve`. The two systems do not overlap: auto-memory is Claude's private scratchpad; the capsule is the governed, versioned record the team and future sessions rely on.

## 6. Roadmap — Seven Phases

### Phase 1 — Capture Core

**Scope (~35 files, all new):**

```
templates/second-brain/
  BRAIN.md, MEMORY.md, README.md, brain-profile.json   # §17 defaults, gbrain_enabled: false
  project-brain/          # full §5.2 skeleton — all subdirs as .gitkeep
    index.md, log.md
    context/ (stack.md, commands.md, conventions.md, installed-skills.md, installed-agents.md)
    sessions/daily|closed/   decisions/active|superseded|candidates/
    lessons/memories|anti-patterns|skill-stubs/   canon/
    synthesis/  support/  reference-repositories/  reports/
scripts/brain/
  brain-capture.js   # append to sessions/daily/YYYY-MM-DD.md; never overwrites
  brain-compile.js   # session logs → decision/lesson candidates
  brain-lint.js      # frontmatter schema (delta 5), stale dates, orphan links, sensitive strings
  brain-promote.js   # ONLY writer to canon/ + decisions/active/; hard-fails without --approve
  brain-verify.js    # structure check; exit 1 on violation
schemas/brain/brain-profile.schema.json
```

Design note: the template ships the **full** directory skeleton even though Phase 1 scripts only use the capture paths — empty dirs cost nothing and brain-verify checks one stable structure forever.

**Script contract (all five):** deterministic; no network; never read sensitive paths; refuse overwrite without `--force`; reports to `.project-brain/reports/`; exit nonzero on security failures; fail open on optional non-security tasks. Tests as sibling `*.test.js`, self-contained and runnable standalone (wiring into `scripts/run-all-tests.js` deferred — eval-team file).

**Acceptance:**
1. `brain-verify.js --target /tmp/test-brain` exits 0 on a fresh template copy
2. `brain-capture.js` twice on one day appends, never overwrites
3. `brain-promote.js` without `--approve` exits nonzero and writes nothing
4. `brain-profile.json` validates against its schema
5. `brain-lint.js` flags a planted fake token in a session log

### Phase 2 — Capture Hooks + Self-install

**Hooks (4 scripts in `hooks/brain/`):**

| Hook | Event | Behavior |
|---|---|---|
| `brain-pre-compact.sh` | PreCompact | Session snapshot → daily log before compaction |
| `brain-session-end.sh` | SessionEnd + Stop (one script, two registrations) | On `SessionEnd`: run brain-compile, write candidates, never promotes. On `Stop` (per turn): if learning signals detected in the turn, suggest `capture-learning` via `additionalContext` — suggestions only work on Stop, since SessionEnd has no next turn to inject into |
| `brain-security-guard.sh` | PreToolUse | Block non-promote writes to `canon/`, sensitive-path reads into the brain, destructive commands on `.project-brain/`. **Only hook allowed to block** |
| `brain-post-lint.sh` | PostToolUse (Write/Edit on `.project-brain/**`) | Run brain-lint; always exit 0 |

Deferred: `brain-load.sh` → Phase 4 (nothing to load yet); stop-suggest folded into `brain-session-end.sh`. Hooks are additive to existing GSD/context-mode/telemetry hooks — distinct names, appended last.

**Self-install:** `scripts/brain/brain-self-install.sh` — template copy → `.project-brain/`, fill BRAIN.md/profile from repo facts, merge 4 hook entries into `.claude/settings.local.json` (telemetry-installer pattern), add `.project-brain/sessions/` to `.gitignore`, finish with brain-verify. Deliberately not touching install.sh (Phase 5); this script is the dry run for install step 8.

**Acceptance:** self-install clean + verify passes; a real session produces a dated `sessions/daily/` entry; security guard blocks a test canon write while normal edits pass; pre-existing hooks still fire.

**End state: the repo is remembering things.**

### Phase 3 — Capture Skills (6)

`brain-capture`, `brain-compile`, `brain-promote` (frontmatter `disable-model-invocation: true`, `risk_tier: critical`), `project-brain-bootstrap` (syncs parent index after scaffold), `capture-learning` (aprende pattern: confirm before write), `brain-weekly-review` (KJ OS pattern: delta-only interview, status sections only, `Last updated` stamp).

Pipeline per repo rules: lightweight skill-scout (documented) → SKILL.md with v3-required sections → `generate-seed-evals.js --context` → skill-eval → skill-refine if below threshold.

**Acceptance:** all six pass thresholds (pass ≥ 80%, trigger ≥ 85%, resilience ≥ 8/10, fit ≥ 7/10; critical tier for brain-promote: 95%/9/8).

### Phase 4 — Retrieval

`brain-search.js` (lexical scan + frontmatter parse, authority × recency × keyword ranking — no FTS index until measurably slow; `brain-index.js` deferred), `brain-context-pack.js` (§7.3 JSON), skills `brain-search` + `brain-context-pack`, `brain-load.sh` SessionStart hook (BRAIN.md + profile + top-authority items via `additionalContext`).

**Acceptance:** planted canon decision outranks a session note on the same keyword; context pack validates against schema; SessionStart adds < 2k tokens.

### Phase 5 — install.sh Integration (shared-files phase, done in one sitting)

install.sh step 8 `--with-second-brain` (+ `--brain-mode`): template copy, hook merge, `.gitignore`, CLAUDE.md `# >>> second-brain >>>` marker containing `@.project-brain/BRAIN.md` (idempotent `grep -qF`), ends with brain-verify. Phase 2's self-install becomes the reference implementation and is retired into this step. uninstall.sh mirror removes tooling but **preserves `.project-brain/` content** (uninstalling tooling must not delete memory). `skills/project-setup/SKILL.md` gains the brain-mode question (default `standard`) and the KJ OS-derived BRAIN.md interview via new skill `second-brain-setup`; `brain-kernel` orchestrator skill routes brain requests. `extract-project-context.js` remains untouched — `brain-profile.json` is authoritative for `brain_mode`; mirroring into project-context.json is a follow-up coordination task with the eval work.

**Acceptance:** dry-run previews 8 steps; fresh install passes verify; re-run idempotent; uninstall preserves capsule.

### Phase 6 — Reference Repository Library

`reference-repositories/` root (README, registry.json/md), `schemas/brain/reference-repo.schema.json`, GStack first entry (source card stubbed from v3 §10.3; live analysis via `gstack-pattern-audit`), scripts `brain-reference-repo-{add,audit,map,refresh}.js`, skills trimmed 11 → 4: `reference-repo-add`, `reference-repo-audit`, `gstack-pattern-audit`, `reference-repo-pattern-extract`. Registry seeded with the §3 entries (GStack, Infinite Brain OS, Claude Memory Compiler, Second Brain Starter, aprende-skill, Karpathy wiki, GBrain, gbrain-evals, LightRAG(+RAG-Anything), Graphify, Understand-Anything, Letta Code, notebooklm-py, PleasePrompto notebooklm-skill, deep-research-notebooklm, KJ OS Template) — all `do-not-install-directly`.

**NotebookLM research lane:** NotebookLM-grounded research output enters `.project-brain/support/sources/` at raw-source authority and flows through compile → promote like any other content. Skill adoption from these repos goes through scout → audit → adapt → eval.

**Acceptance:** registry validates; gstack-pattern-audit writes synthesis to `.project-brain/synthesis/gstack-patterns/`; direct-install attempt from `sources/` blocked by security guard.

### Phase 7 — SecondBrainBench + Docs

`evals/brain/secondbrainbench/` with `brain-kernel-adapter.js` only (no gbrain/hybrid stubs until GBrain is real); **sealed-answer structure** (corpus / questions / answer keys the adapter never sees); §8.1 scenario set, smoke mode first; gates: Recall@5 ≥ 90% (core decisions), Precision@5 ≥ 45%, citation ≥ 90%, sensitive leakage = 0, canon-precedence failures = 0. Docs consolidated 9 → 4: `SECOND_BRAIN.md`, `BRAIN_KERNEL.md`, `SECOND_BRAIN_SECURITY.md`, `REFERENCE_REPOSITORY_LIBRARY.md`; README section. `evals/brain/` gitignored.

**Acceptance:** smoke bench exits 0, report to `.project-brain/reports/brain-evals/`; docs exist; CLAUDE.md documents brain commands.

## 7. Security & Governance

- `brain-promote.js --approve` is the only canon writer; the `brain-promote` skill additionally carries `disable-model-invocation: true` so the platform itself prevents model-initiated promotion
- `brain-security-guard.sh` blocks: sensitive-path reads into the brain, non-promote canon writes, destructive commands on `.project-brain/`, direct installs from `reference-repositories/sources/`
- Sensitive-path list as v3 §12.2; brain-lint scans content for leaked secrets as a second net
- `.gitignore`: `.project-brain/sessions/` (local-only by default), `evals/brain/`
- Uninstall never deletes `.project-brain/` content

## 8. Deferred / Backlog

Central Operator Brain; `brain-index.js` (FTS) until search is measurably slow; GBrain adapter + hybrid/gbrain bench adapters; Graphify-vs-Understand-Anything selection (by audit, when the graph phase arrives); RAG-Anything/LightRAG lab layer; seven trimmed reference-repo skills (`-skill-scout`, `-agent-scout`, `-to-eval-scenarios`, `graphify-project`, `gbrain-adapter-eval`, …); Letta-style scheduled compile ("dreaming") and `/doctor`-style brain health report; `extract-project-context.js` `brain_mode` mirroring (coordinate with eval work); CLI-wrapper integrations pattern from Second Brain Starter.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Parallel eval work touches shared files | All shared-file changes concentrated in Phase 5, done in one sitting; Phases 1–4 add only new files |
| Hook ordering/conflicts with GSD + telemetry hooks | Additive, distinct names, appended last; only security guard blocks; everything else exits 0 |
| 6 skills × skill-eval time in Phase 3 | Accepted; brain-promote is the only critical-tier eval |
| Capture hooks produce noisy logs | brain-lint quality gate + weekly-review ritual; compile extracts candidates rather than promoting |
| Self-install drifts from install.sh step 8 | Phase 5 explicitly retires self-install into the install step; single implementation from then on |
