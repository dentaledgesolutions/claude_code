---
name: project-setup
description: "Use when: setting up a new Claude Code project, CLAUDE.md is missing or sparse, evals/project-context.json has empty arrays, the skill pipeline returns low project_fit_score, or a user says 'help me configure this project for Claude Code', 'set up project context', or 'my skills don't fit my project'."
compatibility: "Claude Code. Node.js ≥ 18 optional (graceful fallback if unavailable)."
---

# Project Setup

Populate `CLAUDE.md` and `evals/project-context.json` so the skill pipeline can find and adapt skills that actually fit your project.

## Quick start

```
User: help me set up this project for Claude Code
```

## Workflow

### Phase 1 — Silent discovery

Before asking the user anything, scan what already exists:

1. Check for `CLAUDE.md` (or `.claude/CLAUDE.md`) — read it fully if present; note which sections are already populated
2. Parse `package.json` if present: extract `name`, `description`, `scripts`, `dependencies`, `devDependencies`
3. Parse `pyproject.toml` if present: extract `name`; detect FastAPI/Django/Flask from content
4. Read the first 30 lines of `README.md` — extract the first substantive description line after the H1
5. Run `ls` on the project root — note top-level directories
6. Check for `.claude/settings.json`

Build a "recommended answer" for each interview question from what you found. If nothing was found for a question, note that explicitly so your recommendation is "no data — please describe."

---

### Phase 2 — Grilling interview

Ask **one question at a time**. After each answer, confirm before moving to the next.

For each question, show:
- The question
- Your recommended answer (pre-filled from Phase 1 discovery)
- "Accept (press Enter), edit, or skip?"

**Question 1 — Purpose**
> "What is this project for — who uses it and what does it help them do?"

Recommended: first substantive `README.md` line, or `description` from `package.json`. If neither exists: "no data found — please describe."

**Question 2 — Stack**
> "What's your tech stack — languages, frameworks, databases?"

Recommended: auto-detected from `dependencies`/`devDependencies` in `package.json` (map against: Next.js, React, Vue, Svelte, Angular, Express, TypeScript, FastAPI, Django, Flask, Rails, Laravel) plus `pyproject.toml` framework hints. List what was detected and ask user to add anything missing.

**Question 3 — Commands**
> "What are your day-to-day commands — test, build, lint, deploy?"

Recommended: `scripts` block from `package.json`, formatted as key → value pairs. If no `package.json`, ask for each command type explicitly.

**Question 4 — Claude rules**
> "What should Claude always do in this project? And what should it never do?"

No recommendation — this requires user judgment. Offer examples to prompt them:
- Always: "run tests before committing", "use TypeScript strict mode", "check existing patterns before adding new files"
- Never: "edit generated files", "use `any` type", "commit secrets"

**Question 5 — Directories**
> "What are the key directories and what lives in each?"

Recommended: top-level directory scan with guesses for common patterns (`src/` → source code, `tests/` or `__tests__/` → tests, `scripts/` → automation, `docs/` → documentation, `dist/` or `build/` → output). Ask user to confirm or correct each guess.

**Question 6 — Domain terms**
> "What domain terms would a skilled collaborator on this project already know?"

Recommended: capitalized acronyms from existing `CLAUDE.md` (pattern `\b[A-Z][A-Z_]{2,}\b`) plus Title-Case phrases from `README.md`. If none found: "no terms detected — list any project-specific vocabulary."

---

### Phase 3 — Generate outputs

**Write or update `CLAUDE.md`:**

If `CLAUDE.md` already exists, read it first. Supplement existing sections; do not overwrite content the user already wrote. Add missing sections only.

Use this structure:

```markdown
# <project name>

## Purpose
<answer 1>

## Quick Facts
- **Stack**: <answer 2>
- **Test Command**: <answer 3 — test>
- **Build Command**: <answer 3 — build>
- **Lint Command**: <answer 3 — lint>

## Key Directories
<answer 5, as bulleted list: path → what lives there>

## Conventions
- Claude should always: <answer 4 — always rules>
- Claude should never: <answer 4 — never rules>

## Domain Terms
<answer 6, as bulleted list>
```

**Regenerate `evals/project-context.json`:**

If Node.js ≥ 18 is available:
```bash
node skills/skill-eval/scripts/extract-project-context.js
```

If Node.js is unavailable, write `evals/project-context.json` directly from interview answers:
```json
{
  "project_name": "<name from question 1 or package.json>",
  "stack": ["<each item from answer 2>"],
  "workflow_terms": ["<capitalized acronyms from answer 6>"],
  "installed_skills": ["<ls skills/ output>"],
  "key_phrases": ["<answer 1 summary>", "<key phrases from answer 6>"],
  "artifact_paths": ["<paths mentioned in answer 5>"]
}
```

**Print handoff:**

```
Project context is ready.
  CLAUDE.md       → written/updated
  evals/project-context.json → populated

Next steps:
  /skill-scout    → find a skill for a specific capability
  /skill-guardian → run a full skill health check
```

---

## Rules

- Never ask more than one question at a time.
- Always show the recommended answer before asking — reduce friction for users who don't know what to write.
- If the user skips a question, leave that section blank in `CLAUDE.md` (don't invent content).
- If `CLAUDE.md` already has a section, show the existing content alongside your recommendation and ask which to keep.
- If Node.js is unavailable, write `evals/project-context.json` directly — never fail silently.
- This skill is idempotent: safe to re-run on any project at any time.
