# Skill Audit: skill-audit
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/skill-audit/
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

**Tools requested by skill:** Read, Bash (to run static-scan.js), Write (to write SKILL-AUDIT.md)
**Purpose stated:** Security gate that scans a skill sourced from GitHub for prompt injection, malicious scripts, permission escalation, and supply chain risks before installation.
**Mismatches:** none — Bash to execute static-scan.js and Write to produce the audit report are both directly required by the skill's purpose

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
**Reason:** Static scanner found zero findings; the skill's own tool scope (Bash to run scanner, Write for audit output) is minimal and matches its stated purpose.
**Next step:** Proceed to skill-eval
