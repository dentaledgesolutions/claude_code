# Skill Eval: reference-repo-add
**Date:** 2026-07-15  **Iteration:** 1  **Evaluator:** skill-eval-agent
**Mode:** smoke (1 rep/scenario, sequential, peak concurrency ≤ 2) — hand-authored scenarios from `evals/reference-repo-add/evals.json`, no regeneration. **Baseline:** none dispatched (with-skill only, per recipe) — no baseline_delta column.

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5 correct, 1 rep each — smoke mode) | ≥ 85% | PASS |
| Context Footprint | 36L / ~144t (SKILL.md only, no bundled files) | — | — |
| Project Fit Score | 10.0/10 | ≥ 7 | PASS |
| Resilience Score | 10.0/10 (1/1 adversarial scored >0) | ≥ 8 | PASS |

## Scenario Results
| ID | Type | Score | Trigger (evidence.json) | Flag |
|----|------|-------|--------------------------|------|
| s1 | direct | 10.0 | skill_loaded: true (correct) | — |
| s2 | paraphrased | 10.0 | skill_loaded: true (correct) | — |
| s3 | edge_case | 10.0 | skill_loaded: true (correct) | — |
| s4 | negative | 10.0 | skill_loaded: false (correct) | — |
| s5 | semantic | 10.0 | skill_loaded: true (correct) | — |
| s6 | adversarial | 10.0 | skill_loaded: false (correct) | — |
| s7 | project-native | 10.0 | skill_loaded: true (correct) | — |
| s8 | project-workflow | 10.0 | skill_loaded: true (correct) | — |
| s9 | multi-turn | 10.0 | skill_loaded: true (correct), no re-ask penalty | — |

## Analyst Observations
- **Discriminating scenarios (run first, per recipe):** s4 (negative "what's tracked" rundown) and s6 (adversarial "install into skills dir") both correctly produced `skill_loaded: false`. Grep of both `output.md` transcripts for the literal `Skill(` token returned zero matches — no accidental marker in negated prose either, so the CRITICAL grading edge (real invocation vs. negated-prose mention) did not arise as a scoring ambiguity in this run.
- **Governance boundary (s6) held correctly:** the skill's own "Not for" clause and the project's do-not-install-directly hard rule were both cited; the transcript redirected to skill-scout → skill-audit → skill-adapt → skill-eval rather than registering or installing anything. No `ADVERSARIAL_FAILURE`.
- **Bundled valid+invalid request (s3) split correctly:** registration proceeded, the clone-locally half was explicitly refused with reasoning stated in-transcript (not silently dropped) — matches all 3 judgment criteria.
- **Multi-turn (s9):** no re-ask of name/url/types already established in the "[Continuing from earlier]" preamble — verified by grep for re-ask phrasing (zero matches). No `MULTI_TURN_REDUNDANCY` deduction.
- **Real-artifact verification, not self-report:** every with-skill subagent ran the actual `scripts/brain/brain-reference-repo-add.js` / `brain-reference-repo-audit.js` against a sandboxed `--root`, not a simulation, and `git status --short reference-repositories/ .claude/agents/` was independently re-verified clean after each of the 9 runs — the real project registry was never touched by any scenario.
- **Non-discriminating check:** not applicable — no baseline pairs were dispatched in this smoke run (recipe specifies with-skill only), so `baseline_delta` is not computed this iteration. If a full-mode eval is later run with baseline pairs, re-check for `|baseline_delta| < 0.5` flags.
- **No UNSTABLE flags possible:** trigger-type scenarios ran 1 rep each per the smoke recipe (not the standard 3 reps), so flakiness (1/3 or 2/3) cannot be assessed from this run. A `--mode full` (3-rep) pass would be needed to rule out description-level flakiness.
- Context footprint is minimal — SKILL.md only (36 lines, no bundled scripts/references in the skill directory itself; it calls out to the project's shared `scripts/brain/` scripts, which are not part of the skill's own footprint).

## Recommendation
HEALTHY — all 5 metrics pass threshold on this smoke-mode, with-skill-only run. Both discriminating (non-trigger) probes correctly declined; all 7 positive scenarios triggered with full workflow-step completion and correct project terminology. No refine-input.json produced (no failing metrics). Recommend a `--mode full` 3-rep run in a future iteration to confirm trigger-type stability before treating this as fully converged.
