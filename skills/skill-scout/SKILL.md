---
name: skill-scout
description: Finds and ranks existing Claude Code skills from GitHub repositories against a project's specific characteristics and needs. Use when looking for a skill, sourcing a skill from GitHub, searching for existing skills for a capability, or when asked "is there a skill for X".
---

# Skill Scout

Find the best existing skill for a capability rather than building from scratch.

## Quick start

```
User: find a skill for code review that fits our GSD workflow
```

## Workflow

1. **Capture the need** — ask: "What capability are you looking for?" and "What does the project use?" (GSD? custom workflow? specific stack?). One question at a time.

2. **Search GitHub** — use WebSearch with queries like:
   - `site:github.com SKILL.md <capability>`
   - `site:github.com "claude code" skill <capability>`
   - `github.com topic:claude-code-skills <capability>`
   
   Also check known registries:
   - `github.com/anthropics/claude-code-skills`
   - `github.com/multica-ai/andrej-karpathy-skills`

3. **Fetch candidates** — WebFetch the raw SKILL.md for each candidate. Collect: name, description, line count, whether it has scripts/REFERENCE.md.

4. **Score candidates** — run `node ~/.claude/skills/skill-scout/scripts/score-candidates.js` with the candidate JSON. See scoring formula in REFERENCE section.

5. **Conflict check** — list installed skills: `ls ~/.claude/skills/`. Flag any candidate whose trigger words heavily overlap with an installed skill's description.

6. **Present ranked table** — show top 3 candidates with scores, trade-offs, and recommended pick. Include source URL and commit hash for pinning.

7. **Hand off to skill-audit** — once user selects a candidate, invoke `skill-audit` before any files are written.

## Scoring dimensions (0–10 each, weighted)

| Dimension | Weight | What to measure |
|-----------|--------|----------------|
| Trigger precision | 30% | Does description include "Use when" with specific triggers? |
| Instruction clarity | 25% | Numbered workflow steps? Clear outputs? |
| Context footprint | 20% | SKILL.md line count (≤50=10, ≤100=7, ≤200=4, >200=1) |
| Project fit | 15% | Terminology matches project stack/workflow |
| Conflict risk | 10% | Overlap with installed skills (0=none, penalize overlap) |

**Total score = weighted average × 10**

## Rules

- Always pin the source commit hash in your recommendation (never just a branch name).
- Never write any files — that's skill-adapt's job (after skill-audit clears the candidate).
- If no suitable candidate scores > 5, recommend building from scratch with `write-a-skill`.
