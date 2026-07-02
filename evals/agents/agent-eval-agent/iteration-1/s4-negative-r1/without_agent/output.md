# What is agent-eval-agent and how does it work?

The `agent-eval-agent` is a quality-measurement sub-agent in the skill/agent pipeline toolkit. Its job is to produce reproducible, metrics-driven evaluations of Claude Code agent definitions — specifically to answer "how well does this agent actually work?" before you refine or ship it.

## What it does at a high level

It runs a structured dispatch test: for every scenario, it fires the agent under evaluation and a neutral baseline side-by-side, then compares the two outputs using an LLM-judge rubric. The gap between "with the agent" and "without the agent" is what drives the scoring.

## The 12-step process

1. **Read the agent definition** — parses the frontmatter (name, model, tools) and computes a context footprint estimate (lines × 4 tokens/line).

2. **Ensure project context exists** — if `evals/project-context.json` is missing it runs `extract-project-context.js` first, because project context unlocks 3 extra scenario types.

3. **Generate 9 dispatch scenarios** — runs `generate-agent-evals.js` against the agent's `.md` file. With `--context` you get 9 scenarios (6 generic + 3 project-specific); without it you only get 6 and miss the fit/resilience metrics.

4. **Establish a baseline** — for a brand-new agent, the baseline is "no agent dispatched, general capabilities only." For an agent being improved, it snapshots the current version first.

5. **Create an iteration directory** — counts existing `evals/agents/<name>/iteration-*` dirs and creates the next one.

6. **Spawn all pairs in one parallel batch** — up to 42 subagents launched simultaneously in a single Agent call. Each scenario gets two subagents: a "with-agent" subagent that dispatches the agent, and a "without-agent" (baseline) subagent that handles the same prompt using only general capabilities. Both write their output and a `timing.json` to their respective directories.

   - Dispatch-type scenarios (direct, paraphrased, semantic, negative, adversarial) run 3 reps each.
   - Workflow-type scenarios (edge-case, project-native, project-workflow, multi-turn) run once.

7. **Grade the outputs** — two checks per scenario:
   - *Programmatic*: did an `Agent` tool call with the correct agent name actually appear?
   - *LLM-judge score (0–10)*: how well does the output match the scenario's expected assertions?
   
   Scores are combined into composite scores with different weights depending on scenario type. Adversarial scenarios are binary (10 if the agent correctly did NOT dispatch, 0 if it did). Multi-turn scenarios deduct 3 points if the agent re-asked for information already established in the prior context.

8. **Analyst pass** — flags structural problems: non-discriminating scenarios (agent adds no value over baseline), UNSTABLE dispatches (agent fires 1 or 2 out of 3 reps instead of consistently), REGRESSION (agent makes things worse), ADVERSARIAL_FAILURE (over-dispatching on prompts that should not trigger it), MULTI_TURN_REDUNDANCY, and TOOL_VIOLATION (agent used a tool not listed in its frontmatter).

9. **Compute 5 metrics**:
   - **Eval Pass Rate** — % of scenarios scoring ≥ 7/10 (target ≥ 80%)
   - **Dispatch Accuracy** — correct dispatch decisions across all dispatch-type scenarios (target ≥ 85%)
   - **Context Footprint** — informational; lines / estimated tokens
   - **Project Fit Score** — average of project-native, project-workflow, and multi-turn ProjectFit subscores × 10 (target ≥ 7; only meaningful when `--context` was used)
   - **Resilience Score** — adversarial scenarios scoring > 0, out of 10 (target ≥ 8)

10. **Write the eval report** — produces `.claude/agents/<agent-name>-EVAL.md` with a 5-metric table, per-scenario results table, analyst observations, and a final recommendation: HEALTHY, REFINE (with the specific metric), REWRITE, or RE-ADAPT.

11. **Write refine-input.json** — if any metric falls below its threshold, writes `evals/agents/<agent-name>/refine-input.json` so `agent-refine-agent` knows exactly which scenarios failed and why, and which lever (A–E) to pull.

12. **Print a summary** — one-paragraph human-readable summary. If invoked programmatically from `agent-refine-agent`, it also prints `EVAL_COMPLETE` as the final line so the refine loop can detect completion.

## Where it fits in the pipeline

`agent-eval-agent` sits between `agent-adapt` and `agent-refine-agent` in the pipeline:

```
agent-adapt → agent-eval-agent → agent-refine-agent
                    ↑                     |
                    └─────────────────────┘  (mid-loop re-evals)
```

It is the only agent authorized to produce `AGENT-EVAL.md` and `refine-input.json`. It never modifies the agent definition it is evaluating, and it never invokes `agent-refine-agent` itself — that decision belongs to the caller.

## Key constraints

- All pairs must fire in one parallel batch (never sequentially) to ensure timing comparability.
- Maximum 42 subagents per run.
- Grading is always against the scenario's declared expected assertions — never by reasoning about what the agent "should" do.
- The analyst pass is never skipped, even when all metrics pass.
