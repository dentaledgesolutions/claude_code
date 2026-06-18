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

2. **Check known registries first** — before a generic search, WebFetch the index or README of these known sources and scan for a match:
   - `github.com/anthropics/claude-code-skills`
   - `github.com/multica-ai/andrej-karpathy-skills`
   - `github.com/vercel-labs/skills`
   - `github.com/ComposioHQ/awesome-claude-skills`

   If a match is found here, skip step 3 and go directly to step 4.

3. **Search GitHub** — if registries don't cover the need, use WebSearch with:
   - `site:github.com filename:SKILL.md <capability>`
   - `github.com/search?type=code&q=filename:SKILL.md+<capability>`
   - `site:github.com "claude code" skill <capability>`

   If one query returns nothing, try alternative terms (e.g., "deploy" → "deployment", "review" → "audit").

4. **Fetch candidates** — WebFetch the raw `SKILL.md` for each candidate. Collect: name, description, full body text, line count, whether it has scripts/REFERENCE.md, repo age in days, star count, source org.

5. **Score candidates** — run `node skills/skill-scout/scripts/score-candidates.js <candidates.json>`. See scoring dimensions below.

6. **Conflict check** — list installed skills: `ls skills/`. Flag any candidate whose trigger words heavily overlap with an installed skill's description.

7. **Present top 3** — for each candidate show:

   ```
   1. <skill-name>  (score: N/10 — STRONG | GOOD | MARGINAL)
      <one-line description>
      Source: github.com/<org>/<repo>@<commit-hash>  ★ <stars>
      Trade-off: <one sentence>
      → Next: skill-audit then skill-adapt
   ```

8. **Hand off to skill-audit** — once the user selects a candidate, invoke `skill-audit` before any files are written.

9. **No results fallback** — if no candidate scores > 5 and no registry match was found:
   - Tell the user no suitable skill was found.
   - Offer to help with the task directly using general capabilities.
   - Recommend building a new skill: invoke `write-a-skill`.

## Scoring dimensions (0–10 each, weighted)

| Dimension | Weight | What to measure |
|-----------|--------|----------------|
| Trigger precision | 25% | Does description include "Use when" with specific triggers? |
| Instruction clarity | 20% | Has REFERENCE.md? Sufficient depth (≥20 lines)? |
| Context footprint | 15% | SKILL.md line count (≤50=10, ≤100=7, ≤200=4, >200=1) |
| Project fit | 15% | Keyword matches in description **and** SKILL.md body |
| Provenance | 10% | Repo age + stars (penalize <30 days; reward ≥100 stars) |
| Source reputation | 10% | Trusted orgs (anthropics, vercel-labs, microsoft…) score higher |
| Conflict risk | 5% | Word-overlap with installed skills |

**Total score = weighted average × 10**

## Common skill categories

| Category | Example search terms |
|----------|---------------------|
| Code quality | review, audit, lint, refactor |
| Testing | tdd, testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| Documentation | docs, readme, changelog, api-docs |
| UI / Design | ui, ux, design-system, accessibility |
| Workflow | planning, phases, git, automation |
| AI integration | llm, agents, mcp, prompt |

## Rules

- Always pin the source commit hash in your recommendation (never just a branch name).
- Never write any files — that's skill-adapt's job (after skill-audit clears the candidate).
- Prefer skills from trusted source orgs; explicitly flag unknown authors with low stars.
- If no suitable candidate scores > 5, recommend building from scratch with `write-a-skill`.
