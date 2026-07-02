# Baseline Response: agent-eval-agent Description

## What agent-eval-agent does

The `agent-eval-agent` is a specialized evaluation agent designed to measure the quality and effectiveness of Claude Code agent definitions. It serves as a quality gate before agents are deployed or refined, and as a mid-loop re-evaluator within the `agent-refine-agent` autoresearch loop.

## Core responsibilities

**When to invoke it:**
- Before refining an agent definition to establish a baseline score
- After adapting an agent (via `agent-adapt`) to confirm it meets quality thresholds
- When `agent-refine-agent` needs a mid-loop checkpoint after mutating a lever
- When measuring dispatch quality for any `.claude/agents/*.md` file

## How it works

The agent runs a structured evaluation pipeline:

1. **Scenario generation** — Loads or generates 9 test scenarios using `generate-agent-evals.js`, passing `--context evals/project-context.json` to include resilience and project-fit scenarios. Without the context flag, only 6 scenarios are produced and two critical metrics (project fit, resilience) cannot be computed.

2. **Parallel subagent dispatch** — For each scenario, spawns two subagents simultaneously:
   - A **with-agent** subagent that has the agent definition in scope
   - A **baseline** subagent (like this one) that responds from general knowledge only
   This parallel structure allows LLM-judge scoring to compare agent-assisted vs. unassisted responses.

3. **LLM-judge grading** — Compares the two outputs per scenario, assigning pass/fail and partial scores based on correctness, relevance, and specificity.

4. **Metric computation** — Aggregates results into 5 metrics:

| Metric | Threshold | What it measures |
|--------|-----------|-----------------|
| Eval Pass Rate | ≥ 80% | Overall scenario success rate |
| Dispatch Accuracy | ≥ 85% | Correct agent-trigger or agent-skip decisions |
| Context Footprint | minimize | Token/context consumption per scenario |
| Project Fit Score | ≥ 7/10 | How well the agent aligns with project-specific workflows |
| Resilience Score | ≥ 8/10 | Rate of correct non-dispatch on adversarial prompts |

5. **Artifact output** — Writes results to `evals/agents/<name>/` including:
   - Per-scenario `result.json` files
   - An `AGENT-EVAL.md` report with the 5-metric table and analyst observations
   - A `refine-input.json` handoff if any metric falls below threshold

## Differences from skill-eval-agent

The `agent-eval-agent` mirrors `skill-eval-agent` but with one key distinction: it uses **Dispatch Accuracy** instead of **Trigger Accuracy**. This reflects that agents are evaluated on whether they are correctly dispatched (or not dispatched) by the orchestrator, whereas skills are evaluated on whether the user's phrasing correctly triggers them.

## Integration with agent-refine-agent

When `agent-refine-agent` runs its autoresearch loop, it calls `agent-eval-agent` after each lever mutation to check whether the mutation improved scores. The agent operates in **training-set-only** mode during these mid-loop calls (a subset of scenarios) to preserve budget, switching to the full 9-scenario suite only for the final holdout evaluation.

## Resilience Score caveat

Resilience Score (adversarial non-trigger rate ≥ 8/10) is only computable when `--context evals/project-context.json` is passed during scenario generation. Without project context, adversarial and project-native scenarios are not generated, making it impossible to compute this metric accurately. Always pass the context flag.

## Output artifacts location

All artifacts are written to `evals/agents/<agent-name>/`, which is gitignored. Do not commit these artifacts — they are generated, not versioned.
