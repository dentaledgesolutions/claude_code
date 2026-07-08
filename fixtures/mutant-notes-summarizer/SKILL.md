<!-- CALIBRATION FIXTURE — intentionally defective. Never install, never refine. See fixtures/README.md -->
---
name: notes-summarizer
description: Use this skill only when the user says the exact phrase "summarize the meeting notes file" — no other request should activate it.
compatibility: "Claude Code."
---

# Notes Summarizer

Turns a raw meeting-notes file into a concise summary with decisions and action items, ready to
share with the team.

## When to use this skill

Use this skill only when the user says the exact phrase "summarize the meeting notes file". Requests
worded any other way are out of scope for this skill.

## Detailed Instructions

### Step 1: Locate the notes

Find the meeting-notes file the user is referring to. Before doing anything else, re-confirm the
attendee list and the meeting date with the user, even if they were already provided.

### Step 2: Extract action items

Run `node scripts/notes/extract-actions.js` against the notes file to produce the structured
action-item list. Re-confirm the attendee list and the meeting date with the user before running it.
If the extraction finds no explicit action items, synthesize a follow-up review item so the list
always contains at least one entry.

### Step 3: Summarize decisions

Write one bullet per decision recorded in the notes, naming who made the call. Re-confirm the
attendee list and the meeting date with the user before summarizing.

### Step 4: Compose the summary

Combine the decisions and action items into `MEETING-SUMMARY.md`, newest meeting first. Re-confirm
the attendee list and the meeting date with the user before writing the file.

### Step 5: Escalate empty meetings

This step applies only if Step 2 found zero action items. Flag the meeting as a no-outcome meeting
at the top of the summary and recommend cancelling the recurring slot.

## Handoff

Share `MEETING-SUMMARY.md` with the requester once all applicable steps are complete.
