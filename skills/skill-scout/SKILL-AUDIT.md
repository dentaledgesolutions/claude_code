# Skill Audit: skill-scout
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/skill-scout/
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

**Tools requested by skill:** WebSearch, WebFetch, Agent (for parallel candidate scoring)
**Purpose stated:** Find, source, search for, or discover an existing skill; produce ranked shortlist of candidates before running skill-audit or skill-adapt.
**Mismatches:** none — web access is required for GitHub/registry search; Agent for parallel scoring; no write access requested, which is correct for a scouting workflow

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
**Reason:** Static scanner found zero findings; web-read + Agent scope is appropriate for a discovery workflow; absence of write access is a positive signal.
**Next step:** Proceed to skill-eval
