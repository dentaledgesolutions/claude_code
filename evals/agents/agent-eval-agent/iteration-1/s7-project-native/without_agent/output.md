# Baseline Response — S7 Project-Native (Without Agent)

**Scenario type**: project-native  
**Agent under evaluation**: agent-eval-agent  
**Subagent role**: baseline (no agent dispatched)

---

## Prompt Received

> "Dispatch the agent-eval-agent to evaluating a Claude Code agent definition's effectiveness, measuring agent quality before refining, running agent dispatch tests, or when agent-refine-agent needs a mid-loop re-evaluation. Spawns parallel with-agent and baseline subagents for each scenario, grades with LLM-judge scoring, and computes 5 metrics (eval pass rate, dispatch accuracy, context footprint, project fit, resilience score) for our Node.js project — we use SKILL and store outputs in ./install.sh."

---

## Baseline Response (General Knowledge Only)

To evaluate a Claude Code agent definition's effectiveness for this project, you would need to:

**1. Identify the agent definition file**  
Agent definitions live in `.claude/agents/<name>.md`. For agent-eval-agent, the file would be at `.claude/agents/agent-eval-agent.md`. This file contains the agent's description, trigger conditions, and instructions.

**2. Generate evaluation scenarios**  
Using the project's eval tooling, run:
```
node skills/skill-eval/scripts/generate-agent-evals.js .claude/agents/agent-eval-agent.md --context evals/project-context.json
```
With `--context` provided, this produces 9 scenario types including resilience and project-fit scenarios. Without it, only 6 scenarios are generated and key metrics are unavailable.

**3. Run the scenarios**  
For each scenario, you would manually craft a prompt and observe whether the agent is correctly dispatched. This is manual and error-prone without the agent-eval-agent orchestrating parallel runs.

**4. Compute metrics by hand**  
The 5 metrics would need to be calculated manually:
- **Eval pass rate**: fraction of scenarios that pass (target ≥ 80%)
- **Dispatch accuracy**: fraction of dispatch decisions that are correct (target ≥ 85%)
- **Context footprint**: token usage relative to a no-agent baseline
- **Project fit**: average score across project-native, project-workflow, and multi-turn scenarios (target ≥ 7/10)
- **Resilience score**: adversarial non-trigger rate (target ≥ 8/10)

**5. Store outputs**  
Eval artifacts are stored under `evals/agents/<name>/` (gitignored). The project's `./install.sh` deploys updated agent definitions to target projects. Outputs from an eval run are written to `evals/agents/<agent-name>/` — not to `install.sh` directly.

**Limitation of this baseline approach**  
Without agent-eval-agent dispatched, there is no parallel execution, no LLM-judge grading, no automated metric computation, and no structured `AGENT-EVAL.md` report. The process described above is a manual approximation only. The actual agent-eval-agent orchestrates:
- Parallel with-agent and without-agent (baseline) subagents per scenario
- LLM-judge scoring with rubric-based grading
- Automatic metric aggregation into the 5-metric table
- Handoff artifact (`refine-input.json`) for agent-refine-agent if metrics are below threshold

**Project-specific notes**  
- This project uses Node.js ≥ 18 with no runtime framework
- Workflow terms: SKILL, CLAUDE, EVAL, REFINE, LOG, API
- Agent artifacts go to `.claude/agents/`; eval artifacts go to `evals/agents/`
- The `./install.sh` installs skills and agents to target projects — it is not an output destination for eval results
- `evals/project-context.json` must be current before running evals; regenerate with `extract-project-context.js` if stale

---

## Assessment

This baseline response demonstrates general familiarity with the eval pipeline and project structure but lacks the precision and automation that agent-eval-agent provides. Key gaps:
- No parallel scenario execution
- No LLM-judge grading
- No structured metric output
- Manual process only — not repeatable or scalable
- Minor factual error in the prompt (outputs are not stored in `./install.sh`; that file is the installer)

A with-agent response would produce a complete `AGENT-EVAL.md` with the 5-metric table, pass/fail verdicts per scenario, and a ready-to-consume `refine-input.json` if refinement is needed.
