# Skill Eval: agent-adapt
**Date:** 2026-06-22
**Skill version:** local
**Scenarios run:** 9 generated (full subagent eval pending)
**Baseline:** no-skill (first eval)

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | — | ≥ 80% | PENDING — run skill-eval-agent |
| Trigger Accuracy | — | ≥ 85% | PENDING |
| Context Footprint | 70L / ~280t | — | EXCELLENT |
| Project Fit Score | — | ≥ 7 | PENDING |
| Resilience Score | — | ≥ 8 | PENDING |

## Observable Assessment (manual)

**Trigger precision:** STRONG — description uses "Use when" twice (unusual but effective): once in the opening sentence, once mid-description. Covers adapting/customizing/installing after audit, and multi-source synthesis.

**Workflow completeness:** 10 numbered steps — most detailed of the three agent pipeline skills. Covers: load source(s) → multi-source synthesis → load project context (reads 9-field project-context.json) → snapshot → adapt description → adapt body → add provenance → write agent file → sync to runtime → conflict check. Mirrors skill-adapt closely.

**Context footprint:** 70 lines / ~280 tokens — EXCELLENT (lowest of all pipeline skills).

**Structural quality:** Has a provenance metadata block template. Reads all 9 project-context.json fields including hooks/mcp_servers/plugins (correctly updated alongside skill-adapt). No REFERENCE.md — all validation logic is inline.

## Issues Found

- No REFERENCE.md validation checklist (unlike skill-adapt which has one)
- Allowed vs. forbidden changes table is absent — skill-adapt has this, agent-adapt does not
- "Adapt the description" step (step 5) doesn't mention the 1024-char limit from Agent Skills spec, unlike skill-adapt step 5

## Recommendation

HEALTHY for initial use. The three missing items (REFERENCE.md, allowed/forbidden table, 1024-char limit note) are quality-of-life gaps that won't block usage but reduce adaptation reliability.
Run full `skill-eval-agent` eval to get measured scores.

## Next step

evals/agent-adapt/evals.json already generated (9 scenarios).
Run skill-eval-agent for full baseline.
Priority follow-up: add REFERENCE.md with validation checklist mirroring skill-adapt/REFERENCE.md.
