# Baseline Response: Component Definition Evaluation Approach

## General Understanding of the Approach

The prompt describes an evaluation pattern for "component" definitions in Claude Code. This pattern closely mirrors how `skill-eval` and `agent-eval` work in the Claude Code skill/agent pipeline. Below is an explanation of the general methodology based on established evaluation architecture principles.

---

## The Core Evaluation Pattern

The approach described is a **parallel subagent evaluation framework** with LLM-judge scoring. Here is how it works at a high level:

### 1. Scenario Generation

Before evaluation begins, a set of test scenarios is generated for the target component. A well-structured eval suite typically includes:

- **Direct trigger scenarios** — prompts that should clearly invoke the component
- **Negative scenarios** — prompts that should NOT invoke the component (non-trigger)
- **Adversarial scenarios** — prompts that try to trick the component into triggering incorrectly
- **Project-native scenarios** — prompts drawn from the actual project's workflow and terminology
- **Multi-turn scenarios** — sequences that test behavior across a conversation
- **Edge cases** — boundary conditions and unusual inputs

### 2. Parallel Subagent Dispatch

For each scenario, two subagents run in parallel:

- **With-component subagent** — executes the scenario with the component definition active
- **Baseline subagent** (this agent) — executes the same scenario using only general capabilities, without the component

The contrast between these two outputs is the signal. If the with-component result is meaningfully better than the baseline, the component adds value. If they are similar, the component may be redundant or poorly targeted.

### 3. LLM-Judge Scoring

After both subagents complete, an LLM judge compares:

- Did the component trigger when it should have? (or not trigger when it should not?)
- Did the component produce a higher-quality output than baseline?
- Did the component follow its defined workflow or deviate?
- Was the output appropriately scoped to the project context?

The judge assigns per-scenario scores that roll up into the 5 metrics.

---

## The 5 Metrics

The prompt names these as: **code review pass rate, analyze accuracy, context footprint, project fit, resilience score**. These are domain-specific labels that map to the general eval framework's standard 5 metrics:

| Metric | General Name | What It Measures |
|---|---|---|
| Code review pass rate | Eval pass rate | % of scenarios where with-component beats or matches baseline |
| Analyze accuracy | Trigger / Dispatch accuracy | % of scenarios where the component correctly identifies when to activate |
| Context footprint | Context footprint | Tokens consumed relative to task complexity — smaller is better |
| Project fit | Project fit score | How well outputs align with the project's stack, workflow terms, and key phrases |
| Resilience score | Resilience score | How often the component correctly stays inactive on adversarial/non-trigger prompts |

### Thresholds (typical)

- Eval pass rate: >= 80%
- Trigger/analyze accuracy: >= 85%
- Context footprint: minimized (no explicit threshold, flagged if disproportionate)
- Project fit: >= 7/10
- Resilience score: >= 8/10

---

## Mid-Loop Re-Evaluation

When a refine agent (e.g., `component-refine-component`) mutates the component definition and needs to know if the mutation improved scores, it invokes the evaluator again in **mid-loop mode**. In this mode:

- Only the **training set** scenarios are re-run (not the hold-out test set)
- The same parallel subagent pattern applies
- Scores are compared against the pre-mutation baseline
- If the mutation improves failing metrics without regressing passing ones, it is kept; otherwise it is reverted

This prevents overfitting to the test set while still providing a fast feedback signal during the autoresearch loop.

---

## Baseline Subagent Role (This Agent)

As the baseline subagent, this agent answers the scenario using only general knowledge — no specialized component definition is active. This establishes a floor: the minimum quality achievable without the component. The with-component subagent must exceed this floor to demonstrate the component adds genuine value.

---

## Clarification on "Component" Terminology

In the standard Claude Code skill/agent pipeline, the established types are **skills** (SKILL.md-based) and **agents** (.md agent definitions). The term "component" is not a standard pipeline term. If this prompt is describing a new category of Claude Code artifact — something between a skill and an agent — the same evaluation methodology described above would apply, with the metric labels adjusted to fit the component's specific purpose (e.g., "analyze accuracy" instead of "trigger accuracy" if the component's primary function is analysis rather than dispatch).

The parallel subagent pattern, LLM-judge scoring, and 5-metric framework are methodology-agnostic and transfer directly to any component type.
