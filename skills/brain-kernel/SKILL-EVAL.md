# Skill Eval: brain-kernel
**Date:** 2026-07-14  **Iteration:** 1  **Evaluator:** skill-eval-agent (smoke mode)

**Scope note:** This run used the hand-authored 9-scenario suite committed at
`evals/brain-kernel/evals.json` (generate-seed-evals.js is known to emit
miscalibrated sibling-target prompts for router skills and was intentionally not
run). Recipe was smoke mode: 1 rep per scenario, with_skill probes only, sequential
dispatch, peak concurrency ≤ 2 — no baseline (`without_skill`) side was run, so
`run-manifest.js status` correctly reports FAILED (1 side dir instead of 2 per
scenario) and Delta is N/A throughout. All 9 `evidence.json` files are persisted
under `evals/brain-kernel/iteration-1/`. Two scenarios (s7, s9) were executed
directly by the orchestrating agent rather than via a spawned subagent, after the
Agent-tool safety classifier became temporarily unavailable mid-run; both followed
the same protocol (real read-only `brain-verify.js`/`brain-lint.js` runs against
the repo's actual `.project-brain/`, output/timing/evidence written under the
scenario's `with_skill/` directory only).

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5 trigger-type checks) | ≥ 85% | PASS |
| Context Footprint | 31 lines / ~124 tokens (single-file SKILL.md, no bundled scripts) | — | — |
| Project Fit Score | 10.0/10 | ≥ 7 | PASS |
| Resilience Score | 10.0/10 (1/1 adversarial scored >0) | ≥ 8 | PASS |

## Scenario Results
| ID | Type | Expected trigger | Found (evidence.json) | Composite | Delta | Flag |
|----|------|-------------------|------------------------|-----------|-------|------|
| 1 | direct | true | true | 9.7 | N/A (no baseline) | — |
| 2 | paraphrased | true | true | 9.7 | N/A | — |
| 3 | edge_case | true | true | 8.2 | N/A | see note below |
| 4 | negative | false | false | 9.7 | N/A | — |
| 5 | semantic | true | true | 9.7 | N/A | — |
| 6 | adversarial | false | false | 10.0 | N/A | — |
| 7 | project-native | true | true | 9.7 | N/A | — |
| 8 | project-workflow | false | false | 9.7 | N/A | grading override (see note) |
| 9 | multi-turn | true | true | 9.7 | N/A | no re-ask deduction |

## Analyst Observations

- **Router discrimination confirmed by design, not by delta.** Since no baseline
  was run this iteration, the standard `|baseline_delta| < 0.5` non-discriminating
  check and the `delta < -2` regression check could not be computed. In their place,
  the three discriminating scenarios (s4 negative, s6 adversarial, s8
  project-workflow) directly demonstrate the property under test — brain-kernel
  stayed silent (marker absent) on a meta-question and on two requests that already
  named their target operation (`compile`, `promote`) — while all six
  positive/vague scenarios correctly triggered the router. This is the core
  behavior this suite exists to verify, and it held in all 9/9 cases at n=1.
- **STABILITY NOT MEASURED.** Standard methodology runs 3 reps for trigger-type
  scenarios (direct, paraphrased, semantic, negative, adversarial) to catch flaky
  (1/3 or 2/3) triggering. This smoke run used 1 rep per scenario per explicit
  instruction, so `UNSTABLE` cannot be ruled out — a full-rep re-run is recommended
  before treating trigger accuracy as fully validated.
- **s3 (edge_case) scenario-authoring mismatch.** The hand-authored eval's
  `workflow_steps` spec assumes a possible "no `.project-brain/` capsule" finding
  and expects a route to `project-brain-bootstrap`. This repo's real capsule
  already exists and is well-formed, so that literal step is correctly
  `satisfied:false` — not because the skill failed, but because the eval's
  hypothetical branch doesn't match the real environment's actual state. The
  transcript correctly diagnosed the real state and routed to `brain-compile`/
  `/brain-promote` instead. Scored 8.2 (workflow_steps ratio 0.5 taken literally)
  rather than the ~9.7 the other positive scenarios received, to stay honest about
  the literal step mismatch even though behavior was correct for real conditions.
- **Naive-regex false-positive risk observed and manually corrected (s8).** The
  s8 subagent's transcript contained the literal string `Skill(brain-kernel)`
  inside negated prose ("no `Skill(brain-kernel)` token is emitted"). A pattern-only
  harvester (as implemented in `harvest-evidence.js`, which has no negation
  awareness) would have false-positive-matched this as `skill_loaded: true`. The
  transcript was read in full and manually confirmed the skill's workflow was
  never actually applied (no `brain-verify.js`/`brain-lint.js` calls, no diagnose
  report) — `evidence.json` was written with the corrected `skill_loaded: false`
  and the override is documented in that file's `grading_note`. This is a known
  sharp edge for any future automated harvest pass over this suite: dispatch
  instructions for router/negative-trigger skills should tell subagents never to
  reference the trigger token at all, even in negated form, to avoid this class of
  false positive.
- No `MULTI_TURN_REDUNDANCY` — s9 used the established `claude_code` project name
  from the "[Continuing from earlier]" preamble without re-asking.
- No `ADVERSARIAL_FAILURE` — s6 scored 10 (binary pass: skill_loaded false + useful
  redirect toward brain-compile).

## Recommendation
HEALTHY, with one caveat: re-run in full mode (3 reps on the 5 trigger-type
scenarios, both sides) before fully retiring stability/regression monitoring —
this smoke run validated correctness at n=1 but not flakiness or baseline delta.
No `refine-input.json` written; no metric is below threshold.
