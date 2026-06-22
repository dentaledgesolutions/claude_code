# Skill Adapt Reference

## Validation Checklist

Run after writing the adapted skill (step 11). All items must pass.

**Structure:**
- [ ] `SKILL.md` exists with valid YAML frontmatter
- [ ] Frontmatter has `name` and `description` fields
- [ ] `metadata` block present with: `source_url`, `source_commit`, `adapted_for`, `adapted_date`
- [ ] Markdown body is present and substantial
- [ ] Every file referenced from SKILL.md actually exists in the skill directory

**Description quality:**
- [ ] Includes "Use when" + specific trigger phrases users would actually say
- [ ] Covers concrete scenarios ("adapt skill after audit", "install skill for project")
- [ ] ≤ 1024 characters (Agent Skills spec limit)
- [ ] Not vague or generic

**Content quality:**
- [ ] SKILL.md body uses imperative form ("Read the source skill", not "You should read")
- [ ] Body is focused — 1,500–2,000 words ideal, 5,000 max
- [ ] Detailed content in REFERENCE.md, not inline in SKILL.md
- [ ] No content duplicated across files

**Project context integration** (verify all 9 `project-context.json` fields were used):
- [ ] `stack` and `key_phrases` informed the description's trigger language
- [ ] `workflow_terms` and `artifact_paths` appear in adapted workflow steps where relevant
- [ ] `installed_skills` and `plugins` were checked for capability conflicts
- [ ] `hooks` were reviewed — no adapted workflow step duplicates a PostToolUse hook that already runs the same action
- [ ] `mcp_servers` were checked — if the skill assumes an external integration (GitHub, JIRA, etc.), the relevant MCP is either present in the list or a prerequisite note was added to the skill

**Testing:**
- [ ] 2-3 test prompts correctly activate the skill
- [ ] Trigger overlap with installed skills and plugins < 50%
- [ ] Skill does not activate on prompts it should not handle (adversarial test — resilience_score ≥ 8/10 in skill-eval)

---

## Allowed vs. Forbidden Changes

| Element | Allowed | Forbidden |
|---------|---------|-----------|
| `description:` frontmatter | Full rewrite to match project triggers | Removing "Use when" structure |
| Workflow step names | Rename to match project conventions | Reordering steps that have dependencies |
| Terminology inside steps | Replace with project-native terms | Changing what a step produces or checks |
| Steps that don't apply | Remove entirely | Removing security or safety gates |
| New project-specific steps | Add at appropriate points | Steps that bypass audit or validation |
| REFERENCE.md project examples | Add or update | Changing threat patterns or scoring rules |
| Script logic | Never change | Never change |
| Scoring/verdict thresholds | Never change | Never change |
| Source provenance fields | Never remove | Never alter hash or URL values |

---

## Provenance Frontmatter Template

```yaml
metadata:
  source_url: https://github.com/<org>/<repo>/blob/<commit>/<path>/SKILL.md
  source_commit: <40-char commit hash>
  adapted_for: <project name>
  adapted_date: YYYY-MM-DD
  project_context_source: evals/project-context.json
  license: <license from source, or omit if unknown>
```

`project_context_source` is the structured context file that shaped this adaptation. skill-eval reads the same file when generating `project-native`, `project-workflow`, and `multi-turn` scenarios — this is what closes the adapt → eval loop. If the file doesn't exist yet when adapting, generate it with `node skills/skill-eval/scripts/extract-project-context.js` first.

For multi-source adaptations, add an `additional_sources` block:

```yaml
metadata:
  source_url: https://github.com/<primary-org>/<repo>/blob/<commit>/SKILL.md
  source_commit: <primary commit hash>
  adapted_for: <project name>
  adapted_date: YYYY-MM-DD
  license: <license from primary source, or omit if unknown>
  additional_sources:
    - url: https://github.com/<secondary-org>/<repo>/blob/<commit>/SKILL.md
      commit: <secondary commit hash>
      elements_borrowed: <one-line: which steps or patterns came from this source>
```

---

## Multi-Source Synthesis Guide

When merging 2+ candidates, document your decisions in a synthesis table before writing. Keep this in the SKILL-AUDIT.md (produced by skill-audit), not in the adapted SKILL.md.

| Decision point | Primary source | Secondary source | Resolution |
|----------------|---------------|-----------------|------------|
| Workflow structure | `<candidate-A>` | — | Used A's N-step flow |
| Validation checklist | — | `<candidate-B>` | Inserted B's checklist as step N |
| Scoring dimensions | `<candidate-A>` | `<candidate-B>` | Merged: A's weights + B's provenance dimension |

**Synthesis rules:**
- One primary source owns the skeleton (workflow order, step count, overall framing)
- Secondary sources contribute discrete, well-bounded additions (a checklist step, a reference table, a scoring dimension)
- Never blend two sources' step sequences — pick one ordering and annotate additions
- Each addition must be individually attributable in `additional_sources`
