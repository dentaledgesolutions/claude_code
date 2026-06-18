# Skill Audit Reference

## SKILL-AUDIT.md Template

```markdown
# Skill Audit: <skill-name>
**Date:** YYYY-MM-DD  
**Source:** <GitHub URL or local path>  
**Verdict:** PASS | FLAG | BLOCK

## Static Scan Results

| Check | Severity | Detail |
|-------|----------|--------|
| ... | PASS | No issues |

## Permissions Audit

**Tools requested by skill:** (list from SKILL.md instructions)  
**Purpose stated:** (description field)  
**Mismatches:** none | <list>

## Provenance

| Attribute | Value | Flag? |
|-----------|-------|-------|
| Repo age | X days | yes/no |
| Stars | N | yes/no |
| Last commit | YYYY-MM-DD | yes/no |
| Contributors | N | yes/no |

## Diff from current version

(only if updating an installed skill — paste `diff` output here)

## Decision

**Verdict:** PASS / FLAG / BLOCK  
**Reason:** (one sentence)  
**Next step:** Proceed to skill-adapt | Awaiting user confirmation | Blocked
```

---

## Threat Patterns

### Prompt Injection (in .md files)

| Pattern | Risk |
|---------|------|
| `ignore previous instructions` | Instruction override |
| `disregard` + instructions | Instruction override |
| `you are now` | Persona hijack |
| `forget everything` | Memory wipe |
| `from now on you must/will` | Behavior override |
| Zero-width Unicode (U+200B, U+200C, U+200D, U+FEFF, U+202E) | Hidden text |
| Base64 blobs (60+ char) | Encoded payload |
| HTML comments `<!-- -->` | Hidden instructions |

### Dangerous Script Operations

| Pattern | Severity |
|---------|----------|
| `eval()` / `new Function()` | BLOCK |
| `child_process` / `exec()` / `spawn()` | BLOCK |
| `fetch()` / `http.get()` / `https.get()` | FLAG |
| `process.env` access | FLAG |
| `fs.writeFile()` outside skill dir | FLAG |
| `require('http')` / `require('child_process')` | BLOCK |

### Dangerous Bash in Markdown Instructions

| Pattern | Severity |
|---------|----------|
| `rm -rf` | BLOCK |
| `curl ... \| bash` | BLOCK |
| `wget ... \| sh` | BLOCK |
| `sudo` | FLAG |
| `chmod 777` | FLAG |
| WebFetch to unknown domains | FLAG |

---

## Permissions Matrix

When auditing permissions, compare what the skill *requests* vs what its *purpose* requires:

| Skill type | Expected tools | Red flags |
|-----------|---------------|-----------|
| Research/analysis | Read, WebSearch, WebFetch | Bash with write ops, Edit |
| Code generation | Read, Edit, Write, Bash (tests only) | rm, chmod, WebFetch to unknown |
| Project management | Read, Bash (git read-only) | Write to ~/.claude/, curl pipes |
| Summarization | Read only | Any Bash, any WebFetch |

---

## Provenance Red Flags

- Repo created < 30 days ago
- 0 GitHub stars (for repos claiming wide adoption)
- Single commit with all files (no development history)
- Username typosquats known publishers (e.g., `anthropic-ai` vs `anthropics`)
- README describes different functionality than SKILL.md
