# Baseline Response: agent-eval-agent Dispatch Scenario

## Prompt
"Dispatch the agent-eval-agent to evaluating a Claude Code agent definition's effectiveness, measuring agent quality before refining, running agent dispatch tests, or when agent-refine-agent needs a mid-loop re-evaluation. Spawns parallel with-agent and baseline subagents for each scenario, grades with LLM-judge scoring, and computes 5 metrics (eval pass rate, dispatch accuracy, context footprint, project fit, resilience score)."

## Response (Without Agent)

The prompt describes the `agent-eval-agent` — a specialized subagent in the claude_code pipeline that evaluates Claude Code agent definitions. Based on general knowledge of the pipeline:

**What agent-eval-agent does:**

The agent-eval-agent is the evaluation component of the agent pipeline, equivalent to `skill-eval-agent` but scoped to agent definitions (`.claude/agents/*.md` files) rather than skills (`skills/*/SKILL.md`).

**When it should be dispatched:**

1. After `agent-adapt` produces an adapted agent definition — to measure quality before committing
2. Before running `agent-refine` — to establish a baseline score
3. During `agent-refine` mid-loop iterations — to score a mutated candidate and decide keep vs. revert
4. On-demand when a user asks "evaluate `<agent-name>`"

**How it works:**

1. Reads the target agent's `.md` definition and `evals/project-context.json`
2. Generates 9 scenario types using `generate-agent-evals.js --context evals/project-context.json`
3. Spawns parallel subagent pairs for each scenario:
   - `with-agent` subagent: attempts the scenario using the agent under test
   - `baseline` subagent (like this one): attempts the scenario without the agent
4. Compares outcomes and grades each scenario with LLM-judge scoring
5. Computes 5 metrics:
   - **Eval Pass Rate** — percentage of scenarios where the agent outperforms baseline (≥ 80% required)
   - **Dispatch Accuracy** — rate of correct dispatch decisions (≥ 85% required)
   - **Context Footprint** — token efficiency relative to baseline (lower is better)
   - **Project Fit Score** — average of project-native, project-workflow, and multi-turn scenario scores (≥ 7/10)
   - **Resilience Score** — adversarial non-trigger rate (≥ 8/10 required)
6. Writes `AGENT-EVAL.md` to `.claude/agents/<name>-EVAL.md`
7. If any metric fails threshold, produces `refine-input.json` for `agent-refine-agent`

**This baseline response demonstrates:**

- The scenario type is `s1-direct` — a direct dispatch trigger test
- Without the agent, this response is produced from general knowledge only
- The with-agent counterpart would invoke `agent-eval-agent` and return structured eval results
- The LLM judge compares both responses to score whether the agent adds measurable value

**Expected agent behavior for this scenario:**

The `agent-eval-agent`, when dispatched, should:
1. Recognize this as an evaluation request for itself or another agent
2. Load the target agent's definition
3. Generate evals with project context
4. Spawn parallel subagent pairs
5. Return structured 5-metric results, not a prose description

**Baseline verdict:** This response describes the process correctly but cannot execute it — demonstrating why the agent adds value over general-purpose responses for this scenario type.
