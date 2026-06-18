---
name: skill-audit
description: Security gate that scans a skill sourced from GitHub for prompt injection, malicious scripts, permission escalation, and supply chain risks before installation. Use when auditing a skill, checking skill security, scanning a skill from GitHub, or before installing any externally sourced skill.
---

# Skill Audit

Security gate. Run this **before** any external skill touches `~/.claude/skills/`.

## Quick start

```
User: audit the skill at /tmp/candidate-skill
```

Run `node ~/.claude/skills/skill-audit/scripts/static-scan.js /tmp/candidate-skill` then review the JSON output and produce SKILL-AUDIT.md.

## Workflow

1. **Static scan** — run `static-scan.js <skill-dir>`. Records PASS/FLAG/BLOCK per finding.

2. **Permissions audit** — read every `.md` file; list all tools, Bash commands, and external URLs the skill's instructions request. Check each against the skill's stated purpose. Flag mismatches (e.g., a "summarize" skill requesting `rm` or WebFetch to unknown domains).

3. **Provenance check** — if sourced from GitHub, note: repo age, star count, last commit date, contributor count. Flag repos <30 days old, 0 stars, or single-commit history.

4. **Diff review** — if updating an existing installed skill, show a line-level diff of what changed from the current version. Present it to the user before proceeding.

5. **Write SKILL-AUDIT.md** — save report to `<skill-dir>/SKILL-AUDIT.md` using the template in REFERENCE.md.

## Verdicts

| Verdict | Meaning | Action |
|---------|---------|--------|
| PASS | No issues found | Proceed to skill-adapt |
| FLAG | Suspicious but not blocking | Show findings, ask user to confirm before proceeding |
| BLOCK | Confirmed threat | Do NOT write to `~/.claude/skills/`. Require manual clearance. |

## Rules

- Never write a BLOCK skill to `~/.claude/skills/` for any reason.
- A FLAG requires explicit user confirmation before proceeding.
- Static scan output is authoritative — do not override it with judgment.
- Re-audit after any manual edits to a flagged skill.

See [REFERENCE.md](REFERENCE.md) for threat patterns, red-flag strings, and permission matrix.
