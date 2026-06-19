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
| `project-native` | Uses project-specific terminology, stack, and artifact paths | `"evaluate skill-adapt for our Next.js/GSD project — outputs go in .planning/"` |
| `project-workflow` | Tests skill within the context of the project's installed skill ecosystem | `"After running skill-audit, now evaluate skill-adapt"` |

The first 5 types are always generated. `project-native` and `project-workflow` require `--context evals/project-context.json`.

Run each scenario 3 times. A stable skill triggers consistently; a flaky one triggers 1–2 out of 3.

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

### Dimension 4: Project Fit (0–10) — project-native and project-workflow scenarios only
- Output uses project-specific terminology correctly → 4 pts
- Output references the correct project artifact paths → 3 pts
- Output aligns with the project's installed skill ecosystem (no conflicts, correct handoffs) → 3 pts

**Base scenario score = (Trigger × 0.4) + (Checklist × 0.3) + (Output × 0.3)**  
**Project scenario score = (Trigger × 0.35) + (Checklist × 0.25) + (Output × 0.25) + (ProjectFit × 0.15)**  
**Project Fit Score** = average of Dimension 4 scores across project-native + project-workflow scenarios.

Trigger accuracy is weighted highest — a skill nobody triggers correctly has no value regardless of execution quality. Project Fit Score below 7 means skill-adapt should be re-run with richer project context before proceeding.

---

## Analyst Pass Checklist

After grading all runs, check for:

- [ ] **Non-discriminating assertions** — scenarios that pass both with-skill and without-skill (skill adds no value here)
- [ ] **Flaky triggers** — scenarios that triggered in 1 or 2 out of 3 reps (description is unstable)
- [ ] **Baseline delta** — is the with-skill output meaningfully better than no-skill? If not, the skill may be redundant
- [ ] **Token cost vs. benefit** — high context footprint skills should show proportionally larger baseline delta
- [ ] **Project terminology mismatch** — project-native scenario triggered but output used generic language instead of project terms
- [ ] **Ecosystem conflict** — project-workflow scenario shows skill duplicating or contradicting output from a sibling skill
- [ ] **Missing artifact references** — output doesn't reference project paths (`.planning/`, `CLAUDE.md`, etc.) that it should know about

---

## SKILL-EVAL.md Template

> Standalone file: `skills/skill-eval/assets/SKILL-EVAL.template.md`

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
