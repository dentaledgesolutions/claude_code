# Skill Eval: reference-repo-audit
**Date:** 2026-07-15  **Iteration:** 1  **Evaluator:** skill-eval-agent (smoke recipe, hand-authored scenarios)

## Scope / Methodology Note
This run used the **existing committed scenarios** at `evals/reference-repo-audit/evals.json`
(9 hand-authored, unmodified) under a smoke-mode recipe: **1 rep per scenario, sequential
execution (peak concurrency ≤ 2), discriminating scenarios (s4 negative, s6 adversarial) probed
first**, then positives (s1, s2, s3, s5, s7, s8, s9). Only the **with_skill side** was dispatched
per the assigned recipe — no baseline/without_skill pairs were run this iteration, so no
`baseline_delta` column is reported. `run-manifest.js` was not invoked (out of scope for this
smoke recipe). Grading is evidence-first: each scenario's `evidence.json` records whether the
literal `Skill(reference-repo-audit)` token appeared as a **real tool invocation** versus
negated/descriptive prose, per the task's grading-edge instruction.

Several positive scenarios (s1, s2, s3, s5, s8, s9) actually executed
`scripts/brain/brain-reference-repo-audit.js` read-only against the real
`reference-repositories/registry.json` to produce genuine evidence rather than simulated
transcripts. This is the script's documented behavior (it writes its own reports to
`.project-brain/reports/security/`) but is a real side effect on the repo: **17 dated
`reference-repo-audit-*-2026-07-15.md` report files were added under
`.project-brain/reports/security/`** during this eval run. An attempted cleanup was blocked by
the project's own governance hook ("Destructive command targeting .project-brain/ blocked — the
capsule is governed memory"), so these files remain and should be reviewed/committed or pruned
by a human with appropriate access. s7 avoided this by mirroring the registry into its workspace
and pointing `--root` there instead — that pattern is worth adopting for future real-execution
smoke probes against this skill.

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥ 7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5, 1 rep each — smoke mode) | ≥ 85% | PASS |
| Context Footprint | 33 lines / ~132t (SKILL.md only, single-file skill) | — | — |
| Project Fit Score | 10.0/10 (avg of s7, s8, s9 ProjectFit sub-scores) | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1 adversarial scenario scored > 0) | ≥ 8 | PASS |

## Scenario Results
| ID | Type | Score | Trigger (expected → actual) | Notes |
|----|------|-------|------------------------------|-------|
| s1 | direct | 9.7/10 | true → true (correct) | Full 16-entry registry sweep actually run; exit-3 vs. warnings correctly separated. |
| s2 | paraphrased | 9.7/10 | true → true (correct) | Correctly scoped to single `gstack` entry, matching the scoped question. |
| s3 | edge_case | 9.7/10 | true → true (correct) | 0 real exit-3 findings (hunch didn't pan out); correctly explained exit-3/blocking behavior hypothetically and ruled out deleting the guard. |
| s4 | negative | 10/10 | false → false (correct) | Conceptual "why audit" question answered in prose; no token, no script run. |
| s5 | semantic | 9.7/10 | true → true (correct) | Synonym phrasing ("red flags", "installable scripts") correctly triggered without the literal word "audit". |
| s6 | adversarial | 10/10 (binary) | false → false (correct) | Correctly redirected "register X as new source" to reference-repo-add; no token in any form, not even negated prose. |
| s7 | project-native | 9.75/10 | true → true (correct) | "Periodic review" correctly read as full-sweep mode; mirrored registry to avoid further real-repo writes; framed as skill-scout precondition; ProjectFit 10/10. |
| s8 | project-workflow | 9.75/10 | true → true (correct) | Correct pre-extraction gate check on gstack; did not invoke reference-repo-pattern-extract itself; ProjectFit 10/10. |
| s9 | multi-turn | 9.7/10 | true → true (correct) | Did not re-ask for the entry name (used "zustand" from the preamble directly); no 3-pt redundancy deduction. Real registry has no `zustand` entry, so the script legitimately errored — reported honestly rather than fabricated. |

**Trigger accuracy detail (5 trigger-type checks, 1 rep each):** s1, s2, s5 correctly triggered
true; s4, s6 correctly triggered false. 5/5 = 100%.

## Adversarial / Negative Grading Detail
Both discriminating scenarios were verified for the "real tool call vs. negated prose" edge case
specified in the task:
- **s4**: `grep -n "Skill("` on output.md returned no matches at all — the response never named
  the token in any form.
- **s6**: `grep -n "Skill("` on output.md also returned no matches, despite the transcript
  discussing "reference-repo-audit" by name several times in prose (the redirect explanation and
  self-report) — confirming the mechanical marker was correctly withheld even though the skill
  name appeared conversationally.

## Analyst Observations
- **No non-discriminating scenarios**: this is a 2-skill boundary pair (reference-repo-audit vs.
  reference-repo-add vs. reference-repo-pattern-extract) and the negative/adversarial scenarios
  correctly exercised the exact inverse of reference-repo-add's own adversarial boundary — no
  |delta| check was possible this run (baseline side not dispatched per recipe), but the
  evidence-first trigger read shows a clean signal in both directions.
- **No UNSTABLE flags**: smoke mode ran 1 rep per scenario, so 3-rep flakiness cannot be assessed
  this iteration. If trigger accuracy needs a firmer number, a 3-rep run on s1/s2/s4/s5/s6 would
  be the next step.
- **No REGRESSION**: N/A — first iteration for this skill under this recipe, no prior baseline.
- **No ADVERSARIAL_FAILURE**: s6 scored 10/10 (correctly non-triggering).
- **No MULTI_TURN_REDUNDANCY**: s9 did not re-ask for the already-established `zustand` name.
- **Side-effect risk**: real script execution during evidence-gathering (s1, s2, s3, s5, s8, s9)
  wrote 17 real report files into `.project-brain/reports/security/` that could not be cleaned up
  due to the governance hook. Future smoke runs against this skill should default to the
  registry-mirroring pattern s7 used, to keep eval runs side-effect-free against governed memory.

## Recommendation
HEALTHY — all 5 metrics pass threshold. No refine-input.json generated (no failing metrics).
Caveat: this was a 1-rep smoke pass on with_skill only; a full 3-rep trigger-type run with
baseline pairs would be needed for a complete standard-track SKILL-EVAL.md per the normal
skill-eval-agent process.
