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

1. **Load the skill** — read `skills/<skill-name>/SKILL.md` and all bundled files (REFERENCE.md, scripts/, references/). Note every file that gets loaded when the skill triggers — these all count toward context footprint.

2. **Generate seed scenarios** — run:
   ```bash
   node skills/skill-eval/scripts/generate-seed-evals.js skills/<skill-name>/SKILL.md
   ```
   This produces 5 scenario types (direct, paraphrased, edge_case, negative, semantic) saved to `evals/<skill-name>/evals.json`. If the project has a UAT.md or acceptance criteria, add those:
   ```bash
   node skills/skill-eval/scripts/generate-seed-evals.js <path-to-UAT.md>
   ```

3. **Establish baseline** — before running with-skill tests, determine what to compare against:
   - **New skill**: no skill at all — run each scenario with no skill loaded
   - **Existing skill being improved**: snapshot first (`cp -r skills/<skill-name> skills/<skill-name>-eval-snapshot`), then use the snapshot as baseline

4. **Run parallel evaluations** — for each scenario, spawn two subagents **in the same turn**:
   - **With-skill**: load the skill, execute the prompt, save output to `evals/<skill-name>/iteration-<N>/<eval-name>/with_skill/`
   - **Baseline**: no skill (or snapshot), same prompt, save to `evals/<skill-name>/iteration-<N>/<eval-name>/without_skill/`

   Run each scenario 3 times to measure trigger consistency. Record `total_tokens` and `duration_ms` from each task notification as it arrives — save to `timing.json` in the run directory.

5. **Grade outputs** — score each with-skill run using the LLM judge rubric in REFERENCE.md. For trigger scenarios (direct, paraphrased, semantic, negative), use programmatic detection first (did the skill tool call appear in the transcript?), then LLM judgment for quality.

6. **Compute 3 metrics**:
   - **Eval Pass Rate** = (scenarios where outcome was correct) / (total) × 100%. Threshold: ≥ 80%
   - **Trigger Accuracy** = (correct trigger decisions across all 3 reps) / (total trigger checks) × 100%. Threshold: ≥ 85%
   - **Context Footprint** = total lines across all files loaded on trigger + estimated tokens (lines × 4 avg)

7. **Analyst pass** — before writing the report, review graded results for:
   - Scenarios that pass whether or not the skill is loaded (non-discriminating — skill adds no value here)
   - High-variance scenarios (triggered 1/3 or 2/3 times — unstable description)
   - Large baseline delta (skill significantly outperforms or underperforms no-skill)

8. **Write SKILL-EVAL.md** — save to `skills/<skill-name>/SKILL-EVAL.md` using the template in REFERENCE.md.

9. **Skill-refine handoff** — if Eval Pass Rate < 80% or Trigger Accuracy < 85%, write `evals/<skill-name>/refine-input.json` with failing scenario names, root causes, and analyst observations. Then invoke `skill-refine`.

## Scoring rubric (per scenario, 0–10)

| Score | Meaning |
|-------|---------|
| 10 | Correct trigger + complete checklist + correct output |
| 7–9 | Minor deviation (step skipped, slightly imprecise) |
| 4–6 | Partial execution (triggered but checklist incomplete) |
| 1–3 | Wrong trigger or substantially wrong output |
| 0 | Failed to trigger when it should, or triggered when it shouldn't |

**Eval Pass Rate:** ≥ 80% = healthy; 60–79% = refine; < 60% = rewrite  
**Trigger Accuracy:** ≥ 85% = healthy; < 85% = description needs optimization

See [REFERENCE.md](REFERENCE.md) for scenario types, eval file format, LLM judge rubric, and report template.
