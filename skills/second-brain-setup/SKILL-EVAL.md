# Skill Eval: second-brain-setup
**Date:** 2026-07-15  **Iteration:** 1  **Evaluator:** skill-eval-agent

**Run mode:** Smoke — 1 rep per scenario (all 9 types), sequential, peak concurrency ≤ 2,
`with_skill` side only, hand-authored `evals/second-brain-setup/evals.json` (no baseline
side, per explicit run recipe). Trigger accuracy and workflow-step results are read
exclusively from `harvest-evidence.js`-generated `evidence.json` files (never from
subagent self-reported headers). Because no baseline/without_skill probes were run this
iteration, `baseline_delta` is N/A for every scenario and the standard non-discriminating/
UNSTABLE/REGRESSION analyst checks (which require baseline deltas and 3-rep data) could
not be evaluated — see Analyst Observations.

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5) | ≥ 85% | PASS |
| Context Footprint | 41L / ~164t | — | — |
| Project Fit Score | 10.0/10 | ≥ 7 | PASS |
| Resilience Score | 10.0/10 | ≥ 8 | PASS |

## Scenario Results
| ID | Type | Score | skill_loaded (expected→actual) | Workflow Steps | Flag |
|----|------|-------|-------------------------------|-----------------|------|
| 1 | direct | 10.0 | true→true ✓ | 4/4 | — |
| 2 | paraphrased | 10.0 | true→true ✓ | 3/3 | — |
| 3 | edge_case | 10.0 | true→true ✓ | 2/2 | — |
| 4 | negative | 10.0 | false→false ✓ | n/a (none expected) | — |
| 5 | semantic | 8.5 | true→true ✓ | 2/3 | minor: "brain-verify" term not literally quoted in precondition narration |
| 6 | adversarial | 10.0 | false→false ✓ | n/a (none expected) | — |
| 7 | project-native | 10.0 | true→true ✓ | 4/4 | — |
| 8 | project-workflow | 10.0 | true→true ✓ | 3/3 | — |
| 9 | multi-turn | 10.0 | true→true ✓ | 1/1, no re-ask of rounds 1-3 | — |

All 9 `skill_loaded` decisions (evidence.json, mechanical `Skill(second-brain-setup)`
regex match, not self-report) matched the scenario's expected value — including both
discriminating probes graded first per the run recipe:

- **s4 (negative)** — "what questions does the interview ask" — correctly answered
  conversationally; no trigger token, no round 1 opened. `skill_loaded: false` (correct).
- **s6 (adversarial)** — "create a .project-brain capsule ... bootstrap from scratch" —
  correctly recognized as project-brain-bootstrap's job (capsule creation), not
  second-brain-setup's (capsule personalization); declined and redirected. No trigger
  token, real or negated. `skill_loaded: false` (correct).

Mirror-boundary property confirmed intact: second-brain-setup never fires on a
bootstrap/creation request, and (per project-brain-bootstrap's own eval) that skill's
"personalize" adversarial probe correctly routes the other direction.

## Analyst Observations

- **No baseline this run**: the run recipe explicitly scoped this iteration to
  `with_skill`-only probes (1 rep, discriminating-scenarios-first) to verify trigger
  boundaries cheaply. `baseline_delta`, non-discriminating (`|delta| < 0.5`), and
  REGRESSION (`delta < -2`) checks require a `without_skill` side and were not computed.
  A follow-up standard-mode run (3 reps on trigger-type scenarios, both sides) is needed
  before this can feed a refine decision on those axes.
- **UNSTABLE check not applicable**: 1 rep per scenario (smoke mode) — 3-rep flakiness
  detection (1/3 or 2/3 trigger rate) requires the standard/full run mode.
- **ADVERSARIAL_FAILURE**: not triggered — s6 scored 10 (skill correctly declined).
- **MULTI_TURN_REDUNDANCY**: not triggered — s9 explicitly skipped re-asking rounds 1-3
  and picked up directly at round 4 using the already-established blunt communication
  style from the simulated prior context.
- **Minor workflow-step gap (s5)**: the semantic-trigger transcript stated the
  precondition check narratively ("Precondition passes — proceeding straight to the
  interview") without literally including the substring "brain-verify" that
  `harvest-evidence.js` matches against for that step. This is most likely subagent
  phrasing variance rather than a skill defect (SKILL.md's own Preconditions section
  does say "passes brain-verify" verbatim), but if this pattern recurs across reps in a
  future 3-rep run, it would indicate the description/workflow doesn't anchor the
  precondition-check language strongly enough to survive paraphrase-triggered probes.
  Not severe enough on its own to warrant a lever mutation from a single smoke rep.
- **Interaction with the real `.project-brain/` capsule**: this project has a live,
  partially-personalized `.project-brain/BRAIN.md` at the repo root. All 6 scenarios
  requiring an existing capsule (s1, s2, s5, s7, s8, s9) operated against a pre-seeded
  copy under each scenario's `with_skill/workspace/.project-brain/`, never the real
  capsule — verified via `git status`/diff on the repo root after every probe (no
  modifications). s3 (edge case) and s6 (adversarial, no capsule needed) correctly used
  an empty workspace with no `.project-brain/` present.

## Recommendation
HEALTHY — all 5 metrics pass threshold on this smoke-mode run. The skill correctly
personalizes an existing capsule on all positive-trigger phrasings tested (direct,
paraphrased, semantic, project-native, project-workflow, multi-turn-resume) and
correctly declines on both discriminating probes (negative explanation question,
adversarial bootstrap-scope-confusion). Recommend a standard-mode (3-rep, baseline-
paired) follow-up run before treating trigger_accuracy and resilience_score as fully
settled, since this run's 100% figures are based on single reps with no baseline
delta.
