# Skill Eval Reference

## Scenario Types

Generate one of each type. Named evals are easier to track than "eval-0".

| Type | Description | Example |
|------|-------------|---------|
| `direct` | Exact trigger phrase from description | `"evaluate the skill-adapt skill"` |
| `paraphrased` | Same intent, different words | `"check how well skill-adapt is working"` |
| `edge_case` | Unusual but valid — starts mid-workflow or uses minimal input | `"I already adapted the skill, just run the checklist"` |
| `negative` | Should NOT trigger this skill | `"describe how skill-adapt works"` (explain, not invoke) |
| `semantic` | Synonym variation of the action verb | `"measure" / "benchmark" / "test"` for "evaluate" |

Run each scenario 3 times. A stable skill triggers consistently across all 3 reps; a flaky one triggers 1–2 out of 3.

---

## Eval File Format (`evals.json`)

```json
{
  "skill_name": "<skill-name>",
  "generated_from": "<SKILL.md path>",
  "evals": [
    {
      "id": 1,
      "eval_name": "direct-primary-trigger",
      "type": "direct",
      "prompt": "evaluate the skill-adapt skill",
      "expected": {
        "triggers": true,
        "assertions": [
          "Loads skill SKILL.md",
          "Generates at least 5 test scenarios",
          "Reports eval pass rate as a percentage"
        ]
      }
    },
    {
      "id": 2,
      "eval_name": "negative-describe-only",
      "type": "negative",
      "prompt": "describe how skill-adapt works",
      "expected": {
        "triggers": false,
        "note": "Should answer conversationally without invoking the eval workflow"
      }
    }
  ]
}
```

---

## LLM Judge Rubric

Use a faster/cheaper model (e.g., Haiku) as judge. Evaluate each with-skill run on 3 dimensions.

### Dimension 1: Trigger Accuracy (0–10)
- Correct trigger decision (yes/no matches expected) → 10
- Triggered but with hesitation, or failed to trigger confidently → 5
- Triggered on a negative case, or failed on a direct case → 0

Check programmatically first: did the skill tool call appear in the transcript? Use LLM judgment only for borderline cases.

### Dimension 2: Checklist Completion (0–10)
Count numbered workflow steps in SKILL.md.  
Score = (steps completed correctly / total steps) × 10

### Dimension 3: Output Correctness (0–10)
Compare actual output against the `assertions` array in the eval:
- All assertions met → 10
- Minor omissions or imprecisions → 7–9
- Key elements missing → 4–6
- Wrong output → 0–3

**Scenario score = (Trigger × 0.4) + (Checklist × 0.3) + (Output × 0.3)**

Trigger accuracy is weighted highest — a skill nobody triggers correctly has no value regardless of execution quality.

---

## Analyst Pass Checklist

After grading all runs, check for:

- [ ] **Non-discriminating assertions** — scenarios that pass both with-skill and without-skill (the skill adds no measurable value for these)
- [ ] **Flaky triggers** — scenarios that triggered in 1 or 2 out of 3 reps (description is unstable)
- [ ] **Baseline delta** — is the with-skill output meaningfully better than no-skill? If not, the skill may be redundant for that scenario
- [ ] **Token cost vs. benefit** — high context footprint skills should show proportionally larger baseline delta

---

## SKILL-EVAL.md Template

```markdown
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

## Scenario Results

| # | Name | Type | Trigger (3 reps) | Score | Baseline delta | Notes |
|---|------|------|-----------------|-------|----------------|-------|
| 1 | direct-primary | direct | 3/3 ✓ | 9/10 | +4 pts | |
| 2 | negative-describe | negative | 0/3 ✓ | 10/10 | n/a | |

## Analyst Observations

- Non-discriminating: (list any)
- Flaky triggers: (list any)
- Baseline delta summary: (one sentence)

## Issues Found

(list scenarios scoring < 7, with root cause)

## Recommendation

HEALTHY / REFINE / REWRITE

## Next step

(none | invoke skill-refine with evals/<skill-name>/refine-input.json)
```

---

## Skill-Refine Handoff Format (`refine-input.json`)

Written when Eval Pass Rate < 80% or Trigger Accuracy < 85%.

```json
{
  "skill_name": "<skill-name>",
  "eval_date": "YYYY-MM-DD",
  "eval_pass_rate": 0.65,
  "trigger_accuracy": 0.78,
  "failing_scenarios": [
    {
      "eval_name": "paraphrased-reword",
      "type": "paraphrased",
      "score": 5,
      "root_cause": "Skill did not trigger on 'check how well' phrasing — description only lists 'evaluate' and 'measure'"
    }
  ],
  "analyst_observations": [
    "Flaky trigger on semantic-synonym (2/3 reps) — description missing synonym 'benchmark'",
    "Non-discriminating: edge_case scenario passes without skill"
  ]
}
```
