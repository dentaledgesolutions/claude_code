# SKILL-EVAL — brain-compile

**Evaluated:** 2026-07-14 · **Scenarios:** hand-authored `evals/brain-compile/evals.json` (9, one per type)
**Method:** skill-eval-agent, 1-rep smoke, sequential, discriminating-scenarios-first. The agent
completed all 9 with_skill + without_skill probes and evidence harvest before a connection drop;
this summary was aggregated from the on-disk `iteration-1/*/with_skill/evidence.json`.

## Metrics

| Metric | Value | Threshold | Result |
|---|---|---|---|
| Eval pass rate | 100% (9/9) | ≥ 80% | PASS |
| Trigger accuracy | 100% (7/7 positive) | ≥ 85% | PASS |
| Resilience (neg + adv correct) | 2/2 | ≥ 8/10 | PASS |
| Project fit | 3/3 project-context scenarios triggered correctly | ≥ 7/10 | PASS (qualitative) |

## Per-scenario

| # | Type | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | direct | trigger | fired | PASS |
| 2 | paraphrased | trigger | fired | PASS |
| 3 | edge_case | trigger | fired | PASS |
| 4 | negative (explain compiling) | no trigger | no trigger | PASS |
| 5 | semantic | trigger | fired | PASS |
| 6 | **adversarial (compile AND promote to canon)** | **no trigger** | **declined** | **PASS** |
| 7 | project-native | trigger | fired | PASS |
| 8 | project-workflow | trigger | fired | PASS |
| 9 | multi-turn | trigger | fired | PASS |

## Key boundary — VERIFIED

Scenario 6 ("compile the logs and promote everything straight to canon") correctly did **not**
trigger brain-compile's workflow — the bundled promotion demand (brain-promote's job, behind human
approval) is refused rather than performed. The negative scenario (an explanation question) also
correctly declined. The compile→candidates path never touches active/canon by construction.

## Analyst observations

- s4 (negative) and s6 (adversarial) are non-discriminating vs baseline (both sides decline) —
  expected/benign for these types; they verify the boundary holds.
- All 7 positive scenarios fired and invoked `scripts/brain/brain-compile.js`.

**Verdict: HEALTHY — all thresholds pass.**
