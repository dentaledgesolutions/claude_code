# Eval Process Hardening — Design

**Date:** 2026-07-08
**Status:** Approved (user, 2026-07-08)
**Motivation:** Post-gate assessment of the evaluation process (robustness ~7/10, accuracy ~6.5/10,
reliability ~7/10) identified three priority gaps: the calibration gate has run once against one
fixture; nothing evaluates agent *teams*; grading variance is unmeasured despite the golden-target
fixture existing for exactly that purpose.

Three parts, implemented in order 1 → 3 → 2 (smallest risk first), one commit per part, TDD
throughout. No CI (standing rule). All `--live` / subagent-spawning steps remain human-invoked.

---

## Part 1 — Routine calibration gate + second fixture

### 1a. Parameterize `scripts/run-calibration.js`

- New flag `--fixture <name>`, default `mutant-brief-writer` — all existing commands keep working
  unchanged.
- The path-constants object (currently hardcoded at ~line 71) becomes a function of the fixture
  name: definition at `fixtures/<name>/SKILL.md`, ground truth at
  `fixtures/<name>/expected-findings.json`, generated scenarios at
  `evals/fixtures/<name>/evals.json`, eval report at `fixtures/<name>/SKILL-EVAL.md` (gitignored
  by the existing `fixtures/*/SKILL-EVAL.md` rule), audit runs under
  `evals/codex-runs/native-audits/skills/<name>/`.
- `check` gains `--expected <path>` (override ground-truth location) so tests can point it at
  synthetic inputs in a temp dir. Existing `--eval-report` / `--audit-report` overrides stay.
- The calibration report gains a fixture column / heading so
  `evals/fixtures/CALIBRATION-REPORT.md` states which fixture was checked. Report path becomes
  `evals/fixtures/CALIBRATION-REPORT-<fixture>.md` to avoid one fixture's PASS overwriting
  another's FAIL; the legacy unsuffixed path is no longer written.

### 1b. New fixture `fixtures/mutant-notes-summarizer`

A deliberately defective meeting-notes-summarizer skill. Header comment identical in spirit to
fixture 1: `<!-- CALIBRATION FIXTURE — intentionally defective. Never install, never refine. -->`
Same immutability rules (fixtures/README.md gets a short section).

4 injected defects in classes distinct from fixture 1 (vague-trigger, self-contradiction,
dropped-step, filename-mismatch):

| # | Class | Injection | Expected catcher |
|---|-------|-----------|------------------|
| 1 | `over-narrow-trigger` | Description triggers only on the exact phrase "summarize the meeting notes file" — paraphrases and semantic variants miss | `native_metric:trigger_accuracy` |
| 2 | `phantom-script` | Step instructs `node scripts/notes/extract-actions.js` — a script that does not exist anywhere | `native_audit:output_integration_claims` |
| 3 | `multi-turn-redundancy` | Workflow mandates re-confirming attendee list and meeting date with the user at the start of *every* step, even when already given | `native_metric:analyst_observations` |
| 4 | `dead-step` | Step 5 applies "only if Step 2 found zero action items", but Step 2's instructions guarantee at least one action item (it must synthesize a follow-up review item when none are found) | `native_audit:workflow_step_fidelity` |

`expected-findings.json` mirrors fixture 1's schema: one entry per defect with `defect_class`,
`anchor_quote` (exact SKILL.md text), `expected_catcher`, and notes.

### 1c. Keyword-fallback map extension

`run-calibration.js`'s per-class keyword regex map gains the 4 new classes, e.g.:

- `over-narrow-trigger`: `/too narrow|under-?trigger|did not trigger|failed to trigger|trigger accuracy|only.*exact phrase/`
- `phantom-script`: `/does not exist|nonexistent|no such (file|script)|missing script|phantom/`
- `multi-turn-redundancy`: `/re-?ask|re-?confirm|redundan|already (established|given|provided)/`
- `dead-step`: `/dead.?step|unreachable|never (applies|reached|true)|impossible condition/`

(Exact regexes finalized during TDD against synthetic report text.)

### 1d. Routine-ness

- New `scripts/run-all-tests.js`: umbrella that discovers and runs every `*.test.js` suite plus
  `scripts/codex/test-schemas.js`, `scripts/codex/test-runners.js`,
  `scripts/telemetry/test-telemetry.js`; exits non-zero on any failure. This is the single
  command for "did I break the eval pipeline?".
- GATE-RUNBOOK.md + CLAUDE.md rule additions: run `node scripts/run-all-tests.js` after any
  change under `skills/*/scripts/`, `scripts/codex/`, `scripts/telemetry/`, or
  `scripts/run-calibration.js`; run the live gate (steps 2–4) against **both** fixtures after
  changes to `buildPrompt()` or the grading methodology.

### 1e. Tests (written first)

`scripts/run-calibration.test.js`:
- anchor-quote window matching (verbatim, elided/partial quoting, normalization of
  backticks/asterisks/quotes/whitespace)
- keyword fallback per class, including all 4 new classes
- checklist-fail row matching (`| <check> | fail |`)
- 4/4 → exit 0, 3/4 → exit 1
- `--fixture` path resolution for both fixtures; `--expected` override
- both committed `expected-findings.json` files validate structurally (required fields present,
  anchor quotes actually appear verbatim in their SKILL.md)

---

## Part 2 — Team-level eval: new `team-eval` skill

### What it evaluates

An *orchestration* — an orchestrator (skill or agent) plus the member agents it dispatches — as a
unit, not any single definition. Fills the current blind spot: per-definition evals never exercise
handoffs, member selection, or ensemble degradation.

### Team manifest

`team.json` (schema documented in the SKILL.md):

```json
{
  "team_name": "repo-audit-ensemble",
  "orchestrator": { "type": "skill", "name": "repo-audit" },
  "members": [ { "agent": "repo-audit-runtime", "role": "runtime layer" }, ... ],
  "handoff_contract": "each member receives an XML slice path and returns a JSON layer object",
  "expected_artifacts": ["docs/audits/<owner>-<repo>-<date>.json"]
}
```

Committed reference: `fixtures/teams/repo-audit-ensemble/team.json` describing the real repo-audit
orchestration (8 analysts). Lives under `fixtures/` (committed, inert reference data — same
rationale as the mutant fixtures).

### Generator

`skills/team-eval/scripts/generate-team-evals.js` (adapted from `generate-agent-evals.js`,
sharing its evidence-spec format so `harvest-evidence.js` needs **no changes**). Emits 6 scenario
types to `evals/teams/<team>/evals.json`:

| Type | Dispatches? | Tests |
|------|-------------|-------|
| `full-run` | ✓ all members | end-to-end orchestration, all members dispatched, final artifact produced |
| `partial-team` | ✓ subset | member subset selection (e.g. `--layer` style scoping) — only named members dispatched |
| `member-failure` | ✓ all minus one | one member unavailable — orchestrator must degrade gracefully, not fabricate the missing layer |
| `handoff-integrity` | ✓ | member outputs must be consumed downstream (artifact/marker evidence), not silently re-derived by the orchestrator |
| `negative` | ✗ | describe the team without dispatching it |
| `adversarial` | ✗ | team vocabulary in wrong scope — must not dispatch |

Evidence per scenario: one `Agent(<member>)` dispatch-token `tool_call` marker per expected member
(`expect: present` or `absent` per scenario), plus artifact checks from `expected_artifacts` and
the handoff contract. Dispatch tokens reuse the exact convention shipped in the marker fix.

### Metrics (5)

| Metric | Definition | Threshold |
|---|---|---|
| team pass rate | scenarios with composite ≥ 7 / total | ≥ 80% |
| dispatch-chain accuracy | correct member dispatch decisions (right members present, no phantom members, absent when required) / total member-checks | ≥ 85% |
| handoff integrity | verifiably consumed member outputs / expected handoffs | ≥ 90% |
| aggregate context footprint | orchestrator + all member definitions, lines → est. tokens | informational |
| team resilience | negative + adversarial scenarios correctly not dispatching / total | ≥ 8/10 |

Report: `evals/teams/<team>/TEAM-EVAL.md` (same table format family as SKILL-EVAL.md /
AGENT-EVAL.md). Below-threshold metrics produce `evals/teams/<team>/refine-input.json` routing to
the *orchestrator's* refine track (team-refine is out of scope — YAGNI).

### Scope boundary

Scenario generation, evidence specs, manifest validation, and docs are fully implemented and
tested. **Live execution of a team eval is human-invoked** (it spawns an orchestrator run per
scenario); the SKILL.md documents the execution workflow for a Claude session the same way
skill-eval's does.

### Tests (written first)

`skills/team-eval/scripts/generate-team-evals.test.js`:
- 6 scenarios from the reference manifest; schema-valid evals.json
- full-run expects a present dispatch marker per member; negative/adversarial expect absent
- member-failure scenario names the excluded member and expects the remaining N−1 markers
- partial-team expects present markers only for the named subset, absent for the rest
- dispatch-token pattern equals the `Agent\(...\)` convention (no narrative-mention regression)
- manifest validation errors (missing members, unknown agent file) fail loudly

---

## Part 3 — Grader-calibration harness + first live variance run

### `scripts/run-grader-calibration.js`

Same generate/check split as `run-calibration.js`; the script never calls an LLM.

**`generate [--judges N]`** (default 5):
- Reads `fixtures/golden-target/golden-transcript.md`, `expected-scores.json`, and the grading
  rubric section of `skills/skill-eval/SKILL.md`.
- Writes `evals/fixtures/grader-calibration/judging-spec.json` (dimensions, tolerance, transcript
  path, output schema) and `judge-prompt-<i>.md` × N — identical prompts instructing one judge
  pass each: score every dimension 0–10 against the rubric, output JSON only, **no access to the
  expected bands** (bands are excluded from the prompt files by construction; test-asserted).
- Each judge pass writes `evals/fixtures/grader-calibration/scores-<i>.json`:
  `{ "judge": i, "dimensions": [{ "dimension": "...", "score": n }], "overall_score": n }`.

**`check`**:
- Loads all `scores-*.json`; validates against `expected-scores.json` bands (fixture tolerance
  ±1 already baked into the bands).
- Per dimension: in-band count, mean, spread (max − min). Spread > 2 ⇒ HIGH-VARIANCE flag.
- Writes `evals/fixtures/grader-calibration/GRADER-CALIBRATION-REPORT.md` — per-dimension table
  (band, per-judge scores, mean, spread, verdict) + overall verdict.
- Exit 0 ⇔ every score in-band AND no HIGH-VARIANCE dimension.

### First live run (this session)

After the harness is green: spawn 5 independent judge subagents (blind to each other and to the
bands), each producing one `scores-<i>.json`; run `check`; report the first real variance
numbers. Result is signal either way: in-band/low-spread validates the judge; drift or spread is
exactly what the harness exists to expose.

### Tests (written first)

`scripts/run-grader-calibration.test.js`:
- `generate` produces N prompts + spec; prompts contain transcript + rubric dimensions but **not**
  the expected bands or target scores
- `check` with synthetic scores: all-in-band → exit 0; one out-of-band → exit 1 naming the
  dimension+judge; spread 3 on one dimension → HIGH-VARIANCE + exit 1
- malformed/missing scores file → loud failure, not silent skip

---

## Documentation updates (land with each part)

- Part 1: GATE-RUNBOOK.md (both-fixture cadence, run-all-tests rule), fixtures/README.md (new
  mutant), CLAUDE.md (run-all-tests rule, `--fixture` flag), README.md (calibration gate row
  mentions two fixtures).
- Part 2: README.md (team-eval skill section + Agents/skills lists), CLAUDE.md (team-eval domain
  terms: team.json, TEAM-EVAL.md, dispatch-chain accuracy, handoff integrity).
- Part 3: GATE-RUNBOOK.md or fixtures/README.md pointer, CLAUDE.md (grader-calibration command),
  README.md (step 7 of the plain-English section gains the grader-honesty sentence already
  present; add the command reference).

## Out of scope (explicit)

- CI wiring (standing rule: not until locally stable and explicitly approved)
- team-refine / autoresearch for teams
- Any change to `harvest-evidence.js`, `run-manifest.js`, or the Codex runner scripts
- Editing either mutant fixture after commit (immutability rule)
