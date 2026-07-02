# What the agent-eval-agent Does and How It Works

The `agent-eval-agent` is a structured, metrics-driven evaluation runner for Claude Code agent definitions. Its job is to tell you whether a given agent (defined in a `.claude/agents/<name>.md` file) is actually working well — not by reasoning about what it *should* do, but by running real dispatch experiments and scoring the results against objective criteria.

## The Core Idea

For every agent you want to evaluate, the agent-eval-agent runs a controlled experiment: it takes each test scenario and fires it **twice in parallel** — once dispatching the agent under test (the "with-agent" path) and once handling it with only general capabilities (the "baseline" path). Comparing these two outputs tells you whether the agent actually adds value.

## Step-by-Step Flow

1. **Read the agent definition.** It reads `.claude/agents/<agent-name>.md` in full, extracting frontmatter (`name`, `model`, `tools`) and computing a context footprint (lines × ~4 tokens/line).

2. **Ensure project context exists.** If `evals/project-context.json` is missing, it runs `extract-project-context.js` to generate it. This file is the shared data contract that enables project-specific test scenarios.

3. **Generate 9 dispatch scenarios.** It runs `generate-agent-evals.js` against the agent file, passing `--context evals/project-context.json`. Without that flag you only get 6 generic scenarios; with it you get 9: 6 generic + 3 project-specific (project-native, project-workflow, multi-turn).

4. **Establish a baseline.** For a brand-new agent with no prior AGENT-EVAL.md, the baseline is "no agent dispatched — just general capabilities." For an existing agent being improved, it snapshots the current version first.

5. **Create an iteration directory.** It counts existing `evals/agents/<agent-name>/iteration-*` directories, increments by one, and creates the new iteration folder.

6. **Fire ALL pairs simultaneously — in one batch.** Up to 42 subagents launch at once. For each scenario, two subagent instructions are dispatched:
   - **With-agent:** "Dispatch the named agent and execute this prompt. Write output to `with_agent/output.md` and `timing.json`."
   - **Baseline:** "Do NOT dispatch the agent. Handle this prompt with general capabilities. Write output to `without_agent/output.md` and `timing.json`."
   
   Dispatch-type scenarios (direct, paraphrased, semantic, negative, adversarial) run 3 reps each. Workflow-type scenarios (edge_case, project-native, project-workflow, multi-turn) run once per side.

7. **Grade each output.** Grading combines a programmatic check (did an Agent tool call actually fire?) with an LLM-judge score (0–10). The composite formula weights dispatch (40%), workflow (30%), and output quality (30%). Project-native scenarios add a ProjectFit dimension. Adversarial scenarios are binary: 10 if the agent correctly did NOT dispatch, 0 if it incorrectly did. Multi-turn scenarios deduct 3 points if the agent re-asks for information already established in the prior context.

8. **Run an analyst pass.** After grading, it flags structural problems: scenarios where the agent adds no value (delta < 0.5), flaky dispatch (dispatched only 1 or 2 of 3 reps), regressions (agent performs *worse* than general capabilities), adversarial failures (over-dispatched), multi-turn redundancy, and tool violations (agent used a tool not declared in its frontmatter).

9. **Compute 5 metrics:**
   - **Eval Pass Rate** — % of scenarios scoring ≥ 7/10 (target: ≥ 80%)
   - **Dispatch Accuracy** — % of correct dispatch decisions across all dispatch-type scenarios (target: ≥ 85%)
   - **Context Footprint** — total lines / estimated tokens (informational only)
   - **Project Fit Score** — average of project-native, project-workflow, and multi-turn ProjectFit scores × 10 (target: ≥ 7/10)
   - **Resilience Score** — adversarial scenarios scoring > 0 / total adversarial × 10 (target: ≥ 8/10)

10. **Write the AGENT-EVAL.md report.** This goes to `.claude/agents/<agent-name>-EVAL.md` and includes the 5-metric table, per-scenario results, analyst observations, and a final recommendation (HEALTHY / REFINE / REWRITE / RE-ADAPT).

11. **Conditionally write refine-input.json.** If any metric falls below threshold, it writes `evals/agents/<agent-name>/refine-input.json` — a structured handoff that tells `agent-refine-agent` exactly which metrics are failing, which scenarios failed, and which Lever (A through E) to target for improvement.

12. **Print a one-paragraph summary.** If invoked programmatically from `agent-refine-agent`, it also prints `EVAL_COMPLETE` as the final line.

## What It Is Not

- It does not modify the agent definition being evaluated.
- It does not invoke `agent-refine-agent` — that's the caller's decision.
- It does not run scenarios sequentially — parallelism is a hard requirement.
- It does not grade by reasoning about intended behavior — only against expected assertions in the scenario spec.

## Where It Fits in the Pipeline

`agent-eval-agent` sits between `agent-adapt` (which tailors an agent to a project) and `agent-refine-agent` (which autonomously improves it). It can also be called mid-loop by `agent-refine-agent` to score a candidate mutation before deciding whether to keep or revert it.
