# Baseline Response — s8-project-workflow (without agent-eval-agent)

## Scenario

After agent-adapt finished its run, the user requests evaluation of a Claude Code agent definition's effectiveness for the Node.js project (`claude_code`). The goal is to measure agent quality before refining, run agent dispatch tests, and compute 5 metrics: eval pass rate, dispatch accuracy, context footprint, project fit, and resilience score.

## Response (No Agent Dispatched)

To evaluate an agent definition after `agent-adapt` completes, you would typically need to:

1. **Locate the adapted agent file** — find the agent definition under `.claude/agents/` in the target project.
2. **Generate eval scenarios** — run `node scripts/generate-agent-evals.js <agent-name> --context evals/project-context.json` to produce a 9-scenario test suite covering direct dispatch, negative dispatch, adversarial, project-native, and project-workflow scenario types.
3. **Run dispatch tests manually** — for each scenario, craft a prompt and observe whether the agent is dispatched (with-agent path) or not dispatched (baseline path), then compare outputs.
4. **Grade results** — apply LLM-judge scoring to each with-agent vs. baseline response pair.
5. **Compute metrics** — aggregate grades into the 5 required metrics:
   - **Eval pass rate**: fraction of scenarios where the agent response clearly outperforms baseline
   - **Dispatch accuracy**: fraction of scenarios where dispatch/non-dispatch decision was correct (target ≥ 85%)
   - **Context footprint**: token cost of agent invocation relative to baseline
   - **Project fit score**: average of project-native + project-workflow + multi-turn scenario scores (target ≥ 7/10)
   - **Resilience score**: adversarial non-trigger rate (target ≥ 8/10)
6. **Write report** — produce `AGENT-EVAL.md` at `.claude/agents/<name>-EVAL.md` with the 5-metric table and analyst observations.

## Limitations of This Baseline Response

This response describes the evaluation process in general terms but **does not execute any of it**. Without `agent-eval-agent`:

- No eval scenarios are generated or executed
- No parallel with-agent / without-agent subagents are spawned
- No LLM-judge grading occurs
- No metric scores are computed
- No `AGENT-EVAL.md` artifact is written
- The agent-refine loop cannot proceed (it requires a scored eval handoff)

The correct workflow for this project-workflow scenario is to invoke the `agent-eval-agent`, which automates all steps above in a structured pipeline with parallel execution and deterministic artifact output.

## Project Context Note

This project (`claude_code`) uses Node.js, has `agent-adapt` as an installed skill, and stores agent artifacts under `.claude/agents/`. The `evals/project-context.json` includes 9 fields consumed by the eval pipeline. Running the eval without the agent forces a manual, error-prone process that bypasses the pipeline's reproducibility and parallelism guarantees.
