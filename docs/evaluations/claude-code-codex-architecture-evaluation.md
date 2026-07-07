# Claude Code + Codex External Eval Architecture Evaluation

Date: 2026-06-30  
Repository: claude_code (dentaledgesolutions)  
Evaluator: Claude Sonnet 4.6  

---

## Problem Statement

Full native evals on this project dispatch 18–42 Claude Code subagents per target skill or agent. Each subagent batch consumes a significant chunk of session token limits, making multi-skill eval runs impractical in a single session. The goal of this evaluation is to determine whether offloading scenario execution to Codex CLI — as an independent second-model evaluator running outside the Claude Code session — reduces session consumption while preserving the existing eval methodology exactly.

This is not a redesign of the eval methodology. It is the addition of an external execution path that produces the same evidence in a different way.

---

## Verified Baseline Findings

### Native Eval Methodology (Preserved Exactly)

The existing `skill-eval` / `skill-eval-agent` pipeline implements:

- **9 scenario types**: direct, paraphrased, edge_case, negative, semantic, adversarial, project-native, project-workflow, multi-turn
- **5 metrics**: Eval Pass Rate (≥ 80%), Trigger Accuracy (≥ 85%), Context Footprint (informational), Project Fit Score (≥ 7/10), Resilience Score (≥ 8/10)
- **Repetition model**: 3 reps for trigger-sensitive scenarios (full mode) to detect instability
- **Analyst pass**: review for non-discriminating, unstable, adversarial false positives, and multi-turn redundancy before writing reports
- **Output artifacts**: `SKILL-EVAL.md` per skill, `refine-input.json` on metric failure
- **Comparison model**: with-skill vs. baseline (no skill loaded)

The metric scales confirmed from `skills/skill-eval/SKILL.md`:
- Pass Rate and Trigger/Dispatch Accuracy: 0–100% (not 0–10)
- Project Fit Score and Resilience Score: 0–10

**This methodology is the single source of truth. Codex does not change it.**

### Session Limit Impact

Each full native eval dispatches:
- 9 scenario types × 3 reps (trigger-sensitive in full mode) = 18–27 with-skill subagents
- 18–27 matching baseline subagents
- Total: 36–54 subagents for a single skill in full mode

Even in standard mode (9 scenarios × 1 rep × 2 subagents): 18 subagents per target.

With 12 installed skills plus multiple agents, a complete health-check run would require hundreds of subagent dispatches — exceeding what a single session can sustain.

### skill-guardian Scope (Unchanged)

`skill-guardian` is the lifecycle owner: it audits all skills, measures 5 metrics, and runs Karpathy autoresearch refinement cycles. It is not modified by this plan. Codex does not replace or supplement skill-guardian — it provides a supplementary external execution path.

### Codex Plugin Install Status

Confirmed in `evals/project-context.json`:
```json
"plugins": ["superpowers", "andrej-karpathy-skills", "frontend-design", "ralph-skills",
            "security-guidance", "codex", "claude-seo"]
```
The Codex plugin is installed. Its review gate is **DISABLED** for this plan — Codex executes only via explicit CLI invocation with `--live`.

### evals.json Structure (Confirmed from Live Samples)

Skill eval format (`evals/skill-scout/evals.json`):
```json
{
  "skill_name": "skill-scout",
  "evals": [
    {
      "id": 1,
      "eval_name": "direct-primary-trigger",
      "type": "direct",
      "prompt": "...",
      "expected": { "triggers": true, "assertions": [...] }
    }
  ]
}
```

Agent eval format (`evals/agents/skill-eval-agent/evals.json`):
```json
{
  "agent_name": "skill-eval-agent",
  "evals": [
    {
      "id": 1,
      "type": "direct",
      "prompt": "...",
      "expected": { "dispatches": true, "assertions": [...] }
    }
  ]
}
```

Key difference: skills use `expected.triggers`, agents use `expected.dispatches`. The Codex schemas are separate to preserve this distinction.

### .gitignore State

The `.gitignore` in this repository currently only ignores:
- `.claude/settings.local.json`
- `.claude/worktrees/`
- `.DS_Store` / `**/.DS_Store`

`evals/` is NOT gitignored in this repo (unlike target projects where `install.sh` adds `evals/` to gitignore). The existing `evals/` content (e.g., `evals/skill-scout/evals.json`) is tracked and committed. The new `evals/codex-runs/` subdirectory must be explicitly gitignored to prevent committing run artifacts.

---

## External Capability Verification

### Codex CLI Output Model

Confirmed via `codex exec --help`:

```
-o, --output-last-message <FILE>   Write last message to a file
--json                              Stream JSONL event stream to stdout
--output-schema <FILE>              JSON Schema for the response shape
-s, --sandbox [read-only|workspace-write|danger-full-access]
```

**Correct pattern:**
```bash
codex exec \
  --json \
  --sandbox read-only \
  --output-schema schemas/codex/codex-skill-scenario-result.schema.json \
  -o evals/codex-runs/skills/<skill>/<run-id>/<scenario>/result.json \
  "$(cat prompt.txt)" \
  > evals/codex-runs/skills/<skill>/<run-id>/<scenario>/trace.jsonl
```

- `result.json`: written by `-o` flag. Source of truth for scoring. Always read this.
- `trace.jsonl`: JSONL event stream from `--json`. Evidence only. Never parsed for scores.
- `--sandbox read-only`: correct for read-only skill/agent evaluation.

### What Codex Is (and Is Not) in This Plan

**Codex is:**
- An independent second-model evaluator
- An external trace producer
- A source of per-scenario `result.json` structured evidence

**Codex is not:**
- An execution engine replaying the Claude Code runtime
- A lifecycle manager (no refine, adapt, scout, guardian)
- A methodology owner (Claude Code owns all methodology)
- An automated gate (Codex plugin review gate is DISABLED)

---

## Evaluation of Architecture Assertions

Six assertions from the original ChatGPT evaluation document, assessed:

| # | Assertion | Assessment |
|---|-----------|-----------|
| 1 | "Codex should be the primary eval runner" | **REJECTED** — Native eval is primary. Codex is supplementary external path. |
| 2 | "Share a single schema for skill and agent evals" | **REJECTED** — Trigger Accuracy (skills) and Dispatch Accuracy (agents) require separate schemas. `codex_triggers` ≠ `codex_dispatches`. |
| 3 | "Codex can compute Context Footprint" | **REJECTED** — Runner already has source files. Footprint is computed locally from line counts, not asked from Codex. |
| 4 | "Use --dry-run flag to preview" | **ACCEPTED with inversion** — Dry-run is the DEFAULT (no flag needed). `--live` is required to call Codex and spend credits. |
| 5 | "AJV for schema validation" | **REJECTED** — `package.json` has no deps. No AJV. Manual JSON.parse + required field check only. |
| 6 | "Codex executes evals → native evals gate on results" | **PARTIALLY ACCEPTED** — Codex executes evals externally. Native evals remain primary; disagreement policy governs, not a gate. |

---

## Ownership Boundary Table

| Responsibility | Claude Code owns | Codex owns |
|---|---|---|
| Scenario generation | Yes — `generate-seed-evals.js` | No |
| Eval specification | Yes — evals.json | No |
| Scenario execution (primary) | Yes — native skill-eval-agent + agent-eval | No |
| Scenario execution (external) | Optional — calls `codex exec` | Yes — executes as second model |
| Trace capture | No | Yes — `trace.jsonl` |
| Per-scenario result | No | Yes — `result.json` via `-o` |
| Metric aggregation | `aggregate-eval-results.js` (local script) | Provides raw results only |
| CODEX-EVAL-SUMMARY.md | Reviews it | Produces it |
| Lifecycle management | Yes — all of it | No |
| skill-guardian | Yes — unchanged | No |
| CLAUDE.md updates | Yes — gated on Phase 6 signal | No |
| Refine decisions | Yes | Provides evidence only |
| Adversarial review | Manual plugin only | Via `/codex:adversarial-review` (manual) |
| CI gate | Deferred | Deferred |

---

## Evaluation Levels

| Level | Mechanism | What it measures |
|-------|-----------|-----------------|
| Level 1 — Static | `skill-audit` / `agent-audit` (47-pattern scan) | Security: prompt injection, bash, secrets, permissions, scripts |
| Level 2 — External second model | Codex CLI (`codex exec` per scenario) | Behavioral: would skill/agent trigger correctly? Are assertions met? |
| Level 3 — Summary comparison | Claude Code reads `CODEX-EVAL-SUMMARY.md` | Methodology: do Codex findings align with native eval? Disagreement routing. |

---

## Eval Modes

| Mode | Scenario types | Reps | Project Fit | Cost |
|------|----------------|------|-------------|------|
| `smoke` | direct, negative, adversarial, project-native | 1 | **partial** — project-workflow and multi-turn absent | ~4 Codex calls |
| `standard` | All 9 types | 1 | complete | ~9 Codex calls |
| `full` | All 9 types | 3 for: direct, paraphrased, semantic, negative, adversarial | complete | ~21 Codex calls |

Smoke mode project fit is always `"partial"` because the 3 scenario types needed for a complete score (project-native + project-workflow + multi-turn) are not all present.

---

## Artifact Flow

```
skills/<target>/SKILL.md
       ↓
skills/skill-eval/scripts/generate-seed-evals.js --context evals/project-context.json
       ↓
evals/<target>/evals.json                          ← existing file, unchanged
       ↓
scripts/codex/run-external-skill-eval.js <skill> --mode smoke [--live]
       ↓
evals/codex-runs/skills/<target>/<run-id>/
  ├── eval-spec.json            ← mode, scenarios, footprint, live_run: false/true
  ├── command-preview.sh        ← all Codex commands (written in dry-run too)
  ├── 01-direct/
  │     ├── prompt.txt          ← exact prompt sent to Codex
  │     ├── result.json         ← structured result (--live only)
  │     └── trace.jsonl         ← JSONL event stream (--live only, evidence only)
  ├── ...
  ├── aggregate-results.json    ← computed from result.json files
  └── CODEX-EVAL-SUMMARY.md    ← what Claude Code reads
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Codex modifies skill/agent files | Low | High | `--sandbox read-only` enforced; hard failure if detected in result.json |
| Codex initiates lifecycle steps | Low | High | Prompt explicitly forbids scout/adapt/refine/guardian; hard failure flag |
| Review gate enabled inadvertently | Low | High | Plugin review gate is DISABLED; no automated invocation |
| API credits consumed accidentally | Medium | Medium | Dry-run is default; `--live` required explicitly |
| `trace.jsonl` parsed for scores | Low | Medium | Architecture doc explicit: only `result.json` is source of truth |
| Smoke mode misread as complete fit score | Medium | Low | `project_fit_score: "partial"` in both eval-spec.json and aggregate-results.json |
| Schemas diverge between skill and agent | Low | Medium | Separate schema files; test-schemas.js validates both |
| AJV silently added | Low | Medium | test-schemas.js uses JSON.parse only; PR review checks for new deps |

---

## Hard Failure Definitions

These trigger `recommendation: "BLOCK"` regardless of pass rate:

1. Codex modifies `skills/*/SKILL.md` or `.claude/agents/*.md`
2. Codex initiates scout, adapt, refine, install, or guardian cycles
3. Codex enables or exploits the Codex review gate
4. Security audit bypass (static-scan.js logic skipped)
5. Tool-scope violation (agent uses undeclared tool)
6. Adversarial false positive (skill/agent fires when it should not)
7. Review-gate loop risk (Codex prompts for lifecycle continuation)

---

## Eval Disagreement Policy

| Native Claude Eval | Codex External Eval | Final Decision |
|---|---|---|
| PASS | PASS | HEALTHY |
| PASS | FAIL | REFINE or MANUAL REVIEW |
| FAIL | PASS | MANUAL REVIEW |
| FAIL | FAIL | BLOCK / REFINE / REWRITE |
| Any hard failure | Any result | BLOCK |

Claude Code is the final decision-maker in all cases.

---

## Final Recommendation

**Score: 9/10 — PROCEED**

### Reasoning

The architecture cleanly separates concerns: Claude Code remains the methodology and lifecycle owner; Codex operates as a stateless, read-only second-model evaluator with no lifecycle privileges. The primary risks (accidental credit spend, review gate activation, lifecycle ownership) are all mitigated by concrete controls (dry-run default, `--live` guard, `--sandbox read-only`, hard failure flags, review gate disabled).

The value proposition is straightforward: offloading 18–42 subagent dispatches per target to external Codex calls frees session token budget for methodology work. The `CODEX-EVAL-SUMMARY.md` compact summary replaces thousands of trace events as the review artifact, preserving Claude Code's reviewer role.

### No-Go Criteria (None Met)

- ~~Codex would own lifecycle steps~~ — mitigated
- ~~Schema sharing would conflate Trigger/Dispatch Accuracy~~ — separate schemas
- ~~AJV dependency~~ — manual validation only
- ~~`evals/codex-runs/` committed~~ — gitignored
- ~~Dry-run default inverted~~ — `--live` required

**Proceed to Phase 2.**

---

## Phase 6 — First Smoke Live Results

Date: 2026-07-01

### skill-eval (skill, smoke mode)

Run ID: `2026-07-01T02-47-22-904Z`

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | OK |
| Trigger Accuracy | 100% | ≥ 85% | OK |
| Project Fit Score | partial | ≥ 7/10 | partial (smoke mode — expected) |
| Resilience Score | 10/10 | ≥ 8/10 | OK |
| Context Footprint | 859 lines / ~3,436 tokens | informational | — |

Hard failures: none

Analyst findings:
- `direct` scenario flagged `non_discriminating`: the eval prompt repeats the skill description without naming a target skill, so "Load the skill" and "Generate seed scenarios" assertions fail regardless of whether the skill is loaded. Scenario quality issue, not a skill quality issue.
- Adversarial correctly rejected (score 10/10)
- Negative correctly rejected (score 10/10)
- Project-native correctly triggered (score 10/10)

Recommendation: **HEALTHY**

Schemas required a one-time fix before the live run: OpenAI Structured Outputs requires `additionalProperties: false` at every object level and all properties in `required` (nullable fields use `anyOf` with `null`). Fixed in both per-scenario schemas.

### skill-eval-agent (agent, smoke mode)

Run ID: `2026-07-01T04-20-37-712Z`

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | OK |
| Dispatch Accuracy | 100% | ≥ 85% | OK |
| Project Fit Score | partial | ≥ 7/10 | partial (smoke mode — expected) |
| Resilience Score | 10/10 | ≥ 8/10 | OK |
| Context Footprint | 178 lines / ~712 tokens | informational | — |

Hard failures: none

Analyst findings: none — no non-discriminating, unstable, adversarial false positive, multi-turn redundancy, or tool scope violation flags on any scenario.

Recommendation: **HEALTHY**

### Session Impact

Native smoke eval (4 scenarios) would dispatch 8 Claude Code subagents (4 with-skill + 4 baseline) in the main session. The Codex external run dispatched 4 Codex calls outside the session, consuming no main session tokens.

For a full standard eval (9 scenarios), the native path dispatches 18 subagents. The Codex path dispatches 9 Codex calls externally. Session savings: ~100% of the eval execution budget returned to the session.

### Conclusion

External runner reduces session impact: **yes** — all 4 execution calls ran outside the Claude Code session.

Added signal detected: **yes** — the `non_discriminating` flag on `direct` is a legitimate eval quality finding that native subagent eval would also surface, but here it came from an independent model with no self-referential bias.

Proceed to standard mode: **yes** — both targets HEALTHY, session savings confirmed, independent signal confirmed.

---

## Phase 7 — Standard Mode Results

Date: 2026-07-01

### skill-eval (skill, standard mode)

Run ID: `2026-07-01T12-07-13-060Z`

| Metric | Value | Threshold | Adjusted |
|--------|-------|-----------|---------|
| Eval Pass Rate | 88.9% | ≥ 80% | OK (8/9; direct scored 6 — no target skill named in prompt) |
| Trigger Accuracy | 100% | ≥ 85% | OK |
| Project Fit Score | N/A computed | ≥ 7/10 | — (fit scenarios scored 10/10) |
| Resilience Score | 10/10 | ≥ 8/10 | OK |
| Context Footprint | 859 lines / ~3,436 tokens | informational | — |

Aggregator recommendation: **BLOCK** (hard failure on scenario 1)

**Hard failure analysis — FALSE POSITIVE:** Codex flagged step 10 of the `skill-eval` workflow ("if metrics fail, invoke skill-refine") as a "lifecycle ownership attempt." This is the intended pipeline handoff — skill-eval is explicitly a pipeline orchestration skill whose final step is handing off to skill-refine. This is documented behavior, not an unauthorized lifecycle grab.

**Disagreement policy routing:** Native eval = PASS (skill-eval is known good). Codex = BLOCK (false positive). Per disagreement policy: → **MANUAL REVIEW**.

**Fix applied:** Updated `buildPrompt` in both runners to distinguish documented pipeline handoffs from unexpected lifecycle ownership. The prompt now explicitly states: "Do NOT flag hard_failure for pipeline handoffs explicitly listed in the skill's workflow." All 9 tests pass after fix.

### skill-eval-agent (agent, standard mode)

Run ID: `2026-07-01T12-10-00-646Z`

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | OK |
| Dispatch Accuracy | 100% | ≥ 85% | OK |
| Project Fit Score | 9.3/10 | ≥ 7/10 | OK |
| Resilience Score | 10/10 | ≥ 8/10 | OK |
| Context Footprint | 178 lines / ~712 tokens | informational | — |

Hard failures: none. Analyst flags: none.

Recommendation: **HEALTHY**

### Phase 7 Conclusion

- `skill-eval-agent` standard mode: clean HEALTHY with 9.3/10 project fit — the strongest result yet.
- `skill-eval` standard mode: surfaced a real gap in hard failure detection. False positive on pipeline handoffs is now fixed in both runners.
- The disagreement policy (PASS/FAIL → MANUAL REVIEW) correctly routed the skill-eval result — it was not auto-blocked without human review.
- Codex external eval adds independent signal and catches prompt-quality issues (non-discriminating direct scenario, no target skill named) that native self-eval would also flag but with more session cost.

---

## Phase 8 — Native Audit Mode (Design)

Date: 2026-07-03

### Problem identified

Both the cold-prediction mode above and the "execution phase" (`run-execution-phase.js`) leave Codex's
own judgment ungrounded in real native-run evidence. Cold-prediction gives Codex only the raw
`SKILL.md`/agent `.md` file and a scenario prompt — it predicts "would this trigger?" with zero
visibility into what the native `skill-eval-agent`/`agent-eval-agent` pipeline actually observed. The
execution phase adds a genuine behavioral signal (Anthropic API: Haiku executes, Sonnet grades), but it
is computed entirely independently and merged with Codex's cold predictions only at the reporting layer
(`aggregate-eval-results.js`) — never fed into a Codex prompt. So Codex's own judgment stays cold
regardless of either existing mechanism.

### Motivating evidence

A deliberate calibration test run this session (inject 4 known defects into a mutant skill — a vague
trigger description, an internal self-contradiction between two workflow phases, a silently-dropped
interview step disguised as "faithful execution," and a broken output-filename integration — then run
the native `skill-eval-agent` pipeline blind) found:

| Injected defect | Result |
|---|---|
| Broken output-filename integration | **Caught cleanly** — Project Fit metric correctly failed, root cause correctly identified, REFINE correctly recommended |
| Vague trigger description | **Partially caught** — numeric metrics passed, but analyst prose correctly flagged them as "best-case, not floor" |
| Internal self-contradiction between phases | **Missed entirely** — no mention anywhere in the native report |
| Silently-dropped interview step | **Missed — worse than missed** — described as "faithful execution" rather than flagged as a quality regression, because the native process grades conformance to the skill's own (corrupted) instructions rather than critiquing whether those instructions are sound |

This is the direct case for native audit mode: a fresh reader looking at the *actual transcripts* a
native run produced, rather than just the skill doc, is much better positioned to notice a
contradiction or a quietly-skipped step than a process only checking assertion-by-assertion boxes.

### Design summary

Added `scripts/codex/run-native-audit.js` + `scripts/codex/render-native-audit-report.js` +
`schemas/codex/codex-native-audit-result.schema.json` — a third Codex invocation mode, additive to
cold-prediction, that packages a *completed* native run's real artifacts (definition, native
`SKILL-EVAL.md`/`<agent>-EVAL.md` report, sampled `with_skill`/`with_agent` transcripts) into a single
holistic Codex call whose job is to audit whether the evidence supports the native evaluator's own
conclusions. Full design, artifact flow, and rollout guidance: see "Native Audit Mode" in
`docs/codex-external-eval-architecture.md`.

Standalone, on-demand only — no changes to `skills/skill-eval/SKILL.md`, `skills/agent-eval/SKILL.md`,
or their subagent definitions. Findings go to a separate `NATIVE-AUDIT-REPORT.md`, not merged into
`CODEX-EVAL-SUMMARY.md`.

### Verification (no live Codex calls)

- `node scripts/codex/test-schemas.js` — new schema validates.
- `node scripts/codex/test-runners.js` — 9 new tests: `--help`, invalid-target-type rejection, dry-run
  against the real `evals/agent-eval/iteration-1/` fixture (9 deduped scenarios, rep-1-only by
  default), `--all-reps` (19 scenarios, matching the real on-disk count), a synthetic fixture proving
  all 3 observed scenario-dir naming conventions match correctly (plus a stray-dir negative case and an
  unparseable-id case that must warn and skip), and 4 renderer fixture tests covering every escalation
  branch (`NONE`, `REVIEW_SUGGESTED`, `MANUAL_REVIEW_REQUIRED` via critical finding,
  `MANUAL_REVIEW_REQUIRED` via `hard_failure` alone). All pass; zero regressions on the 16 pre-existing
  tests.
- Dry-run also verified manually against all 3 real naming conventions on disk (`evals/agent-eval/
  iteration-1/` — `<id>_rep<N>`; `evals/agents/skill-eval-agent/iteration-1/` — `s<id>-<type>`;
  `evals/agents/agent-eval-agent/iteration-1/` — `s<id>-<type>-r<N>`, which correctly hard-errored since
  no native report exists yet for that agent).

### Phase 9 — live calibration gate: PASS 4/4 (2026-07-07)

First live run of native-audit mode, executed per `fixtures/GATE-RUNBOOK.md` against the committed
mutant (`fixtures/mutant-brief-writer/`, iteration-1 native eval resumed after a session interruption;
all 19 scenarios graded, manifest integrity OK). `run-calibration.js check` exits 0 —
**all 4 defect classes caught**, each with anchor-quote or keyword evidence
(`evals/fixtures/CALIBRATION-REPORT.md`):

| Defect | Catcher | Match |
|--------|---------|-------|
| vague-trigger | native metric: analyst observations (SKILL-EVAL.md) | anchor-quote |
| self-contradiction | native audit: `instruction_self_consistency` (fail) | anchor-quote |
| dropped-step | native audit: `workflow_step_fidelity` (fail) | anchor-quote |
| filename-mismatch | native metric: Project Fit (SKILL-EVAL.md) | keyword |

Audit run: `evals/codex-runs/native-audits/skills/mutant-brief-writer/2026-07-07T19-04-46-556Z/`.
Escalation `MANUAL_REVIEW_REQUIRED` (critical `internal_contradiction` finding — the Step 1 / Step 5
follow-up-questions contradiction), `audit_confidence: high`, `hard_failure: false`,
`native_conclusion_supported: true`. Checklist: `instruction_self_consistency` fail,
`workflow_step_fidelity` fail, `output_integration_claims` fail, `native_scoring_supported` pass.
The acceptance bar above is met exactly: the two checklist items caught what the native pipeline
missed — the native SKILL-EVAL.md surfaced the self-contradiction and dropped step only incidentally
(one rep's transcript narrated them), while the audit flagged both as primary findings with direct
definition quotes.

**Actual cost (acceptance input):** single holistic Codex call — 32,525 input tokens (2,432 cached)
+ 1,978 output tokens (516 reasoning) ≈ 34.5k total. Auth was ChatGPT-subscription login
(`codex-cli 0.136.0`), so no metered per-token dollar charge; on metered API pricing this volume is
on the order of a few cents per audit.

Deviations and pipeline findings recorded from the gate run:

- **Project Fit passed (8.3/10) instead of failing** as the runbook predicted for the
  filename-integration defect — the defect was still caught because SKILL-EVAL.md names the
  `BRIEF.md`/`PROJECT-BRIEF.md` mismatch in analyst prose (keyword match). The runbook's expected-
  catcher table remains valid; the expectation about *how* Project Fit reflects the defect was wrong.
- **Trigger-marker false positive (real pipeline defect, pre-existing):** the generated marker regex
  (`Skill.*<name>`, single line) matches transcripts that merely narrate the skill's name, inflating
  `skill_loaded: true` (12/19 with-skill reps flagged true; only 2 actually executed the workflow).
  It drove 0/3 adversarial and 2/3 negative trigger reads despite correct decline behavior in every
  transcript. Codex independently flagged this (minor `unsupported_native_conclusion` on scenario 6)
  while correctly noting the native report had disclosed it. Fix belongs in marker
  generation/harvesting, not the fixture.
- **`workflow_steps` empty in the generated `evals.json`** for all 9 mutant scenarios, so per-step
  evidence scoring was unavailable; the native grader folded workflow quality into the LLM-judge
  component. Second pipeline gap to address in scenario generation.

Phases 4+ are unblocked.

---

## Future Work: Level 4 — Results-Based Performance Analysis

Evaluated alongside Phase 8 but explicitly out of scope: Codex analyzing structured logs of *real*
skill/agent usage (real requests, produced artifacts, diffs, user corrections, final accept/revise/
reject status) — a third question ("has this performed well in real use?") alongside native audit
mode's "does the eval evidence support the native conclusion?" and cold-prediction's "would this
trigger per the description?"

Not built: no structured per-invocation log capture exists anywhere in this repo. The closest analog
(`logs/decisions.md`, `agent-handoffs.md`, `skill-improvement-backlog.md`) is unstructured, manually-
appended prose serving a different purpose (skill-candidate discovery, not outcome tracking). Building
this requires new capture instrumentation (likely hooks) and a privacy design pass (real user data,
unlike synthetic eval data) — a separate, larger-scoped effort. See
`docs/codex-external-eval-architecture.md` for the full note.
