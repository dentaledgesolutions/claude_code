# project-idea Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `project-idea` skill that turns a vague greenfield idea into a structured `PROJECT-BRIEF.md` through a short guided interview, then update `project-setup` to read that brief and pre-fill its Q1–Q6 recommendations.

**Architecture:** Two SKILL.md edits — one new file (`skills/project-idea/SKILL.md`) and one targeted addition to `skills/project-setup/SKILL.md`. No new scripts, no new dependencies. The brief is plain markdown written to the project root; `project-setup` reads it silently during Phase 1 discovery.

**Tech Stack:** Markdown only. Node.js not required.

## Global Constraints

- No new npm dependencies
- SKILL.md files follow existing frontmatter + workflow pattern used by all skills in `skills/`
- Static-scan (`node skills/skill-audit/scripts/static-scan.js`) must return PASS verdict on every modified or created skill before committing
- Deploy to `~/.claude/skills/` after writing any skill so changes take effect immediately in Claude Code: `cp -r skills/<name> ~/.claude/skills/<name>`
- Commit message format: `feat(<scope>): <description>`

---

### Task 1: Create `skills/project-idea/SKILL.md`

**Files:**
- Create: `skills/project-idea/SKILL.md`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `PROJECT-BRIEF.md` in the project root (read by Task 2's `project-setup` changes)

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p skills/project-idea
```

Expected: no output, directory exists.

- [ ] **Step 2: Write `skills/project-idea/SKILL.md`**

Create the file with this exact content:

```markdown
---
name: project-idea
description: >
  Use when: starting a new project from scratch, clarifying a vague idea before
  building, not sure what to build or how to structure it, or wanting confirmation
  on an early-stage concept. Interviews the user one question at a time to define
  the problem, target user, core features, out-of-scope items, tech direction, and
  success criteria. Produces PROJECT-BRIEF.md. Run before project-setup on any
  greenfield project.
---

# Project Idea

Turn a vague idea into a structured project brief through a short guided interview. Produces `PROJECT-BRIEF.md` that `project-setup` reads to pre-fill its recommendations.

## Quick Start

```
User: I have an idea for a project
User: I want to build something but I'm not sure where to start
User: help me figure out what to build
User: I want to start a new project
User: can you help me plan my idea
```

## Workflow

### Phase 0 — Existing Brief Check

Silently attempt to read `PROJECT-BRIEF.md`. If it exists:

> "I found an existing project brief. Do you want to update it, or start over?"

- **Update:** re-run the interview with current brief values as pre-filled recommendations; treat each existing answer as the recommended answer for that question.
- **Start over:** proceed as if no brief exists.

If no brief exists, proceed directly to Phase 1.

### Phase 1 — Three Anchor Questions

Ask one question at a time. Wait for the user's answer before continuing. Each anchor has one optional adaptive probe — use it only when the answer is vague or abstract. Never chain probes or ask two questions in the same message.

---

**Anchor 1 — Problem + who**

> "What problem does this project solve, and who experiences it?"

**Probe trigger:** Answer is vague — subject is generic ("it helps people", "it's for users", "for everyone", "for businesses").

**Probe:**
> "Can you give me a concrete example — who is the person, and what are they trying to do right now?"

Store: `problem` (the full picture of who + what problem), `target_user` (the concrete person).

---

**Anchor 2 — What it does**

> "Describe what the project does in one or two sentences — imagine explaining it to a friend."

**Probe trigger:** Answer is abstract or a feature list ("it does many things", "it has a dashboard, reports, notifications…").

**Probe:**
> "What would a user actually do when they first open it?"

Store: `what_it_does`.

---

**Anchor 3 — Out of scope**

> "What would you leave out of the first version?"

**Probe trigger:** Answer is "nothing", blank, or "I don't know".

**Probe:**
> "For example — would you skip user accounts? Payment processing? A mobile version?"

Store: `out_of_scope` (list of excluded items; may be empty if the user genuinely has none).

---

### Phase 2 — Tech Direction

After the three anchors, derive the platform type from what was described. Then suggest a concrete starting point in plain language — not bare framework names, but a description with named examples.

**Derive platform type from the user's description:**

| Signal in description | Platform type |
|---|---|
| "website", "web app", "browser", "online tool" | web app |
| "phone app", "mobile", "iOS", "Android" | mobile app |
| "API", "backend", "server", "service" | API / backend |
| "command line", "terminal", "script", "CLI" | CLI tool |
| "desktop app", "Windows app", "Mac app" | desktop app |
| "data", "pipeline", "spreadsheet", "analysis", "ML" | data pipeline |
| Unclear or mixed | Ask first: "Would this be a website, a mobile app, or something else?" |

**Suggested defaults by platform type:**

| Platform | Plain-language suggestion | Example tools to name |
|---|---|---|
| Web app | "a website with a database behind it" | Next.js, Supabase |
| Mobile app | "a cross-platform mobile app" | React Native, Expo |
| API / backend | "a server that responds to requests" | Node.js + Express, or FastAPI |
| CLI tool | "a command-line script" | Node.js or Python |
| Desktop app | "a desktop application" | Electron or Tauri |
| Data pipeline | "a script that processes and transforms data" | Python + pandas |

**Question framing:**

> "For [platform type] like this, a common approach is [plain-language suggestion]. Tools like [Example A] and [Example B] are popular and [relevant quality — beginner-friendly / free / fast to start]. Does that direction work, or do you already use specific tools — or need anything to be [free / offline-capable / in a specific language]?"

If the user has no preference and no constraints, accept the suggestion as-is. Store: `tech_direction`.

### Phase 3 — Name and Success Signal

**If the project name is not yet clear from context**, ask it as the first question in Phase 3:

> "What do you want to call this project?"

Then ask the success signal question (no adaptive probe — accept any answer):

> "How would you know this project succeeded? What would be different?"

Store: `project_name`, `success_looks_like`.

### Phase 4 — Write `PROJECT-BRIEF.md`

Write to the project root immediately after Phase 3. Use this exact structure:

```markdown
# Project Brief: <project_name>

## Problem
<problem — use the user's own words>

## What It Does
<what_it_does — use the user's own words>

## Target User
<target_user — concrete person from Anchor 1 or its probe>

## Core Features (v1)
<inferred from what_it_does minus out_of_scope — derive 3–5 bullets; never ask the user for this list>

## Out of Scope (v1)
<out_of_scope — each item as a bullet; write "None stated." if empty>

## Tech Direction
<tech_direction — plain-language description + named tools + any stated constraints>

## Success Looks Like
<success_looks_like — user's own words>

## Open Questions
<anything that came up but was not resolved — write "None." if empty>
```

**Writing rules:**
1. Use the user's own words wherever possible. Do not paraphrase into technical language they did not use.
2. Core Features are inferred — derived from `what_it_does` minus `out_of_scope`. Never ask the user for a feature list directly.
3. Open Questions are non-blocking — capture unresolved items here; the brief is always written regardless.
4. Never leave a section blank. Use "None stated." or "None." for empty sections rather than omitting them.

### Closing Message

After writing the file, show a one-paragraph summary of what was captured (project name, what it does, platform type), then:

> "`PROJECT-BRIEF.md` saved. Run `/project-setup` next — it will read your brief and pre-fill its questions so you just confirm rather than type."

---

## Rules

- **One question per message** — never ask two questions in the same message.
- **At most one probe per anchor** — if the probe answer is still vague, accept it and move on. Do not chain follow-ups.
- **Never ask for a feature list directly** — derive Core Features from the other answers.
- **Always write the brief** — even if some answers are vague or incomplete. Open Questions captures what's unresolved.
- **Plain language for tech** — always describe the stack in plain terms before naming tools. Never drop a bare framework name without context ("a tool for building websites called Next.js" beats "Next.js" alone for a non-technical user).
```

- [ ] **Step 3: Verify the file was written correctly**

```bash
grep -n "name: project-idea\|Phase 0\|Phase 1\|Phase 2\|Phase 3\|Phase 4\|PROJECT-BRIEF" skills/project-idea/SKILL.md
```

Expected output includes: `name: project-idea`, all five phase headings, and multiple `PROJECT-BRIEF` references.

- [ ] **Step 4: Run static-scan and verify PASS**

```bash
node skills/skill-audit/scripts/static-scan.js skills/project-idea/
```

Expected output:
```json
{
  "verdict": "PASS",
  ...
  "summary": { "total": 0, "BLOCK": 0, "FLAG": 0 },
  "findings": []
}
```

If verdict is not PASS, fix the flagged content before continuing.

- [ ] **Step 5: Deploy to `~/.claude/skills/`**

```bash
cp -r skills/project-idea ~/.claude/skills/project-idea
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add skills/project-idea/SKILL.md
git commit -m "feat(project-idea): add greenfield planning skill — guided interview produces PROJECT-BRIEF.md"
```

---

### Task 2: Update `skills/project-setup/SKILL.md` to read `PROJECT-BRIEF.md`

**Files:**
- Modify: `skills/project-setup/SKILL.md` (Phase 1 Discovery section — steps 1 and 2)

**Interfaces:**
- Consumes: `PROJECT-BRIEF.md` written by Task 1's skill at runtime
- Produces: enriched Q1, Q2, Q4, Q6 recommendations labeled `(from project brief)`

- [ ] **Step 1: Add `PROJECT-BRIEF.md` to the Phase 1 file scan list**

In `skills/project-setup/SKILL.md`, find this block (around line 115):

```
1. **Scan for existing files** — attempt Read on each (silently skip if missing):
   - `CLAUDE.md` and `.claude/CLAUDE.md`
   - `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`
   - `requirements.txt`
   - `README.md`
   - Check for any `*.ipynb` files: `ls *.ipynb 2>/dev/null`
   - `.claude/settings.json` — read `hooks` key (detect active automation events)
   - `.mcp.json` — read `mcpServers` keys (detect external integrations)
   - `~/.claude/settings.json` — read `enabledPlugins` keys (detect active plugins)
   - `logs/decisions.md`, `logs/agent-handoffs.md`, `logs/skill-improvement-backlog.md` — note whether `logs/` exists; these are read by `skill-discovery` to surface skill candidates from accumulated project activity
```

Replace it with:

```
1. **Scan for existing files** — attempt Read on each (silently skip if missing):
   - `PROJECT-BRIEF.md` — if present, signals a `project-idea` run preceded this setup; read and store as `brief`. Show one note at interview open: *"Found `PROJECT-BRIEF.md` — recommendations pre-filled from your project brief."*
   - `CLAUDE.md` and `.claude/CLAUDE.md`
   - `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`
   - `requirements.txt`
   - `README.md`
   - Check for any `*.ipynb` files: `ls *.ipynb 2>/dev/null`
   - `.claude/settings.json` — read `hooks` key (detect active automation events)
   - `.mcp.json` — read `mcpServers` keys (detect external integrations)
   - `~/.claude/settings.json` — read `enabledPlugins` keys (detect active plugins)
   - `logs/decisions.md`, `logs/agent-handoffs.md`, `logs/skill-improvement-backlog.md` — note whether `logs/` exists; these are read by `skill-discovery` to surface skill candidates from accumulated project activity
```

- [ ] **Step 2: Add brief priority to the auto-recommendations block**

In the same file, find the auto-recommendations block (around line 126). It begins:

```
2. **Build auto-recommendations** for each interview question.
   When `ref_signals` is non-null, supplement local signals with reference signals as described below. Reference signals never override local signals — local always wins when present. Reference-sourced values are labeled `(from references)`.

   - **Q1 rec**: `package.json:description` → first substantive non-heading line of README.md → `ref_signals.ref_purpose` labeled `(from references)` → `null`
   - **Q2 rec**: stack tokens from local manifests ...
   - **Q3 rec**: `package.json:scripts` keys ...
   - **Q4 rec**: none from local files — but if `ref_signals` is non-null ...
   - **Q5 rec**: top-level directories ...
   - **Q6 rec**: all-caps tokens ...
```

Replace it with:

```
2. **Build auto-recommendations** for each interview question.
   When `brief` is non-null (from `PROJECT-BRIEF.md`), brief values take priority over all other signals. Brief-sourced values are labeled `(from project brief)`. When `ref_signals` is non-null, supplement local signals with reference signals as described below. Reference signals never override local signals — local always wins when present. Reference-sourced values are labeled `(from references)`.

   - **Q1 rec**: `brief["What It Does"]` labeled `(from project brief)` → `package.json:description` → first substantive non-heading line of README.md → `ref_signals.ref_purpose` labeled `(from references)` → `null`
   - **Q2 rec**: `brief["Tech Direction"]` labeled `(from project brief)` → stack tokens from local manifests (package.json deps / pyproject.toml / Cargo.toml / go.mod); append any `ref_signals.ref_stack` tokens not already present, each labeled `(from references)`; `*.ipynb` present → Python + Jupyter; if `.mcp.json` found, note the MCP servers as context (e.g. "jira MCP detected — add to stack description if relevant"); nothing → `null`
   - **Q3 rec**: `package.json:scripts` keys (test, build, lint, start, deploy); for any key with no local value, fill from `ref_signals.ref_commands[key]` labeled `(from references)`; see default commands table in Rules; nothing → blank
   - **Q4 rec**: if `brief["Out of Scope (v1)"]` is non-empty, show those items as Never examples labeled `(from project brief)`; otherwise if `ref_signals` is non-null and `ref_rules_always` / `ref_rules_never` are non-empty, show them labeled `(from references)`; otherwise no recommendation
   - **Q5 rec**: top-level directories minus `node_modules`, `.git`, `dist`, `build`, `.cache`, `__pycache__`; append any `ref_signals.ref_directories` entries whose path is not already listed, each labeled `(from references)`
   - **Q6 rec**: if `brief["Open Questions"]` is non-empty and contains real items (not "None."), offer those items as terms to name and define, labeled `(from project brief)`; append all-caps tokens (≥3 chars) from README.md and CLAUDE.md, deduplicated, max 10; append any `ref_signals.ref_glossary` entries whose term is not already present, each labeled `(from references)`
```

- [ ] **Step 3: Verify Phase 1 structure is intact**

```bash
grep -n "Phase 0\|Phase 1\|Phase 2\|Phase 3\|PROJECT-BRIEF\|from project brief\|brief\[" skills/project-setup/SKILL.md | head -20
```

Expected output includes:
- `PROJECT-BRIEF.md` in the file scan list
- `from project brief` in the recommendations block
- `Phase 2` still present after Phase 1 (confirms Phase 2 was not accidentally deleted)

- [ ] **Step 4: Run static-scan and verify PASS**

```bash
node skills/skill-audit/scripts/static-scan.js skills/project-setup/
```

Expected output:
```json
{
  "verdict": "PASS",
  ...
  "summary": { "total": 0, "BLOCK": 0, "FLAG": 0 },
  "findings": []
}
```

- [ ] **Step 5: Deploy updated `project-setup` to `~/.claude/skills/`**

```bash
cp -r skills/project-setup ~/.claude/skills/project-setup
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add skills/project-setup/SKILL.md
git commit -m "feat(project-setup): detect PROJECT-BRIEF.md and pre-fill Q1/Q2/Q4/Q6 from project-idea output"
```
