# Second Brain Phase 7 — SecondBrainBench + Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove retrieval can be trusted (sealed-answer benchmark with hard gates) and document the whole system in four consolidated docs.

**Architecture:** Bench **code** is versioned in `scripts/brain/` (adapter, runner, reporter, dataset generator); bench **data** (datasets, questions, sealed answers, run reports) is generated into `evals/brain/` and gitignored — mirroring the repo's "code versioned, eval artifacts generated" rule. The sealed-answer methodology (gbrain-evals): the adapter under test never sees the answer key. One adapter only (`brain-kernel`); gbrain/hybrid adapters are not even stubbed until GBrain is real.

**Tech Stack:** Node ≥ 18 CommonJS, zero dependencies; Markdown docs.

## Global Constraints

- Phases 1–6 complete
- Pass gates (spec §6 Phase 7): Recall@5 ≥ 90% (core decisions) · Precision@5 ≥ 45% · citation accuracy ≥ 90% · sensitive leakage = 0 · canon-precedence failures = 0
- Sealed answers live in `answers/` files the adapter code path never reads — the runner compares after retrieval completes
- Reports → `.project-brain/reports/brain-evals/` AND `evals/brain/secondbrainbench/reports/`
- CLAUDE.md gains nothing new — brain commands are documented in BRAIN.md (already `@import`ed via the Phase 5 marker)
- Do NOT touch eval-team files; `evals/brain/` must be gitignored before the first run

## Preflight — re-verify before executing

- [ ] All `scripts/brain/*.test.js` green; live capsule verifies
- [ ] `evals/.gitignore` exists — check whether it already ignores everything or is enumerated; if enumerated, append `brain/`
- [ ] Live capsule has ≥ 5 promoted decisions/canon items (bench smoke uses a synthetic capsule, but the live-run step needs real content — promote pending candidates first via /brain-promote)

---

### Task 1: Dataset generator + brain-kernel adapter

**Files:**
- Create: `scripts/brain/secondbrainbench-generate.js`, `scripts/brain/bench-brain-kernel-adapter.js`
- Test: `scripts/brain/secondbrainbench.test.js` (started here, extended in Task 2)
- Modify: `evals/.gitignore` (add `brain/` if not covered)

**Interfaces:**
- `secondbrainbench-generate.js --out <dir> [--target <capsule>] [--synthetic]` — builds a bench workspace: `<out>/capsule/` (with `--synthetic`: a planted capsule with known content; without: a **copy** of the live capsule), `<out>/questions/questions.json`, `<out>/answers/answers.json` (sealed). Question types (10, from spec/v3 §8.1): `decision-retrieval`, `lesson-retrieval`, `canon-precedence`, `anti-pattern`, `security-rule`, `stale-detection`, `contradiction`, `citation`, `reference-pattern`, `time-aware`. Synthetic mode plants one known-answer doc per type plus distractors, e.g. canon-precedence: same topic in `canon/` and `sessions/`, answer = the canon path.
- `bench-brain-kernel-adapter.js` — exports `retrieve(capsuleDir, question) → { paths: string[], contents: string[] }` (top-5 via `brain-search`'s `search()`); **imports nothing from `answers/`** (the test greps the source to prove it).
- Question shape: `{ id, type, query, expects: "path" }`. Answer shape (sealed file): `{ id, correct_paths: string[], must_rank_first?: string }`.

- [ ] **Step 1: Failing test (generator + adapter half)** — assert: `--synthetic` writes capsule + 10 questions + 10 sealed answers; every `correct_paths` entry exists in the synthetic capsule; adapter returns ≤ 5 capsule-relative paths for a sample question; `grep -c "answers" scripts/brain/bench-brain-kernel-adapter.js` = 0 (adapter can't see the key).
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement both scripts.** Generator's synthetic capsule plants, per type, a target doc + 2 distractors with overlapping vocabulary; sealed answers written once, never re-read by anything except the Task 2 runner's compare step.
- [ ] **Step 4: Tests pass; commit** — `git commit -m "feat(bench): SecondBrainBench generator + brain-kernel adapter (sealed answers)"`

---

### Task 2: Runner + reporter with hard gates

**Files:**
- Create: `scripts/brain/secondbrainbench-run.js`, `scripts/brain/secondbrainbench-report.js`
- Test: extend `scripts/brain/secondbrainbench.test.js`

**Interfaces:**
- `secondbrainbench-run.js --adapter brain-kernel --mode smoke|standard [--workspace <dir>] [--target <capsule>]` — smoke: generates a synthetic workspace and runs all 10 questions once; standard: runs against a copy of the live capsule with generated questions. Per question: call adapter → compare to sealed answer → score. Writes `results.json`: per-question rows + aggregate `{ recall_at_5, precision_at_5, citation_accuracy, sensitive_leakage, canon_precedence_failures }`. **Exit 0 only if all five gates pass; exit 1 otherwise** (spec: this is a trust gate, fail loudly).
  - recall@5: correct path present in top-5 · precision@5: relevant/returned · citation accuracy: returned paths exist on disk · sensitive leakage: `scanSensitive` over returned contents = 0 · canon precedence: for `must_rank_first` questions, that path is rank 1
- `secondbrainbench-report.js --results <file>` — renders `SECONDBRAINBENCH-REPORT.md`: gate table (metric / value / gate / PASS-FAIL), per-type breakdown, failed-question detail. Written to both report destinations (capsule write fails open when no capsule).

- [ ] **Step 1: Extend the test:** smoke run on synthetic workspace exits 0 with all gates green (synthetic data is constructed to pass); sabotage run — regenerate, delete the canon target file so precedence fails — exits 1 and the report names the failed gate; report file exists in both locations; `results.json` has all five aggregate keys.
- [ ] **Step 2: Verify failure → implement → pass.**
- [ ] **Step 3: Wire `evals/.gitignore`** (`brain/` line), then live smoke:

```bash
node scripts/brain/secondbrainbench-run.js --adapter brain-kernel --mode smoke \
  --workspace evals/brain/secondbrainbench/smoke-$(date -u +%F)
cat .project-brain/reports/brain-evals/SECONDBRAINBENCH-REPORT.md
git status --porcelain evals/   # expect: empty (gitignored)
```

Expected: exit 0, gate table all PASS, nothing staged from evals/.

- [ ] **Step 4: Standard run against the live capsule.** Gates may legitimately fail on thin live content — a failed live gate at this stage is a **finding to capture** (`brain-capture --type lesson`), not a blocker; the smoke gate is the phase acceptance.
- [ ] **Step 5: Commit** — `git commit -m "feat(bench): SecondBrainBench runner + reporter — five hard gates, sealed-answer compare"`

---

### Task 3: Four consolidated docs

**Files:**
- Create: `docs/SECOND_BRAIN.md`, `docs/BRAIN_KERNEL.md`, `docs/SECOND_BRAIN_SECURITY.md`, `docs/REFERENCE_REPOSITORY_LIBRARY.md`
- Modify: `README.md` (one new section)

Each doc consolidates content that already exists in the design spec and SKILL.mds — write from those sources, verify every claim against the shipped code (correct script names, flags, exit codes, hook events), and keep each under ~150 lines.

- [ ] **`docs/SECOND_BRAIN.md`** — architecture + protocol: the four memory tiers table (session / native auto-memory / capsule / central-deferred); authority ranking; lifecycle states; the capture → compile → promote → retrieve loop diagram (text); phase history table with links to the seven plans; "what lives where" directory map.
- [ ] **`docs/BRAIN_KERNEL.md`** — operator reference: every `scripts/brain/*.js` with usage line, flags, exit codes (the 0/1/2/3 convention table); every hook with event + blocking behavior; every brain skill with trigger phrases; the install recipe; troubleshooting (verify failures, lint exit 3, guard denials).
- [ ] **`docs/SECOND_BRAIN_SECURITY.md`** — threat model + enforcement map: sensitive-path and content-pattern lists (from `brain-lib.js`, quoted exactly); the guard's four deny rules; canon protection chain (script `--approve` + skill `disable-model-invocation` + hook deny); what uninstall preserves; incident playbook (lint exit 3 → locate via report → redact → re-lint → check git history for the leak).
- [ ] **`docs/REFERENCE_REPOSITORY_LIBRARY.md`** — governance: the registry schema fields; the do-not-install-directly rule and its enforcement; add/audit/map/refresh script usage; pattern-extraction flow into synthesis; the 16 seeded entries table (generate from registry.md); NotebookLM research lane.
- [ ] **`README.md`** — add a "Second Brain" section after the existing pipeline overview: 5-line summary, install one-liner (`./install.sh <target> --with-second-brain`), link to the four docs. Follow the README's existing tone and heading style.
- [ ] **Verify claims:** for each doc, run every command it quotes (`--help`-style dry invocations) and confirm flags/exit codes match; fix doc or note code bug.
- [ ] **Commit** — `git commit -m "docs(brain): SECOND_BRAIN, BRAIN_KERNEL, SECURITY, REFERENCE_LIBRARY + README section"`

---

### Task 4: Phase and project acceptance

- [ ] **Spec criterion:** smoke bench exits 0 and writes report to `.project-brain/reports/brain-evals/` ✓ (Task 2 Step 3)
- [ ] **Spec criterion:** all four docs exist; README links them
- [ ] **Spec criterion:** brain commands documented and reachable from CLAUDE.md — confirm the Phase 5 marker `@import`s BRAIN.md and BRAIN.md references `docs/BRAIN_KERNEL.md`
- [ ] Full regression: `for t in scripts/brain/*.test.js; do node "$t" || exit 1; done` — every phase's tests still green
- [ ] End-to-end narrative check (the whole system, one sitting): fresh temp project → `install.sh --with-second-brain` → capture 3 entries (1 decision, 1 lesson, 1 note) → compile → promote the decision with approval → search finds it ranked above the note → context-pack lists it under relevant_decisions → smoke bench passes → uninstall preserves the capsule
- [ ] Capture the finale: `node scripts/brain/brain-capture.js --type decision --title "Second Brain v1 complete" --message "All 7 phases shipped: capture core, hooks, skills, retrieval, installer, reference library, bench + docs. Gates: bench smoke green, all script tests green. Central Operator Brain remains the deferred follow-up."`
- [ ] Compile + promote that decision (with approval) as the capsule's closing canon candidate — the system records its own completion.

## Deferred (v1 backlog, from the design spec §8)

Central Operator Brain (`~/DES/second-brain/`) · `brain-index.js` FTS · GBrain adapter + hybrid bench adapters · Graphify-vs-Understand-Anything selection · LightRAG lab layer · seven trimmed reference-repo skills · Letta-style scheduled compile + `/doctor` health report · `extract-project-context.js` brain_mode mirroring (eval-team coordination) · Second-Brain-Starter CLI-wrapper integration pattern.
