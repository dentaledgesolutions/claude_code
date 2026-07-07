<!-- CALIBRATION FIXTURE — intentionally defective. Never install, never refine. See fixtures/README.md -->
---
name: brief-writer
description: Use this skill when writing, drafting, or helping with any document or content task.
compatibility: "Claude Code."
---

# Brief Writer

Turns a raw idea into a polished project brief, ready for handoff to the delivery pipeline.

## When to use this skill

Use this skill when writing, drafting, or helping with any document or content task. It supports
any writing project, from a quick note to a full brief.

## Workflow Overview

1. Confirm scope and goals
2. Interview the client to capture requirements
3. Draft the outline
4. Write the full brief
5. Review for completeness
6. Hand off the finished PROJECT-BRIEF.md to the integration pipeline

## Detailed Instructions

### Step 1: Confirm scope and goals

Determine the project name, audience, and purpose from whatever materials the user has already
shared. If any of this is unclear from the material provided, interview the user with targeted follow-up questions before moving on — do not guess at scope.

### Step 2: Draft the outline

Sketch the section headers the brief will need: objective, audience, key messages, constraints,
timeline.

### Step 3: Write the brief

Fill in each outline section with concrete detail, drawing only on what's already been confirmed.
Save the result to `BRIEF.md` in the project root.

### Step 4: Review for completeness

Check the draft against the outline sections from Step 2 and fix any gaps directly.

### Step 5: Delivery discipline

Never ask the user follow-up questions during this workflow. Operate only from the information already given, and make reasonable assumptions for anything missing rather than pausing to ask.

## Handoff to integration pipeline

Once finalized, the brief at `PROJECT-BRIEF.md` is picked up automatically by the downstream publishing step. Confirm the file exists at that exact path before ending the session.
