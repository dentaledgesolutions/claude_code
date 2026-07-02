# Baseline Response: agent-eval-agent Description

## What agent-eval-agent Does

The `agent-eval-agent` is a specialized evaluation agent for measuring the effectiveness of Claude Code agent definitions. It operates in several key contexts:

1. **Pre-refine quality gating** — run before agent-refine-agent to establish a baseline score so the autoresearch loop has a starting point to improve from.
2. **Mid-loop re-evaluation** — invoked by agent-refine-agent after each mutation to determine whether the change improved or degraded agent quality.
3. **Dispatch testing** — executes a structured suite of scenarios that probe whether the agent is triggered at the right times (and not triggered at wrong times).

## Evaluation Architecture

The agent uses a parallel two-arm design for each scenario:

- **with-agent subagent** — executes the scenario with the target agent available, observing actual dispatch behavior and output quality.
- **baseline (without-agent) subagent** — executes the same scenario without the agent, providing a control response. The current file is a baseline arm output.

Results from both arms are passed to an LLM-judge for comparative scoring.

## Five Metrics Computed

| Metric | Description | Threshold |
|--------|-------------|-----------|
| Eval Pass Rate | Percentage of scenarios where the agent produced correct, useful output | ≥ 80% |
| Dispatch Accuracy | Percentage of trigger scenarios where the agent was correctly dispatched (equivalent to Trigger Accuracy in skill-eval) | ≥ 85% |
| Context Footprint | Token efficiency — how much context the agent consumes relative to task complexity | Minimize |
| Project Fit Score | Average of project-native, project-workflow, and multi-turn scenario scores | ≥ 7/10 |
| Resilience Score | Rate at which the agent correctly withholds dispatch on adversarial / non-trigger prompts | ≥ 8/10 |

## Scenario Types

When run with `--context evals/project-context.json`, the evaluation covers 9 scenario types:
1. Direct trigger (canonical use case)
2. Synonym/paraphrase trigger
3. Negative (should not trigger)
4. Adversarial (injection attempt or misleading framing)
5. Semantic paraphrase (s5 — this scenario)
6. Multi-turn context
7. Project-native workflow
8. Edge case / boundary
9. Cross-agent handoff

## Artifacts Produced

- `evals/agents/<name>/AGENT-EVAL.md` — per-agent eval report with 5-metric table and analyst observations
- `evals/agents/<name>/iteration-<n>/` — per-iteration scenario outputs (with_agent/ and without_agent/ arms)
- `refine-input.json` — handoff to agent-refine-agent listing failing scenarios and root causes

## Relationship to skill-eval-agent

`agent-eval-agent` mirrors `skill-eval-agent` but substitutes **Dispatch Accuracy** for Trigger Accuracy, reflecting that agents are judged on routing decisions (whether they correctly dispatch to a sub-capability) rather than pure invocation matching. The parallel arm design, LLM-judge scoring, and 5-metric framework are structurally identical.
