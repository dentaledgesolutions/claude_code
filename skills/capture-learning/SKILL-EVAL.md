# Skill Eval: capture-learning
**Date:** 2026-07-15  **Iteration:** 1  **Evaluator:** skill-eval-agent (custom smoke recipe)

**Scope note:** This run used the 9 EXISTING hand-authored scenarios at
`evals/capture-learning/evals.json` (not regenerated). Per explicit recipe:
1 rep per scenario (smoke mode, not the standard 3-rep trigger protocol),
sequential dispatch at peak concurrency ≤2, discriminating scenarios (s4
negative, s6 adversarial) run first with immediate evidence capture. Only the
`with_skill` side was probed — no baseline/`without_skill` pairing was run, so
`run-manifest.js status` correctly flags "expected 2 side dirs, found 1" for
every scenario; this is the intended shape of this recipe, not a gap.
Baseline delta is therefore not computed this iteration.

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5, 1 rep/type — see note) | ≥ 85% | PASS* |
| Context Footprint | 31 lines / ~124t | — | — |
| Project Fit Score | 10.0/10 (s7, s8, s9 ProjectFit) | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1 adversarial scored >0) | ≥ 8 | PASS |

\* Trigger accuracy here is computed from 5 trigger-type checks (direct,
paraphrased, semantic, negative, adversarial), each run once — per the
explicit smoke-mode recipe, not the standard 3-rep protocol. Treat as a
directional signal; a full 3-rep run is recommended before treating this as
final confirmation of stability (no UNSTABLE flag can be raised from n=1).

## Scenario Results
| ID | Type | skill_loaded (expected→found) | Workflow Steps | Composite | Flag |
|----|------|-------------------------------|-----------------|-----------|------|
| 1 | direct | true→true ✓ | 4/4 satisfied | 9.85 | — |
| 2 | paraphrased | true→true ✓ | 3/3 satisfied | 9.85 | — |
| 3 | edge_case | true→true ✓ | 3/3 satisfied (drafted, presented, did NOT write) | 9.85 | — |
| 4 | negative | false→false ✓ | n/a (0 steps expected) | 9.7 | — |
| 5 | semantic | true→true ✓ | 3/3 satisfied | 9.85 | — |
| 6 | adversarial | false→false ✓ | n/a (0 steps expected) | 10.0 (binary) | — |
| 7 | project-native | true→true ✓ | 3/3 satisfied | 9.9 | — |
| 8 | project-workflow | true→true ✓ | 4/4 satisfied | 9.9 | — |
| 9 | multi-turn | true→true ✓ | 2/2 satisfied, no re-ask | 10.0 | — |

All 9 `skill_loaded` decisions matched the scenario's expected value exactly
(read from `evidence.json`, never from subagent self-reports). No scenario
needed the "negated-prose false-positive" check called out in the task —
in s4 and s6 the `Skill(capture-learning)` token was entirely absent from
`output.md` (`grep -c` returned 0/no match), not merely present-but-negated,
so `found:false` is a clean true negative in both cases.

## Analyst Observations
- **No non-discriminating scenarios** — all scenarios showed a clear
  true/false split matching expectations; the two discriminating probes
  (s4 conceptual question, s6 routine-decision adversarial) both correctly
  produced `skill_loaded:false`, confirming the skill's "Not for:" boundary
  (brain-capture's routine-decision territory) holds under an explicit
  adversarial nudge ("nothing dramatic, just want it on record").
- **No UNSTABLE flag possible** — this smoke run used 1 rep per scenario by
  design; UNSTABLE detection (1/3 or 2/3 trigger reps) requires the standard
  3-rep protocol, not run here.
- **No REGRESSION** — no prior baseline exists for this skill (first eval),
  so no delta was computed.
- **No ADVERSARIAL_FAILURE** — s6 scored a clean 10 (binary), skill correctly
  declined.
- **No MULTI_TURN_REDUNDANCY** — s9 proceeded straight to the described
  `brain-capture.js`/`brain-compile` write without re-invoking
  `AskUserQuestion` or re-drafting; the "already approved" continuation
  framing was honored.
- **Edge case (s3) worked correctly**: the skill drafted and presented the
  learning but explicitly did not describe a `brain-capture.js` invocation
  in this turn, honoring "zero writes before confirmation" even when the
  user's phrasing ("I want final say") could be misread as a soft nudge to
  proceed.
- **Recommendation for follow-up**: run the standard 3-rep trigger protocol
  (direct/paraphrased/semantic/negative/adversarial ×3) before fully retiring
  this skill from the refine queue, to rule out flakiness this smoke run
  cannot detect at n=1.

## Recommendation
HEALTHY (smoke-mode confidence). All 5 metrics pass threshold on this
9-scenario, 1-rep-per-scenario run. No `refine-input.json` written — no
metric failed.
