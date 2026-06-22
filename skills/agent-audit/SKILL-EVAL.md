# Skill Eval: agent-audit
**Date:** 2026-06-22
**Skill version:** local
**Scenarios run:** 9 generated (full subagent eval pending)
**Baseline:** no-skill (first eval)

## Metrics

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | — | ≥ 80% | PENDING — run skill-eval-agent |
| Trigger Accuracy | — | ≥ 85% | PENDING |
| Context Footprint | 75L / ~300t | — | OK |
| Project Fit Score | — | ≥ 7 | PENDING |
| Resilience Score | — | ≥ 8 | PENDING |

## Observable Assessment (manual)

**Trigger precision:** STRONG — description includes "Use when" with 4 trigger phrases: auditing/checking/scanning an agent, before installing via agent-adapt. Clear gate function.

**Workflow completeness:** 8 numbered steps: load agent → run static scanner (reuses skill-audit's static-scan.js) → check tool scope → check recursion → check prompt injection → check persona override → write SKILL-AUDIT.md → verdict.

**Context footprint:** 75 lines / ~300 tokens — EXCELLENT.

**Structural quality:** No REFERENCE.md or dedicated scripts/ — reuses `node skills/skill-audit/scripts/static-scan.js`. Same co-installation dependency concern as agent-scout.

## Issues Found

- Reuses skill-audit's static-scan.js but this dependency is not documented
- No REFERENCE.md for verdict escalation rules or agent-specific threat patterns
- The 5 security checks (tool escalation, recursion, prompt injection, persona override, model override) are only in SKILL.md — no lookup reference for borderline cases

## Recommendation

HEALTHY for initial use. Run full `skill-eval-agent` eval to get measured scores.
Suggested improvement: add agent-specific threat pattern documentation to a REFERENCE.md.

## Next step

evals/agent-audit/evals.json already generated (9 scenarios).
Run skill-eval-agent for full baseline.
