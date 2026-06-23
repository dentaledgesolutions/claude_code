# Skill Audit: agent-audit
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/agent-audit/
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

**Tools requested by skill:** Read, Bash (to run static-scan.js)
**Purpose stated:** Security gate that scans a Claude Code agent definition sourced from GitHub for prompt injection, tool escalation, unbounded recursion, and persona override risks before installation.
**Mismatches:** none — Bash access to run the local static-scan.js script is appropriate and expected

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
**Reason:** Static scanner found zero findings; Bash access is scoped to running the project's own static-scan.js and is appropriate for a security gate skill.
**Next step:** Proceed to skill-eval
