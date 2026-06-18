---
name: skill-adapt
description: Adapts a security-audited skill to match a specific project's patterns, terminology, workflow gates, and installed skill ecosystem. Use when adapting a skill for a project, customizing a skill, modifying a skill to fit a project's workflow, or after skill-audit returns PASS.
---

# Skill Adapt

Rewrite a sourced skill so it fits your project like a native skill — not a transplant.

## Prerequisite

`skill-audit` must have returned **PASS** before calling this. Never adapt a BLOCK or unaudited skill.

## Workflow

1. **Read source skill** — load the candidate's SKILL.md (and REFERENCE.md if present).

2. **Read project context** — look for (in order of priority):
   - `.planning/PLAN.md` or `.planning/REQUIREMENTS.md`
   - `.planning/intel/CONTEXT.md` or `CONTEXT.md`
   - `.planning/codebase/PATTERNS.md`
   - `CLAUDE.md` in project root
   
   Extract: stack, conventions, workflow steps, terminology, installed skills list.

3. **Adapt the description** — rewrite the `description:` frontmatter field to use project-specific terminology and trigger phrases. Keep "Use when [X]" format. Target ≤ 200 chars.

4. **Adapt checklist steps** — align workflow steps with project gates:
   - GSD projects: map steps to GSD phase gates (plan → execute → verify)
   - Custom projects: match step naming and artifact conventions
   - Remove steps that don't apply; add project-specific steps

5. **Add source provenance** — append to frontmatter:
   ```yaml
   source_url: <GitHub URL>
   source_commit: <commit hash>
   adapted_for: <project name>
   adapted_date: YYYY-MM-DD
   ```

6. **Conflict check** — compare new description against installed skills:
   ```bash
   ls ~/.claude/skills/
   ```
   If trigger overlap > 50% with an existing skill, propose a more specific description or ask user whether to replace.

7. **Write the adapted skill** — write to `~/.claude/skills/<skill-name>/SKILL.md`. If a scripts/ or REFERENCE.md adaptation is also needed, write those too.

8. **Report changes** — present a summary: what was changed, what was removed, what was added, and why.

## Adaptation rules

- **Keep SKILL.md under 100 lines** — move detail to REFERENCE.md.
- **Never change the core logic** — only adapt framing, triggers, and workflow step names.
- **Preserve the source commit hash** — needed for upstream version checking.
- **One skill per directory** — don't merge multiple skills into one file.
- **Test the trigger** — after writing, verify the description would correctly invoke the skill given a realistic user prompt.
