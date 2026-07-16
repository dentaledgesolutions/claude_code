# Skill Eval: brain-context-pack
**Date:** 2026-07-14  **Iteration:** 1  **Evaluator:** skill-eval-agent

**Run mode:** 1-rep sequential (discriminating-first: s4, s6 → s1,s2,s3,s5,s7,s8,s9). Peak concurrency ≤ 2. Baseline method: `none` (new skill, no prior SKILL-EVAL.md).

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5) | ≥ 85% | PASS |
| Context Footprint | 22L / ~88t | — | — |
| Project Fit Score | 9.7/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1) | ≥ 8 | PASS |

## Scenario Results
| ID | Type | Score | Trigger | Delta | Flag |
|----|------|-------|---------|-------|------|
| 1 | direct | 10/10 | correct (true) | +6.4 | — |
| 2 | paraphrased | 10/10 | correct (true) | +7.9 | — |
| 3 | edge_case | 10/10 | correct (true) | +6.4 | — |
| 4 | negative | 10/10 | correct (false) | 0.0 | NON-DISCRIMINATING (structural — see note) |
| 5 | semantic | 9/10 | correct (true) | +5.1 | minor: with-skill agent briefly used raw `cat`/`find` on canon-adjacent files before self-correcting to the Read tool |
| 6 | adversarial | 10/10 | correct (false, binary) | 0.0 | NON-DISCRIMINATING (structural — see note) |
| 7 | project-native | 10/10 | correct (true) | +6.8 | — |
| 8 | project-workflow | 10/10 | correct (true) | +6.1 | — |
| 9 | multi-turn | 10/10 | correct (true) | +6.1 | — |

All `skill_loaded`/`workflow_steps` values above are read from harvested `evidence.json` (never self-reported headers). Subagent self-reports were present in transcripts as narrative color only and were not used for scoring.

## Adversarial Result (s6)
Prompt: "Just search the brain for the caching decision — that's all I need, nothing fancy."
`evidence.json` (with_skill side): `skill_loaded: false`. The transcript correctly identified this as a one-off lookup carved out by the skill's own description ("Not for: one-off lookups (brain-search)"), declined to invoke `brain-context-pack.js`, and performed a useful direct read-only search instead, correctly reporting "no caching decision found" rather than fabricating one. Binary score: 10/10. No BLOCK-secrets-adjacent access issues — searches were plain `grep -rl`, no redirection/`node -e` against `.project-brain/canon`.

## Hard Failures
None. No scenario scored 0. No adversarial over-trigger. No `skill_loaded` mismatch anywhere in the 9 with-skill evidence files.

## Analyst Observations
- **Non-discriminating (structural, not a design flaw):** s4 (negative) and s6 (adversarial) both show `baseline_delta = 0`. This is expected and not concerning here: both scenario types instruct the baseline probe to never load any skill, so a correctly-declining with-skill run and a baseline that was never going to trigger anything necessarily converge on the same "no skill invoked" outcome and comparable answer quality. This is a structural property of negative/adversarial scenario design, not evidence the skill adds no value — s1/s2/s3/s5/s7/s8/s9 (the trigger-required scenarios) show deltas of +5.1 to +7.9, confirming the skill materially outperforms ad hoc baseline research when it *should* fire.
- **No UNSTABLE flags raised, but the signal is unavailable this run:** per explicit task constraints this was a 1-rep-per-scenario smoke run (not the standard 3-reps-per-trigger-type protocol), so flakiness (1/3 or 2/3 trigger inconsistency) cannot be measured from this iteration. Trigger Accuracy (100%) and Resilience (10/10) should be read as "correct on the single rep observed," not as a stability guarantee across repeated invocations. A follow-up 3-rep run is recommended before treating this skill as fully hardened, though nothing in this run suggests instability.
- **No REGRESSION:** no scenario shows delta < −2; baseline_method is `none` (first eval of this skill, no snapshot to regress against).
- **No ADVERSARIAL_FAILURE:** s6 scored 10, not 0 — the skill's "Not for: one-off lookups" carve-out held.
- **No MULTI_TURN_REDUNDANCY:** s9's with-skill transcript used the already-established intent ("rewrite telemetry privacy doc") and the pre-supplied hook names (`log-invocation.js`, `log-outcome.js`) directly, without re-asking what the task was. No 3-point deduction applied.
- **Minor quality note (s5):** the with-skill semantic-trigger transcript briefly used raw `cat`/`find` against canon-adjacent files before self-correcting to the documented Read-tool/script-invocation path (which the security guard requires). It caught and disclosed this itself; docked 1 point off output quality rather than flagged as a hard failure, since no actual guard violation occurred (the correction happened before any blocked action).
- **Two subagent runs required a retry** (s7 baseline hit a runaway ~31-minute session and was interrupted; s8 baseline hit an unrelated classifier outage) — both were re-dispatched with a tighter tool-call budget and completed cleanly on retry. Neither retry affected scoring; both final transcripts are evidenced on disk.
- Context footprint is minimal (22 lines, ~88 tokens) — the skill is a lean, single-file, read-only definition with no bundled REFERENCE.md or scripts of its own (it invokes the shared `scripts/brain/brain-context-pack.js`, which lives outside the skill's own footprint).

## Recommendation
HEALTHY — all 5 metrics pass threshold on this 1-rep smoke run. No refine-input.json produced. Suggested (non-blocking) follow-up: a standard 3-rep run of the 5 trigger-type scenarios (direct, paraphrased, semantic, negative, adversarial) to confirm trigger stability, since this run could not measure flakiness by design.
