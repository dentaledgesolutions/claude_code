# Skill Audit: project-setup
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/project-setup/
**Verdict:** PASS

## Static Scan Results

| Check | Severity | Detail |
|-------|----------|--------|
| Prompt injection patterns | PASS | No issues |
| Dangerous Bash in instructions | PASS | No issues |
| Hardcoded secrets | PASS | No issues |
| Overly permissive settings rules | PASS | No issues |
| Malicious JS/Python/Shell in scripts | PASS | No issues |

**Scanner output:** `{ "verdict": "PASS", "summary": { "total": 0, "BLOCK": 0, "FLAG": 0 }, "findings": [] }`

## Permissions Audit

**Tools requested by skill:** Read, Write, Bash (to run extract-project-context.js), WebFetch (optional — for reference repo seeding)
**Purpose stated:** Generates CLAUDE.md and evals/project-context.json; interviews user to capture project context; optionally seeds conventions from up to 3 GitHub reference repos.
**Mismatches:** none — write access to CLAUDE.md and evals/ is the core output of this skill; WebFetch is scoped to GitHub reference repos provided by the user

## Provenance

| Attribute | Value | Flag? |
|-----------|-------|-------|
| Repo age | Project-internal — not sourced from GitHub | no |
| Stars | N/A | no |
| Last commit | 2026-06-22 (per git log) | no |
| Contributors | Project team | no |

## Diff from current version

N/A — first audit of this skill; no prior installed version to diff.

## Decision

**Verdict:** PASS
**Reason:** Static scanner found zero findings; write access is scoped to CLAUDE.md and evals/; WebFetch is user-directed and optional.
**Next step:** Proceed to skill-eval
