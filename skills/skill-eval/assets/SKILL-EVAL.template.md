# Skill Eval: <skill-name>
**Date:** YYYY-MM-DD  
**Skill version:** <commit hash or "local">  
**Scenarios run:** N (×3 reps each)
**Baseline:** no-skill | snapshot of previous version

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | XX% | ≥ 80% | PASS / FAIL |
| Trigger Accuracy | XX% | ≥ 85% | PASS / FAIL |
| Context Footprint | XX lines / ~XX tokens | — | OK / HIGH |
| Project Fit Score | X/10 | ≥ 7 | PASS / FAIL / N/A |

## Scenario Results

| # | Name | Type | Trigger (3 reps) | Score | Baseline delta | Notes |
|---|------|------|-----------------|-------|----------------|-------|
| 1 | direct-primary | direct | 3/3 ✓ | 9/10 | +4 pts | |
| 2 | negative-describe | negative | 0/3 ✓ | 10/10 | n/a | |

## Analyst Observations

- Non-discriminating: (list any)
- Flaky triggers: (list any)
- Baseline delta summary: (one sentence)
- Project terminology mismatch: (list any)
- Ecosystem conflicts: (list any)

## Issues Found

(list scenarios scoring < 7, with root cause)

## Recommendation

HEALTHY / REFINE / REWRITE

## Next step

(none | invoke skill-refine with evals/<skill-name>/refine-input.json)
