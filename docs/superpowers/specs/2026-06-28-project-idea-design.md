# project-idea — Design Spec

**Date:** 2026-06-28
**Status:** Approved
**Pipeline position:** Before `project-setup`, greenfield projects only

---

## Problem

The current pipeline starts at `project-setup`, which configures Claude Code for a project that already has a clear direction. There is no step for a user who has a raw idea but does not yet know what exactly to build, who it is for, or how it should be structured. Without this step, the pipeline assumes the user already has clarity — leaving greenfield users without guidance before they start building.

---

## What It Does

`project-idea` interviews the user one question at a time to turn a vague idea into a structured project brief. It covers problem statement, target user, core features, out-of-scope items, tech direction, and success criteria. It produces `PROJECT-BRIEF.md`, which `project-setup` reads to pre-fill its Q1–Q6 recommendations.

---

## Skill Metadata

```yaml
name: project-idea
description: >
  Use when: starting a new project from scratch, clarifying a vague idea before
  building, not sure what to build or how to structure it, or wanting confirmation
  on an early-stage concept. Interviews the user one question at a time to define
  the problem, target user, core features, out-of-scope items, tech direction, and
  success criteria. Produces PROJECT-BRIEF.md. Run before project-setup on any
  greenfield project.
```

**Trigger phrases:**
- "I have an idea for a project"
- "I want to build X but I'm not sure where to start"
- "Help me figure out what to build"
- "I want to start a new project"
- "Can you help me plan my idea"

---

## Interview Structure (Approach C: fixed core + adaptive probing)

Four phases, always one message at a time. Never ask multiple questions in the same message.

### Phase 0 — Existing brief check

Attempt `Read PROJECT-BRIEF.md` silently. If found:

> "I found an existing project brief. Do you want to update it, or start over?"

If updating: re-run the interview with current brief values as pre-filled recommendations. If starting over: proceed as new.

### Phase 1 — Three anchor questions

Each anchor has one optional adaptive probe, triggered only when the answer is vague or abstract. At most one probe per anchor — never chain probes.

**Anchor 1 — Problem + who**

> "What problem does this project solve, and who experiences it?"

| Probe trigger | Probe question |
|---|---|
| Vague subject ("it helps people", "it's for everyone", "for users") | "Can you give me a concrete example — who is the person, and what are they trying to do right now?" |

**Anchor 2 — What it does**

> "Describe what the project does in one or two sentences — imagine explaining it to a friend."

| Probe trigger | Probe question |
|---|---|
| Abstract or feature-listy answer ("it does many things", "it has a dashboard and reports and...") | "What would a user actually do when they first open it?" |

**Anchor 3 — Out of scope**

> "What would you leave out of the first version?"

| Probe trigger | Probe question |
|---|---|
| "Nothing", blank, or "I don't know" | "For example — would you skip user accounts? Payment processing? A mobile version?" |

### Phase 2 — Tech direction

After the three anchors, derive a platform type from what was described (web app, mobile app, API/backend, CLI tool, desktop app, data pipeline, etc.). Then suggest a concrete, accessible starting point — not raw stack names, but plain-language description with examples.

**Framing template:**

> "For [platform type] like this, a common approach is [plain-language description]. Tools like [Example A] and [Example B] are popular and [relevant quality — beginner-friendly / free / fast to start / etc.]. Does that direction work, or do you already use specific tools — or need anything to be [free / offline-capable / a specific language]?"

**Suggested defaults by platform type:**

| Platform | Plain-language suggestion | Example tools to name |
|---|---|---|
| Web app | "a website with a database behind it" | Next.js, Supabase |
| Mobile app | "a cross-platform mobile app" | React Native, Expo |
| API / backend | "a server that responds to requests" | Node.js + Express, or FastAPI if Python |
| CLI tool | "a command-line script" | Node.js or Python |
| Desktop app | "a desktop application" | Electron or Tauri |
| Data pipeline | "a script that processes and transforms data" | Python + pandas |
| Unknown / mixed | Ask: "Would this be a website, a mobile app, or something else?" before suggesting |

If the user has no preference and no constraints, accept the suggested direction as-is and record it in the brief. If they name tools or constraints, record those instead.

### Phase 3 — Success signal

One closing question, no adaptive probe:

> "How would you know this project succeeded? What would be different?"

Any answer is accepted — even a vague one ("people use it", "my team stops using spreadsheets") is sufficient.

---

## Output: `PROJECT-BRIEF.md`

Written to the project root after Phase 3 completes.

```markdown
# Project Brief: <name — inferred from "what it does", or ask if genuinely unclear>

## Problem
<who experiences it and what they're trying to do — use the user's own words>

## What It Does
<one or two sentences from the user's answer to Anchor 2>

## Target User
<concrete person from Anchor 1 or its probe>

## Core Features (v1)
- <inferred from "what it does" minus "out of scope" — not asked directly>
- …

## Out of Scope (v1)
- <explicitly excluded items from Anchor 3>
- …

## Tech Direction
<suggested platform + tools in plain language, plus any stated constraints or preferences>

## Success Looks Like
<user's answer to the success signal question>

## Open Questions
- <anything that came up but was not resolved — non-blocking>
```

**Writing rules:**
1. Use the user's own words wherever possible. Do not paraphrase vague answers into technical precision they didn't provide.
2. Core Features are inferred, not asked for directly. Derive them from what the project does minus what's explicitly out of scope.
3. Open Questions are non-blocking. They are captured for future grilling sessions, not resolved before writing the brief.
4. If the project name is genuinely unclear from context, ask it as part of Phase 3 (alongside or before the success signal): *"What do you want to call this project?"* Do not infer a name if it would be misleading. This is the only question that may be added on top of the standard flow.

### Closing message

After writing the file, show a one-paragraph summary of the brief and end with:

> "`PROJECT-BRIEF.md` saved. Run `/project-setup` next — it will read your brief and pre-fill its questions so you just confirm rather than type."

---

## Changes to `project-setup`

One addition to Phase 1 (Discovery), slotted before the auto-recommendation logic:

1. Attempt `Read PROJECT-BRIEF.md` silently (skip if missing).
2. If found, set a `brief` variable and show one note at interview open:
   > "Found `PROJECT-BRIEF.md` — recommendations pre-filled from your project brief."
3. Map brief fields to Q1–Q6 recommendations:

| Question | Brief field used | Label |
|---|---|---|
| Q1 (purpose) | `What It Does` | `(from project brief)` |
| Q2 (stack) | `Tech Direction` | `(from project brief)` |
| Q4 (rules) | `Out of Scope` offered as Never examples | `(from project brief)` |
| Q6 (terminology) | `Open Questions` offered as terms to name and define | `(from project brief)` |

Brief recommendations take priority over locally-detected signals. When both exist, show both — brief labeled `(from project brief)`, manifest signals labeled `(detected)`. The user can override any recommendation as usual.

Q3 (commands), Q5 (directories), and the remaining parts of Q6 are unchanged — best discovered from actual project files once scaffolding exists.

---

## What `project-idea` Does NOT Do

- No domain modeling, ADRs, or `CONTEXT.md` — handled by a separate `domain-modeling` step after building starts
- No full roadmap or phase breakdown — handled by `gsd-new-project`
- No code scaffolding or file generation beyond `PROJECT-BRIEF.md`
- No reference project analysis — handled by `project-setup` Phase 0 with `repo-audit`
- No automatic invocation of `project-setup` — the handoff is prompted, not automatic

---

## Updated Pipeline (greenfield)

```
[project-idea]     ← what to build, for whom, rough tech direction
      ↓ PROJECT-BRIEF.md
[project-setup]    ← AI config: CLAUDE.md + project-context.json (reads brief)
      ↓ CLAUDE.md + project-context.json
[project-audit]    ← security scan of .claude/ config
      ↓
[skill-scout → skill-audit → skill-adapt → skill-eval → skill-refine]
```

For existing projects, `project-idea` is skipped. `project-setup` detects the absence of `PROJECT-BRIEF.md` and proceeds with local file detection as before.

---

## Success Criteria

- A non-technical user can complete the interview in under 10 minutes
- `PROJECT-BRIEF.md` contains enough for `project-setup` to pre-fill Q1 and Q2 without the user re-typing them
- The tech direction suggestion is always in plain language — no bare framework names without context
- The skill never asks more than 8 questions total (3 anchors + up to 3 probes + Phase 2 tech direction + Phase 3 success signal — aim for 5 on average since probes are selective)
- Open Questions are captured, not blocked on — the brief is always written even with unresolved items
