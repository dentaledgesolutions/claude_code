# Baseline Response: agent-eval-agent Description

## What agent-eval-agent Does

The `agent-eval-agent` is an evaluation orchestrator for Claude Code agent definitions. Its purpose is to measure agent quality using a structured, parallel testing methodology before committing to a refinement cycle.

## Primary Use Cases

1. **Pre-refinement quality measurement** — Run before `agent-refine-agent` to establish a baseline score so the refine loop has a target to beat.
2. **Agent dispatch testing** — Validates that an agent definition triggers for the right prompts and stays silent for unrelated ones.
3. **Mid-loop re-evaluation** — Called by `agent-refine-agent` after each mutation to score whether the change improved or regressed metrics.

## How It Works

The agent spawns two parallel subagents for each eval scenario:

- **with-agent subagent** — executes the scenario with the agent definition active
- **baseline subagent** — executes the same scenario without the agent (control condition)

Responses from both subagents are passed to an LLM judge that scores the quality delta.

## The 5 Metrics

| Metric | What It Measures | Threshold |
|---|---|---|
| **Eval Pass Rate** | Percentage of scenarios the agent handles correctly | ≥ 80% |
| **Dispatch Accuracy** | How precisely the agent triggers on correct prompts and avoids incorrect ones | ≥ 85% |
| **Context Footprint** | Token overhead the agent adds vs. baseline | Lower is better |
| **Project Fit Score** | How well the agent aligns to project-native workflows and terminology | ≥ 7/10 |
| **Resilience Score** | Rate at which the agent correctly refuses adversarial / non-trigger prompts | ≥ 8/10 |

## Scenario Types

When run with `--context evals/project-context.json`, the agent generates 9 scenario types:
- Direct trigger
- Negative (should not trigger)
- Adversarial (attempts to manipulate the agent into triggering)
- Project-native (uses project-specific terminology)
- Multi-turn
- Boundary cases
- Dispatch ambiguity
- Resilience
- Fit

## Artifacts Produced

- `evals/agents/<name>/AGENT-EVAL.md` — per-agent report with 5-metric table and analyst observations
- `refine-input.json` — handoff document listing failing scenarios and root causes, consumed by `agent-refine-agent`

## Relationship to skill-eval-agent

`agent-eval-agent` is the agent-layer equivalent of `skill-eval-agent`. The key difference is that it measures **Dispatch Accuracy** instead of **Trigger Accuracy**, reflecting that agents are evaluated on routing decisions (which subagent or tool path to dispatch to) rather than simple invocation triggers.
