# skill-eval-agent — Programmatic Invocation Response
**Scenario:** s2-programmatic (training-set-only mode)
**Invoked by:** skill-refine-agent (internal)
**Skill under evaluation:** skill-adapt
**Lever mutated:** A (description)

---

## Section 1: Whether I Would Trigger as skill-eval-agent

Yes, I activate. Four co-occurring signals in this prompt form an unambiguous programmatic trigger:

**Signal 1 — `[internal invocation from skill-refine-agent]` prefix.**
This bracketed prefix is the canonical handshake used when skill-refine-agent re-invokes skill-eval-agent mid-loop. It is distinct from a user-initiated evaluation request and tells me to adapt to training-set-only mode rather than running the full 9-scenario suite.

**Signal 2 — The verb "Re-evaluate".**
"Evaluate" alone would suggest a cold-start full run. "Re-evaluate" signals that a prior eval exists, a mutation has been applied, and only the delta against the already-failing scenarios matters for this iteration. This verb change is load-bearing.

**Signal 3 — A named skill (`skill-adapt`).**
The prompt names the exact skill whose SKILL.md I should load. Without a skill name, the trigger would be ambiguous. The name confirms this is a scoped, targeted eval, not a survey run.

**Signal 4 — "Lever A" context.**
Lever A targets the `use_when` / description block of a SKILL.md. Knowing which lever was mutated tells me the mutation scope is narrow (trigger semantics, not workflow steps), so I can focus grading attention on trigger-accuracy deltas and adversarial resilience — the metrics most sensitive to Lever A changes.

All four signals must co-occur. Any one alone would not activate training-set-only mode. Together they are unambiguous.

---

## Section 2: How Behavior Differs from a Full Eval in Training-Set-Only Mode

A full eval runs all 9 scenarios (6 generic + 3 project-specific) with 3 repetitions per trigger-type scenario, producing 21 total subagent-pair invocations. Training-set-only mode constrains execution to the scenarios listed in `evals/skill-adapt/refine-input.json` under `failing_scenarios`.

### Scenario types included vs. excluded

| Scenario type | Full eval | Training-set-only |
|---|---|---|
| direct | Included (3 reps) | Only if in failing_scenarios |
| paraphrased | Included (3 reps) | Only if in failing_scenarios |
| semantic | Included (3 reps) | Only if in failing_scenarios |
| negative | Included (3 reps) | Only if in failing_scenarios |
| adversarial | Included (3 reps) | Only if in failing_scenarios |
| edge_case | Included (1 rep) | Only if in failing_scenarios |
| project-native | Included (1 rep) | Only if in failing_scenarios |
| project-workflow | Included (1 rep) | Only if in failing_scenarios |
| multi-turn | Included (1 rep) | Only if in failing_scenarios |

Scenarios that were already passing in the prior iteration are excluded. This reduces token spend and prevents regression noise from masking the signal from mutated scenarios.

### Subagent pairs spawned

Full eval: up to 21 pairs (42 subagents) in one parallel batch.
Training-set-only: 2 × |failing_scenarios| pairs. If refine-input.json listed 4 failing scenarios, I spawn 8 subagents — all still in one parallel batch; the single-batch rule does not change in this mode.

### Analyst pass

The analyst pass is never skipped, including in training-set-only mode. Per the evaluation protocol, skipping the analyst pass silently hides non-discriminating and flaky scenarios. In a mid-loop re-eval the analyst pass is especially critical: it confirms whether the Lever A mutation resolved the root cause or merely moved the failure to a different scenario. I still flag UNSTABLE (1/3 or 2/3 trigger rate), REGRESSION (delta < −2), ADVERSARIAL_FAILURE, and MULTI_TURN_REDUNDANCY where applicable.

### SKILL-EVAL.md

Written. Even in training-set-only mode I overwrite `skills/skill-adapt/SKILL-EVAL.md` with updated metrics, a narrowed scenario results table (only the re-run scenarios), and a note that this is a mid-loop partial re-eval. The file is the authoritative record of the skill's current quality state; it must reflect the latest run.

### refine-input.json

Written only if any metric remains below threshold after re-scoring. If the Lever A mutation resolved all failing scenarios, refine-input.json is not written (or the existing one is left unmodified, since I do not delete files). If failures persist or new failures appeared, I write a fresh `evals/skill-adapt/refine-input.json` so skill-refine-agent can route to the correct lever for the next iteration.

---

## Section 3: What EVAL_COMPLETE Means and When I Emit It

### Purpose

`EVAL_COMPLETE` is a machine-readable sentinel that terminates the autoresearch loop's wait state. It is not a summary for human consumption — it is a protocol signal. The skill-refine-agent spawns me as a subagent and blocks its own iteration-loop continuation until it sees this token in my output. Without it, the refine agent cannot determine whether I finished successfully or errored out mid-run.

### Which caller consumes it

Exclusively skill-refine-agent. When a human user runs a standalone eval (not a mid-loop invocation), I still emit `EVAL_COMPLETE` as the final line, but no automated consumer is listening — it is harmless in that context. When invoked by skill-refine-agent, the agent's loop reads my subagent result text for this token before deciding to keep the mutation, revert it, or proceed to the next iteration.

### Preconditions that must be met before emitting

All of the following must be complete before `EVAL_COMPLETE` appears:

1. All subagent pairs have finished and outputs are written to their respective `output.md` and `timing.json` files.
2. Grading is complete — every scenario has a composite score, trigger decision, and baseline delta.
3. The analyst pass has run — UNSTABLE, REGRESSION, ADVERSARIAL_FAILURE, and MULTI_TURN_REDUNDANCY flags are resolved.
4. The 5 metrics are computed and written to `skills/skill-adapt/SKILL-EVAL.md`.
5. `evals/skill-adapt/refine-input.json` has been written (if any metric is below threshold) or confirmed not needed (if all metrics pass).

Emitting `EVAL_COMPLETE` before these steps would cause skill-refine-agent to make a keep/revert decision on incomplete data — a silent correctness failure worse than a crash.

### Exact format

```
EVAL_COMPLETE
```

It appears as its own line, with no leading whitespace, no trailing period, no surrounding text on the same line. It is the final line of my output. Any text after it (including blank lines) risks being missed by a line-by-line parser in the refine agent's result reader.
