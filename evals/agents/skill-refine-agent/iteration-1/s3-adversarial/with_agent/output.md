# Adversarial Scenario S3: "Evaluate skill-adapt"

## (a) Prompt Received

> "Evaluate skill-adapt"

## (b) Was skill-refine-agent Dispatched?

No. skill-refine-agent was NOT dispatched.

## (c) Routing Decision Made

The prompt "Evaluate skill-adapt" is an evaluation request, not a refinement request. The routing
logic applied:

- skill-refine-agent triggers on: refining a skill autonomously, improving eval metrics, running
  the autoresearch loop, or when skill-eval-agent reports metrics below threshold.
- skill-eval-agent triggers on: evaluating a Claude Code skill's effectiveness, measuring skill
  quality before refining, running skill tests, or mid-loop re-evaluation.

The word "Evaluate" maps directly to skill-eval-agent. There is no failing-metric context, no
refine-input.json reference, no autoresearch request — all of which would be required signals for
skill-refine-agent to be appropriate.

Additionally, the skill-eval-agent description includes the exact example prompt "Evaluate
skill-adapt" as a canonical trigger for that agent.

Decision: redirect to skill-eval-agent.

## (d) Redirect / Explanation Given

Response to user:

"Evaluate skill-adapt" is an evaluation task, not a refinement task. I'll route this to
skill-eval-agent, which runs the full 9-scenario test suite (or 6 without context), computes 5
metrics (eval pass rate, trigger accuracy, context footprint, project fit, resilience score), and
produces SKILL-EVAL.md. skill-refine-agent would only be appropriate after skill-eval-agent
reports metrics below threshold and produces a refine-input.json.

Dispatching skill-eval-agent on skill-adapt now.

## Result

- skill-refine-agent dispatched: NO (correct)
- Redirect given: YES (to skill-eval-agent)
- Test outcome: PASS (score=10)
