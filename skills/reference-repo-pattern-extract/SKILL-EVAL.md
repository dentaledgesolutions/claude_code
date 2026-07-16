# Skill Eval: reference-repo-pattern-extract

**Date:** 2026-07-16  **Iteration:** 1  **Evaluator:** skill-eval (native, 1 rep/scenario)

## Run notes

First eval for this skill — a full cold run (no prior artifacts existed). All 9 scenarios were
executed fresh: `with_skill` on **Opus** (the production measurement tier), `without_skill`
baselines on a **lower-cost model (Sonnet)** — result-neutral, since baseline composites are
hard-zero by rule for trigger-positive scenarios and non-discriminating for negative/adversarial
ones, so the baseline executor cannot move any gated metric. `baseline_method = none`.

**Fixtures.** The skill is the generic (source-parameterized) sibling of `gstack-pattern-audit`,
and its scenarios exercise three sources that are not in the real registry: `aprende-skill`,
`design-system-repo`, and `legacy-toolkit`. A shared fixture seed was built once and validated
before the runs: `aprende-skill` and `design-system-repo` audit clean (exit 0) and their cards
`map` to non-empty patterns/candidate_skills/candidate_agents; `legacy-toolkit` carries a
non-compliant `install_policy` so its audit deterministically returns **exit 3** — the precise
condition the s3 blocked-extraction scenario requires. Each `with_skill` run copied the seed into
its own scenario `with_skill/workspace/` and passed `--root <workspace>` to every script, so the
real capsule and reference library were never touched. The seed lives at
`evals/reference-repo-pattern-extract/_fixture-seed/` (outside the iteration dir so it is not
scanned as a scenario).

**Harvester input fix.** Like `gstack-pattern-audit`, this skill's `evals.json` had
`expected.evidence.artifacts` as bare directory strings, which crashes `harvest-evidence.js` (it
expects `{path}` objects). Normalized to `[]` to match the rest of the suite; synthesis-writing is
verified via the `workflow_steps` marker for `.project-brain/synthesis/<name>-patterns/` plus an
independent physical-file check (see Analyst Observations).

`run-manifest.js status` exits 0 (integrity gate passed — 9 scenarios `graded`, both sides present).

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% (9/9 ≥7) | ≥ 80% | PASS |
| Trigger Accuracy | 100% (5/5 trigger-type checks) | ≥ 85% | PASS |
| Context Footprint | 35 lines / ~140t | — | — |
| Project Fit Score | 10/10 | ≥ 7 | PASS |
| Resilience Score | 10/10 (1/1 adversarial) | ≥ 8 | PASS |

Context footprint: `skills/reference-repo-pattern-extract/` is a single `SKILL.md` (35 lines, no
bundled files — `brain-reference-repo-audit.js` / `-map.js` / `-refresh.js` are shared toolkit
infrastructure). Very small footprint.

## Scenario Results

| ID | Type | Score (with-skill) | Trigger (evidence.json) | Baseline | Delta | Flag |
|----|------|---------------------|--------------------------|----------|-------|------|
| s1 | direct | 10 | correct (true) | 0 | +10 | 4/4 steps (audit→map→synthesis→refresh) on aprende-skill |
| s2 | paraphrased | 10 | correct (true) | 0 | +10 | design-system-repo, component-conventions focus |
| s3 | edge_case | 10 | correct (true) | 0 | +10 | audit run for real → exit 3 → BLOCKED, no synthesis written |
| s4 | negative | 10 | correct (false) | 0 | 0 | NON-DISCRIMINATING (expected — explains output shape, no workflow) |
| s5 | semantic | 10 | correct (true) | 0 | +10 | synonym phrasing activated generic extract (not GStack) |
| s6 | adversarial | 10 | correct (false) | 0 | 0 | NON-DISCRIMINATING (expected — redirects GStack to gstack-pattern-audit) |
| s7 | project-native | 10 | correct (true) | 0 | +10 | ProjectFit 10/10; candidate_skills/agents → scout/audit pipeline |
| s8 | project-workflow | 10 | correct (true) | 0 | +10 | ProjectFit 10/10; ran map, did not skip to skill-adapt |
| s9 | multi-turn | 10 | correct (true) | 0 | +10 | ProjectFit 10/10; no re-audit, no re-ask |

Trigger-type checks (denominator = 5): s1, s2, s3, s5 correctly triggered; s4 correctly did not.
Adversarial (s6) is scored under Resilience. All trigger-positive baselines are 0 by the standard
hard-zero rule.

## Analyst Observations

- **The clean-audit gate is the skill's core value, and s3 proves it.** The user framed a flagged
  finding as "old news"; the run re-ran `brain-reference-repo-audit.js --name legacy-toolkit` for
  real, observed **exit 3**, quoted the actual `SECURITY … install_policy` finding, and STOPPED —
  explicitly declining to run map/WebFetch/synthesis/refresh and refusing to trust the staleness
  assumption. No synthesis file was written for s3 (physically confirmed), exactly as required.
- **Adversarial routing (s6) is correct.** The GStack-specific request was declined with a citation
  of the skill's "Not for: GStack specifically (gstack-pattern-audit)" exclusion and redirected to
  the dedicated skill; the generic map/extract workflow was not run. `|delta| < 0.5` is the expected
  non-discriminating shape.
- **Negative (s4) stayed conversational.** `skill_loaded=false`, zero invocation markers — the run
  described what extraction produces (`type: synthesis`, `status: candidate` files under
  `.project-brain/synthesis/<name>-patterns/`) without running anything.
- **Synthesis-authority discipline held on all six trigger-positive runs.** Each mapped the card via
  `brain-reference-repo-map.js --json`, wrote `status: candidate` synthesis into its sandboxed
  `.project-brain/synthesis/<name>-patterns/`, and recorded explicit non-adoption — candidate
  skills/agents flagged as still requiring scout → audit → adapt → eval, nothing installed
  (physically confirmed: 3 synthesis files each for s1/s2/s5/s7/s8, 1 for s9).
- **Strong project fit (10/10).** s7 used the map script's real `candidate_skills`/`candidate_agents`
  JSON shape and routed them to the skill-scout → skill-audit → skill-adapt → skill-eval pipeline;
  s8 trusted the stated clean audit but still ran the map step rather than jumping to skill-adapt;
  s9 used the already-established clean-audit status and component-conventions focus without
  re-running the audit or re-asking.

## Recommendation

**HEALTHY** — all 5 metrics pass their standard thresholds (eval pass rate 100% ≥ 80%, trigger
accuracy 100% ≥ 85%, project fit 10/10 ≥ 7, resilience 10/10 ≥ 8). No `refine-input.json` written.
