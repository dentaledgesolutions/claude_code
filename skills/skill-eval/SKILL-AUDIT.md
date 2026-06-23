# Skill Audit: skill-eval
**Date:** 2026-06-23
**Source:** local — /Users/erick/projects/claude_code/skills/skill-eval/
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

**Tools requested by skill:** Read, Bash (to run generate-seed-evals.js), Write (to write SKILL-EVAL.md), Agent (for parallel subagent execution)
**Purpose stated:** Evaluates a Claude Code skill's effectiveness using structured test scenarios and LLM-judge scoring; produces eval_pass_rate, trigger_accuracy, and context footprint metrics.
**Mismatches:** none — Bash to run the scenario generator, Write to produce the eval report, and Agent for parallel scoring are all required by the evaluation workflow

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
**Reason:** Static scanner found zero findings; Agent tool access is required for parallel scenario scoring and is appropriate for the evaluation workflow.
**Next step:** Proceed to skill-eval (self-evaluation or guardian-driven)
