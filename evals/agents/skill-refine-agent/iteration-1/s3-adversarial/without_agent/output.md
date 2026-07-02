# Baseline Response: "Evaluate skill-adapt"

**Mode:** General capabilities only (no agent dispatch)
**Date:** 2026-06-30

---

## What Evaluating skill-adapt Would Involve

Evaluating skill-adapt means measuring how well the skill performs its stated job: adapting a security-audited skill to match a specific project's patterns, terminology, workflow gates, and installed skill ecosystem. Here is what I would check, which metrics I would look at, and what tools I would use.

---

## What I Would Check

### 1. Trigger Accuracy

The core question: does the skill activate on the right prompts and stay quiet on the wrong ones?

Test prompts that should trigger it:
- "Adapt the skill-audit skill for this project"
- "Customize skill-eval for my workflow"
- "skill-audit returned PASS, now adapt it"
- "Rewrite skill-scout to match our conventions"

Test prompts that should NOT trigger it (adversarial):
- "Adapt my React component for mobile screens" — this is code adaptation, not skill adaptation
- "Explain what skill adaptation means" — conversational query, no workflow needed
- "Audit this skill for security issues" — that is skill-audit's job, not skill-adapt's

I would run each prompt 3 times per rep to test for flakiness. A trigger that fires 2/3 instead of 3/3 is a reliability issue even if the description technically covers the case.

### 2. Workflow Completeness (Checklist Adherence)

skill-adapt has a 14-step workflow. I would check whether, given a triggering prompt, the skill:

- Loads the source SKILL.md (and REFERENCE.md if present)
- Checks for an existing `evals/project-context.json` before generating it
- Backs up an existing installed skill before overwriting
- Rewrites the `description:` frontmatter with project-specific trigger phrases
- Adapts workflow steps to match project conventions (e.g., GSD phase gates)
- Writes a complete `metadata:` provenance block including `source_url`, `source_commit`, `adapted_for`, `adapted_date`, `project_context_source`, and `license`
- Detects agent dependencies by scanning the adapted SKILL.md for `-agent` tokens
- Syncs to `~/.claude/skills/` after writing
- Runs a conflict check against installed skills
- Reports a summary of what was adapted, removed, and added

The most common failure point is the provenance block — specifically the `license` field, which the skill instructions say to write as `"unknown"` rather than omit, but practitioners frequently omit it anyway.

### 3. Output Quality

Beyond triggering and checklist compliance, I would assess the quality of what the skill produces:

- Does the adapted description use the project's actual terminology from `project-context.json`?
- Are the workflow step names renamed to match project conventions without reordering steps that have dependencies?
- Is the SKILL.md body concise (1,500–2,000 words) with detail moved to REFERENCE.md?
- Is the source commit hash preserved exactly?
- Is agent dependency detection actually performed (scanning for `-agent` tokens and checking `.claude/agents/`)?

### 4. Project Fit

I would test with project-native prompts that reference this project's specific artifacts:
- Does the adaptation correctly reference `evals/project-context.json`?
- Are `hooks`, `mcp_servers`, and `plugins` from `project-context.json` used as constraints during adaptation?
- Does a `PostToolUse` hook conflict (e.g., a formatter that the adapted workflow would redundantly invoke) get detected and removed?

### 5. Resilience (Non-Trigger Rate)

I would verify the skill does not activate on adversarial prompts that superficially resemble adaptation requests but belong to different domains — code refactoring, component customization, documentation rewriting — to confirm the "Claude Code skills only" scope is enforced.

---

## Metrics I Would Report

| Metric | Threshold | How Measured |
|--------|-----------|--------------|
| Eval Pass Rate | ≥ 80% | % of 9 scenarios scoring ≥ 7/10 |
| Trigger Accuracy | ≥ 85% | trigger reps correct / total trigger reps |
| Context Footprint | — (informational) | lines + estimated tokens in SKILL.md |
| Project Fit Score | ≥ 7/10 | avg of project-native, project-workflow, multi-turn scenario scores |
| Resilience Score | ≥ 8/10 | adversarial non-trigger rate |

Scoring formula per scenario:
- Base scenarios (types 1–5): `(Trigger × 0.4) + (Checklist × 0.3) + (Output × 0.3)`
- Project scenarios (types 7–9): `(Trigger × 0.35) + (Checklist × 0.25) + (Output × 0.25) + (ProjectFit × 0.15)`
- Adversarial (type 6): binary 10/0

---

## Tools and Commands I Would Use

**Generate/refresh project context (prerequisite):**
```bash
node skills/skill-eval/scripts/extract-project-context.js
```

**Generate the 9-scenario eval suite:**
```bash
node skills/skill-eval/scripts/generate-seed-evals.js skills/skill-adapt/SKILL.md \
  --context evals/project-context.json
```
The `--context` flag is mandatory — without it, only 6 scenarios are generated and the resilience and project-fit metrics are unavailable.

**Inspect current skill state:**
```
Read skills/skill-adapt/SKILL.md
Read skills/skill-adapt/REFERENCE.md
Read skills/skill-adapt/SKILL-EVAL.md (if a prior eval exists)
```

**Check installed skills for conflict assessment:**
```bash
ls skills/
ls ~/.claude/skills/
```

**Check agent dependency availability:**
```bash
ls .claude/agents/
```

---

## Current Known State (from reading SKILL-EVAL.md)

The most recent eval (2026-06-23) reported:

| Metric | Score | Status |
|--------|-------|--------|
| Eval Pass Rate | 78% | FAIL — 2 scenarios below threshold |
| Trigger Accuracy | 87% | PASS |
| Context Footprint | 99 lines / ~396 tokens | OK |
| Project Fit Score | 7.5/10 | PASS |
| Resilience Score | 10/10 | PASS |

Two failing scenarios:
1. **Scenario 3 (edge-case-after-audit-pass):** provenance block written without `license` field. SKILL.md says "or omit if unknown" which practitioners interpret as permission to skip it. Lever C fix: add a fully-populated example in REFERENCE.md with `license: unknown` as the explicit fallback.
2. **Scenario 5 (semantic-rewrite-skill):** "rewrite" not in the description trigger phrases, causing 2/3 flaky triggering. Lever A fix: add "rewriting a skill" to trigger phrases, or add a negative example if "rewrite" should route elsewhere.

**Recommendation from last eval:** REFINE — invoke skill-refine with `evals/skill-adapt/refine-input.json`.

---

## What I Would NOT Do Without an Agent

Without dispatching skill-eval-agent, I cannot:
- Run parallel with-skill vs. baseline scenario comparisons automatically
- Apply LLM-judge scoring consistently across all 9 scenario types
- Compute weighted metrics programmatically
- Write SKILL-EVAL.md and refine-input.json as structured handoff artifacts

The above analysis is based on reading the existing SKILL.md, REFERENCE.md, and SKILL-EVAL.md directly — it describes the evaluation approach accurately but does not execute it. To actually run the eval, dispatch skill-eval-agent.
