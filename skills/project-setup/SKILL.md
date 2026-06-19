---
name: project-setup
description: "Use when: setting up a new Claude Code project, generating or updating CLAUDE.md, creating evals/project-context.json for the skill pipeline, onboarding Claude to an existing codebase, or when skill-adapt or skill-eval reports empty or sparse project context. Interviews the user one question at a time (grilling pattern, recommended answer pre-filled) to capture project purpose, stack, key commands, Claude conventions, key directories, and domain terminology. Outputs a structured CLAUDE.md and a populated evals/project-context.json so the pipeline (skill-scout → skill-adapt → skill-eval) runs at full fidelity. Does not require Node.js or GSD."
compatibility: "Claude Code. Node.js ≥ 18 optional — used to run extract-project-context.js; degrades gracefully without it."
---

# Project Setup

Configure your project for Claude Code in one guided interview. Produces a rich `CLAUDE.md` and `evals/project-context.json` that the full skill pipeline depends on to operate at full fidelity.

## Quick start

```
User: set up my project for Claude Code
User: my project-context.json is empty
User: help me configure CLAUDE.md
```

## Workflow

### Phase 0 — Reference Projects (run before Phase 1)

Ask exactly once at the start of every `/project-setup` run:

> "Do you have any reference projects to draw conventions from? Paste up to 3 GitHub URLs, one per line — or press Enter to skip."

**If the user presses Enter or says "no":** set `ref_signals = null` and proceed immediately to Phase 1. No further Phase 0 work.

**If URLs are provided:**

#### 0a. URL normalisation

Accept up to 3 URLs. Silently ignore any beyond 3, with a single note:
> "Only the first 3 URLs will be used."

For each URL, extract `owner/repo` from:
- `https://github.com/owner/repo` (any suffix after the repo name is ignored)
- `https://github.com/owner/repo/tree/branch`
- `owner/repo` (bare shorthand)

If `owner/repo` cannot be extracted, display inline and skip:
> "Could not parse 'xyz' as a GitHub repo — skipping."

#### 0b. Fetching (for each valid `owner/repo`)

Fetch the following via `raw.githubusercontent.com` using WebFetch. Any non-200 response is silently skipped. All fetching is silent — no output to the user during Phase 0.

| File | URL |
|---|---|
| `CLAUDE.md` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/CLAUDE.md` |
| `README.md` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md` |
| `package.json` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/package.json` |
| `pyproject.toml` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/pyproject.toml` |
| `Cargo.toml` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/Cargo.toml` |
| `go.mod` | `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/go.mod` |

Fetch directory listings via GitHub API. Any non-200 response is silently skipped:

| Path | URL |
|---|---|
| `skills/` | `https://api.github.com/repos/<owner>/<repo>/contents/skills` |
| `.claude/agents/` | `https://api.github.com/repos/<owner>/<repo>/contents/.claude/agents` |

#### 0c. Signal extraction (per file, per repo)

| File | Extracted signals |
|---|---|
| `CLAUDE.md` | Purpose: first non-heading paragraph. Stack: technology mentions. Always-rules: lines under any heading containing "always". Never-rules: lines under any heading containing "never". Directories: bulleted `path — description` pairs. Domain terms: `**term**: definition` or `**term** — definition` patterns. |
| `README.md` | Purpose fallback: first substantive non-heading line. Stack: technology token mentions in first 30 lines. |
| `package.json` | Stack tokens: framework names found in `dependencies` and `devDependencies` keys. Commands: values of `scripts.test`, `scripts.build`, `scripts.lint`, `scripts.deploy`. Project purpose: `description` field. |
| `pyproject.toml` | Stack: detect FastAPI / Django / Flask / Pydantic from file content. |
| `Cargo.toml` | Stack: add "Rust". |
| `go.mod` | Stack: add "Go". |
| `skills/` API listing | Skill names: each item's `name` field where `type` is `"dir"`. |
| `.claude/agents/` API listing | Agent names: each item's `name` field with `.md` suffix stripped. |

#### 0d. Merge into `ref_signals`

After processing all repos, produce one merged object (all fields deduplicated):

```
ref_signals = {
  ref_purpose:      string | null           // first purpose found across all refs
  ref_stack:        string[]                // deduplicated union of all stack tokens
  ref_commands:     { test, build, lint, deploy }  // first non-blank value per key
  ref_rules_always: string[]                // all always-rules, deduplicated
  ref_rules_never:  string[]                // all never-rules, deduplicated
  ref_directories:  { path, description }[] // deduplicated by path
  ref_glossary:     { term, definition }[]  // deduplicated by term
  ref_skills:       string[]                // all skill names, deduplicated
  ref_agents:       string[]                // all agent names, deduplicated
}
```

If no references were provided or all fetches failed, `ref_signals = null`.

---

### Phase 1 — Discovery (silent, run before speaking)

1. **Scan for existing files** — attempt Read on each (silently skip if missing):
   - `CLAUDE.md` and `.claude/CLAUDE.md`
   - `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`
   - `requirements.txt`
   - `README.md`
   - Check for any `*.ipynb` files: `ls *.ipynb 2>/dev/null`

2. **Build auto-recommendations** for each interview question:
   - **Q1 rec**: `package.json:description` → first substantive non-heading line of README.md → `null`
   - **Q2 rec**: stack tokens from package.json deps / pyproject.toml / Cargo.toml / go.mod; `*.ipynb` present → Python + Jupyter; nothing → `null`
   - **Q3 rec**: `package.json:scripts` keys (test, build, lint, start, deploy); see default commands table in Rules; nothing → blank
   - **Q4 rec**: none — rules must come from the user
   - **Q5 rec**: top-level directories minus `node_modules`, `.git`, `dist`, `build`, `.cache`, `__pycache__`
   - **Q6 rec**: all-caps tokens (≥3 chars) from README.md and CLAUDE.md, deduplicated, max 10

3. **Run extract-project-context.js if Node ≥ 18**:
   ```bash
   node skills/skill-eval/scripts/extract-project-context.js 2>/dev/null
   ```
   If it succeeds, read `evals/project-context.json` as a starting draft for Q2 and Q6 recommendations. Do not run more than once per session.

4. **Determine mode**:
   - CLAUDE.md exists with ≥1 substantive line → **SUPPLEMENT** mode: read it, identify which standard sections are missing (Quick Facts, Key Directories, Claude's Rules, Domain Terms), ask only about those; skip the rest
   - CLAUDE.md missing or empty → **CREATE** mode: full 6-question interview

5. **Check if project-context.json already rich**:
   - If `evals/project-context.json` exists AND `stack` is non-empty AND `key_phrases` is non-empty → offer to skip the interview and just refresh context: *"Project context already looks populated. Refresh evals/project-context.json without re-interviewing? [y/N]"*
   - If user says y: jump to Phase 3b. If n or missing: run full interview.

### Phase 2 — Grilling Interview (one question at a time)

Open with: *"I'll ask you [N] questions, one at a time. Each has a recommended answer from your project files. Press Enter to accept, or type your own."*

N = 6 in CREATE mode, or the count of missing sections in SUPPLEMENT mode.

Wait for the user's answer before asking the next question.

---

**Q1 — Project purpose**

> What does this project do? (One sentence.)
>
> **Recommended:** "[from README/package.json, or: 'No description found — please describe the project in one sentence']"

Store as `purpose`.

---

**Q2 — Tech stack**

> What technologies make up this project's stack?
>
> **Recommended:** "[detected stack, e.g. 'React, TypeScript, Node.js' — or 'Nothing detected; please describe your stack']"
>
> *(Confirm, correct, or describe freely. You can write anything: 'Python data science with pandas and scikit-learn'.)*

Parse answer into array: split on `,`, `;`, ` and `. Strip whitespace. Store as `stack_array`.

---

**Q3 — Key commands**

> What are the commands for common tasks? Fill in any blanks or press Enter to keep recommendations:
>
> ```
> test:   [detected or blank]
> build:  [detected or blank]
> lint:   [detected or blank]
> deploy: [detected or blank]
> ```
>
> *(Leave blank to omit. Type corrections in the format `test: pytest, build: make`.)*

Store as `commands` map. Omit keys with blank values. If project has no meaningful commands (e.g. pure notebooks), skip this question and note "N/A".

---

**Q4 — Claude's rules**

> What should Claude always do in this project? What should Claude never do?
>
> **Recommended:** none — this must come from you.
>
> *Examples: "Always run tests before committing. Never edit generated files in `dist/`."*
>
> *(Press Enter to skip if you have no rules yet.)*

Parse into `always_items` and `never_items`: split on "Never" / "Don't" / "Avoid" boundaries. If parsing is ambiguous, keep the raw text as a single block under `## Claude's Rules`.

---

**Q5 — Key directories**

> Which directories are most important, and what do they contain?
>
> **Recommended:**
> ```
> [top-level dirs with inferred purpose, e.g.]
> src/     — application source code
> tests/   — test suite
> docs/    — documentation
> ```
>
> *(Confirm, correct, or add/remove entries.)*

Store as `directories` list of `{path, description}` pairs.

---

**Q6 — Domain terminology** *(optional)*

> Are there project-specific terms Claude should know? Press Enter to skip.
>
> **Recommended:** "[all-caps tokens found, e.g. 'GSD, UAT, SKILL-EVAL, PRD']"
>
> *Format: one term per line as `TERM — what it means`*
>
> *(Accept any language — terms are stored verbatim.)*

Store as `glossary` list of `{term, definition}` pairs. If user presses Enter or says "none", store `[]`.

---

### Phase 3 — Generate Outputs

#### 3a. Write CLAUDE.md

Use the CLAUDE.md template below.

- **CREATE mode**: write the full template substituting interview answers. Omit any section whose content is entirely empty (e.g. no glossary = no Domain Terms section).
- **SUPPLEMENT mode**: read existing CLAUDE.md. For each missing standard section, append it at the end with a `<!-- added by project-setup -->` comment above it. Never add a section that already exists. Never remove or alter existing content. Use substring matching to detect existing sections: if any heading contains "term", "glossary", or "vocabulary" (case-insensitive), skip Q6; if any heading contains "rules", "conventions", "always", or "never", skip Q4.

If writing fails (permissions): print the template as a code block and instruct the user to paste it.

#### 3b. Write evals/project-context.json

Create the directory first:
```bash
mkdir -p evals
```

**Path A — Node ≥ 18 available and not already run in this session:**
```bash
node skills/skill-eval/scripts/extract-project-context.js
```
This re-reads the CLAUDE.md just written. Then read `evals/project-context.json` and check: if `stack` is still empty, fall through to Path B.

**Path B — No Node, or extract produced empty `stack`:**
Construct and write `evals/project-context.json` directly:

```json
{
  "project_name": "<basename of cwd, or package.json name>",
  "stack": ["<stack_array items>"],
  "workflow_terms": ["<UPPERCASE tokens ≥3 chars from rules_raw + glossary term names>"],
  "installed_skills": ["<output of: ls skills/ 2>/dev/null, as array; or []>"],
  "key_phrases": ["<purpose>", "<command values joined with space>"],
  "artifact_paths": ["<directories paths normalised to ./path/ form>"]
}
```

For `installed_skills`: run `ls skills/ 2>/dev/null` and parse the directory names. Use `[]` if `skills/` doesn't exist.

#### 3c. Show summary

```
✓ CLAUDE.md [created | updated — N sections added]
✓ evals/project-context.json written
    project_name:    <name>
    stack:           <stack joined with ", ">
    workflow_terms:  <N terms>
    key_phrases:     <N phrases>
    installed_skills:<N skills>

Next: 'find a skill for <capability>' to start the pipeline.
  Or: run skill-needs-analysis-agent to get a prioritized skill shortlist for this project.
```

## CLAUDE.md Template

```markdown
# <project_name>

<purpose>

## Quick Facts

- **Stack**: <stack joined with ", ">
- **Test**: `<test_cmd>`
- **Build**: `<build_cmd>`
- **Lint**: `<lint_cmd>`
- **Deploy**: `<deploy_cmd>`

## Key Directories

<for each directory:>
- `<path>` — <description>

## Claude's Rules

### Always

<always_items as bullet list>

### Never

<never_items as bullet list>

## Domain Terms

<for each glossary entry:>
- **<term>**: <definition>
```

Omit Quick Facts lines where the command was blank. Omit entire sections (Key Directories, Claude's Rules, Domain Terms) if they have no content.

## Rules

- **Never silently overwrite an existing CLAUDE.md.** Always ask: *"CLAUDE.md already exists. Supplement it (add missing sections only) or overwrite it completely? [supplement / overwrite]"* Default is supplement.
- **Never re-run `extract-project-context.js` more than once per session.** Re-reading after CLAUDE.md is written is sufficient.
- **Accept Q6 answers verbatim** — do not apply regex transforms to user-supplied terminology. Non-English terms must be stored exactly as typed.
- **For non-code projects** where no manifest is found: skip Q3 (commands) entirely; write `"N/A"` next to commands in CLAUDE.md.
- **If writing CLAUDE.md fails** (permission denied): print the full template as a fenced code block and ask the user to paste it.

### Default commands by detected stack

| Detected stack | test | build | lint |
|---|---|---|---|
| Python / FastAPI / Django | `pytest` | `python -m build` | `ruff check .` |
| Rust | `cargo test` | `cargo build` | `cargo clippy` |
| Go | `go test ./...` | `go build ./...` | `golangci-lint run` |
| Ruby / Rails | `bundle exec rspec` | `gem build` | `rubocop` |
| Java (Maven) | `mvn test` | `mvn package` | `mvn checkstyle:check` |
| Jupyter notebooks | *(N/A)* | `jupyter nbconvert --to script --execute *.ipynb` | *(N/A)* |
