# Skill Eval: gstack-pattern-audit

**Date:** 2026-07-15  **Iteration:** 1  **Evaluator:** skill-eval (native, 1 rep/scenario)

## Run notes

This iteration completed a partially-run eval. Scenarios s1 (direct), s4 (negative), and s6
(adversarial) had both sides present from a prior session (with_skill on the session/Opus tier).
The remaining six trigger-positive scenarios (s2, s3, s5, s7, s8, s9) had no with_skill runs, and
most scenarios were missing baselines. This run generated the 6 missing `with_skill` runs and all
missing `without_skill` baselines, initialized the iteration's `run-manifest.json`
(`baseline_method = none`), harvested evidence, and graded.

**Model split (per cost directive):** the six new `with_skill` measurement runs were executed on
**Opus** (the tier the skill runs on in production and the tier the pre-existing s1/s4/s6 used —
downgrading the measurement side would change trigger/output behavior). The baselines were
executed on a **lower-cost model (Sonnet)** — result-neutral, since baseline composites are
hard-zero by rule for every trigger-positive scenario and non-discriminating for the
negative/adversarial ones, so the baseline executor cannot move any gated metric.

Each `with_skill` run mirrored `reference-repositories/` + a minimal `.project-brain/` into its
own scenario `with_skill/workspace/` and passed `--root <workspace>` to every script, so the real
capsule and reference library were never touched.

**Harvester fix (input normalization):** gstack's `evals.json` was the only skill in the suite
whose `expected.evidence.artifacts` held bare directory strings
(`".project-brain/synthesis/gstack-patterns/"`) rather than the `{path}` objects
`harvest-evidence.js` expects — this crashed the harvester (the pre-existing s1 evidence.json
showed `artifacts: undefined`, confirming the path never worked). The artifacts arrays were
normalized to `[]` to match the other 13 brain skills, all of which verify synthesis-writing via
the `workflow_steps` marker for `.project-brain/synthesis/gstack-patterns/` rather than the
auxiliary artifact-existence check. Synthesis output was then independently confirmed to physically
exist in every trigger-positive workspace (see Analyst Observations).

`run-manifest.js status` exits 0 (integrity gate passed — all 9 scenarios `graded`, both sides
present).

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5 trigger-type checks) | ≥ 85% | PASS |
| Context Footprint | 35 lines / ~140t | — | — |
| Project Fit Score | 10/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1 adversarial) | ≥ 8 | PASS |

Context footprint: `skills/gstack-pattern-audit/` contains a single file, `SKILL.md` (35 lines,
no bundled scripts/references — `brain-reference-repo-audit.js` / `brain-reference-repo-refresh.js`
are shared toolkit infrastructure invoked by the skill, not bundled). Very small footprint.

## Scenario Results

| ID | Type | Score (with-skill) | Trigger (evidence.json) | Baseline | Delta | Flag |
|----|------|---------------------|--------------------------|----------|-------|------|
| s1 | direct | 10 | correct (true) | 0 | +10 | 4/4 workflow steps (audit→WebFetch→synthesis→refresh) |
| s2 | paraphrased | 10 | correct (true) | 0 | +10 | review-chain focus honored |
| s3 | edge_case | 10 | correct (true) | 0 | +10 | audit gate run for real, not fabricated/assumed |
| s4 | negative | 10 | correct (false) | 0 | 0 | NON-DISCRIMINATING (expected — explains "what is GStack", no workflow) |
| s5 | semantic | 10 | correct (true) | 0 | +10 | synonym phrasing activated; correct target (not generic extract) |
| s6 | adversarial | 10 | correct (false) | 0 | 0 | NON-DISCRIMINATING (expected — rejects non-GStack aprende-skill source) |
| s7 | project-native | 10 | correct (true) | 0 | +10 | ProjectFit 10/10; compared vs real skills/, no install |
| s8 | project-workflow | 10 | correct (true) | 0 | +10 | ProjectFit 10/10; synthesis only, did not run skill-adapt |
| s9 | multi-turn | 10 | correct (true) | 0 | +10 | ProjectFit 10/10; no re-ask, no fresh re-audit |

Trigger-type checks (denominator = 5): s1, s2, s3, s5 correctly triggered; s4 correctly did not.
Adversarial (s6) is scored under Resilience. All trigger-positive baseline composites are 0 by the
standard hard-zero rule (baseline structurally never emits the `Skill(gstack-pattern-audit)`
marker).

## Analyst Observations

- **Edge-case audit gate (s3) is handled exactly as specified.** The prompt ("go ahead and start
  comparing it to the source card") invites skipping step 1's audit gate; the run instead executed
  `brain-reference-repo-audit.js --name gstack` for real, confirmed exit 0, and explicitly noted
  that a non-zero audit would have STOPPED the workflow — the audit result was not fabricated to
  keep moving.
- **Adversarial probe (s6) correctly declined.** The request targeted `aprende-skill` (a non-GStack
  source); the run read the skill, cited its "Not for: generic sources (reference-repo-pattern-extract)"
  scope exclusion, and did not run the GStack-specific workflow or WebFetch GStack. `|delta| < 0.5`
  is the expected non-discriminating shape (both sides decline) — not a defect.
- **Negative scenario (s4) answered informationally.** `skill_loaded=false`; the run explained what
  GStack is (reference source, 7-stage sprint loop, registered in `reference-repositories/`) without
  invoking the extraction workflow.
- **Synthesis-authority discipline held on every trigger-positive run.** All six new with_skill runs
  wrote `type: synthesis`, `status: candidate` files into their sandboxed
  `.project-brain/synthesis/gstack-patterns/` (physically verified: s2 review-chain.md; s3
  sprint-loop-and-review-chain.md; s5 qa-and-review-chain.md; s7 skill-convention-patterns.md; s8
  three files incl. cross-model-review-gate.md; s9 review-chain.md) and each explicitly recorded
  non-adoption — nothing installed, no skill-adapt/scout run, GStack skills flagged as requiring
  scout → audit → adapt → eval before any use.
- **Strong project fit (10/10).** s7 compared GStack's skill list against the real `skills/` inventory
  (naming real siblings) and wrote findings as synthesis rather than into `skills/`; s8 sat correctly
  in the skill-scout → gstack-pattern-audit → skill-adapt handoff without duplicating discovery or
  running adaptation; s9 picked up the established review-chain focus and clean-audit status without
  re-asking or re-running the gate from scratch.

## Recommendation

**HEALTHY** — all 5 metrics pass their standard thresholds (eval pass rate 100% ≥ 80%, trigger
accuracy 100% ≥ 85%, project fit 10/10 ≥ 7, resilience 10/10 ≥ 8). No `refine-input.json` written.
