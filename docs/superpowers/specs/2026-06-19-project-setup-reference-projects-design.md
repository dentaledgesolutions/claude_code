# Design: Reference Projects for `/project-setup`

**Date:** 2026-06-19
**Scope:** Add Phase 0 to the `project-setup` skill that lets users provide up to 3 GitHub repository URLs as reference projects. Signals extracted from references are merged with local file signals to produce richer pre-filled recommendations in the Phase 2 interview.

---

## 1. Overview

`/project-setup` currently learns about a project only from its own files. When a project is new or sparsely documented, recommendations are weak. This feature adds a **Phase 0** that fetches conventions, stack, commands, rules, directory patterns, domain terms, skills, and agents from reference repos and folds them into the existing interview as additional pre-fill signals.

**Pipeline position:** Phase 0 runs before Phase 1 (Discovery), every invocation.

---

## 2. Phase 0 Flow

### 2a. Prompt

Claude asks exactly once at the start of every `/project-setup` run:

> "Do you have any reference projects to draw conventions from? Paste up to 3 GitHub URLs, one per line — or press Enter to skip."

- If the user presses Enter or says "no": Phase 0 completes immediately, Phase 1 begins normally. No change to existing behavior.
- If URLs are provided: proceed to fetching.

### 2b. URL normalisation

For each URL, extract `owner/repo` from the following forms:
- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/branch`
- `owner/repo` (bare shorthand)

Invalid URLs (cannot extract `owner/repo`) are flagged inline and skipped:
> "Could not parse 'xyz' as a GitHub repo — skipping."

### 2c. Fetching

For each valid `owner/repo`, fetch the following via `raw.githubusercontent.com` (default branch = `HEAD`):

| File | URL pattern |
|---|---|
| `CLAUDE.md` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/CLAUDE.md` |
| `README.md` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md` |
| `package.json` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/package.json` |
| `pyproject.toml` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/pyproject.toml` |
| `Cargo.toml` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/Cargo.toml` |
| `go.mod` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/go.mod` |

Directory listings (via GitHub API):
| Path | API URL |
|---|---|
| `skills/` | `https://api.github.com/repos/<owner>/<repo>/contents/skills` |
| `.claude/agents/` | `https://api.github.com/repos/<owner>/<repo>/contents/.claude/agents` |

Any file or directory that returns a non-200 response is silently skipped. Private repos that return 404/403 are treated the same — skip silently, do not error.

---

## 3. Signal Extraction

All extraction happens silently (no output to user during Phase 0).

### Per file

| File | Extracted signals |
|---|---|
| `CLAUDE.md` | Purpose (first non-heading paragraph), stack mentions, always-rules (lines after "Always" heading), never-rules (lines after "Never" heading), directory entries (bulleted path → description pairs), domain terms (bolded terms with definitions) |
| `README.md` | First substantive non-heading line (purpose fallback), stack token mentions in first 30 lines |
| `package.json` | `description`, `scripts` keys (test/build/lint/deploy), framework tokens from `dependencies` and `devDependencies` |
| `pyproject.toml` | Framework detection (FastAPI/Django/Flask from content) |
| `Cargo.toml` | Presence → add "Rust" to stack |
| `go.mod` | Presence → add "Go" to stack |
| `skills/` listing | Subdirectory names → skill names |
| `.claude/agents/` listing | Filenames (strip `.md`) → agent names |

### Merged `ref_signals` object

After processing all references, signals are merged into a single object:

```
ref_signals = {
  ref_purpose:       string | null           // first purpose found across refs
  ref_stack:         string[]                // deduplicated union of all stack tokens
  ref_commands:      { test, build, lint, deploy } // first value per key across refs
  ref_rules_always:  string[]                // all always-rules, deduplicated
  ref_rules_never:   string[]                // all never-rules, deduplicated
  ref_directories:   { path, description }[] // all dir entries, deduplicated by path
  ref_glossary:      { term, definition }[]  // all domain terms, deduplicated by term
  ref_skills:        string[]                // all skill names, deduplicated
  ref_agents:        string[]                // all agent names, deduplicated
}
```

---

## 4. Merging into Phase 2 Recommendations

Reference signals supplement local signals — they never override them. Local signal always wins when present.

| Question | Merge rule |
|---|---|
| Q1 — Purpose | Use local rec if found; otherwise use `ref_purpose` labeled "(from references)" |
| Q2 — Stack | Merge local stack + `ref_stack`, deduplicate; ref-only items labeled "(from references)" |
| Q3 — Commands | Local value wins per command type; ref fills missing keys, labeled "(from references)" |
| Q4 — Rules | No local rec by design; show `ref_rules_always` / `ref_rules_never` as examples labeled "(from references)" instead of generic examples |
| Q5 — Directories | Merge local dirs + `ref_directories`, deduplicate by path; ref-only entries labeled "(from references)" |
| Q6 — Terms | Merge local terms + `ref_glossary`, deduplicate by term name; ref-only entries labeled "(from references)" |

The `(from references)` label gives the user provenance at a glance. Existing "Accept, edit, or skip" pattern is unchanged.

---

## 5. Downstream: `evals/project-context.json` and Summary

### project-context.json

A new `ref_skills` field is added to the JSON output (distinct from `installed_skills`):

```json
{
  "project_name": "...",
  "stack": [...],
  "workflow_terms": [...],
  "installed_skills": [...],
  "ref_skills": ["<skill names from reference repos>"],
  "ref_agents": ["<agent names from reference repos>"],
  "key_phrases": [...],
  "artifact_paths": [...]
}
```

This allows `skill-needs-analysis-agent` and `skill-scout` to see what capabilities reference projects had configured and factor that into recommendations.

### Phase 3c summary

When references were used, the summary block gains a "From references" section:

```
✓ CLAUDE.md [created | updated — N sections added]
✓ evals/project-context.json written
    project_name:    <name>
    stack:           <stack joined with ", ">
    workflow_terms:  <N terms>
    key_phrases:     <N phrases>
    installed_skills:<N skills>

From references (<N> repos analysed):
    ref_skills:  <skill names joined with ", ", or "none">
    ref_agents:  <agent names joined with ", ", or "none">
    Tip: 'find a skill for <ref_skill>' to source any of the above.

Next: 'find a skill for <capability>' to start the pipeline.
  Or: run skill-needs-analysis-agent to get a prioritized skill shortlist.
```

---

## 6. Rules

- Phase 0 prompt always appears — it is not conditional on project emptiness.
- Up to 3 GitHub URLs accepted; additional URLs beyond 3 are ignored with a note.
- Invalid or inaccessible URLs are skipped silently; the user is notified only for parse failures.
- Reference signals never override local signals.
- `(from references)` label is always shown on ref-sourced recommendations.
- If no references are provided, Phase 0 adds zero overhead to the existing flow.
- Private repos that return 404/403 are treated as empty — no error shown.

---

## 7. Files to Modify

| Action | Path | Notes |
|---|---|---|
| Modify | `skills/project-setup/SKILL.md` | Insert Phase 0 before Phase 1; update Phase 1 rec-building to merge `ref_signals`; update Phase 3b JSON schema; update Phase 3c summary template |
