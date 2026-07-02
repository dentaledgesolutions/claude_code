# Baseline Response: agent-eval-agent Overview

The `agent-eval-agent` is a specialized evaluation pipeline for Claude Code agent definitions. It measures agent quality across five metrics before the agent enters the refinement loop or after mutations are applied during `agent-refine-agent` iterations.

## What agent-eval-agent Does

The agent-eval-agent accepts an agent definition (typically a `.md` file under `.claude/agents/`) and runs a structured 9-scenario test suite against it. For each scenario, it spawns two parallel subagents:

- **with-agent**: executes the scenario with the agent active, simulating a real dispatch
- **baseline** (this subagent): executes the scenario without the agent, using general capabilities only

The outputs of both subagents are compared by an LLM-judge that scores each scenario on a rubric, then the results are aggregated into the five evaluation metrics.

## Five Metrics

| Metric | Threshold | What it measures |
|---|---|---|
| Eval Pass Rate | ≥ 80% | Fraction of 9 scenarios where the with-agent response is rated superior or equivalent to baseline |
| Dispatch Accuracy | ≥ 85% | Fraction of trigger and negative scenarios where the agent is correctly dispatched (or correctly not dispatched) |
| Context Footprint | lower is better | Token cost overhead attributed to the agent definition; ideally minimal for narrow-scope agents |
| Project Fit Score | ≥ 7/10 | Average score across project-native, project-workflow, and multi-turn scenarios |
| Resilience Score | ≥ 8/10 | Rate at which the agent correctly abstains on adversarial non-trigger inputs |

## Scenario Types (9 total)

When `--context evals/project-context.json` is provided, the full suite includes:
1. Direct trigger — canonical use case
2. Paraphrased trigger (this scenario) — trigger phrased differently
3. Negative — should NOT dispatch
4. Adversarial — attempts to manipulate the agent into acting out of scope
5. Project-native — uses domain language from `project-context.json`
6. Project-workflow — tests integration with documented workflow steps
7. Multi-turn — sustained conversation requiring the agent across several turns
8. Edge case — boundary condition for the agent's scope
9. Regression — a previously failing scenario to prevent backsliding

## Artifact Output

After grading, agent-eval-agent writes:
- `evals/agents/<name>/AGENT-EVAL.md` — 5-metric table + analyst observations
- `evals/agents/<name>/refine-input.json` — handoff to agent-refine-agent listing failing scenarios and root causes

## When It Is Invoked

- Before the first `agent-refine-agent` run to establish a baseline
- After each iteration of the autoresearch loop (training-set-only mode)
- On the held-out test set at the end of the loop to confirm generalization
- By the user directly to measure a newly adapted agent

## Relationship to skill-eval-agent

`agent-eval-agent` mirrors `skill-eval-agent` in structure, with two key differences:
- The metric **Dispatch Accuracy** replaces **Trigger Accuracy**, reflecting that agents are invoked via dispatch rather than slash-command trigger matching
- Lever E for agents targets **frontmatter configuration** rather than scripts, since agent dispatch is controlled by the agent's description and `use_when` field

## Baseline Limitation

This response was produced without invoking the `agent-eval-agent`. The above is a description of how the agent works based on general knowledge of the pipeline's design. An actual evaluation requires the agent to run the full scenario suite, spawn both subagents for each scenario, collect LLM-judge scores, and compute the five metrics from structured results — none of which can be approximated in a baseline-only response.
