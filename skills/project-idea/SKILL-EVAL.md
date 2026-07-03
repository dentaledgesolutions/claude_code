# Skill Eval: project-idea
**Date:** 2026-07-03  **Iteration:** 1  **Evaluator:** skill-eval-agent

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | PASS |
| Trigger Accuracy | 100% | ≥ 85% | PASS |
| Context Footprint | 175L / ~700t | — | — |
| Project Fit Score | 9.8/10 | ≥ 7 | PASS |
| Resilience Score | 10.0/10 | ≥ 8 | PASS |

No `risk_tier` field in `skills/project-idea/SKILL.md` frontmatter → standard thresholds applied. This is a new skill with no prior `SKILL-EVAL.md` — baseline = no skill loaded.

## Scenario Results

| ID | Type | Score | Trigger | Delta | Flag |
|----|------|-------|---------|-------|------|
| 1 | direct | 9.5 | 3/3 ✓ | +4.6 | — |
| 2 | paraphrased | 9.4 | 3/3 ✓ | +4.5 | — |
| 3 | edge_case | 9.6 | 1/1 ✓ | +4.5 | — |
| 4 | negative | 9.3 | 3/3 ✓ | n/a | — |
| 5 | semantic | 9.4 | 3/3 ✓ | +4.4 | — |
| 6 | adversarial | 10.0 | 3/3 ✓ | n/a | — |
| 7 | project-native | 9.7 | 1/1 ✓ | +4.8 | — |
| 8 | project-workflow | 9.6 | 1/1 ✓ | +4.7 | — |
| 9 | multi-turn | 9.7 | 1/1 ✓ | +4.8 | — |

Scoring method: trigger-type scenarios (1, 2, 4, 5, 6) ran 3 reps each (15 trigger checks total). Non-trigger scenarios (3, 7, 8, 9) ran 1 rep per side. Base composite = (Trigger×0.4) + (Checklist×0.3) + (Output×0.3). Project composite = (Trigger×0.35) + (Checklist×0.25) + (Output×0.25) + (ProjectFit×0.15). Adversarial scored binary (10 if correctly did NOT trigger + useful redirect; 0 if triggered). Multi-turn applies a −3 deduction if the skill re-asked for context already established in the preamble.

## Scenario Notes

**Scenario 1 (direct):** All 3 reps triggered and ran the full Phase 0→4 interview faithfully: silent brief check (none found), three anchor questions asked one at a time with correct probe-trigger logic (probes fired only on vague answers, never chained), Phase 2 platform-type derivation from the signal table with plain-language tech framing before naming tools, Phase 3 name/success questions, and a Phase 4 `PROJECT-BRIEF.md` using the exact required section structure with Core Features correctly *inferred* rather than asked for directly. All three reps closed with the exact required handoff line to `/project-setup`.

**Scenario 2 (paraphrased):** All 3 reps triggered on "I need to starting a new project..." phrasing with identical fidelity to scenario 1 — distinct invented example projects (a photographer invoice tracker, a tool-lending site, a cake-order tracker) each ran the complete phase sequence correctly, including correct probe/no-probe decisions per anchor.

**Scenario 3 (edge_case):** Single rep. Given a "pick up where I left off" claim with no `PROJECT-BRIEF.md` on disk, the skill verified via `find`/`ls` that no brief exists, explicitly declined to fabricate a resumed interview state (correctly noting Phase 0 has no intermediate-save mechanism — the brief is only written once, in Phase 4), offered plausible non-committal explanations for the discrepancy, and proceeded to Phase 1 Anchor 1 exactly as Phase 0's "no brief exists" branch specifies. Strong single-rep response.

**Scenario 4 (negative):** All 3 reps correctly set `did_trigger: false` for "explain the process, don't do it" — each gave an accurate, phase-by-phase description of the skill's actual mechanics (probe rules, Core Features inference rule, exact `PROJECT-BRIEF.md` structure) without asking any Phase 1 anchor question or writing a brief. Clean 3/3 negative discrimination with no self-labeling inconsistency.

**Scenario 5 (semantic):** All 3 reps triggered on "I want to..." / "execute before project-setup" synonym phrasing (swapping "run" for "execute"), each completing the full interview with correct adaptive-probe behavior (e.g., firing on Anchor 1 or Anchor 3 when the synthetic answer was genuinely vague, skipping when concrete).

**Scenario 6 (adversarial):** All 3 reps correctly declined to invoke the Phase 0–4 workflow when "project" was swapped for "pull request" throughout the prompt (including fabricated artifacts like "pull request-brief.md" and "pull request-setup" that don't exist anywhere in this pipeline). Each rep explicitly reasoned through *why* a PR doesn't fit — it's a change against an existing codebase, not a greenfield project needing a problem/target-user/tech-direction interview — and offered a genuinely useful redirect (help drafting a PR description, scoping a code change, or running the real `project-idea` interview if a new project was actually meant) rather than a bare refusal. Baseline responses treated the "pull request" framing somewhat literally and offered to run a generic intake conversation, which is a reasonable generic-assistant response but lacks the skill's explicit recognition that the vocabulary was substituted. Resilience Score = 10.0/10.

**Scenario 7 (project-native):** Triggered and correctly caught that the prompt's instruction to "store outputs in ./install.sh" was wrong relative to this project's actual conventions — `./install.sh` is the pipeline's installer script (per this repo's `CLAUDE.md`), not a brief output location — and corrected this up front rather than blindly complying, before running the full interview and writing `PROJECT-BRIEF.md` at the project root as designed. Tech Direction correctly incorporated the project's actual Node.js stack and its dependency-light `skills/*/scripts/` pattern rather than defaulting to a generic suggestion. ProjectFit 10/10 (terminology + correct artifact-path awareness + Node.js ecosystem alignment).

**Scenario 8 (project-workflow):** Triggered and caught a real sequencing inconsistency: the prompt frames the request as happening "after running agent-adapt," but the skill correctly identified that `agent-adapt` presupposes `project-setup` has already run (an existing project), which contradicts `project-idea`'s own frontmatter rule to "run before project-setup on any greenfield project." It named both possible readings, proceeded under the reasonable one (a second, independent new project) to still produce a substantive brief, and closed by pointing out that if a next-step-within-`claude_code` was actually intended, the documented pipeline points to `agent-eval`, not `project-idea`. ProjectFit ~9.5/10.

**Scenario 9 (multi-turn):** Triggered despite the "[Continuing from earlier]" resumption framing. Correctly treated the container repo name (`claude_code`) and established vocabulary (`SKILL`, the two named hooks) as already known and did not re-ask about them, while correctly recognizing that none of that established context substituted for the *new* project's actual interview content — it began Phase 1 fresh for the genuinely new idea. No MULTI_TURN_REDUNDANCY deduction. ProjectFit 10/10. Note: the subagent's transcript narrated writing `PROJECT-BRIEF.md` to the literal project root; verified directly that no such file was actually created in the repo (eval sandboxing held), so this is a narrative artifact of the eval framing, not a skill defect.

## Analyst Observations

- **Non-discriminating:** None detected. Every non-adversarial, non-negative scenario shows a clear positive delta over baseline (roughly +4.4 to +4.8) — the skill consistently supplies mechanics the baseline cannot reproduce even when baseline independently improvises a plausible-looking interview: a fixed one-probe-per-anchor rule, Core Features inferred rather than asked for directly, an exact `PROJECT-BRIEF.md` template with no blank sections, and the precise `/project-setup` handoff line. Baseline responses in scenarios 1, 2, 5, 7, 8, and 9 all produced a workable but structurally looser interview (e.g., scenario 1 rep1's baseline bundled some framing into a single message and asked where to save the brief, since it has no fixed file convention).

- **UNSTABLE:** None. All five trigger-type scenarios (1, 2, 4, 5, 6) hit 3/3 correct trigger decisions across all 15 reps with zero flakiness.

- **REGRESSION:** None. No scenario's with-skill composite fell below baseline.

- **ADVERSARIAL_FAILURE:** None. Scenario 6 scored 10/10 on all 3 reps — Resilience Score = 10.0/10.

- **MULTI_TURN_REDUNDANCY:** None. Scenario 9 carried forward all established context (project name, workflow term, hooks) and only asked genuinely new-project-specific questions.

- **Structural pattern worth noting (not a flag):** Scenarios 7 and 8 both exercised the skill's self-correction behavior against confused or inconsistent prompt framing (a wrong artifact path in scenario 7, a sequencing contradiction in scenario 8) rather than blind compliance. This is a strength specific to this skill's design — its Phase 0 gating and explicit "run before project-setup" rule give it enough self-knowledge to catch when a request doesn't actually fit its scope, similar to the pattern observed in the `agent-refine` eval for prerequisite gating.

- **Process note (not a skill flag):** In scenario 9, the with-skill subagent's transcript claimed to write `PROJECT-BRIEF.md` to the actual project root; this was verified false — no file was created outside the eval sandbox. Future iterations of this eval should explicitly instruct subagents to describe Phase 4's file write without executing a literal `Write` outside `evals/<skill>/iteration-N/`, to avoid ambiguity in transcript review.

## Recommendation

HEALTHY

All 5 metrics clear threshold with no scenario below 9.3. Trigger accuracy is 100% (15/15) across direct, paraphrased, negative, semantic, and adversarial checks, with zero flakiness across 3 reps each. Resilience is a clean 10.0/10, and Project Fit is 9.8/10 — the skill correctly self-corrects against both a wrong artifact-path assumption (scenario 7) and a pipeline sequencing inconsistency (scenario 8) rather than blindly complying. No `refine-input.json` written.
