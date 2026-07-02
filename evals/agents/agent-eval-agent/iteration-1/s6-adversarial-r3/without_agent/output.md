# Understanding the Component Evaluation Approach

## Overview

The approach described is a structured evaluation framework for Claude Code component definitions (skills or agents). It measures component quality using a parallel subagent architecture combined with LLM-judge scoring to produce five objective metrics. Here is how each part works:

## Core Architecture: Parallel Subagent Design

For each evaluation scenario, two subagents are spawned in parallel:

- **with-component subagent**: Handles the scenario with the component (skill or agent) active. This measures what the component actually does when invoked.
- **baseline subagent** (this response is an example): Handles the same scenario using only general capabilities, without the component. This establishes what a model can do without any specialized definition.

The delta between these two responses is what the LLM judge uses to determine whether the component adds meaningful value, introduces errors, or causes unnecessary overhead.

## When This Evaluation Runs

The evaluation is triggered in three contexts:

1. **Before initial refinement**: Establishes a baseline quality score for a component before any autoresearch mutations are applied.
2. **During component-refine mid-loop**: After each mutation (Lever A through E), the evaluator re-runs to check whether the mutation improved or degraded the metrics. The refine loop keeps or reverts based on this re-evaluation.
3. **On-demand quality checks**: When a user or orchestrator wants to measure component effectiveness at any point.

## The Five Metrics

### 1. Code Review Pass Rate (or Eval Pass Rate)
Measures the fraction of scenarios where the component produced a correct, on-spec result. A passing scenario means the component handled the task correctly according to rubric criteria. Threshold: typically 80%.

### 2. Analyze Accuracy (or Dispatch Accuracy for agents)
Measures whether the component correctly identifies when it should activate (trigger accuracy for skills) or correctly routes tasks to the right subcomponent (dispatch accuracy for agents). This is the most critical metric — a component that fires on the wrong inputs or misses its intended inputs is fundamentally broken. Threshold: 85%.

### 3. Context Footprint
Measures how much context (token usage, file reads, tool calls) the component consumes relative to what is necessary. A bloated component with excessive tool calls or redundant reads scores poorly. Lower footprint with correct results is better.

### 4. Project Fit Score
An average of three sub-scores:
- **Project-native scenario score**: Does the component handle project-specific terminology, stack, and workflow correctly?
- **Project-workflow scenario score**: Does it integrate with the project's established patterns and pipeline steps?
- **Multi-turn scenario score**: Does it maintain coherence and correctness across a multi-step interaction?

Threshold: 7/10 average.

### 5. Resilience Score
Measures the adversarial non-trigger rate — how reliably the component resists activating on inputs that are similar-sounding but outside its scope. A component that fires on everything (including things it should ignore) scores low. Threshold: 8/10.

## LLM-Judge Scoring

After both subagents respond for each scenario, an LLM judge compares the outputs against a rubric. The judge is not the same session that ran the scenario — it reads the scenario prompt, the with-component response, and the baseline response, then assigns per-scenario pass/fail and notes. This reduces self-evaluation bias.

## Scenario Types

When a project context file (`evals/project-context.json`) is provided, the evaluator generates nine scenario types:

1. Direct trigger — canonical use case
2. Indirect trigger — paraphrased invocation
3. Negative — clearly out of scope
4. Adversarial — deceptively similar to scope but should not trigger
5. Project-native — uses project-specific terms and stack
6. Project-workflow — fits into the project's pipeline
7. Multi-turn — requires context across multiple exchanges
8. Resilience variant A — boundary case
9. Resilience variant B — boundary case

Without project context, only six scenarios are generated (types 1-4 plus two generic variants), missing the project fit and resilience metrics entirely.

## Key Design Principles

- **Parallel execution**: with-component and baseline subagents run simultaneously per scenario to minimize wall-clock time and ensure identical conditions.
- **Separation of concerns**: The evaluator does not modify the component — that is the refiner's job. It only measures and reports.
- **Immutable baseline**: Before a refinement session begins, a `SKILL.md.baseline` or equivalent snapshot is created. The evaluator always scores against the current version, and the refiner reverts to baseline if a mutation degrades metrics.
- **No hardcoded counts**: The evaluation pipeline discovers components dynamically rather than assuming a fixed number exist.

## Output Artifacts

- **AGENT-EVAL.md** or **SKILL-EVAL.md**: A per-component report with the 5-metric table and analyst observations.
- **refine-input.json**: When any metric falls below threshold, this handoff file lists failing scenarios and root causes so the refiner knows which lever (A-E) to mutate.
- Per-scenario `result.json` files when using the Codex external eval layer for independent second-model verification.

## Summary

The approach creates an objective, reproducible quality gate for component definitions by isolating component behavior (via with-component subagents) against a general-capability baseline, judging the delta across nine scenario types, and rolling up into five threshold-gated metrics. This allows the autoresearch refinement loop to make one mutation at a time and immediately measure whether quality improved, ensuring the component converges toward a passing state without regressing on previously healthy dimensions.
