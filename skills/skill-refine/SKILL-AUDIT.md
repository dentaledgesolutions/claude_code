# Skill Audit: skill-refine
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/skill-refine/
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

**Tools requested by skill:** Read, Edit, Write, Bash (to run skill-eval-agent), Agent (for skill-eval-agent invocation)
**Purpose stated:** Auto-improves a Claude Code skill using Karpathy's autoresearch loop — baseline eval, targeted mutation, re-measure, keep or revert.
**Mismatches:** none — Edit/Write access to SKILL.md is the core mutation operation; Agent tool for skill-eval-agent invocation is required for the re-measure step

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
**Reason:** Static scanner found zero findings; edit access to SKILL.md is the intended mutation target and Agent use is scoped to the skill-eval-agent for re-scoring only.
**Next step:** Proceed to skill-eval
