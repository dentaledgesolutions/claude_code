# Skill Eval: agent-scout
**Date:** 2026-06-22
**Skill version:** local
**Scenarios run:** 9 generated (full subagent eval pending)
**Baseline:** no-skill (first eval)

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | — | ≥ 80% | PENDING — run skill-eval-agent |
| Trigger Accuracy | — | ≥ 85% | PENDING |
| Context Footprint | 84L / ~336t | — | OK |
| Project Fit Score | — | ≥ 7 | PENDING |
| Resilience Score | — | ≥ 8 | PENDING |

## Observable Assessment (manual)

**Trigger precision:** STRONG — description uses "Use when:" format with 4 distinct trigger phrases covering find/source/discover/ranked-shortlist. Unique differentiator from skill-scout: "use this when the capability requires a spawnable sub-agent, not just a skill."

**Workflow completeness:** 9 numbered steps covering: project context pre-flight → capability capture → 4-registry parallel fetch → GitHub fallback → candidate scoring → conflict check → shortlist presentation → no-results fallback. Mirrors skill-scout structure.

**Context footprint:** 84 lines / ~336 tokens — GOOD (under 100-line target).

**Structural quality:** No REFERENCE.md or scripts/ — relies on score-candidates.js from skill-scout. This is a potential gap: the scoring script path is hardcoded as `node skills/skill-scout/scripts/score-candidates.js` which assumes co-installation. Should be noted as a dependency.

## Issues Found

- No REFERENCE.md — workflow depth lives entirely in SKILL.md body
- Dependency on `skills/skill-scout/scripts/score-candidates.js` not documented in `compatibility:` frontmatter

## Recommendation

HEALTHY for initial use. Run full `skill-eval-agent` eval to get measured scores.
Suggested improvement: add `compatibility:` note about score-candidates.js dependency.

## Next step

Run: `node skills/skill-eval/scripts/generate-seed-evals.js skills/agent-scout/SKILL.md --context evals/project-context.json` then invoke skill-eval-agent.
evals/agent-scout/evals.json already generated (9 scenarios).
