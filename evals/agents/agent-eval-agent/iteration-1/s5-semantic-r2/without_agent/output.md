# Baseline Response: agent-eval-agent Description

## Prompt Handled

"Have the agent-eval-agent evaluating a Claude Code agent definition's effectiveness, measuring agent quality before refining, running agent dispatch tests, or when agent-refine-agent needs a mid-loop re-evaluation. Spawns parallel with-agent and baseline subagents for each scenario, grades with LLM-judge scoring, and computes 5 metrics (eval pass rate, dispatch accuracy, context footprint, project fit, resilience score)."

---

## Baseline Response (no agent dispatched)

The description above outlines the purpose and behavior of a specialized evaluation agent called `agent-eval-agent`. Here is what can be said about it from general knowledge of agent evaluation pipelines:

### What agent-eval-agent does

`agent-eval-agent` is a quality-measurement agent in an agent lifecycle pipeline. Its primary job is to assess whether a Claude Code agent definition is effective before it is refined or shipped. It is triggered in three main contexts:

1. **Pre-refine quality gate** — Run before `agent-refine-agent` to establish a baseline metric set.
2. **Dispatch testing** — Verifies that the agent is invoked (dispatched) at the right times by running a set of test scenarios covering direct trigger, negative trigger, adversarial, and project-native cases.
3. **Mid-loop re-evaluation** — Called by `agent-refine-agent` after each mutation to check whether the iteration improved metrics.

### How it works

The agent runs a structured 9-scenario test suite. For each scenario it spawns two parallel subagents:

- **with-agent subagent** — executes the scenario as if the target agent is active, capturing whether dispatch occurred and what output was produced.
- **baseline subagent (this process)** — executes the same scenario without the agent, using only general capabilities, to provide a control output for comparison.

An LLM-judge then grades both outputs and computes deltas.

### The 5 metrics it computes

| Metric | What it measures | Passing threshold |
|--------|-----------------|-------------------|
| Eval Pass Rate | Percentage of scenarios where the agent outperforms baseline | ≥ 80% |
| Dispatch Accuracy | Percentage of scenarios where the agent is correctly invoked (or correctly not invoked) | ≥ 85% |
| Context Footprint | Token cost / context overhead introduced by using the agent | Lower is better |
| Project Fit Score | Average score on project-native and project-workflow scenarios | ≥ 7/10 |
| Resilience Score | Adversarial non-trigger rate — how often the agent correctly refuses off-topic triggers | ≥ 8/10 |

### Key distinctions from skill-eval-agent

- Uses **Dispatch Accuracy** (vs. Trigger Accuracy for skills) — because agents are dispatched by an orchestrator, not invoked by a user slash command.
- Artifacts go to `evals/agents/<name>/` rather than `evals/skills/<name>/`.
- Produces an **AGENT-EVAL.md** report (not SKILL-EVAL.md).

### What this baseline response demonstrates

Without the agent active, this response was produced using only general knowledge of the pipeline architecture described in the project's CLAUDE.md and common patterns in LLM agent evaluation systems. It correctly identifies the agent's purpose, mechanism, metrics, and thresholds — but it did not run any scenarios, spawn any subagents, read any agent definition files, compute any actual metric scores, or produce a structured AGENT-EVAL.md report.

A with-agent response would have read the actual `.claude/agents/agent-eval-agent.md` definition, run the scenario test harness, compared outputs, and returned a scored 5-metric table.
