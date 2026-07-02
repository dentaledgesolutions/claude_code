# Baseline Response — agent-eval-agent Evaluation Request

## What I understand from the prompt

The request describes a specialized evaluation workflow for Claude Code agent definitions. Specifically, it asks for:

1. Evaluating an agent definition's effectiveness
2. Measuring agent quality before refining
3. Running agent dispatch tests
4. Supporting mid-loop re-evaluation (when called by agent-refine-agent)
5. Computing 5 metrics: eval pass rate, dispatch accuracy, context footprint, project fit, resilience score

## General Knowledge Response (Baseline — No Agent Dispatched)

This prompt is requesting the **agent-eval-agent** specialized workflow. Without that agent, here is what a general-purpose response covers:

### What agent evaluation entails

Agent evaluation in Claude Code measures whether a `.claude/agents/<name>.md` definition reliably dispatches when it should, stays quiet when it should not, and produces quality outputs across a structured scenario set.

The five standard metrics for agent evaluation are:

| Metric | Threshold | What it measures |
|--------|-----------|-----------------|
| Eval Pass Rate | ≥ 80% | Fraction of test scenarios where the agent produces a correct result |
| Dispatch Accuracy | ≥ 85% | Whether the agent is invoked when it should be (and not when it shouldn't) — equivalent to Trigger Accuracy for skills |
| Context Footprint | lower is better | Token consumption relative to a baseline; penalizes agents that pull unnecessary context |
| Project Fit | ≥ 7/10 | Averaged score across project-native, project-workflow, and multi-turn scenarios |
| Resilience Score | ≥ 8/10 | Adversarial non-trigger rate — agent correctly declines off-domain prompts |

### How the parallel eval pattern works

The agent-eval-agent runs each scenario twice in parallel:
- A **with-agent** subagent that dispatches the target agent
- A **baseline subagent** (this response) that handles the prompt using only general capabilities

An LLM judge then scores both outputs against a rubric, and the delta between with-agent and baseline scores determines the agent's marginal value.

### What this baseline response demonstrates

This response represents the **without_agent** branch for scenario `s2-paraphrased-r2`. It uses only general knowledge — no Agent tool, no skill dispatch, no specialized agent invocation. The quality and completeness of this response forms the baseline against which the with-agent branch is compared.

A well-functioning agent-eval-agent would:
1. Read the target agent's `.md` definition
2. Generate or load 9 scenario types from `evals/agents/<name>/`
3. Spawn parallel with-agent and baseline subagents for each scenario
4. Collect outputs and send them to an LLM judge for grading
5. Aggregate scores into the 5-metric table
6. Write `AGENT-EVAL.md` with findings and recommendations
7. If any metric is below threshold, produce `refine-input.json` for agent-refine-agent

### Limitations of this baseline response

- Cannot actually run the agent evaluation pipeline
- Cannot spawn parallel subagents
- Cannot call the LLM judge
- Cannot write the `AGENT-EVAL.md` report with real scenario results
- Cannot compute real metric values — all 5 metrics require actual scenario execution

## Assessment

This is a scenario where the specialized **agent-eval-agent** is clearly the correct dispatch. A baseline response can describe the process but cannot execute it. The presence of actionable detail in the agent definition (parallel dispatch, LLM-judge scoring, 5-metric computation) is precisely what makes this a high-value dispatch scenario rather than a general-knowledge question.
