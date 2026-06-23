# Project Skill Health Report
**Project:** claude_code
**Date:** 2026-06-23
**Guardian run:** Phases 0-4 complete

---

## Context Freshness

`evals/project-context.json` is current (generated within the last 7 days). Fields confirmed non-empty:
- `stack`: Node.js
- `key_phrases`: 2 entries (project purpose + infrastructure description)
- `installed_skills`: 10 skills enumerated
- `hooks`: 10 active hooks (SessionStart x3, PostToolUse x3, PreToolUse x4)
- `mcp_servers`: empty (no MCP integrations active)
- `plugins`: 5 (superpowers, skill-creator, context-mode, claude-mem, frontend-design)

---

## Security Grade

**Current scan:** Grade C — 68/100
**Prior scan (2026-06-23 earlier artifact):** Grade C — 71/100
**Trend: degraded** (C/71 → C/68, -3 points, same letter grade)

### Category Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| secrets | 100/100 | Clean |
| permissions | 36/100 | 5 high-severity allow rules too broad |
| hooks | 100/100 | Clean |
| mcp_servers | 100/100 | No MCP servers configured |
| agents | 5/100 | 4 agents with Bash access; 4 agents oversized (>5000 effective chars) |

### High-Severity Findings (10 total)

**Permissions (5 high)** — all in `settings.local.json`:
1. `Bash(node skills/*)` — wildcard node execution across all skill scripts
2. `Bash(node scripts/*)` — wildcard node execution across all scripts
3. `Bash(node -e *)` — arbitrary inline node code execution
4. `Bash(node *)` — unrestricted node invocation
5. `Bash(python3 -c "...")` — inline Python execution (hardcoded one-liner, lower practical risk)

**Agents (5 high)**:
1. `skill-eval-agent.md` — Bash access
2. `skill-needs-analysis-agent.md` — Bash access
3. `skill-refine-agent.md` — Bash access
4. `skill-scout-agent.md` — Bash access AND web+write combination (prompt-injection risk: can fetch external content and write files)
5. `skill-scout-agent.md` also flagged for web+write access (counted once above)

### Medium-Severity Findings (6 total)
- `Bash(curl -s *)` — unrestricted HTTP requests via curl
- No PreToolUse hooks in `settings.local.json` (note: `settings.json` has PreToolUse hooks; this finding may be scoped to the local file only)
- `skill-eval-agent.md` — 7,041 effective chars (>5,000 threshold)
- `skill-guardian.md` — 9,110 effective chars (>5,000 threshold)
- `skill-refine-agent.md` — 7,258 effective chars (>5,000 threshold)
- `skill-scout-agent.md` — 5,063 effective chars (>5,000 threshold)

No critical findings. No auto-fixable findings.

---

## Skill Inventory

| Skill | Classification | SKILL-EVAL.md | SKILL-REFINE-LOG.md | Static Scan Verdict |
|-------|---------------|---------------|---------------------|---------------------|
| agent-adapt | ACTIVE | yes | no | PASS |
| agent-audit | ACTIVE | yes | no | PASS |
| agent-scout | ACTIVE | yes | no | PASS |
| project-audit | ACTIVE | yes (new) | no | PASS |
| project-setup | ACTIVE | yes (new) | no | PASS |
| skill-adapt | ACTIVE | yes (new) | no | PASS |
| skill-audit | ACTIVE | yes (new) | no | PASS |
| skill-eval | ACTIVE | yes (new) | no | PASS |
| skill-refine | ACTIVE | yes (new) | no | PASS |
| skill-scout | ACTIVE | yes | yes | PASS |

**Classification rationale:** All 10 skills now have SKILL-EVAL.md baselines. The 6 previously INSTALLED skills were evaluated in Phase 3 of this guardian run.

---

## Phase 2 Static Scan Results

All 10 skills already had `SKILL-AUDIT.md` files. No new scans were required. Every skill returned verdict PASS across all 5 categories (prompt injection, dangerous Bash in instructions, secrets, permissions, scripts).

No BLOCK or FLAG verdicts. No skills are suspended from evaluation.

---

## Phase 3 Eval Results — All 10 Skills

### Summary

| Status | Count |
|--------|-------|
| Healthy (all thresholds met) | 10 |
| Needs refinement (one threshold missed) | 0 |
| Critical (eval_pass_rate < 60% or resilience < 6) | 0 |
| Blocked (security) | 0 |
| Not yet evaluated | 0 |

### Per-Skill Status

Skills evaluated in this run (Phase 3, 2026-06-23). The 4 previously evaluated skills (agent-adapt, agent-audit, agent-scout, skill-scout) retained their existing SKILL-EVAL.md and were not re-run.

| Skill | Status | Pass Rate | Trigger Acc | Resilience | Fit Score | Footprint | Last Eval | Action |
|-------|--------|-----------|-------------|------------|-----------|-----------|-----------|--------|
| project-setup | Healthy | 89% | 93% | 10/10 | 8.2/10 | 354L / ~1,416T | 2026-06-23 | Evaluated |
| project-audit | Healthy | 89% | 100% | 10/10 | 8.5/10 | 190L / ~760T | 2026-06-23 | Evaluated |
| skill-adapt | Healthy | 89% | 93% | 10/10 | 7.5/10 | 101L / ~404T | 2026-06-23 | Refined (2 iters) |
| skill-audit | Healthy | 89% | 93% | 10/10 | 8.3/10 | 51L / ~204T | 2026-06-23 | Evaluated |
| skill-eval | Healthy | 89% | 87% | 10/10 | 8.7/10 | 105L / ~420T | 2026-06-23 | Refined (2 iters) |
| skill-refine | Healthy | 89% | 93% | 10/10 | 8.0/10 | 73L / ~292T | 2026-06-23 | Evaluated |

Note: skill-eval's eval_pass_rate was corrected to 89% after tabulation review (scenario 9 scored 7, which meets the ≥7 threshold; only scenario 3 failed at 6). The REFINE flag was driven by Lever B gaps in the workflow, not the pass rate metric. Both gaps are now closed.

**Threshold key:**
- eval_pass_rate: ≥ 80% to pass
- trigger_accuracy: ≥ 85% to pass
- resilience_score: ≥ 8/10 to pass
- project_fit_score: ≥ 7/10 to pass

### Phase 4 Refinements Applied (2026-06-23)

**skill-adapt — 2 iterations, 2 levers:**

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| eval_pass_rate | 78% | 89% | +11pp |
| trigger_accuracy | 87% | 93% | +6pp |
| resilience_score | 10/10 | 10/10 | 0 |
| project_fit_score | 7.5/10 | 7.5/10 | 0 |
| context_footprint | 99L / ~396T | 101L / ~404T | +2L |

- Iter 1 (Lever A): Added "rewriting a skill to match project conventions" to `description:` frontmatter. Fixed scenario 5 trigger from 2/3 to 3/3. eval_pass_rate 78% → 89%.
- Iter 2 (Lever C): Added "Fully-Populated Example" subsection to provenance template in REFERENCE.md with explicit `license: MIT` and instruction "never omit the field". Fixed scenario 3 license omission (0/3 → 3/3).

**skill-eval — 2 iterations, 2 levers (both Lever B):**

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| eval_pass_rate | 89% | 89% | 0pp |
| trigger_accuracy | 87% | 87% | 0pp |
| resilience_score | 10/10 | 10/10 | 0 |
| project_fit_score | 7.8/10 | 8.7/10 | +0.9 |
| context_footprint | 100L / ~400T | 105L / ~420T | +5L |

- Iter 1 (Lever B): Inserted "Resume check" block before step 1. Instructs skill to skip completed steps when user signals mid-workflow entry. Fixed scenario 3 (steps 2–3 no longer re-run). Score: 6.0 → 9.0.
- Iter 2 (Lever B): Rewrote step 2 opening to check for prior session confirmation of evals/project-context.json before running extraction script. Added "do not ask the user whether to include it" directive for --context flag. Fixed scenario 9 multi-turn redundancy penalty (-3 → 0). project_fit_score: 7.8 → 8.7.

### Systemic Pattern: Improvement-Verb Flakiness

Two skills showed the same symptom in their semantic scenario:
- skill-adapt scenario 5: "rewrite" triggered 2/3 reps (not in description)
- skill-refine scenario 5: "optimize" triggered 2/3 reps (not in description)

Both skills describe their action using "adapt"/"refine" but users also naturally say "rewrite", "optimize", "tune", "overhaul". This is a cross-skill description gap. When refining these skills, consider whether to add these synonyms to trigger phrases or add negative examples to prevent over-broad triggering. The latter is safer — "rewrite" intentionally routes to a different workflow (write-a-skill, not skill-adapt), and "optimize" may be ambiguous.

---

## Findings Requiring Attention

### Security (project-level — not skill content)

**FLAG: skill-scout-agent.md web+write combination**
This agent is permitted to fetch from the web (WebFetch, WebSearch) and write files (Write, Bash). A prompt injection payload hosted on a scouted GitHub page could instruct the agent to modify local skill files. Recommended mitigation: split the scout workflow into a read-only research sub-agent and a separate write-gated installation step.

**FLAG: Four broad node allow rules in settings.local.json**
`Bash(node *)`, `Bash(node skills/*)`, `Bash(node scripts/*)`, and `Bash(node -e *)` collectively allow arbitrary Node.js execution. These are intentional for the pipeline's eval and scout scripts, but `Bash(node -e *)` in particular permits inline code that is not traceable to a named file. Consider removing `Bash(node -e *)` and replacing with specific named scripts.

**INFO: Agent oversize warnings**
Four agents exceed 5,000 effective characters. These are the guardian and eval/refine/scout agents which are inherently complex. Review is recommended but the size is expected given their role; no malicious content found in static scan.

### Skill Audit (per-skill content)

No BLOCK or FLAG verdicts from Phase 2. All 10 skills PASS.

---

## Recommendations

1. ~~**Run skill-refine on skill-adapt**~~ — DONE (2026-06-23). Lever A + Lever C applied. eval_pass_rate 78% → 89%. Both analyst gaps closed. See `skills/skill-adapt/SKILL-REFINE-LOG.md`.

2. ~~**Run skill-refine on skill-eval**~~ — DONE (2026-06-23). Two Lever B edits applied. project_fit_score 7.8 → 8.7. Resume checkpoint and continuation-awareness added. See `skills/skill-eval/SKILL-REFINE-LOG.md`.

3. **Remove or scope-down `Bash(node -e *)` in `settings.local.json`** — lowest-effort, highest-impact permissions fix. Replaces inline eval with named script calls.

4. **Separate skill-scout-agent.md into a read-only scout phase and a write-gated install phase** — eliminates the web+write attack surface flagged by AgentShield.

5. **Monitor project-setup footprint** — at 354 lines / ~1,416 tokens it is the largest skill in the pipeline by a factor of 2x. All future additions should route to REFERENCE.md. If footprint exceeds 400 lines, consider splitting Phase 0 (reference repo fetching) into a dedicated sub-skill.

6. **Add "review" and "check" to project-audit description triggers** — the semantic scenario revealed that these synonyms work but cause Step 4b (persist to project-context.json) to be skipped. Adding them explicitly will make the full checklist fire reliably.
