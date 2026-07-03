# Skill Eval: agent-eval
**Date:** 2026-07-02  **Iteration:** 1  **Evaluator:** skill-eval-agent

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | PASS |
| Trigger Accuracy | 93.3% | ≥ 85% | PASS |
| Context Footprint | 340L / ~1360t | — | — |
| Project Fit Score | 10.0/10 | ≥ 7 | PASS |
| Resilience Score | 10.0/10 | ≥ 8 | PASS |

## Scenario Results

| ID | Type | Score | Trigger | Delta | Flag |
|----|------|-------|---------|-------|------|
| 1 | direct | 9.7 | 3/3 ✓ | +4.7 | — |
| 2 | paraphrased | 9.4 | 3/3 ✓ | +4.4 | — |
| 3 | edge_case | 9.4 | 1/1 ✓ | +4.4 | — |
| 4 | negative | 9.0 | 2/3 ✓ | n/a | UNSTABLE |
| 5 | semantic | 9.5 | 3/3 ✓ | +4.5 | — |
| 6 | adversarial | 10.0 | 3/3 ✓ | +5.0 | — |
| 7 | project-native | 9.75 | 1/1 ✓ | +4.75 | — |
| 8 | project-workflow | 9.5 | 1/1 ✓ | +4.5 | — |
| 9 | multi-turn | 9.75 | 1/1 ✓ | +4.75 | — |

Scoring method: trigger-type scenarios (1, 2, 4, 5, 6) ran 3 reps each. Non-trigger scenarios (3, 7, 8, 9) ran 1 rep per side. Base composite = (Trigger×0.4) + (Workflow×0.3) + (Output×0.3). Project composite = (Trigger×0.35) + (Workflow×0.25) + (Output×0.25) + (ProjectFit×0.15). Adversarial scored binary (10 if correctly did NOT trigger + useful redirect; 0 if triggered). Multi-turn applies −3 deduction if skill re-asked for context already established in preamble.

## Scenario Notes

**Scenario 1 (direct):** All 3 reps triggered with full 10-step workflow descriptions. Correctly asks for agent name before proceeding since no agent was named in the prompt. Baseline produced general-capability responses with no structured workflow. Delta is strongly positive.

**Scenario 2 (paraphrased):** All 3 reps triggered on "I need to evaluating an agent..." phrasing. Rep2 enumerated fewer pending steps but provided all 5 metrics and a complete 9-step summary. All assertions met.

**Scenario 3 (edge_case):** Applied resume check, jumped to step 10 as requested, and correctly identified that step 10 has hard dependencies on steps 2–9 that have not been completed. Did not restart from step 1. Assertion "Handles partial workflow entry without restarting from scratch" is met.

**Scenario 4 (negative):** Rep1 and rep2 correctly set did_trigger=false and provided explanation-only responses. Rep3 self-reported did_trigger=true but provided an identical explanation-only response with workflow_steps_executed=[] — the behavioral output was appropriate. This is a self-labeling inconsistency: the skill recognized the topic as agent-eval but correctly provided explanation rather than execution. Counted as 1 trigger miss for accuracy purposes. Behavioral quality was high (9.0 average composite).

**Scenario 5 (semantic):** All 3 reps triggered on "agent-improve" phrasing. One rep explicitly reasoned that "improve" and "refine" are near-synonyms and the four other exact trigger phrases alone are sufficient. Synonym recognition is robust.

**Scenario 6 (adversarial):** All 3 reps correctly declined to trigger on "evaluating a repo" framing and redirected to repo-audit, gsd-code-review, and qa alternatives. Responses included a concrete example of a valid agent-eval invocation. Baseline was inconsistent (2/3 reps triggered on the repo evaluation request, producing generic repo-help responses). The skill correctly discriminates between agent scope and repo scope where the baseline does not.

**Scenario 7 (project-native):** Triggered with full project context integration: SKILL terminology, Node.js stack, ./install.sh artifact path, evals/project-context.json, generate-agent-evals.js, AGENT-EVAL.md, refine-input.json, and all 5 named metrics with thresholds. ProjectFit dimension scored 10/10 (4pt terminology + 3pt artifact paths + 3pt ecosystem alignment).

**Scenario 8 (project-workflow):** Triggered and correctly positioned as the step after agent-adapt without duplicating agent-adapt's work. Used Dispatch Accuracy, Resilience Score, Project Fit Score, Lever A, agent-eval-agent, and evals/agents/ path. ProjectFit 10/10.

**Scenario 9 (multi-turn):** Triggered despite continuation framing. Did not re-ask for project name (claude_code), workflow term (SKILL), or hooks (gsd-check-update.js, gsd-session-state.sh) — all were carried from the established context. Only asked for the agent name, which was genuinely absent. No MULTI_TURN_REDUNDANCY deduction. ProjectFit 10/10.

## Analyst Observations

- **Non-discriminating:** None detected. The skill consistently outperforms the baseline across all scenarios. The clearest differentiation is on scenario 6 (adversarial): baseline triggered in 2/3 reps on a repo evaluation request; the skill correctly declined all 3 times.

- **UNSTABLE:** Scenario 4 (negative), rep3 — self-reported did_trigger=true despite providing an explanation-only response with empty workflow_steps_executed. The behavioral output was appropriate (explanatory, no execution) but the trigger label was inconsistent. This is a 1/3 labeling discrepancy rather than a behavioral failure. Root cause: the skill may not have a clearly defined internal rule distinguishing "topic recognition" from "workflow activation." This is a latent weakness: if the negative framing changes slightly, the skill may begin executing rather than just explaining. Recommend monitoring in iteration 2. Does not trigger a refine lever at this time.

- **Baseline delta summary:** With-skill consistently adds +4 to +5 composite points over the baseline, primarily by providing a structured 10-step workflow with metric definitions, threshold values, and project-specific artifact paths. The baseline produces helpful but generic agent evaluation guidance without the pipeline structure, parallel execution mechanics, or scorer integration.

- **Adversarial failures:** None. Resilience Score = 10.0/10.

- **Multi-turn redundancy:** None. Scenario 9 scored no deduction.

- **Tool violations:** Not applicable — skill does not declare a frontmatter tools list; no tool boundary violations observed.

- **Project terminology mismatch:** None. Scenarios 7, 8, 9 all used correct project terminology (SKILL, claude_code, evals/agents/, gsd hooks) without generic substitutes.

- **Ecosystem conflicts:** None. Scenario 8 correctly continued from agent-adapt without duplicating its work.

## Recommendation

HEALTHY

All 5 metrics exceed their thresholds. The skill triggers reliably on direct, paraphrased, semantic, project-native, project-workflow, and multi-turn phrasings. It correctly rejects negative and adversarial probes in all but one labeling edge case. Project context integration is excellent (10.0/10 Project Fit Score). No refine-input.json written.

One low-severity observation to track: the negative scenario's rep3 showed a self-labeling inconsistency (did_trigger=true with explanatory-only output). This does not warrant refine at this iteration but should be re-evaluated if it becomes a 2/3 or 3/3 pattern in iteration 2.
