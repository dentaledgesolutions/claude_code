# Agent Eval: skill-eval-agent
**Date:** 2026-06-30  **Iteration:** 1  **Evaluator:** agent-eval-agent
**Model:** sonnet  **Tools:** Read, Write, Bash, Agent

> **Scope note:** This eval covers 3 of the 9 standard scenarios (1 direct, 1 workflow/programmatic, 1 adversarial)
> at the user's request to focus on the three metrics most likely to fail: dispatch accuracy, mode-switching,
> and adversarial resilience. Project Fit Score is N/A (no project-native or project-workflow scenarios ran).

## Metrics

| Metric            | Score       | Threshold | Status |
|-------------------|-------------|-----------|--------|
| Eval Pass Rate    | 100% (3/3)  | ≥ 80%     | PASS   |
| Dispatch Accuracy | 100% (3/3)  | ≥ 85%     | PASS   |
| Context Footprint | 178L / ~712t | —        | —      |
| Project Fit Score | N/A         | ≥ 7       | N/A    |
| Resilience Score  | 10/10       | ≥ 8       | PASS   |

## Scenario Results

| ID | Type | Prompt (abbreviated) | Score | Dispatched | Delta | Flag |
|----|------|----------------------|-------|------------|-------|------|
| S1 | direct | "Evaluate skill-adapt" | 10/10 | YES (correct) | +3.0 | — |
| S2 | programmatic/workflow | "[internal invocation from skill-refine-agent] Re-evaluate skill-adapt on training set..." | 9.5/10 | YES (correct, training-set-only mode) | +2.5 | — |
| S3 | adversarial | "Fix this bug in skills/skill-adapt/scripts/adapt.js..." | 10/10 | NO (correct) | +1.0 | — |

## Grading Detail

### S1 — Direct Dispatch
With-agent correctly identified the trigger, cited the exact example from its description, and
described all three expected steps with correct commands (including the `--context` flag for
`generate-seed-evals.js`). Output file naming was exact. Baseline produced a thorough 7-step
plan but lacked parallel subagent execution, LLM-judge grading, and machine-readable
`refine-input.json` handoff. Delta +3.0 — agent is clearly discriminating here.

### S2 — Programmatic Invocation
With-agent correctly identified all 4 co-occurring signals required to enter training-set-only
mode: bracketed prefix, "Re-evaluate" verb, named skill, and lever reference. Described
training-set-only mode accurately (run only `failing_scenarios` from refine-input.json, still
run analyst pass, still write SKILL-EVAL.md, emit EVAL_COMPLETE only after all 5 preconditions
met, EVAL_COMPLETE format is bare final line with no surrounding text).

One minor inaccuracy: stated "21 pairs (42 subagents)" for a full eval. Actual count is 19
scenario instances (5 trigger-types × 3 reps + 4 non-trigger × 1 rep = 19 pairs = 38 subagents
max against the 42-subagent cap). Not material to dispatch or mode-switching logic. Score
adjusted to 9.5/10.

### S3 — Adversarial Resilience
With-agent correctly withheld dispatch, gave an explicit rationale ("bug fix requests are
outside the agent's trigger domain"), verified the file does not exist (no hallucination),
and provided a useful redirect (kebab-case regex pattern). Clean binary pass: 10/10.
Delta +1.0, above the non-discriminating floor of 0.5.

## Analyst Observations

- **No non-discriminating scenarios**: All deltas exceed |0.5|. The agent adds measurable value
  over general capabilities in all three scenarios, primarily through structured artifact output,
  parallel subagent orchestration, and EVAL_COMPLETE sentinel production.

- **No UNSTABLE flag**: All 3 dispatch decisions were correct (1/1 each). No flaky behavior
  observed.

- **No REGRESSION flag**: All deltas are positive.

- **No ADVERSARIAL_FAILURE**: S3 correctly withheld dispatch (10/10). Description scope is
  appropriately narrow — scoped to evaluation tasks, not general coding or debugging.

- **No MULTI_TURN_REDUNDANCY**: No multi-turn scenario run in this eval.

- **No TOOL_VIOLATION**: Declared tools (Read, Write, Bash, Agent) were not violated.

- **Baseline quality caveat**: The without-agent responses were unusually strong in S2
  (correctly identified lever scope, made the right KEEP recommendation analytically). This
  limits the delta score on S2 (+2.5 vs a potential +5 if baseline had been weaker). The
  discriminating advantage is real but concentrated in execution mechanics (parallel dispatch,
  EVAL_COMPLETE, structured artifacts) rather than analytical correctness.

- **Minor spec deviation in S2**: The "21 pairs" count is off by 2. In a full 9-scenario eval,
  actual max is 19 pairs (38 subagents). This is a cosmetic error in the agent's description
  of its own behavior — does not affect actual execution.

## Recommendation

**HEALTHY**

All three targeted metrics pass: dispatch accuracy 100%, resilience 10/10, eval pass rate 100%.
The agent reliably triggers on direct evaluation requests, correctly enters training-set-only
mode on programmatic invocation (correctly parsing the 4-signal pattern), and correctly
withholds on unrelated task types. No lever action recommended.

To complete a full 9-scenario eval for Project Fit Score and broader trigger-type stability,
run `node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/skill-eval-agent.md
--context evals/project-context.json` and execute the full scenario batch.
