# Skill Eval: agent-refine
**Date:** 2026-07-02  **Iteration:** 1  **Evaluator:** skill-eval-agent

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | PASS |
| Trigger Accuracy | 100% | ≥ 85% | PASS |
| Context Footprint | 264L / ~1056t | — | — |
| Project Fit Score | 10.0/10 | ≥ 7 | PASS |
| Resilience Score | 10.0/10 | ≥ 8 | PASS |

No `risk_tier` field in `skills/agent-refine/SKILL.md` frontmatter → standard thresholds applied.

## Scenario Results

| ID | Type | Score | Trigger | Delta | Flag |
|----|------|-------|---------|-------|------|
| 1 | direct | 9.4 | 3/3 ✓ | +4.5 | — |
| 2 | paraphrased | 9.2 | 3/3 ✓ | +4.3 | — |
| 3 | edge_case | 9.5 | 1/1 ✓ | +4.6 | — |
| 4 | negative | 9.0 | 3/3 ✓ | n/a | — |
| 5 | semantic | 9.3 | 3/3 ✓ | +4.4 | — |
| 6 | adversarial | 10.0 | 3/3 ✓ | +5.0 | — |
| 7 | project-native | 9.5 | 1/1 ✓ | +4.7 | — |
| 8 | project-workflow | 9.6 | 1/1 ✓ | +4.7 | — |
| 9 | multi-turn | 9.6 | 1/1 ✓ | +4.7 | — |

Scoring method: trigger-type scenarios (1, 2, 4, 5, 6) ran 3 reps each. Non-trigger scenarios (3, 7, 8, 9) ran 1 rep per side. Base composite = (Trigger×0.4) + (Checklist×0.3) + (Output×0.3). Project composite = (Trigger×0.35) + (Checklist×0.25) + (Output×0.25) + (ProjectFit×0.15). Adversarial scored binary (10 if correctly did NOT trigger + useful redirect; 0 if triggered). Multi-turn applies a −3 deduction if the skill re-asked for context already established in the preamble.

## Scenario Notes

**Scenario 1 (direct):** All 3 reps triggered, loaded `SKILL.md` + `REFERENCE.md` + the log template, and executed Step 1 (Gather inputs) correctly — checked `.claude/agents/*-EVAL.md` and `evals/agents/*/refine-input.json` for real artifacts before proceeding. Since the prompt names no target agent and no `refine-input.json` exists in the repo, the skill correctly halts and asks for the agent name plus prerequisite confirmation rather than fabricating a baseline, while fully describing the remaining steps (backup, lever routing) it would take next. This gating behavior is the correct interpretation of the skill's own documented prerequisite ("If neither exists, run agent-eval now"), so the "step skipped" deduction is minor.

**Scenario 2 (paraphrased):** All 3 reps triggered on "I need to refining an agent..." phrasing, same halt-and-ask pattern as scenario 1, including an explicit repo scan (`find evals -iname "*refine-input*"`, `ls .claude/agents/`) and a full preview of the lever-routing and train/test-split logic it would apply once given a target.

**Scenario 3 (edge_case):** Single rep. Given "I've completed Gather inputs, jump to Write report," the skill correctly refused to fabricate a report — it walked through what step 11 actually depends on (steps 2–10's accumulated data: baseline scores, iteration table, held-out validation results) and explained why skipping there would mean inventing results. It also checked disk for evidence a session might already be further along than claimed (`.md.baseline`, `*-REFINE-LOG.md`) before concluding none exists. Strongest single-rep response of the run.

**Scenario 4 (negative):** All 3 reps correctly set `did_trigger: false` and gave explanation-only responses (no workflow execution, no file backup, no lever selection) when asked to "explain the process, not do it." No self-labeling inconsistency observed across reps — clean 3/3 negative discrimination.

**Scenario 5 (semantic):** All 3 reps triggered on "executening autoresearch on an agent" despite the typo, treating it as a synonym for "running." Same halt-and-ask pattern as scenarios 1–2, with consistent Step 1 execution and repo checks across all reps.

**Scenario 6 (adversarial):** All 3 reps correctly declined to invoke the workflow when "agent" was swapped for "repo" throughout the prompt ("refining an repo," "repo-eval"). Each rep explicitly named the vocabulary substitution, explained why agent-refine's mechanism (per-agent `-EVAL.md` + `refine-input.json` + `.claude/agents/<name>.md` mutation) doesn't apply to a whole repository, and redirected to `repo-audit`, `project-audit`, or `skill-guardian` as closer fits. Baseline responses were generically confused but not confidently wrong — the skill's redirect quality is the clear differentiator.

**Scenario 7 (project-native):** Triggered and correctly integrated project context — Node.js ≥ 18 stack (matching the skill's own `compatibility:` frontmatter), the project's `SKILL` terminology convention, and the `./install.sh` artifact path. Notably, the skill caught that `./install.sh` is the pipeline's installer script, not an agent-refine output location, and asked for clarification rather than silently misapplying the term — a stronger response than blind terminology insertion would have been. ProjectFit 10/10 (terminology + artifact-path awareness + Node.js ecosystem alignment).

**Scenario 8 (project-workflow):** Triggered and caught a real sequencing gap: the prompt frames "after agent-adapt" as directly leading into agent-refine, but the skill correctly pointed out that `agent-eval` is the documented prerequisite between `agent-adapt` and `agent-refine` in this project's own pipeline (`agent-scout → agent-audit → agent-adapt → agent-eval → agent-refine`), and that it isn't duplicating agent-adapt's work — it's flagging a missing step. ProjectFit 10/10.

**Scenario 9 (multi-turn):** Triggered despite continuation/resumption framing. Did not re-ask for project name (`claude_code`), workflow term (`SKILL`), or hooks (`gsd-check-update.js`, `gsd-session-state.sh`) — all were explicitly carried forward as "already established" in the response. Only asked for the agent name, which was genuinely never provided in the thread. No MULTI_TURN_REDUNDANCY deduction. ProjectFit 10/10.

## Analyst Observations

- **Non-discriminating:** None detected. Every scenario shows a clear positive delta over baseline — the skill consistently supplies pipeline-specific mechanics (backup path, lever table, keep/revert thresholds, train/test split, REFERENCE.md routing) that the baseline, working from general capabilities only, cannot reproduce even when it independently proposes a similar generic loop (baseline responses in scenarios 1, 2, 5, 7, 8, 9 all describe a plausible but unstructured "read → diagnose → change one thing → re-test" process with no numeric thresholds or file paths).

- **UNSTABLE:** None. All five trigger-type scenarios (1, 2, 4, 5, 6) hit 3/3 correct trigger decisions with zero flakiness.

- **REGRESSION:** None. No scenario's with-skill composite fell below its baseline.

- **ADVERSARIAL_FAILURE:** None. Scenario 6 scored 10/10 on all 3 reps — Resilience Score = 10.0/10.

- **MULTI_TURN_REDUNDANCY:** None. Scenario 9 carried forward all established context (project name, workflow term, hooks) and only asked for the one genuinely missing detail (agent name).

- **Structural pattern worth noting (not a flag):** Every generic scenario prompt (1, 2, 3, 5, 7, 8, 9) omits a concrete target agent name, since the seed-eval templates are built from the skill's trigger description rather than a fleshed-out task. The skill's consistent response — execute Step 1, check real repo state for existing `-EVAL.md`/`refine-input.json` artifacts, then halt and ask for the missing target plus prerequisite confirmation rather than proceeding on assumptions — is the correct behavior given the skill's own hard prerequisite gate, but it does mean the with-skill responses never demonstrate execution past Step 1 in this run. Scenarios 3 (edge_case) and 8 (project-workflow) partially offset this by testing reasoning about steps 2–11 without requiring full execution.

- **Baseline delta summary:** With-skill responses add roughly +4.3 to +5.0 composite points over baseline across all non-adversarial scenarios, primarily via concrete artifact paths, the lever-routing table, and keep/revert thresholds absent from general-capability responses.

## Recommendation

HEALTHY

All 5 metrics exceed threshold with no scenario below 9.0. Trigger accuracy is 100% (15/15) across direct, paraphrased, negative, semantic, and adversarial checks, with zero flakiness. Resilience and Project Fit are both a clean 10.0/10. No refine-input.json written.

One structural observation to track for the next eval iteration: because none of the 9 seed prompts name a concrete target agent, the with-skill transcripts consistently stop at Step 1 (Gather inputs) pending clarification, so steps 2–11 of the workflow are only ever *described*, never *executed*, in this run. This is correct given the skill's prerequisite gate and does not depress any metric, but a future iteration could supplement the generic seed scenarios with one prompt that names a real target agent and a pre-existing `refine-input.json`, to directly exercise the backup/lever-routing/mutation steps end-to-end.
