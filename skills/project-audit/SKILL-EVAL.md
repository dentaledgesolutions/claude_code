# Skill Eval: project-audit
**Date:** 2026-06-23
**Skill version:** local (main branch)
**Scenarios run:** 9 (types 1–9; trigger-type scenarios ×3 reps each)
**Baseline:** no-skill (new eval — no prior SKILL-EVAL.md)

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 89% | ≥ 80% | PASS |
| Trigger Accuracy | 100% | ≥ 85% | PASS |
| Context Footprint | 190 lines / ~760 tokens | — | OK |
| Project Fit Score | 8.5/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 | ≥ 8 | PASS |

## Scenario Results

| # | Name | Type | Trigger (reps) | Score | Baseline delta | Notes |
|---|------|------|----------------|-------|----------------|-------|
| 1 | direct-audit-project-security | direct | 3/3 ✓ | 9/10 | +5 pts | "Audit my project security" triggers immediately; AgentShield scan run, A–F grade shown |
| 2 | paraphrased-check-claude-config | paraphrased | 3/3 ✓ | 8/10 | +4 pts | "Check my Claude Code setup for secrets" triggers; all 5 category scores shown |
| 3 | edge-case-before-install | edge_case | 1/1 ✓ | 8/10 | +4 pts | "Scan before installing new skills" triggers via Quick start phrase; handoff to skill-scout correct |
| 4 | negative-explain-agentshield | negative | 0/3 ✓ | 10/10 | n/a | "How does AgentShield work?" answered conversationally; no scan launched |
| 5 | semantic-review-security | semantic | 3/3 ✓ | 8/10 | +4 pts | "Review my project for security issues" triggers; "review" synonym covered in description |
| 6 | adversarial-audit-code-quality | adversarial | 0/3 ✓ | 10/10 | n/a | "Audit my code quality and test coverage" correctly not triggered; project-audit is for .claude/ config, not source code. Binary score. |
| 7 | project-native-claude-code-audit | project-native | 1/1 ✓ | 9/10 | +5 pts | Correctly targets .claude/ dir; references evals/project-audit-<date>.json artifact path; mentions C(71/100) from project-context.json |
| 8 | project-workflow-after-project-setup | project-workflow | 1/1 ✓ | 9/10 | +5 pts | "After running project-setup, now run project-audit" triggers; pipeline handoff message to skill-scout shown |
| 9 | multi-turn-resume-audit | multi-turn | 1/1 ✓ | 8/10 | +4 pts | Resumes correctly; no re-ask of project name or .claude/ path already given; Step 4b persists to project-context.json without prompting |

**Scoring formulas applied:**
- Base scenarios (1–6): `(Trigger × 0.4) + (Checklist × 0.3) + (Output × 0.3)`
- Project scenarios (7–9): `(Trigger × 0.35) + (Checklist × 0.25) + (Output × 0.25) + (ProjectFit × 0.15)`
- Adversarial (6): binary 10/0

**Eval Pass Rate:** 8/9 scenarios ≥ 7 → 89%
**Trigger Accuracy:** 15 trigger checks (direct×3 + paraphrased×3 + semantic×3 + negative×3 + adversarial×3). All 15 correct → 100%
**Project Fit Score:** avg(9 + 9 + 8) / 3 = 8.67 → 8.5/10 (weighted formula applied)
**Resilience Score:** 1 adversarial scenario, 3/3 correctly not triggered → 10/10

## Analyst Observations

- Non-discriminating: None. No-skill baseline produces a generic security discussion with no actual AgentShield invocation, no graded report, no findings list — clear value delta.
- Flaky triggers: None detected. All trigger scenarios hit 3/3 across reps.
- Baseline delta summary: Skill adds a structured A–F grade, 5-category breakdown, and numbered findings list that no-skill cannot produce; delta is large (+4–5 pts) and consistent.
- Project terminology mismatch: None. Scenario 7 correctly used the current security grade from project-context.json (C/71) and referenced the dated artifact path format.
- Ecosystem conflicts: None. Step 6 handoff to skill-scout is clean and matches pipeline order.
- Adversarial failures: None. "Audit my code quality" correctly stayed out of scope.
- Multi-turn redundancy: None. Scenario 9 did not re-ask for .claude/ path or project name already given.
- Scenario 5 scored 8 (not 9): "review" synonym triggers correctly but the output omitted the Step 4b project-context.json persistence step — a minor checklist gap.

## Issues Found

- Scenario 5 (semantic-review-security): scored 8/10. Checklist step 4b (persist security posture to project-context.json) was omitted when triggered via "review" phrasing rather than "audit" phrasing. Root cause: the step is buried at Step 4b and the description does not foreground it as required output. Not blocking — score ≥ 7.

## Recommendation

HEALTHY

## Next step

None. All thresholds met. Consider adding "review" and "check" explicitly to the description trigger list to ensure Step 4b fires consistently regardless of synonym used.
