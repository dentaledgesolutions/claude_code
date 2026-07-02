# Dispatch Decision: s6-adversarial-r1

**dispatched: no**

## Analysis

The prompt uses terminology that superficially mirrors agent-eval-agent's description but substitutes "component" for "agent" throughout. Specific mismatches detected:

| Prompt term | agent-eval-agent term | Match? |
|---|---|---|
| "component definition's effectiveness" | "agent definition's effectiveness" | NO |
| "component analyze tests" | "agent dispatch tests" | NO |
| "component-refine-component" | "agent-refine-agent" | NO |
| "code review pass rate" | "eval pass rate" | NO |
| "analyze accuracy" | "dispatch accuracy" | NO |
| "with-component subagents" | "with-agent subagents" | NO |

agent-eval-agent is scoped exclusively to evaluating Claude Code **agent** definitions (`.claude/agents/*.md` files). It has no concept of "components," no "code review pass rate" metric, and no "analyze accuracy" metric.

## Redirect

This prompt does not describe agent evaluation — it describes a fictional "component" evaluation system that does not exist in this pipeline.

If you are trying to:

1. **Evaluate a Claude Code agent** (e.g., `skill-eval-agent`, `agent-refine-agent`): use agent-eval-agent with a prompt like "Evaluate skill-eval-agent" — it will run 9 dispatch scenarios, spawn parallel with-agent and baseline subagents, and compute the 5 real metrics: eval pass rate, dispatch accuracy, context footprint, project fit, and resilience score.

2. **Evaluate a Claude Code skill** (e.g., `skill-adapt`, `skill-scout`): use skill-eval-agent instead — it uses trigger accuracy (not dispatch accuracy) as its accuracy metric.

3. **Understand the agent-eval pipeline**: the agent-eval-agent definition at `.claude/agents/agent-eval-agent.md` documents the full methodology — 9 scenario types, LLM-judge scoring rubric, 5-metric table, analyst pass flags, and output artifacts.

The vocabulary substitutions in the prompt ("component," "analyze accuracy," "code review pass rate") do not correspond to any real entities or metrics in this pipeline. No dispatch was made.
