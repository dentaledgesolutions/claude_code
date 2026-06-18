---
name: skill-refine
description: Auto-improves a Claude Code skill using Karpathy's autoresearch loop — baseline eval, targeted mutation, re-measure, keep or revert. Produces a delta report. Use when refining a skill, improving a skill, running autoresearch on a skill, or when skill-eval reports pass rate below threshold.
---

# Skill Refine

Apply Karpathy's autoresearch loop to measurably improve a skill. No guessing — mutate, measure, keep if better.

## Prerequisite

Run `skill-eval` first. You need a baseline eval pass rate. If none exists, run it now.

## The Loop

```
METRIC:  eval_pass_rate + trigger_accuracy + context_footprint
LEVER:   One SKILL.md section per iteration
RULE:    Score ↑ → keep. Score ↓ → revert. Repeat until target or budget.
```

**Default target:** eval_pass_rate ≥ 80%, trigger_accuracy ≥ 85%  
**Default budget:** 5 iterations (increase if user requests deeper refinement)

## Workflow

1. **Load baseline** — read `~/.claude/skills/<skill-name>/SKILL-EVAL.md`. Note baseline scores.

2. **Identify worst-scoring scenarios** — pick the 1-2 scenarios with the lowest scores from SKILL-EVAL.md. These drive the hypothesis.

3. **Hypothesize** — propose ONE change from the lever space:
   - **Lever A** — description wording (trigger precision)
   - **Lever B** — checklist step (completeness or ordering)
   - **Lever C** — example addition or replacement (clarity)
   - **Lever D** — REFERENCE.md content (depth for edge cases)
   - **Lever E** — script logic (if a script is generating wrong output)

4. **Make surgical edit** — edit exactly the targeted section. No other changes. (Karpathy: orthogonal edits only.)

5. **Re-run eval** — run `skill-eval` on the modified skill. Compare scores against baseline.

6. **Keep or revert**:
   - Score improved → update SKILL-REFINE-LOG.md with: iteration, hypothesis, change, delta
   - Score same or dropped → revert the edit; log the failed hypothesis

7. **Repeat** — generate next hypothesis from remaining low-scoring scenarios. Stop when:
   - Target scores reached, OR
   - Budget exhausted, OR
   - No untested hypotheses remain

8. **Write final report** — update SKILL-REFINE-LOG.md with summary and final scores.

## Rules

- **One lever per iteration** — never change description AND checklist in the same iteration.
- **Revert faithfully** — if a change hurts the score, restore the exact prior content.
- **Log every iteration** — including failed hypotheses. They're data.
- **Don't rewrite the skill** — refine is not rewrite. If pass rate < 40% after 5 iterations, recommend `write-a-skill` instead.
- **Store results in claude-mem** — use the observation system to persist refinement history across sessions.

See [REFERENCE.md](REFERENCE.md) for the refinement log template and hypothesis generation guide.
