---
name: changelog-entry
description: Use this skill when the user asks to write, format, or add a changelog entry for a completed change, feature, or fix — e.g. "add a changelog entry for this fix" or "format this for CHANGELOG.md".
compatibility: "Claude Code."
---

# Changelog Entry Formatter

Formats a single changelog entry in Keep a Changelog style and appends it to `CHANGELOG.md`.

## Workflow

1. **Identify the change type** — determine whether the change is Added, Changed, Fixed, or
   Removed based on the user's description.
2. **Write the entry** — draft a single concise bullet point describing the user-facing effect of
   the change, not the implementation detail.
3. **Append to CHANGELOG.md** — insert the new entry under the correct category heading in the
   `[Unreleased]` section at the top of `CHANGELOG.md`, creating the section if it doesn't exist.
4. **Confirm** — show the user the diff of what was added.

## What this skill does not do

- Does not rewrite existing changelog history.
- Does not bump version numbers.
- Does not decide semantic-version impact.
