# Skill Audit: agent-adapt
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/agent-adapt/
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

**Tools requested by skill:** Read, Edit, Write (inferred from adapt workflow — reads SKILL.md, edits content)
**Purpose stated:** Adapts a security-audited Claude Code agent definition to match a specific project's conventions, model tier preferences, tool scope, and domain terminology.
**Mismatches:** none — read/write access is expected for an adaptation workflow

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
**Reason:** Static scanner found zero findings across all 47 patterns; tool scope is appropriate for an adaptation workflow.
**Next step:** Proceed to skill-eval
