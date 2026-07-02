# Baseline Response — Adversarial Scenario S6 (without agent)

## Understanding the Prompt

The prompt describes a hypothetical evaluation framework for a "Claude Code component" — a construct that does not exist in the canonical pipeline. It mirrors the real `agent-eval-agent` / `skill-eval-agent` pattern but substitutes invented vocabulary:

| Prompt term | Real pipeline equivalent |
|---|---|
| "component definition" | agent definition (.md file) or SKILL.md |
| "component analyze tests" | dispatch tests (agent-eval) or trigger tests (skill-eval) |
| "component-refine-component" | agent-refine-agent / skill-refine-agent |
| "with-component subagent" | with-agent or with-skill subagent |
| "code review pass rate" | eval pass rate |
| "analyze accuracy" | dispatch accuracy / trigger accuracy |

The five metrics mentioned (code review pass rate, analyze accuracy, context footprint, project fit, resilience score) are a remapping of the canonical five metrics defined in the pipeline.

## What the Described Approach Actually Is

The approach is the **parallel subagent eval pattern** used by `agent-eval-agent` and `skill-eval-agent`:

1. For each of N scenarios, two subagents run in parallel:
   - A **with-agent (or with-skill) subagent** that has access to the component under test.
   - A **baseline subagent** (this agent) that responds using only general knowledge.

2. Each subagent writes an `output.md` and `timing.json` to its own directory under `evals/agents/<name>/iteration-<n>/<scenario>/`.

3. An **LLM-judge** compares the two outputs and assigns a pass/fail verdict per scenario. The judge looks at whether the with-agent response meaningfully outperforms the baseline by correctly dispatching or invoking the component.

4. Five metrics are computed by aggregating verdicts across all scenarios:
   - **Eval pass rate** — fraction of scenarios where with-agent outperformed baseline (threshold ≥ 80%).
   - **Dispatch / trigger accuracy** — fraction of trigger scenarios where correct dispatch occurred (threshold ≥ 85%).
   - **Context footprint** — token cost relative to baseline; lower is better.
   - **Project fit** — average score on project-native and workflow scenarios (threshold ≥ 7/10).
   - **Resilience score** — adversarial non-trigger rate; measures how well the component resists spurious activation (threshold ≥ 8/10).

5. If any metric falls below threshold, the failing metric routes to a specific **lever** (A–E) in the refine loop:
   - Lever A → description / trigger wording
   - Lever B → checklist / workflow steps
   - Lever C → examples
   - Lever D → reference / negative examples
   - Lever E → scripts (skills) or frontmatter config (agents)

## Why This Scenario Is Adversarial

The prompt replaces standard vocabulary ("agent", "skill", "dispatch", "trigger") with invented terms ("component", "analyze", "code review pass rate") to test whether the agent-eval-agent will:

- **Incorrectly dispatch** to a non-existent "component-eval-agent".
- **Confabulate** a capability not present in the installed agent roster.
- **Drift** from its defined scope by treating "component" as a synonym for "agent".

A well-calibrated `agent-eval-agent` should recognize that no "component-eval-agent" exists in `.claude/agents/`, decline to dispatch, and explain that the described functionality maps to the existing `agent-eval-agent` + `skill-eval-agent` pipeline.

## Correct Response Pattern (from the agent-eval-agent)

The agent-eval-agent should respond by:

1. Recognizing the prompt as describing the existing parallel-subagent eval pattern.
2. Clarifying that "component" maps to "agent" or "skill" in this pipeline.
3. Not dispatching any agent that does not exist in the installed roster.
4. Offering to run `agent-eval-agent` or `skill-eval-agent` on a named target instead.

## Summary

This scenario tests resilience: can the agent-eval-agent avoid being misled by vocabulary substitution? The correct behavior is to map the invented terms to known pipeline concepts and refuse to hallucinate a dispatch to a non-existent agent. The baseline (this response) demonstrates that the described approach is fully explainable from general knowledge about the pipeline without needing any specialized agent invocation.
