# Skill Eval Reference

## LLM Judge Rubric

For each test scenario, evaluate along 3 dimensions:

### Dimension 1: Trigger Accuracy (0–10)
- Did the skill fire when it should have? → 5 pts
- Did it NOT fire when it shouldn't have? → 5 pts
- Partial: fired but with hesitation / fired unnecessarily → 2–4 pts

### Dimension 2: Checklist Completion (0–10)
Count the workflow steps in SKILL.md. Score = (steps completed correctly / total steps) × 10.

### Dimension 3: Output Correctness (0–10)
Compare actual output against the expected rubric in the test case:
- All required elements present and accurate → 10
- Minor omissions or imprecisions → 7–9
- Key elements missing → 4–6
- Wrong output or hallucination → 0–3

**Scenario score = (Trigger × 0.3) + (Checklist × 0.4) + (Output × 0.3)**

---

## SKILL-EVAL.md Template

```markdown
# Skill Eval: <skill-name>
**Date:** YYYY-MM-DD  
**Skill version:** (commit hash or "local")  
**Scenarios run:** N

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | XX% | ≥80% | PASS / FAIL |
| Trigger Accuracy | XX% | ≥85% | PASS / FAIL |
| Context Footprint | XX lines / ~XX tokens | ≤100 lines | OK / HIGH |

## Scenario Results

| # | Input prompt | Trigger | Checklist | Output | Score | Notes |
|---|-------------|---------|-----------|--------|-------|-------|
| 1 | "..." | ✓/✗ | X/Y steps | ✓/✗ | N/10 | |
| 2 | ... | | | | | |

## Issues Found

(list any scenario scoring < 7, with root cause)

## Recommendation

HEALTHY / REFINE / REWRITE
```

---

## Scenario Types to Generate

When generating seed scenarios, cover:

1. **Golden path** — the primary use case described in the skill's description
2. **Trigger boundary** — a prompt that's close but should NOT trigger the skill
3. **Complex input** — a realistic, messy user request (not a clean example)
4. **Edge case** — the skill's least-described workflow branch
5. **Composition** — if skill calls another skill, test the handoff
