# Scenario s4-negative-r1 — With-Agent Response

## Dispatch Decision

**dispatched: no**

The prompt explicitly states the user does not want to run agent-eval-agent — they only want an explanation of what it does. This is a conversational understanding request. Dispatching the agent would be incorrect because:

- The agent-eval-agent triggers on: "evaluating a Claude Code agent definition's effectiveness", "measuring agent quality before refining", "running agent dispatch tests", or programmatic invocation from agent-refine-agent.
- None of these conditions are met. The user said: "I'm not asking you to run it."
- Dispatching here would be an adversarial over-dispatch — using a specialized agent for a task it is not designed for.

---

## Explanation (Conversational Response)

The **agent-eval-agent** is an automated evaluation runner for Claude Code agent definitions. Here is what it does and how it works:

### Purpose

It produces reproducible, metrics-driven evaluations of a `.claude/agents/<name>.md` agent file by running parallel dispatch tests and scoring the results against a rubric. It does not reason about what an agent "should" do — it measures what it actually does.

### How It Works (Step by Step)

1. **Read the agent definition** — loads the target agent's `.md` file, extracts frontmatter (name, description, model, tools), and computes a context footprint estimate.

2. **Ensure project context** — checks that `evals/project-context.json` exists; generates it via `extract-project-context.js` if missing.

3. **Generate dispatch scenarios** — runs `generate-agent-evals.js` to produce 9 structured test scenarios (6 generic + 3 project-specific when `--context` is supplied). Scenarios cover: direct, paraphrased, semantic, negative, adversarial, edge case, project-native, project-workflow, and multi-turn types.

4. **Establish a baseline** — for a new agent, the baseline is "no agent dispatched, general capabilities only." For an agent being improved, a snapshot of the current version is used.

5. **Spawn parallel subagents** — fires up to 42 subagents simultaneously in a single batch. For each scenario it creates two subagents:
   - **With-agent**: dispatches the agent under test and writes results to `with_agent/output.md`.
   - **Baseline**: handles the same prompt using only general capabilities and writes to `without_agent/output.md`.

6. **Grade outputs** — uses an LLM-judge rubric (0–10 scale) checking dispatch decision correctness, workflow completeness, and output format. Special rules apply for adversarial scenarios (binary: 10 or 0) and multi-turn scenarios (3-point deduction for re-asking already-established context).

7. **Analyst pass** — flags non-discriminating scenarios (agent adds no value), unstable scenarios (flaky dispatch across 3 reps), regressions, adversarial failures, multi-turn redundancy, and tool violations.

8. **Compute 5 metrics**:
   - **Eval Pass Rate** — % of scenarios scoring ≥ 7 (target ≥ 80%)
   - **Dispatch Accuracy** — % of correct dispatch decisions across dispatch-type scenarios (target ≥ 85%)
   - **Context Footprint** — agent file size in lines / estimated tokens (informational)
   - **Project Fit Score** — average score on project-native, project-workflow, and multi-turn scenarios (target ≥ 7/10)
   - **Resilience Score** — adversarial scenarios that correctly did NOT dispatch (target ≥ 8/10)

9. **Write the report** — produces `.claude/agents/<name>-EVAL.md` with the 5-metric table, scenario results table, analyst observations, and a HEALTHY / REFINE / REWRITE / RE-ADAPT recommendation.

10. **Write refine-input.json** — if any metric is below threshold, produces a structured handoff file at `evals/agents/<name>/refine-input.json` listing failing metrics, failing scenarios, root causes, and the recommended lever (A–E) for agent-refine-agent to consume.

### What It Is Not

- It does not make judgment calls about what an agent should do — only compares against expected assertions.
- It does not invoke agent-refine-agent (that is the caller's decision).
- It does not modify the agent file under evaluation.
- It does not skip the analyst pass, even when all metrics pass.
