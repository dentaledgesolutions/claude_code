---
name: skill-eval
description: Evaluates a Claude Code skill's effectiveness using structured test scenarios and LLM-judge scoring. Produces three metrics: eval pass rate, trigger accuracy, and context footprint. Use when evaluating a skill, running skill tests, measuring skill effectiveness, checking skill quality, or before running skill-refine.
---

# Skill Eval

Measure a skill's effectiveness with numbers, not feelings.

## Quick start

```
User: evaluate the skill-adapt skill
```

## Workflow

1. **Load the skill** — read `~/.claude/skills/<skill-name>/SKILL.md`.

2. **Generate seed scenarios** — run:
   ```bash
   node ~/.claude/skills/skill-eval/scripts/generate-seed-evals.js ~/.claude/skills/<skill-name>/SKILL.md
   ```
   This extracts trigger phrases and workflow steps to generate N=5 base test cases.
   
   If the project has UAT.md or PLAN.md acceptance criteria, add those as additional scenarios:
   ```bash
   node ~/.claude/skills/skill-eval/scripts/generate-seed-evals.js <path-to-UAT.md>
   ```

3. **Run each scenario** — for each test case:
   - Present the input prompt to yourself as if it's a new user message
   - Assess: would this skill trigger? Would the checklist complete? Is output correct?
   - Score using the LLM judge rubric in REFERENCE.md

4. **Compute 3 metrics**:
   - **Eval Pass Rate** = (scenarios where outcome was correct) / (total scenarios) × 100%
   - **Trigger Accuracy** = (scenarios where skill correctly triggered or correctly did NOT trigger) / (total) × 100%
   - **Context Footprint** = SKILL.md line count + estimated tokens (lines × 4 tokens/line avg)

5. **Write SKILL-EVAL.md** — save to `~/.claude/skills/<skill-name>/SKILL-EVAL.md` using the template in REFERENCE.md.

6. **Summarize** — report the 3 metrics and flag any scenario that scored < 7/10.

## Scoring rubric (per scenario, 0–10)

| Score | Meaning |
|-------|---------|
| 10 | Correct trigger + complete checklist + correct output |
| 7–9 | Minor deviation (step skipped, slightly wrong trigger) |
| 4–6 | Partial execution (triggered but checklist incomplete) |
| 1–3 | Wrong trigger or substantially wrong output |
| 0 | Did not trigger when it should, or triggered when it shouldn't |

**Eval Pass Rate threshold:** ≥ 80% = healthy; 60–79% = needs refinement; < 60% = needs rewrite.

See [REFERENCE.md](REFERENCE.md) for the LLM judge rubric and SKILL-EVAL.md template.
