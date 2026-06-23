# Skill Eval: skill-refine
**Date:** 2026-06-23
**Skill version:** local (main branch)
**Scenarios run:** 9 (types 1–9; trigger-type scenarios ×3 reps each)
**Baseline:** no-skill (new eval — no prior SKILL-EVAL.md)

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 89% | ≥ 80% | PASS |
| Trigger Accuracy | 93% | ≥ 85% | PASS |
| Context Footprint | 73 lines / ~292 tokens | — | OK |
| Project Fit Score | 8.0/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 | ≥ 8 | PASS |

## Scenario Results

| # | Name | Type | Trigger (reps) | Score | Baseline delta | Notes |
|---|------|------|----------------|-------|----------------|-------|
| 1 | direct-refine-skill | direct | 3/3 ✓ | 9/10 | +5 pts | "Refine the skill-adapt skill" triggers; backup created, baseline loaded, loop begins |
| 2 | paraphrased-improve-skill | paraphrased | 3/3 ✓ | 8/10 | +4 pts | "Improve skill-eval pass rate" triggers; failing scenarios loaded from refine-input.json |
| 3 | edge-case-pass-rate-below | edge_case | 1/1 ✓ | 8/10 | +4 pts | "Skill eval pass rate is 72%, what do I do?" triggers; routing step 3 engaged correctly |
| 4 | negative-explain-autoresearch | negative | 0/3 ✓ | 10/10 | n/a | "What is Karpathy's autoresearch loop?" answered conversationally; no refinement workflow launched |
| 5 | semantic-optimize-skill | semantic | 2/3 ✗ | 6/10 | +2 pts | "Optimize skill-audit for better trigger accuracy" — triggered 2/3 reps. "Optimize" not in description. Flaky. |
| 6 | adversarial-refine-prompt | adversarial | 0/3 ✓ | 10/10 | n/a | "Help me refine my prompt for writing emails" correctly not triggered; skill-refine is for Claude Code skills, not general prompts. Binary score. |
| 7 | project-native-refine-for-claude-code | project-native | 1/1 ✓ | 9/10 | +5 pts | Uses "claude_code", "evals/skill-adapt/refine-input.json", "SKILL.md.baseline"; lever routing matches project's installed skills |
| 8 | project-workflow-after-skill-eval | project-workflow | 1/1 ✓ | 8/10 | +4 pts | "After skill-eval, now refine" triggers; refine-input.json loaded; train/test split applied; final validation invokes skill-eval |
| 9 | multi-turn-resume-refine | multi-turn | 1/1 ✓ | 8/10 | +3 pts | Resumes from iteration 2 without re-asking skill name, baseline score, or budget; proceeds to step 5 (hypothesis) directly |

**Scoring formulas applied:**
- Base scenarios (1–6): `(Trigger × 0.4) + (Checklist × 0.3) + (Output × 0.3)`
- Project scenarios (7–9): `(Trigger × 0.35) + (Checklist × 0.25) + (Output × 0.25) + (ProjectFit × 0.15)`
- Adversarial (6): binary 10/0

**Eval Pass Rate:** scenarios ≥ 7: 1(9), 2(8), 3(8), 4(10), 6(10), 7(9), 8(8), 9(8) = 8 pass. Scenario 5 (6) = 1 fail. 8/9 = **89%**
**Trigger Accuracy:** 15 trigger checks. Scenario 5 missed 1/3 reps → 14/15 correct → **93%**
**Project Fit Score:** avg(9 + 8 + 8) = 8.33 → **8.0/10** after dimension weighting
**Resilience Score:** 1 adversarial scenario, 3/3 correctly not triggered → **10/10**

## Analyst Observations

- Non-discriminating: None. No-skill baseline produces informal "I'll try to improve this" with no backup, no lever routing, no keep/revert logic, no SKILL-REFINE-LOG.md — high value delta.
- Flaky triggers: Scenario 5 (semantic-optimize-skill) triggered 2/3 reps. "Optimize" is not in the description; similar to skill-adapt's "rewrite" flakiness. The pattern is consistent across skills that use general improvement verbs not listed in descriptions. FLAKY — needs Lever A treatment if refine is invoked.
- Baseline delta summary: Skill adds structured Karpathy loop with lever routing, train/test split, and keep/revert logic that no-skill entirely lacks; delta is consistently +4–5 pts on workflow scenarios.
- Project terminology mismatch: None. Scenario 7 correctly referenced evals/skill-adapt/refine-input.json, SKILL.md.baseline, and lever table from REFERENCE.md.
- Ecosystem conflicts: None. Final validation correctly invokes skill-eval rather than implementing its own eval — this is the correct inter-skill dependency.
- Adversarial failures: None. "Refine my email prompt" correctly stayed out of scope.
- Multi-turn redundancy: None. Scenario 9 resumed iteration 2 without any redundant clarifying questions.
- The "optimize" flakiness in scenario 5 is the same symptom seen in skill-adapt scenario 5 ("rewrite"). This is a cross-skill pattern: general improvement synonyms (optimize, rewrite, tune) are not in descriptions, causing inconsistent triggering. Worth noting in PROJECT-SKILL-HEALTH.md as a systemic pattern.

## Issues Found

- **Scenario 5 (semantic-optimize-skill):** scored 6/10. Triggered 2/3 reps; "optimize" not in description. Root cause: description covers "refining", "improving", "autoresearch" but not "optimizing" or "tuning". Lever A candidate: add "optimizing a skill" and "tuning" to trigger phrases.

## Recommendation

HEALTHY

## Next step

None. All thresholds met (eval_pass_rate 89% ≥ 80%, trigger_accuracy 93% ≥ 85%, resilience 10/10, fit 8.0/10). The scenario 5 flakiness on "optimize" is noted but does not cross a threshold. Address in next refinement cycle if needed — add "optimizing" to description as Lever A.
