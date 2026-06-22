# Skill Eval: <skill-name>
**Date:** YYYY-MM-DD  
**Skill version:** <commit hash or "local">  
**Scenarios run:** N (trigger-type ×3 reps; non-trigger ×1)
**Baseline:** no-skill | snapshot of previous version

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | XX% | ≥ 80% | PASS / FAIL |
| Trigger Accuracy | XX% | ≥ 85% | PASS / FAIL |
| Context Footprint | XX lines / ~XX tokens | — | OK / HIGH |
| Project Fit Score | X.X/10 | ≥ 7 | PASS / FAIL / N/A |
| Resilience Score | X.X/10 | ≥ 8 | PASS / BROADEN / N/A |

## Scenario Results

| # | Name | Type | Trigger (reps) | Score | Baseline delta | Notes |
|---|------|------|----------------|-------|----------------|-------|
| 1 | direct-primary | direct | 3/3 ✓ | 9/10 | +4 pts | |
| 2 | negative-describe | negative | 0/3 ✓ | 10/10 | n/a | |
| 6 | adversarial-wrong-scope | adversarial | 0/3 ✓ | 10/10 | n/a | Binary score |
| 9 | multi-turn-resumed | multi-turn | 1/1 ✓ | — | — | |

## Analyst Observations

- Non-discriminating: (list any)
- Flaky triggers: (list any)
- Baseline delta summary: (one sentence)
- Project terminology mismatch: (list any)
- Ecosystem conflicts: (list any)
- Adversarial failures: (list any — ADVERSARIAL_FAILURE flag → Lever A)
- Multi-turn redundancy: (list any — MULTI_TURN_REDUNDANCY flag → Lever B)

## Issues Found

(list scenarios scoring < 7, with root cause)

## Recommendation

HEALTHY / REFINE / REWRITE / RE-ADAPT

## Next step

(none | invoke skill-refine with evals/<skill-name>/refine-input.json)
