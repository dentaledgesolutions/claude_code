# Skill Eval: brain-weekly-review
**Date:** 2026-07-15  **Iteration:** 1  **Evaluator:** skill-eval-agent (custom recipe: smoke mode, 1 rep/scenario, sequential, peak concurrency ≤2, with-skill only — no baseline dispatch)

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5) | ≥ 85% | PASS |
| Context Footprint | S / ~128t (32 lines × 4) | — | — |
| Project Fit Score | 9.3/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1 adversarial >0) | ≥ 8 | PASS |

Trigger Accuracy covers the 5 trigger-type scenarios (direct, paraphrased, semantic, negative, adversarial) at 1 rep each per the smoke-mode recipe, not the standard 3-rep/15-check protocol — treat this as a directional signal, not a full-stability read. All 5 checks correct on this pass.

## Scenario Results
| ID | Type | Score | Trigger (skill_loaded) | Correct? | Flag |
|----|------|-------|------------------------|----------|------|
| 1 | direct | 10 | true | yes | — |
| 2 | paraphrased | 9 | true | yes | — |
| 3 | edge_case | 10 | true | yes | — |
| 4 | negative | 10 | false | yes | — |
| 5 | semantic | 10 | true | yes | — |
| 6 | adversarial | 10 | false | yes | — |
| 7 | project-native | 9 | true | yes | — |
| 8 | project-workflow | 9 | true | yes | — |
| 9 | multi-turn | 10 | true | yes | — |

No baseline was dispatched per this evaluation's recipe (with-skill probes only), so no baseline-delta column is populated; all scores above are the with-skill composite grades against evals.json's `expected.judgment` criteria and evidence.json's harvested `skill_loaded`/`workflow_steps`.

## Analyst Observations

- **Discriminating scenarios confirmed the skill's boundary is well-drawn.** s4 (cadence-explanation question) and s6 (adversarial promote-to-canon request) both correctly produced `skill_loaded: false` with no occurrence of the `Skill(brain-weekly-review)` token anywhere in the transcript — not even in negated prose that could false-positive a naive substring check. s6 in particular gave a substantive, useful redirect to brain-promote rather than a bare refusal.
- **Delta-only discipline held under both routine and adversarial framing.** Across every triggering scenario (s1, s2, s3, s5, s7, s8, s9), the skill consistently: scanned via brain-lint.js before asking anything, made status-field-only edits (never structural rewrites), never touched `decisions/candidates/` or `canon/`, and correctly handed off promotion-worthy items to brain-promote instead of acting on them.
- **s3 (edge_case) showed strong judgment**: the user's imprecise "several items are stale" claim was checked against the real lint output (which found exactly 1), and the discrepancy was explicitly called out rather than silently trusted — exactly the behavior the scenario's judgment criteria test for.
- **s9 (multi-turn) avoided the redundancy failure mode cleanly**: it did not re-run brain-lint.js and did not re-ask "still accurate, changed, or superseded?" for the item whose verdict was already established in the simulated prior turn — no 3-point deduction applies.
- **Non-discriminating check**: not applicable this run — no baseline was dispatched, so |baseline_delta| could not be computed. If a future iteration needs a baseline-delta read, dispatch the `without_skill` side per the standard skill-eval-agent protocol.
- **UNSTABLE check**: not applicable at 1 rep/scenario — stability (1/3 or 2/3 firing) cannot be assessed from smoke mode. Recommend a full 3-rep pass before treating trigger accuracy as final.
- **PROCESS OBSERVATION (not a skill defect, informational only)**: two independent with-skill subagents (s7, s8) each produced a stray, content-empty (0 findings/0 warnings) real-repo file at `.project-brain/reports/lint/<date>.md` despite operating against a `--target`-pinned sandbox. s8's transcript root-caused this: `hooks/brain/brain-post-lint.sh` (a repo PostToolUse hook) matches on the substring `.project-brain/` in any Edit/Write `file_path` — including nested sandbox paths like `evals/.../workspace/.project-brain/...` — and re-runs `brain-lint.js` against the *real* root `.project-brain/` as a side effect, not the subagent's target. No content in the real capsule's `BRAIN.md`, `decisions/`, or `canon/` was altered (confirmed via `git status`/diff and cross-checked by a second independent subagent); the artifact is untracked, matches the exact empty-report shape already present for every prior day back to 2026-07-09, and a subagent's attempt to clean it up was correctly blocked by write-guard hooks protecting the real capsule. This is a path-matching gap in `hooks/brain/brain-post-lint.sh` (too broad — doesn't anchor to repo root), not a brain-weekly-review workflow defect. Recommend a follow-up fix to the hook's path matcher, tracked separately from this skill's own refine loop.

## Recommendation
HEALTHY — all 5 metrics pass threshold on this smoke-mode (1 rep) pass. The skill correctly triggers on direct/paraphrased/semantic phrasing, correctly declines on negative and adversarial (promotion-scope-confusion) prompts, and holds its delta-only/status-field-only/no-promotion hard rules consistently across routine, edge-case, project-native, project-workflow, and multi-turn framings.

Suggested (non-blocking) follow-ups:
1. Run a full 3-rep trigger-accuracy pass (standard skill-eval-agent protocol) before treating trigger accuracy as fully stable — this evaluation used 1 rep per trigger-type scenario by design.
2. File a fix for `hooks/brain/brain-post-lint.sh`'s path-matching (anchor to repo-root `.project-brain/`, not any path containing that substring) so future sandboxed evals of brain skills don't produce stray real-capsule report files.
