# Skill Eval: brain-capture

**Date:** 2026-07-13  **Iteration:** 1  **Evaluator:** skill-eval-agent (smoke mode, 1 rep/scenario)

## Run notes

This iteration resumed a prior run that died from excessive fan-out (`evals/brain-capture/iteration-1/`
already existed with `s1-direct` and `s2-paraphrased` fully graded at 3 reps, `s3-edge_case` graded at
1 rep, and `s4-negative`/`s5-semantic`/`s6-adversarial` left as empty `dispatched` stubs with no
transcripts). Per explicit instructions for this run, methodology was constrained to **exactly 1 rep
per scenario, dispatched sequentially at peak concurrency ≤ 2 subagents**. The empty `r2`/`r3` stub
manifest entries for s4/s5/s6 (never actually dispatched with content) were removed as stale artifacts
of the prior interrupted run. The completed `r2`/`r3` transcripts for s1/s2 were left on disk as
supplementary data but are **not** counted in the metrics below, which use only the `r1` result for
every scenario — consistent with the 1-rep methodology actually executed this run. `baseline_method =
none` (recorded in `run-manifest.json`, first eval for this skill — no prior `SKILL-EVAL.md` existed).

All 9 scenarios (s1–s9) are now `graded` with `output.md`/`timing.json`/`evidence.json` present on both
sides; `run-manifest.js status` exits 0 (integrity gate passed).

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5 trigger-type checks) | ≥ 85% | PASS |
| Context Footprint | 41 lines / ~164t | — | — |
| Project Fit Score | 9.3/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1 adversarial) | ≥ 8 | PASS |

Context footprint: `skills/brain-capture/` contains a single file, `SKILL.md` (41 lines, no bundled
scripts/references — `scripts/brain/brain-capture.js` is shared toolkit infrastructure invoked by the
skill, not a bundled skill file). Extremely small footprint.

## Scenario Results

| ID | Type | Score (with-skill) | Trigger (evidence.json) | Baseline | Delta | Flag |
|----|------|---------------------|--------------------------|----------|-------|------|
| s1 | direct | 8.8 | correct (true) | 0 | +8.8 | minor: reminder says "brain-promote" instead of "brain-compile" for the candidate step |
| s2 | paraphrased | 10 | correct (true) | 0 | +10 | — |
| s3 | edge_case | 10 | correct (true) | 0 (manually corrected — harvester regex false-positive on baseline's negated mention of the marker string) | +10 | — |
| s4 | negative | 10 | correct (false) | 10 | 0 | NON-DISCRIMINATING (expected/benign — both sides correctly abstain) |
| s5 | semantic | 10 | correct (true) | 0 | +10 | — |
| s6 | adversarial | 10 | correct (false) | 10 | 0 | NON-DISCRIMINATING (expected/benign — both sides correctly decline and redirect toward brain-compile/brain-promote) |
| s7 | project-native | 10 | correct (true) | 0 | +10 | ProjectFit 10/10 |
| s8 | project-workflow | 10 | correct (true) | 0 | +10 | ProjectFit 9/10 |
| s9 | multi-turn | 10 | correct (true) | 0 | +10 | ProjectFit 9/10; no re-ask redundancy deduction |

All baseline composites for expected-`skill_loaded:true` scenarios are graded 0 by the standard hard-zero
rule (baseline structurally never emits the `Skill(brain-capture)` marker), even where the baseline
transcript independently discovered and ran the same underlying script by exploring the repo (notably
s9's baseline) — that reflects a well-documented codebase, not the skill's own value-add, and is scored
per rubric accordingly.

## Analyst Observations

- **Non-discriminating (benign):** s4 (negative) and s6 (adversarial) both show `|delta| < 0.5`. This is
  the expected shape for these scenario types — the skill's job here is to correctly *not* trigger, which
  a general-capabilities baseline also does naturally (it has no skill to over-trigger). Not a defect;
  flagged per the analyst-pass rule but does not indicate the skill adds no value.
- **Recurring minor content defect (does not fail a threshold):** s1's supplementary r1/r3 transcripts
  (2 of 3 direct-scenario reps, judgment_score 6 both times) mis-name the promotion pipeline in the
  final reminder step — SKILL.md step 5 says "remind: decisions/lessons become candidates via
  brain-compile," but these two reps say "candidates for canon via brain-promote" instead, skipping the
  compile step and jumping straight to the promote step's name. r2 and every other trigger-positive
  scenario (s2, s5, s7, s8, s9) got this reminder exactly right, so it reads as an occasional recall slip
  on the specific brain-capture → brain-compile → brain-promote pipeline ordering rather than a systemic
  gap. Below the flag thresholds (no UNSTABLE trigger flakiness — all reps triggered correctly; no
  REGRESSION; eval_pass_rate unaffected since 8.8 ≥ 7) but worth a light-touch wording tweak if this skill
  is revisited (e.g. spelling out "→ candidates via brain-compile → canon via brain-promote" explicitly in
  step 5 to reduce ambiguity).
- **No REGRESSION, ADVERSARIAL_FAILURE, or MULTI_TURN_REDUNDANCY flags.** The single adversarial scenario
  (s6) scored 10 (skill correctly declined and redirected to brain-compile/brain-promote without
  over-triggering). The single multi-turn scenario (s9) took the established type/title directly from the
  resumed-context prompt without re-asking — 0-point deduction.
- **Sensitive-content refusal path (s3) works correctly end-to-end:** with-skill attempted the script,
  hit brain-capture.js's real exit-3 refusal on the embedded password, surfaced the exact refusal reason,
  and asked for a redacted version rather than working around it (e.g. editing the log file directly or
  silently stripping the secret and writing anyway).
- **Project fit is strong (9.3/10 avg)** — all three project-context scenarios (s7 project-native, s8
  project-workflow, s9 multi-turn) correctly used real toolkit terminology (SKILL.md, skills/,
  .claude/agents/, skill-eval, skill-audit's 47-pattern scanner, brain-compile/brain-promote pipeline
  ordering) and Node.js-native script invocation with no build step.

## Recommendation

**HEALTHY** — all 5 metrics pass their standard thresholds (eval pass rate 100% ≥ 80%, trigger accuracy
100% ≥ 85%, project fit 9.3/10 ≥ 7, resilience 10/10 ≥ 8). No `refine-input.json` written. The one
recurring minor defect (brain-compile/brain-promote name confusion in the closing reminder, 2 of 3
supplementary direct-scenario reps) is noted for optional future wording tightening but does not fail any
metric.
