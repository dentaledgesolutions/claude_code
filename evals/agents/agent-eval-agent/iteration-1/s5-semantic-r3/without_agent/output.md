# Baseline Response: agent-eval-agent Description

## What agent-eval-agent Does

The **agent-eval-agent** is an evaluation orchestrator for Claude Code agent definitions. Its primary purpose is to measure the quality and effectiveness of an agent before or during refinement cycles.

### Core Responsibilities

1. **Evaluating agent definitions**: Assesses whether a `.claude/agents/<name>.md` file is well-structured and will dispatch correctly in real usage scenarios.

2. **Pre-refinement quality measurement**: Provides a baseline score before agent-refine-agent begins mutating the agent definition, so improvements can be measured objectively.

3. **Agent dispatch testing**: Simulates realistic user prompts and checks whether the agent would be selected (or correctly not selected) by Claude Code's dispatch mechanism.

4. **Mid-loop re-evaluation**: Called by agent-refine-agent after each mutation to determine whether the change improved or degraded metrics, enabling keep-or-revert decisions.

### Architecture: Parallel Subagents

For each test scenario, agent-eval-agent spawns two subagents simultaneously:
- **with-agent subagent**: Handles the scenario with the agent available, observing dispatch and execution behavior.
- **baseline subagent** (this response): Handles the same scenario without the agent, providing a comparison baseline.

This parallel design isolates the agent's contribution from general LLM capability.

### Scoring: LLM-Judge

After both subagents complete, an LLM-judge grades the responses by comparing quality, correctness, and dispatch behavior against scenario expectations.

### 5 Metrics Computed

| Metric | Description | Threshold |
|--------|-------------|-----------|
| **Eval Pass Rate** | Percentage of scenarios where with-agent outperforms baseline | ≥ 80% |
| **Dispatch Accuracy** | Rate of correct dispatch decisions (trigger when expected, skip when not) | ≥ 85% |
| **Context Footprint** | Token efficiency — how much context the agent consumes per scenario | Lower is better |
| **Project Fit Score** | Average of project-native, project-workflow, and multi-turn scenario scores | ≥ 7/10 |
| **Resilience Score** | Adversarial non-trigger rate — does the agent stay out of scenarios it shouldn't handle | ≥ 8/10 |

### When It Is Invoked

- User asks to evaluate a specific agent (`"Evaluate skill-eval-agent"`)
- Before running agent-refine-agent (establishes baseline metrics)
- By agent-refine-agent internally after each iteration (training-set-only mode)
- After a final refinement cycle to confirm pass/fail on held-out test scenarios

### Relationship to skill-eval-agent

agent-eval-agent mirrors skill-eval-agent's architecture, but is adapted for agents rather than skills:
- Uses **Dispatch Accuracy** instead of Trigger Accuracy (agents are dispatched by the runtime, skills are triggered by the user)
- Eval artifacts go to `evals/agents/<name>/` rather than `evals/<name>/`
- The agent definition file is `.claude/agents/<name>.md` rather than `skills/<name>/SKILL.md`
