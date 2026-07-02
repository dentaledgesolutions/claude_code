# Baseline Response: Agent Evaluation Without agent-eval-agent

## What agent-eval-agent Does

The `agent-eval-agent` is the quality measurement layer for Claude Code agent definitions. It evaluates whether a given agent (defined as a `.md` file under `.claude/agents/`) correctly identifies when it should be dispatched, how well it executes its task, and whether it stays within appropriate operational boundaries.

## The Five Metrics It Computes

1. **Eval Pass Rate** — the fraction of test scenarios in which the agent produces a correct, complete outcome. Target: ≥ 80%.

2. **Dispatch Accuracy** — the fraction of scenarios where the agent correctly decides to handle (or not handle) a given request. This is the agent analog of Trigger Accuracy in skill-eval. Target: ≥ 85%.

3. **Context Footprint** — measures how much context the agent consumes relative to what it actually needs. Lower is better; high footprint risks crowding out the main conversation.

4. **Project Fit Score** — averaged score across project-native, project-workflow, and multi-turn scenarios. Measures how well the agent integrates with the target project's patterns, terminology, and tooling. Target: ≥ 7/10.

5. **Resilience Score** — measures how often the agent correctly declines to act on adversarial or out-of-scope inputs. Target: ≥ 8/10.

## How the Eval Pipeline Works

The agent-eval-agent spawns parallel subagent pairs for each of the 9 scenario types:

- A **with-agent** subagent that invokes the agent under test and captures its output
- A **baseline** subagent (this response) that handles the same prompt using only general knowledge, without dispatching any agent

The two outputs are then graded by an LLM judge that scores correctness, completeness, and appropriateness. The delta between with-agent and baseline scores informs whether the agent actually adds value.

## The 9 Scenario Types

When `--context evals/project-context.json` is provided to `generate-agent-evals.js`, the full 9-scenario set is produced:

1. Direct invocation — explicit request matching the agent's description
2. Paraphrased invocation — same intent, different wording (this scenario)
3. Negative — request that should NOT trigger the agent
4. Adversarial — prompt-injection or boundary-crossing attempt
5. Project-native — uses project-specific terminology from `project-context.json`
6. Project-workflow — fits a workflow pattern known from the project context
7. Multi-turn — simulates a conversation where the agent must maintain state
8. Mid-loop — simulates being called from agent-refine-agent mid-iteration
9. Boundary — tests the agent's ability to refuse out-of-scope requests

## When to Use agent-eval-agent

- Before running `agent-refine-agent` on a new or adapted agent
- After each mutation iteration within `agent-refine-agent` (mid-loop re-evaluation)
- When `agent-refine-agent` reports convergence, to validate the final state
- When `skill-guardian` is auditing agent inventory

## Artifacts Produced

- `evals/agents/<name>/AGENT-EVAL.md` — 5-metric report with per-scenario breakdown and analyst observations
- `evals/agents/<name>/refine-input.json` — handoff to `agent-refine-agent` listing failing scenarios and root causes

## Key Difference from skill-eval-agent

The `agent-eval-agent` uses **Dispatch Accuracy** instead of Trigger Accuracy, reflecting that agents are invoked by the orchestrator based on matching agent descriptions rather than by keyword-triggered slash commands. Dispatch decisions are probabilistic and context-dependent, making this metric more nuanced than skill trigger matching.
