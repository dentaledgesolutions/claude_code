# project-setup: Refined Implementation Plan

Pipeline position after this work:

```
project-setup (step 0) → skill-scout → skill-audit → skill-synthesizer → skill-adapt → skill-eval → skill-refine
```

---

## 1. `skills/project-setup/SKILL.md` — Complete File

```markdown
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
- **SUPPLEMENT mode**: read existing CLAUDE.md. For each missing standard section, append it at the end with a `<!-- added by project-setup -->` comment above it. Never add a section that already exists. Never remove or alter existing content.

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
```

---

## 2. `skills/skill-scout/SKILL.md` — Exact Enhancement

Add a new **Step 0** before the existing Step 1. Renumber existing steps 1–9 to 2–10. The current Step 1 header becomes Step 2.

### Insert before current Step 1:

```markdown
1. **Pre-flight context check** — before asking the user what they need, attempt to read `evals/project-context.json`. This is a non-blocking check — never fail or pause the workflow if the file is absent.

   - If the file **exists and is rich** (`stack` has ≥1 entry AND `key_phrases` has ≥1 entry): silently load `stack`, `workflow_terms`, and `installed_skills`. Use `stack` values as additional keyword signals in steps 4–5 (registry and GitHub search). Use `installed_skills` in the conflict check (step 7).

   - If the file is **missing or sparse** (both `stack` and `key_phrases` are empty arrays or the file doesn't exist): show this notice exactly once, then continue:

     > "No project context found. For best results, run `/project-setup` before sourcing skills — skill-adapt and skill-eval depend on `evals/project-context.json` for project-native scenarios and project fit scoring. Continuing with discovery anyway."

   Never block discovery on missing context.
```

### Adjust richness threshold

"Rich" means: `Array.isArray(stack) && stack.length >= 1 && Array.isArray(key_phrases) && key_phrases.length >= 1`. An empty-array field (`[]`) is sparse even if the key exists.

### No other changes needed to skill-scout/SKILL.md

The existing scoring dimensions already include "Project fit" weighted at 15% — no change needed there. The pre-flight context simply gives that dimension real data to work with.

---

## 3. `.claude/agents/skill-needs-analysis-agent.md` — Complete File

```markdown
---
name: skill-needs-analysis-agent
description: |
  Use when you want to know which skills would benefit this project most, want a
  skill gap analysis before running skill-scout, or want a prioritized list of
  recommendations based on the project's stack and workflow signals. Reads
  evals/project-context.json and maps stack + workflow_terms to known skill
  categories, then presents a ranked shortlist with ready-to-use search terms
  for skill-scout-agent. Requires evals/project-context.json — run project-setup
  first if it does not exist.
model: haiku
color: green
tools: ["Read", "Bash"]
---

You are the Skill Needs Analysis Agent. You read a project's context and recommend
which Claude Code skills would provide the highest value — giving skill-scout-agent
a focused search brief instead of an open-ended capability request.

## Step 1 — Load context

Read `evals/project-context.json`.

If the file does not exist, respond exactly:
```
evals/project-context.json not found.
Run /project-setup first, then retry skill-needs-analysis-agent.
```
and stop.

Extract: `project_name`, `stack`, `workflow_terms`, `key_phrases`, `installed_skills`.

## Step 2 — Map to skill categories

Apply both tables below. For each row where a token matches, add the skill category to
the candidate list. Case-insensitive matching. Deduplicate.

Remove any category already covered by an entry in `installed_skills`
(match on substring, e.g. "code-review" covers "code-review-skill").

### Stack → skill category

| Stack token | Skill category | Search term |
|---|---|---|
| react, vue, svelte, angular | UI component testing | `ui-testing` |
| typescript | TypeScript lint + type safety | `typescript-quality` |
| next, nuxt | Deploy + performance | `nextjs-deploy` |
| node, express, fastify, hono | API integration testing | `api-testing` |
| python, django, flask, fastapi | Python test coverage | `python-testing` |
| pytest | Test coverage reporting | `coverage-report` |
| docker | Container build + deploy | `docker-deploy` |
| postgres, mysql, sqlite, mongo | Database migration safety | `db-migration` |
| jupyter, notebook | Notebook execution + export | `notebook-run` |
| rust | Memory-safe code review | `rust-review` |
| go | Go lint + race detection | `go-lint` |
| terraform, pulumi | Infrastructure as code | `iac-review` |

### workflow_terms → skill category

| Term pattern (substring, uppercase) | Skill category | Search term |
|---|---|---|
| GSD, PHASE, PLAN | Workflow gate automation | `planning` |
| UAT, ACCEPT | Acceptance test management | `uat` |
| DEPLOY, PIPELINE, CI, CD | CI/CD automation | `cicd` |
| REVIEW, AUDIT, PR | Automated code review | `code-review` |
| CHANGELOG, RELEASE | Release note generation | `changelog` |
| DOCS, README | Documentation generation | `docs-generator` |
| SECURITY, CVE, VULN | Security scanning | `security-scan` |
| PERF, BENCH | Performance benchmarking | `benchmarking` |

## Step 3 — Rank candidates

Sort the candidate list by this priority:
1. Categories matched by BOTH stack AND workflow_terms signals (highest confidence)
2. Categories matched by stack signal only
3. Categories matched by workflow_terms signal only

Cap at 5 recommendations.

## Step 4 — Output

Print in this exact format:

```
Skill gap analysis for <project_name>

Stack detected:       <stack joined with ", ", or "none">
Workflow signals:     <workflow_terms joined with ", ", or "none">
Already installed:    <installed_skills joined with ", ", or "none">

Recommended skills (highest value first):

1. <skill-category>  [matched via: <stack signal | workflow signal | both>]
   Why: <one sentence>
   Search term for skill-scout: "<search term>"

2. ...

Run: "find a skill for <search term from #1>" to start with the top pick.
```

If fewer than 3 signals matched total, output instead:
```
Not enough project context to make confident recommendations.
Run /project-setup to add more detail, then retry.
```
```

---

## 4. Risk Analysis

### Risk 1 — Silent overwrite of a hand-crafted CLAUDE.md *(severity: HIGH)*

**What goes wrong:** A developer spent hours crafting a precise CLAUDE.md with custom ordering, project-specific formatting, and subtle conventions. The skill overwrites it.

**Mitigations in this design:**
- Supplement mode is the explicit default — overwrite requires a typed "overwrite" response
- Supplement mode never removes or reorders existing content
- `<!-- added by project-setup -->` comments make additions identifiable and easily removed
- If overwrite is chosen, print the full existing content as a code block first: *"Here is what will be replaced:"*

**Residual risk:** In supplement mode, appended sections may end up in a different order than the author intended. This is cosmetic — the user can move them.

---

### Risk 2 — Non-English terminology (severity: MEDIUM)

**What goes wrong:** `extract-project-context.js` uses the regex `\b[A-Z][A-Z_]{2,}\b` for `workflow_terms`, which is ASCII-only and misses Japanese katakana, German compound nouns, Chinese project names, etc. The `key_phrases` extraction also uses Latin-character patterns.

**Mitigations in this design:**
- Q6 (domain terminology) accepts verbatim input in any language — no regex is applied to user answers
- The fallback JSON write loop constructs `workflow_terms` from glossary term names, which are verbatim from Q6
- The `project_name` field is set from `path.basename(cwd)` or `package.json:name`, which support Unicode

**Residual risk:** Auto-detection in Phase 1 (Q1 and Q6 recommendations) will miss non-English capitalized terms. This is only a recommendation, not the final value — the user corrects it in Phase 2.

**Recommendation for a future iteration:** In `extract-project-context.js`, add a fallback that reads all bolded terms from CLAUDE.md (`**term**` pattern) regardless of case, supplementing the all-caps extraction.

---

### Risk 3 — Projects with no obvious stack (severity: MEDIUM)

**What goes wrong:** A data science notebook, a collection of R scripts, a Makefile-only project, or a polyglot monorepo has no manifest file that Phase 1's scan covers. Q2 gets `null` recommendations and the user faces a blank box.

**Mitigations in this design:**
- `*.ipynb` detection covers Jupyter notebooks explicitly
- Q2 includes the prompt: *"Nothing detected; please describe your stack"* — a blank recommendation is still a valid answer
- Q3 includes "N/A" for non-code projects

**Additional detectors to consider adding:**
- `*.R` or `renv.lock` → R
- `*.jl` or `Project.toml` (Julia) → Julia
- `Makefile` → read targets as Q3 command recommendations
- `Dockerfile` or `docker-compose.yml` → add Docker to stack
- `*.tf` or `*.tfvars` → Terraform

**Recommendation:** Add these checks to Phase 1's file scan. They cost nothing and prevent blank Q2 recommendations for common non-JS/Python stacks.

---

### Risk 4 — Supplement vs. overwrite for existing CLAUDE.md (severity: MEDIUM)

**What goes wrong:** Supplement mode appends new sections to the bottom of an existing CLAUDE.md. If the file already has some sections (e.g. Quick Facts) but not others (e.g. Domain Terms), the appended sections appear after existing content. For large CLAUDE.md files, this can be jarring.

**Deeper problem:** A CLAUDE.md might have a "Domain Terms" section under a different heading ("Glossary", "Terminology", "Key Concepts"). The supplement check (does a "## Domain Terms" heading exist?) would miss this and add a duplicate.

**Mitigations in this design:**
- The supplement check uses substring matching on heading text: if any heading contains "term", "glossary", or "vocabulary" (case-insensitive), skip Q6
- Appended sections get `<!-- added by project-setup -->` markers for easy identification and relocation

**Remaining design decision:** Should supplement mode offer to insert sections at a specific position, or always append? Always-append is simpler and less risky (no insertion logic that could corrupt content). Recommend keeping always-append with the comment markers and trusting the user to reorder.

---

### Risk 5 — Trigger collision with `session-start-hook` skill (severity: LOW)

**What goes wrong:** A user says "help me set up my project" and gets `session-start-hook` instead of `project-setup` (or vice versa).

**Analysis:** `session-start-hook` description focuses on "startup hooks", "SessionStart hooks", "ensure project can run tests and linters during web sessions" — a runtime concern. `project-setup` description focuses on "CLAUDE.md", "project-context.json", "onboarding Claude to an existing codebase" — a configuration concern. The trigger phrases are sufficiently distinct.

**Mitigation:** The `project-setup` description explicitly includes the file names (`CLAUDE.md`, `evals/project-context.json`) and the pipeline stage names (`skill-adapt`, `skill-eval`). These are unlikely to appear in a hook-setup context.

---

### Risk 6 — Stale project-context.json (severity: LOW)

**What goes wrong:** User runs `project-setup` on day 1, adds a new framework dependency two weeks later, and the stale `evals/project-context.json` causes skill-adapt to adapt to the old stack.

**Mitigation in this design:** Phase 1 Step 5 checks if the file exists and is rich, and offers a one-keystroke refresh. This re-runs Phase 3 only (no re-interview).

**Future improvement:** Add a `generated_at` timestamp to the JSON and have skill-adapt warn if the file is >30 days old.

---

## 5. Verification Checklist

Five concrete test scenarios with expected outcomes.

---

### Scenario 1 — Fresh empty project directory

**Setup:** Empty directory. No files.

**Invoke:** `/project-setup`

**Expected behavior:**
1. Phase 1 finds no files; all recommendations are `null`
2. Announces CREATE mode, 6 questions
3. Asks Q1 with no recommendation pre-filled
4. Asks Q2–Q6 sequentially, one at a time
5. Writes CLAUDE.md from template (all sections present if user answered all questions)
6. Node.js check: if absent, writes `evals/project-context.json` directly from answers; if present, runs extract-project-context.js
7. Shows summary

**Pass criteria:**
- `CLAUDE.md` exists and contains all 4 standard sections
- `evals/project-context.json` exists
- `stack` field in JSON matches what user typed in Q2
- `key_phrases[0]` matches user's Q1 answer

---

### Scenario 2 — package.json present, no CLAUDE.md

**Setup:**
```json
{
  "name": "my-app",
  "description": "A task management tool",
  "scripts": { "test": "jest", "build": "tsc", "lint": "eslint src/" },
  "dependencies": { "react": "^18", "typescript": "^5" }
}
```

**Invoke:** `/project-setup`

**Expected behavior:**
1. Phase 1 detects `package.json`; builds recommendations: Q1 = "A task management tool", Q2 = "React, TypeScript", Q3 = test: jest / build: tsc / lint: eslint src/
2. Q1: user sees recommendation pre-filled, presses Enter to accept
3. Q2: user sees "React, TypeScript" pre-filled, accepts
4. Q3: user sees all three commands pre-filled, accepts
5. Q4, Q5, Q6 asked interactively (no pre-fill for Q4)
6. Writes CLAUDE.md with Stack: React, TypeScript and all three commands
7. Writes project-context.json

**Pass criteria:**
- CLAUDE.md `## Quick Facts` contains `Stack: React, TypeScript` and all three commands
- `project-context.json` has `stack: ["React", "TypeScript"]`
- Q1 and Q2–Q3 accepted recommendations without re-typing (interview was fast)

---

### Scenario 3 — Existing hand-crafted CLAUDE.md, all sections present

**Setup:**
```markdown
# My App
A task management tool.

## Quick Facts
- Stack: React, TypeScript
- Test: `jest`

## Key Directories
- `src/` — React components

## Claude's Rules
### Always
- Run tests before committing.
### Never
- Edit files in dist/.

## Domain Terms
- **GTD**: Getting Things Done methodology
```

**Invoke:** `/project-setup`

**Expected behavior:**
1. Phase 1 detects CLAUDE.md with all 4 standard sections
2. Announces SUPPLEMENT mode: all sections present
3. Asks: "Project context already looks populated. Refresh evals/project-context.json without re-interviewing? [y/N]"
4. User says y → Phase 3b runs; no interview
5. CLAUDE.md is untouched
6. evals/project-context.json is written

**Pass criteria:**
- CLAUDE.md byte-for-byte identical to input (no modifications)
- `project-context.json` exists with non-empty fields
- No interview questions were asked

---

### Scenario 4 — Node.js not available

**Setup:** `which node` fails; `package.json` present with React + TypeScript deps.

**Invoke:** `/project-setup`

**Expected behavior:**
1. Phase 1: Bash check for Node fails; auto-detection falls back to direct package.json parsing (Read tool, not node)
2. Interview runs normally (6 questions, with recommendations from package.json parse)
3. Phase 3b: extract-project-context.js is skipped; falls through directly to Path B (fallback JSON write)
4. `evals/project-context.json` written from interview answers
5. No error or broken state; summary shows "written from interview answers (Node.js not available)"

**Pass criteria:**
- No error messages referencing Node.js
- `evals/project-context.json` exists and has non-empty `stack`
- `stack` in JSON matches Q2 answer

---

### Scenario 5 — Jupyter notebook project

**Setup:**
```
analysis.ipynb
data/raw/
data/processed/
outputs/
```
No `package.json`, `pyproject.toml`, or other manifest.

**Invoke:** `/project-setup`

**Expected behavior:**
1. Phase 1: `ls *.ipynb` returns `analysis.ipynb`; stack recommendation = "Python, Jupyter"
2. Q3 recommendation: `build: jupyter nbconvert --to script --execute *.ipynb`; test and lint = blank
3. Q5 recommendation: data/raw, data/processed, outputs/ — with inferred purposes
4. Q6 optional; user may add domain terms
5. CLAUDE.md has `Stack: Python, Jupyter` and the nbconvert build command; no test/lint lines (blank = omitted)
6. project-context.json has `stack: ["Python", "Jupyter"]`

**Pass criteria:**
- CLAUDE.md contains "Python, Jupyter" and the nbconvert command
- `project-context.json` has `stack` array containing "Jupyter"
- No "stack detection failed" or similar errors

---

## 6. Files to Create / Modify

| Action | Path | Notes |
|--------|------|-------|
| Create | `skills/project-setup/SKILL.md` | Full content in Section 1 above |
| Modify | `skills/skill-scout/SKILL.md` | Insert Step 0 from Section 2; renumber existing steps |
| Create | `.claude/agents/skill-needs-analysis-agent.md` | Full content in Section 3 above |
| Modify | `install.sh` | Update pipeline display and "Start with" message (see below) |

### `install.sh` update (lines 122–132)

Replace:
```bash
echo "  Pipeline:"
echo "    skill-scout  → find an existing skill on GitHub"
echo "    skill-audit  → security-gate it before install"
echo "    skill-adapt  → adapt it to this project"
echo "    skill-eval   → measure its effectiveness"
echo "    skill-refine → auto-improve until targets are met"
echo ""
echo "  Start with: 'find a skill for <capability>'"
echo "           or 'audit the skill at <path>'"
```

With:
```bash
echo "  Pipeline:"
echo "    project-setup → configure CLAUDE.md + project-context.json (Step 0)"
echo "    skill-scout   → find an existing skill on GitHub"
echo "    skill-audit   → security-gate it before install"
echo "    skill-adapt   → adapt it to this project"
echo "    skill-eval    → measure its effectiveness"
echo "    skill-refine  → auto-improve until targets are met"
echo ""
echo "  Start with: 'set up my project for Claude Code' (first time)"
echo "           or 'find a skill for <capability>' (if already configured)"
```

---

## 7. Open Questions (Decisions for Implementation)

1. **Supplement mode section detection**: Should "Glossary" and "Key Concepts" headings count as the "Domain Terms" section? Recommend yes — use substring match on heading text rather than exact `## Domain Terms`.

2. **`generated_at` timestamp in project-context.json**: Add it? It would let skill-adapt warn when context is stale. Low cost, high future value. Recommend adding.

3. **SKILL-EVAL.md for project-setup**: Should the project-setup skill have its own eval? Given that it's an interactive interview skill, traditional eval scenarios are harder to automate. Recommend deferring until after initial implementation — write a manual test checklist (the 5 scenarios above) and revisit automation later.

4. **`skill-needs-analysis-agent` invocation**: Who invokes it? Currently it's an opt-in agent. Consider having `project-setup` mention it in the summary: *"Run `skill-needs-analysis-agent` to get a recommended skill shortlist for this project."* This closes the gap between project-setup and skill-scout.
