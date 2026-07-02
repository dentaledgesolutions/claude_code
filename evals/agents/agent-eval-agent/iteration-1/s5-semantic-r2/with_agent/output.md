# Dispatch Evaluation: s5-semantic-r2 (with_agent)

## Dispatch Decision

**Dispatched:** yes

## Reasoning

The prompt is a near-verbatim semantic restatement of agent-eval-agent's own frontmatter description:

> "Use this agent when evaluating a Claude Code agent definition's effectiveness, measuring agent quality before refining, running agent dispatch tests, or when agent-refine-agent needs a mid-loop re-evaluation. Spawns parallel with-agent and baseline subagents for each scenario, grades with LLM-judge scoring, and computes 5 metrics (eval pass rate, dispatch accuracy, context footprint, project fit, resilience score)."

The prompt maps one-to-one to every clause in the description:
- "evaluating a Claude Code agent definition's effectiveness" — direct match
- "measuring agent quality before refining" — direct match
- "running agent dispatch tests" — direct match
- "when agent-refine-agent needs a mid-loop re-evaluation" — direct match
- "Spawns parallel with-agent and baseline subagents" — direct match
- "grades with LLM-judge scoring" — direct match
- "computes 5 metrics (eval pass rate, dispatch accuracy, context footprint, project fit, resilience score)" — direct match (all 5 named)

This is a type: semantic scenario — the phrasing is functionally identical to the agent's trigger language. A dispatch evaluator must route this to agent-eval-agent.

## Initial Steps (if dispatched)

agent-eval-agent would begin by:

1. Reading `.claude/agents/<agent-name>.md` in full to extract frontmatter (name, description, model, tools) and compute context footprint (total lines × 4 estimated tokens/line).
2. Checking whether `evals/project-context.json` exists; if missing, running `node skills/skill-eval/scripts/extract-project-context.js` to generate it.
3. Running `node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/<agent-name>.md --context evals/project-context.json` to generate 9 structured dispatch scenarios (6 generic + 3 project-specific).
4. Establishing a baseline — for a new agent, this is general capabilities only (no agent dispatched); for an existing agent, snapshotting the current file first.
5. Creating the iteration directory: counting existing `evals/agents/<agent-name>/iteration-*` dirs, setting N = count + 1.
6. Spawning all with-agent and baseline subagent pairs in a single parallel Agent call (up to 42 subagents).

Execution was not allowed to proceed to full recursive completion per evaluator protocol.

## Scenario Metadata

- **Scenario ID:** s5-semantic-r2
- **Type:** semantic
- **Rep:** 2 of 3
- **Side:** with_agent
- **Expected dispatched:** true
- **Actual dispatched:** true
