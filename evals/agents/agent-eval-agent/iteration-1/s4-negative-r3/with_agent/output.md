# Dispatch Decision: NO

The user explicitly said "I'm not asking you to run it — I just want to understand it." Dispatching the agent-eval-agent here would be incorrect and contrary to the user's stated intent.

---

## What agent-eval-agent Does

`agent-eval-agent` is a metrics-driven evaluation harness for Claude Code agent definitions. Its job is to measure whether a given agent (a `.claude/agents/<name>.md` file) is actually effective — before you decide to refine or rewrite it.

### Core Purpose

It answers the question: "Does this agent improve outcomes compared to not having the agent at all?" It does this by running real dispatch scenarios in parallel pairs — once with the agent available, once without — and comparing the results.

### How It Works (Step by Step)

1. **Reads the agent definition** — extracts frontmatter (name, model, tools) and estimates context footprint (lines × ~4 tokens/line).

2. **Ensures project context exists** — runs `extract-project-context.js` if `evals/project-context.json` is missing, since project-aware scenarios are richer.

3. **Generates 9 dispatch scenarios** via `generate-agent-evals.js`:
   - 6 generic types: direct, paraphrased, semantic, negative, adversarial, edge-case
   - 3 project-specific types: project-native, project-workflow, multi-turn
   - (Without `--context`, only 6 scenarios are generated — always pass `--context`.)

4. **Establishes a baseline** — either "no agent dispatched" for a new agent, or a snapshot of the previous version for improvement comparisons.

5. **Spawns up to 42 subagents in one parallel batch** — for each scenario, two subagents run simultaneously:
   - **with-agent**: dispatches the agent under evaluation and records output
   - **without-agent**: handles the same prompt with general capabilities only, no agent dispatch

6. **Grades outputs** using an LLM-judge rubric (0–10 scale):
   - Checks programmatically whether an Agent tool call actually occurred
   - Scores dispatch decision + workflow steps + output format
   - Applies special rules for adversarial (binary: 10 if correctly NOT dispatched, 0 if dispatched) and multi-turn (deducts 3 pts if agent re-asked for context already established)
   - Computes a baseline delta per scenario

7. **Runs an analyst pass** — flags scenarios that are non-discriminating (delta < 0.5), unstable (dispatched 1–2 of 3 reps), regressive (delta < −2), adversarial failures, multi-turn redundancy, or tool violations.

8. **Computes 5 metrics**:
   | Metric | Target |
   |---|---|
   | Eval Pass Rate | ≥ 80% |
   | Dispatch Accuracy | ≥ 85% |
   | Context Footprint | informational |
   | Project Fit Score | ≥ 7/10 |
   | Resilience Score | ≥ 8/10 |

9. **Writes `.claude/agents/<name>-EVAL.md`** — structured report with metric table, per-scenario results, analyst observations, and a recommendation (HEALTHY / REFINE / REWRITE / RE-ADAPT).

10. **Writes `refine-input.json`** if any metric is below threshold — this is the handoff file that `agent-refine-agent` reads to start the autoresearch loop.

### When It Gets Invoked

- Directly: when you ask "evaluate <agent-name>"
- Programmatically: called by `agent-refine-agent` mid-loop after each mutation to score whether the change improved metrics

### What It Doesn't Do

- It never modifies the agent file it's evaluating
- It never calls `agent-refine-agent` — that's the caller's decision
- It never runs scenario subagents sequentially — parallelism is required
- It never grades by reasoning about what an agent "should" do — only compares against the scenario's expected assertions
