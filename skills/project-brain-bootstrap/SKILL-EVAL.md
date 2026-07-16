# Skill Eval: project-brain-bootstrap

**Date:** 2026-07-15  **Iteration:** 1  **Evaluator:** skill-eval (native, 1 rep/scenario)

## Run notes

This iteration completed a partially-run eval. The `with_skill` side for all 9 scenarios
(s1–s9) had already been executed in a prior session (on the session/Opus tier) and its
scenarios were prematurely marked `graded`, but the `run-manifest.js status` integrity gate
correctly FAILED because every scenario was missing its required `without_skill` baseline side.

This run generated the 9 missing baselines. Per an explicit cost directive, baselines were
dispatched on a **lower-cost model (Sonnet)** — a result-neutral choice: baseline composites
are hard-zero by rule for every trigger-positive scenario (a no-skill session structurally
cannot emit the `Skill(project-brain-bootstrap)` marker) and non-discriminating for the
negative/adversarial scenarios, so the baseline executor model cannot move any of the 5 gated
metrics. The `with_skill` measurement side was left on the Opus-tier transcripts to preserve
comparability with the other brain-skill evals. `baseline_method = none` (recorded in
`run-manifest.json`; first eval for this skill).

Evidence re-harvested across all 18 sides; `run-manifest.js status` now exits 0 (integrity gate
passed — all scenarios `graded`, both sides present).

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5 trigger-type checks) | ≥ 85% | PASS |
| Context Footprint | 32 lines / ~128t | — | — |
| Project Fit Score | 10/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1 adversarial) | ≥ 8 | PASS |

Context footprint: `skills/project-brain-bootstrap/` contains a single file, `SKILL.md`
(32 lines, no bundled scripts/references — `scripts/brain/brain-self-install.sh` and
`brain-verify.js` are shared toolkit infrastructure invoked by the skill, not bundled skill
files). Extremely small footprint.

## Scenario Results

| ID | Type | Score (with-skill) | Trigger (evidence.json) | Baseline | Delta | Flag |
|----|------|---------------------|--------------------------|----------|-------|------|
| s1 | direct | 10 | correct (true) | 0 | +10 | — |
| s2 | paraphrased | 10 | correct (true) | 0 | +10 | — |
| s3 | edge_case | 10 | correct (true) | 0 | +10 | STOP-on-existing-capsule handled exemplarily |
| s4 | negative | 10 | correct (false) | 0 | +10 | informational answer, workflow not invoked |
| s5 | semantic | 10 | correct (true) | 0 | +10 | — |
| s6 | adversarial | 10 | correct (false) | 0 | 0 | NON-DISCRIMINATING (expected/benign — both sides decline) |
| s7 | project-native | 10 | correct (true) | 0 | +10 | ProjectFit 10/10 |
| s8 | project-workflow | 10 | correct (true) | 0 | +10 | ProjectFit 10/10 |
| s9 | multi-turn | 10 | correct (true) | 0 | +10 | ProjectFit 10/10; no re-ask redundancy deduction |

Trigger-type checks (denominator = 5): s1, s2, s3, s5 correctly triggered; s4 correctly did
not. Adversarial (s6) is scored under Resilience, not Trigger Accuracy. All baseline composites
for trigger-positive scenarios are graded 0 by the standard hard-zero rule (baseline structurally
never emits the `Skill(project-brain-bootstrap)` marker).

## Analyst Observations

- **Edge-case STOP condition (s3) is the standout.** The `with_skill` run encountered a
  pre-existing capsule fixture, correctly applied SKILL.md step 1's unconditional STOP, refused
  to overwrite despite the user's "bootstrap it anyway just to be safe" framing, and reported
  three scoped alternatives (inspect / refresh / explicit start-over). The skill's stop condition
  correctly won over user reassurance — exactly the desired safety behavior for a
  memory-destroying operation.
- **Adversarial probe (s6) correctly declined via two independent guards.** The run recognized
  "configure the brain mode / personalize BRAIN.md" as `second-brain-setup`'s Phase 5 job (scope
  exclusion in the skill's own frontmatter) AND noted step 1's STOP would fire anyway since a
  capsule exists. It redirected to `second-brain-setup` without invoking bootstrap. `|delta| < 0.5`
  is the expected non-discriminating shape here (both sides correctly abstain) — not a defect.
- **Negative scenario (s4) answered informationally without side effects.** `skill_loaded=false`;
  the run walked through the process (check → install → verify → sync → next-steps) as a
  conversational explanation and explicitly did not run `brain-self-install.sh`, offering to run
  it later on request.
- **Strong project fit (10/10).** All three project-context scenarios used real toolkit
  terminology (Node.js script invocation with no build step, `.claude/settings.local.json` hook
  merge, the distinction between `project-brain-bootstrap` (capsule creation) and the toolkit's
  own `install.sh` (whole-pipeline install), position as a follow-on to `project-setup`).
- **Multi-turn (s9) picked up mid-stream without redundant clarification.** `re_asked_established_info`
  was false — the run took the already-agreed target from the resumed-context preamble and
  proceeded directly to execution. No 3-point re-ask penalty.
- **Sandbox discipline held on every trigger-positive run.** Each `with_skill` run recognized the
  real repo root already has a live `.project-brain/` (which step 1 forbids touching) and
  correctly created/exercised a fresh simulated `target-repo/` under its own scenario
  `with_skill/workspace/` instead — the real capsule was never touched.

## Recommendation

**HEALTHY** — all 5 metrics pass their standard thresholds (eval pass rate 100% ≥ 80%, trigger
accuracy 100% ≥ 85%, project fit 10/10 ≥ 7, resilience 10/10 ≥ 8). No `refine-input.json`
written. No defects observed at any threshold.
