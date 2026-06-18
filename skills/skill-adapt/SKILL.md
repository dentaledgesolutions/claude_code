---
name: skill-adapt
description: Adapts a security-audited skill to match a specific project's patterns, terminology, workflow gates, and installed skill ecosystem. Use when adapting a skill for a project, customizing a skill, modifying a skill to fit a project's workflow, after skill-audit returns PASS, or when synthesizing multiple candidate skills into one project-native skill.
---

# Skill Adapt

Rewrite a sourced skill so it fits your project like a native skill — not a transplant.

## Prerequisite

`skill-audit` must have returned **PASS** on every source before calling this. Never adapt a BLOCK or unaudited skill.

## Workflow

1. **Load source skill(s)** — read the SKILL.md (and REFERENCE.md if present) for every audited candidate. If multiple candidates passed audit, go to step 2. If only one, skip to step 3.

2. **Multi-source synthesis** (2+ candidates only) — compare candidates on these dimensions:
   - Trigger precision: which has the clearest "Use when" triggers?
   - Workflow completeness: which covers the most necessary steps?
   - Project alignment: which uses terminology closest to this project?
   - Structural quality: which has the better REFERENCE.md / scripts separation?

   Choose one as the primary source (highest combined fit). Extract specific steps or patterns from secondary sources to fill its gaps. Record which source each element came from — this goes into the provenance record in step 7.

3. **Read project context** — check in this order:
   - `CLAUDE.md` in project root
   - `.planning/PLAN.md` or `.planning/REQUIREMENTS.md`
   - `.planning/intel/CONTEXT.md` or `CONTEXT.md`
   - `.planning/codebase/PATTERNS.md`
   - `README.md` (project description and stack overview)
   - `package.json` / `pyproject.toml` (technology stack)

   Extract: stack, conventions, workflow step names, terminology, list of installed skills.

4. **Snapshot existing skill** — if a skill with this name is already installed, back it up before touching anything:
   ```bash
   cp -r skills/<skill-name> skills/<skill-name>-backup-$(date +%Y%m%d)
   ```

5. **Adapt the description** — rewrite the `description:` frontmatter using project-specific terminology and "pushy" trigger phrases: include the exact words a user would say to activate this skill. Keep "Use when [X]" format. Target ≤ 200 chars.

6. **Adapt workflow steps** — align steps with project conventions:
   - GSD projects: map to GSD phase gates (discuss → plan → execute → verify)
   - Custom projects: match step naming and artifact conventions
   - Remove steps that don't apply; add project-specific steps where needed
   - See REFERENCE.md for what's allowed vs. forbidden to change

7. **Add provenance record** — append to frontmatter:
   ```yaml
   source_url: <GitHub URL>
   source_commit: <40-char commit hash>
   adapted_for: <project name>
   adapted_date: YYYY-MM-DD
   ```
   For multi-source adaptations, include all sources. See REFERENCE.md for the full template.

8. **Write the adapted skill** — write to `skills/<skill-name>/SKILL.md`. Adapt REFERENCE.md and scripts/ only if they need project-specific examples or paths; never change their core logic.

9. **Sync to runtime** — copy to the global skills directory so Claude Code can use it immediately:
   ```bash
   cp -r skills/<skill-name> ~/.claude/skills/
   ```

10. **Conflict check** — compare the new description against installed skills: `ls skills/`. If trigger overlap > 50% with an existing skill, propose a more specific description or ask the user whether to replace.

11. **Validate** — run the checklist in REFERENCE.md. Fix any failures before proceeding.

12. **Test the trigger** — give 2-3 realistic user prompts that should activate this skill. Verify the description routes those prompts correctly. If not, sharpen the description and re-test.

13. **Report** — summarise: what was adapted from which source, what was removed, what was added, and why.

## Adaptation rules

- Keep SKILL.md concise — move detail to REFERENCE.md. Body content should be 1,500–2,000 words at most.
- Never remove the source commit hash — needed for upstream version checking.
- One skill per directory — don't merge multiple skills into one file.
- Never change script logic or scoring thresholds — only adapt framing, triggers, and step names.

See [REFERENCE.md](REFERENCE.md) for the validation checklist, provenance template, and allowed/forbidden changes table.
