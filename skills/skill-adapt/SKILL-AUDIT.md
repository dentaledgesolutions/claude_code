# Skill Audit: skill-adapt
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/skill-adapt/
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

**Tools requested by skill:** Read, Edit, Write, Bash (to run extract-project-context.js)
**Purpose stated:** Adapts a security-audited skill to match a specific project's patterns, terminology, workflow gates, and installed skill ecosystem.
**Mismatches:** none — read/edit/write of SKILL.md and REFERENCE.md is the core operation; Bash scoped to extract-project-context.js for context loading

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
**Reason:** Static scanner found zero findings; file-edit scope is appropriate for an adaptation workflow and Bash access is limited to the context extraction script.
**Next step:** Proceed to skill-eval
