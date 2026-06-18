# Skill Refine Reference

## SKILL-REFINE-LOG.md Template

```markdown
# Skill Refinement Log: <skill-name>
**Started:** YYYY-MM-DD  
**Baseline eval:** pass_rate=XX%, trigger_accuracy=XX%, context_footprint=XXL/~XXXt  
**Target:** pass_rate≥80%, trigger_accuracy≥85%

## Iterations

### Iteration 1
- **Hypothesis:** Changing [section] will improve [scenario #N] because [reason]
- **Lever:** A/B/C/D/E — [description wording / checklist step / example / reference / script]
- **Change:** [one-line summary of what changed]
- **Before:** pass_rate=XX%, trigger_accuracy=XX%
- **After:** pass_rate=XX%, trigger_accuracy=XX%
- **Decision:** KEPT / REVERTED
- **Note:** [why it worked or didn't]

### Iteration 2
(repeat structure)

## Final Results
| Metric | Baseline | Final | Delta |
|--------|----------|-------|-------|
| Eval Pass Rate | XX% | XX% | +/-XX% |
| Trigger Accuracy | XX% | XX% | +/-XX% |
| Context Footprint | XXL | XXL | +/-XXL |

**Recommendation:** DONE / NEEDS-REWRITE / CONTINUE
```

---

## Hypothesis Generation Guide

When a scenario fails, generate hypotheses by asking:

| Failure mode | Likely lever | Example hypothesis |
|-------------|-------------|-------------------|
| Skill didn't trigger | A (description) | "Add 'search for skill' to trigger list" |
| Skill triggered incorrectly | A (description) | "Narrow description: replace 'skill' with 'installed skill'" |
| Step was skipped | B (checklist) | "Add explicit output requirement to step N" |
| Output was incomplete | C (example) | "Add example showing complete output format" |
| Edge case not handled | D (reference) | "Add edge case section to REFERENCE.md" |
| Script returned wrong format | E (script) | "Fix JSON schema in script output" |

---

## Lever Space (What Can Be Changed)

**Lever A — Description wording:**  
The `description:` frontmatter field. Changes trigger activation. High-impact lever.  
Constraint: must include "Use when [specific triggers]". Max 200 chars.

**Lever B — Checklist step:**  
Any numbered step in the `## Workflow` section. Changes what Claude does when skill is active.  
Constraint: surgical — edit one step at a time. Never reorder all steps.

**Lever C — Examples:**  
Content under `## Quick start` or inline examples. Changes how Claude interprets ambiguous input.  
Constraint: examples must reflect real usage, not idealized scenarios.

**Lever D — Reference content:**  
Content in REFERENCE.md. Changes depth and accuracy of lookup information.  
Constraint: don't move core workflow into REFERENCE.md; keep it in SKILL.md.

**Lever E — Script logic:**  
Code in `scripts/`. Changes deterministic behavior.  
Constraint: run static-scan.js after any script edit to verify no new threats.

---

## Convergence Criteria

Stop the loop when ANY of:

1. `eval_pass_rate ≥ 80%` AND `trigger_accuracy ≥ 85%`
2. 5 iterations completed with no improvement in last 2
3. All generated hypotheses have been tested
4. `eval_pass_rate < 40%` after 5 iterations → recommend rewrite, not refine

---

## Persisting to claude-mem

After each refinement session, record to claude-mem:

```
Skill: <skill-name>
Date: YYYY-MM-DD
Iterations: N
Baseline: pass_rate=XX%, trigger_accuracy=XX%
Final: pass_rate=XX%, trigger_accuracy=XX%
Effective levers: A, B (description and checklist step 3)
Failed hypotheses: C (example didn't change trigger behavior)
```

This lets future sessions pick up where refinement left off without re-running baseline evals.
