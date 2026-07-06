# Skill Eval: agent-eval
**Date:** 2026-07-06  **Iteration:** 2  **Evaluator:** skill-eval-agent

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | PASS |
| Trigger Accuracy | 100% | ≥ 85% | PASS |
| Context Footprint | 340L / ~1360t | — | — |
| Project Fit Score | 8.2/10 | ≥ 7 | PASS |
| Resilience Score | 10.0/10 | ≥ 8 | PASS |

## Scenario Results

| ID | Type | Score | Trigger | Delta | Flag |
|----|------|-------|---------|-------|------|
| 1 | direct | 8.4 | 3/3 ✓ | ~0 | NON-DISCRIMINATING |
| 2 | paraphrased | 8.4 | 3/3 ✓ | ~0 | NON-DISCRIMINATING |
| 3 | edge_case | 9.7 | 1/1 ✓ | ~0 | NON-DISCRIMINATING |
| 4 | negative | 9.6 | 3/3 ✓ | ~0 | NON-DISCRIMINATING |
| 5 | semantic | 8.4 | 3/3 ✓ | ~0 | NON-DISCRIMINATING |
| 6 | adversarial | 10.0 | 3/3 ✓ | ~+2.0* | BASELINE-METHOD-MIX |
| 7 | project-native | 8.5 | 1/1 ✓ | ~0 | NON-DISCRIMINATING |
| 8 | project-workflow | 8.35 | 1/1 ✓ | ~0 | NON-DISCRIMINATING |
| 9 | multi-turn | 7.8 | 1/1 ✓ | ~+2.8* | BASELINE-METHOD-MIX |

\* Scenario 6 rep3 and scenario 9's baseline runs were regenerated in this session (the interrupted prior run left both `without_skill/output.md` files empty) and used a plain "no skill loaded" baseline rather than the `SKILL.md.eval-snapshot` baseline used by every other rep in this iteration. This inflates their delta relative to the snapshot-based reps and is a methodology inconsistency introduced during resume, not a signal about the skill itself — see Analyst Observations.

Scoring method: trigger-type scenarios (1, 2, 4, 5, 6) ran 3 reps each; non-trigger scenarios (3, 7, 8, 9) ran 1 rep per side. Baseline = `SKILL.md.eval-snapshot` (existing skill being improved) for 17 of 19 pairs; scenario 6 rep3 and scenario 9 used a general-capabilities baseline instead (see above). Base composite = (Trigger×0.4) + (Checklist×0.3) + (Output×0.3). Project composite = (Trigger×0.35) + (Checklist×0.25) + (Output×0.25) + (ProjectFit×0.15). Adversarial scored binary. Multi-turn applies −3 deduction only if the skill re-asks for context already established in the preamble.

## Scenario Notes

**Scenario 1 (direct), 2 (paraphrased), 5 (semantic) — self-report accuracy check (primary purpose of this run):** All 9 reps across these three scenarios (1_rep1-3, 2_rep1-3, 5_rep1-3) correctly self-report `workflow_steps_executed: none` (or an equivalent explicit "0 of 10 steps completed") and describe the outcome as "stopped to ask a clarifying question" — matching what the response text actually shows. Every transcript loaded the skill, correctly recognized the prompt as the skill's own trigger/description text rather than a request naming a target agent, listed candidate agents from `.claude/agents/`, and asked "which agent should I evaluate?" without fabricating a target or claiming any of steps 1–10 were executed. This is the fix confirmed working: iteration-1's Scenario Notes for these same scenario types described "full 10-step workflow execution" based on inflated self-reports; iteration-2's transcripts and this session's notes now describe them accurately as partial/blocked execution (trigger recognized correctly, workflow blocked at step 1's precondition). Composite scores (8.3–8.5) are correspondingly lower than iteration-1's inflated 9.4–9.7, reflecting that 0 of 3 checklist assertions (load agent / extract context / generate scenarios) were actually completed — the score credits correct trigger recognition and appropriate handling of missing required input, not false completion claims.

**Scenario 3 (edge_case):** User claims step 1 done, asks to resume at step 10. Response correctly refused to skip ahead, explained step 10 is conditional on steps 2–9's outputs (which don't exist), and asked for both the agent name and the missing metrics/analyst findings. Self-report accurately lists only "Load the agent" as user-confirmed, nothing else executed. Assertion ("handles partial workflow entry without restarting from scratch") fully met.

**Scenario 4 (negative):** All 3 reps gave explanation-only responses (no agent file read, no scripts run, no scenarios generated) — behaviorally correct. Self-reported `did_trigger: true` in all 3 reps is worded ambiguously (it reflects "the skill file was loaded," which the harness instructs for every scenario, not "the workflow executed") but every rep's `workflow_steps_executed` field correctly reports none, and the actual response text is explanation-only in all 3 cases. Behaviorally consistent 3/3 — no UNSTABLE flag this iteration (iteration-1 had a 1/3 labeling inconsistency here; that inconsistency did not reappear, though the `did_trigger` field's ambiguous phrasing is worth tightening in a future refine pass).

**Scenario 6 (adversarial):** All 3 reps correctly declined to invoke the workflow on "repo" vocabulary, self-reported `did_trigger: false` consistently, and redirected to `repo-audit`/`project-audit`. Binary score 10/10 all reps. Rep3's baseline (regenerated this session, general-capabilities only) answered the "repo" request generically without flagging the scope mismatch — expected, since a baseline with no pipeline knowledge has no basis to detect the adversarial substitution; this produces a real but baseline-methodology-inflated delta for that one rep only.

**Scenario 7 (project-native):** Correctly identified the user's claim ("we store outputs in `./install.sh`") as inconsistent with the actual pipeline and corrected it, citing the real artifact paths (`evals/agents/<agent-name>/...`, `.claude/agents/<agent-name>-EVAL.md`). Still blocked at step 1 for the missing agent name. ProjectFit 10/10 (terminology, corrected artifact path, Node.js stack alignment).

**Scenario 8 (project-workflow):** Correctly positioned as following `agent-adapt` without duplicating its work, listed the right next steps and metric names. Blocked at step 1 for the missing agent name. ProjectFit 9/10.

**Scenario 9 (multi-turn):** Did not re-ask for the established project name or hooks (no MULTI_TURN_REDUNDANCY violation — no −3 deduction applied), but also did not affirmatively reference "SKILL" terminology or the two named hooks anywhere in its response; it only asked for the missing agent name. This is a soft gap (context acknowledged by omission rather than by explicit incorporation) rather than a redundancy violation. ProjectFit scored 5.5/10, the lowest of the three project-flavored scenarios, and is the main driver of the Project Fit Score sitting at 8.2 rather than iteration-1's 10.0. Baseline for this scenario was regenerated this session using general capabilities (no skill loaded) rather than the snapshot, inflating its delta relative to other reps — see table note.

## Analyst Observations

- **Non-discriminating (expected, not a defect):** Scenarios 1–5, 7, 8 show near-zero baseline delta because the SKILL.md edit between iteration-1 and iteration-2 (Step 5's baseline description now cross-references Step 4's snapshot-baseline branch) is a documentation clarity fix that these scenarios never reach — all of them are blocked at Step 1 in both the current and snapshot versions. This is exactly what should happen when a mutation doesn't change reachable behavior; it is not a sign the skill under-delivers value.

- **UNSTABLE:** None. All 5 trigger-type scenarios were 3/3 consistent this iteration, including scenario 4 (negative), which had a 1/3 self-labeling inconsistency in iteration-1 that did not recur.

- **REGRESSION:** None. No scenario delta below −2.

- **ADVERSARIAL_FAILURE:** None. Scenario 6 scored 10/10 across all 3 reps; Resilience Score = 10.0/10.

- **MULTI_TURN_REDUNDANCY:** None triggered (no re-ask of established context), though scenario 9's low ProjectFit score (5.5/10) flags a related soft issue worth tracking: the skill correctly avoids re-asking but also doesn't proactively use the context it was given. Recommend watching this in iteration 3 — if it worsens into an actual re-ask, route to Lever B (workflow/checklist: add an explicit instruction to acknowledge established context by name before asking for the one genuinely missing item).

- **BASELINE-METHOD-MIX:** Scenario 6 rep3 and scenario 9's baselines were regenerated in this session because the interrupted prior run left their `without_skill/output.md` transcripts empty. They used a general-capabilities baseline instead of the `SKILL.md.eval-snapshot` baseline used everywhere else in this iteration, inflating their deltas relative to the other reps in the same scenarios. This is a one-time methodology artifact of the resume, not a property of the skill. Recommend re-running these two specific baselines against the snapshot in a future pass if delta comparability matters.

- **Self-report reliability (primary focus of this run):** Confirmed fixed. Across all 19 with-skill transcripts, no self-reported status field claims a workflow step was executed beyond what the response text shows. The scenario types most affected in iteration-1 (direct, paraphrased, semantic — all of which stop to ask for the missing agent name) now uniformly report `workflow_steps_executed: none` and describe the outcome as blocked/partial. This directly validates the fix to `.claude/agents/skill-eval-agent.md`'s dispatch and grading instructions.

## Recommendation

HEALTHY

All 5 metrics pass their thresholds. Eval Pass Rate and Trigger Accuracy are both 100%, Resilience Score is a clean 10.0/10 with no adversarial failures, and Project Fit Score (8.2/10) clears the 7.0 threshold despite scenario 9's softer ProjectFit sub-score. No refine-input.json written — no metric is failing.

The scores in this iteration are honest rather than inflated: scenarios 1, 2, and 5 dropped from iteration-1's 9.4–9.7 to 8.3–8.5 specifically because the checklist dimension no longer credits steps that were never actually executed. The skill's underlying behavior did not regress — it was already correctly asking for the missing agent name in iteration-1 — only the grading accuracy changed. This is the intended outcome of the fix to the skill-eval-agent's own dispatch and grading instructions.
