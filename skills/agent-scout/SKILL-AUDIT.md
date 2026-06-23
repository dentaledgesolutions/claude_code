# Skill Audit: agent-scout
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/agent-scout/
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

**Tools requested by skill:** WebSearch, WebFetch (to search GitHub/registries for agent definitions)
**Purpose stated:** Find, source, search for, or discover existing Claude Code agent definitions from the ecosystem; produce ranked shortlist before agent-audit or agent-adapt.
**Mismatches:** none — web access is required for a scouting workflow; no write access requested

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
**Reason:** Static scanner found zero findings; web-read-only scope is appropriate for a discovery workflow.
**Next step:** Proceed to skill-eval
