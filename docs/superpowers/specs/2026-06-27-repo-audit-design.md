# Repo Audit Skill — Design Spec
**Date:** 2026-06-27
**Status:** Approved

## Goal

Build a `repo-audit` skill that conducts in-depth audits of any public GitHub repository, extracts specific details from each layer of the tech stack, and outputs structured artifacts that inform the architecture of future Claude Code projects.

## Community Tools

- **Repomix** (`npx repomix --remote`) — primary engine; packs any public GitHub repo into a single compressed, structured file without cloning. Node.js native, matches project stack.
- **Gitingest** (`gitingest <url>`) — fallback engine; Python-native, simpler output (summary + tree + content), lighter for large repos or when Repomix fails.

---

## Architecture

```
User invokes: repo-audit <github-url> [--pipeline] [--layer <names>]
                    │
                    ▼
         ┌─────────────────────┐
         │  repo-audit skill   │  ← orchestrator (SKILL.md)
         └─────────┬───────────┘
                   │
         ┌─────────▼───────────┐
         │  npx repomix        │
         │  --remote <url>     │
         │  --compress         │
         │  --output-format xml│
         └─────────┬───────────┘
                   │ packed output → /tmp/repo-audit-<owner>-<repo>/packed.xml
                   │
         ┌─────────▼───────────┐
         │  categorize-files.js│  ← routes files to 8 layer slices
         └─────────┬───────────┘
                   │ 8 layer XML slices + manifest.json
                   │
          ┌────────┴──────────────────────────────────┐
          │          8 parallel sub-agents             │
          │  runtime  framework  database  testing     │
          │  cicd     auth       ai-llm    claude-code │
          └────────┬──────────────────────────────────┘
                   │ 8 layer objects
         ┌─────────▼───────────┐
         │  Merge + write      │
         │  JSON + Markdown    │
         └─────────┬───────────┘
                   │
         ┌─────────▼───────────┐    ← if --pipeline flag
         │  Pipeline inject    │
         │  evals/project-     │
         │  context.json       │
         └─────────────────────┘
```

**Key decisions:**
- One Repomix run produces one packed file. The skill categorizes files into layer slices — no redundant fetches.
- 8 parallel agents each receive only their layer's slice — per-agent context stays small regardless of repo size.
- XML output format from Repomix — structured enough for reliable file-path splitting.
- `--pipeline` flag is opt-in. Standalone mode is the default.

---

## Components

**New files:**
```
skills/repo-audit/
├── SKILL.md
├── SKILL-AUDIT.md          ← required by skill-guardian health checks
├── SKILL-EVAL.md           ← required by skill-guardian health checks
└── scripts/
    └── categorize-files.js

.claude/agents/
├── repo-audit-runtime.md
├── repo-audit-framework.md
├── repo-audit-database.md
├── repo-audit-testing.md
├── repo-audit-cicd.md
├── repo-audit-auth.md
├── repo-audit-ai-llm.md
└── repo-audit-claude-code.md
```

`SKILL-AUDIT.md` and `SKILL-EVAL.md` follow the same template as all other skills in the pipeline. `SKILL-EVAL.md` is generated via `generate-seed-evals.js` as part of the implementation. `SKILL-AUDIT.md` is written by hand at the end of implementation using the static-scan results.

### `SKILL.md` — orchestrator responsibilities
1. Validate + normalize GitHub URL → `owner/repo`
2. Run `npx repomix --remote owner/repo --compress --output-format xml > /tmp/repo-audit-owner-repo/packed.xml`
3. Run `categorize-files.js` → 8 layer slices in `/tmp/repo-audit-owner-repo/`
4. Dispatch 8 parallel sub-agents, each receiving its slice path
5. Collect 8 layer objects, merge into final artifacts
6. Write `docs/audits/<owner>-<repo>-<date>.md` + `.json`
7. If `--pipeline`: inject `ref_signals` into `evals/project-context.json`
8. Cleanup `/tmp/repo-audit-<owner>-<repo>/`

### `categorize-files.js` — file routing rules

| Layer | File patterns matched |
|---|---|
| Runtime | `package.json`, `*.toml`, `*.mod`, `Dockerfile*`, `.nvmrc`, `.python-version`, `docker-compose*` |
| Framework | `src/**`, `app/**`, `pages/**`, `routes/**`, `components/**`, `server.*`, `vite.*`, `next.config.*`, `webpack.*` |
| Database | `**/db/**`, `**/migrations/**`, `**/schema.*`, `**/models/**`, `drizzle.*`, `prisma/**`, `**/repositories/**` |
| Testing | `**/*.test.*`, `**/*.spec.*`, `**/tests/**`, `**/e2e/**`, `jest.*`, `vitest.*`, `pytest.*`, `playwright.*` |
| CI/CD | `.github/**`, `.circleci/**`, `.gitlab-ci.*`, `Makefile`, `Dockerfile*`, `**/deploy/**`, `fly.toml`, `vercel.json` |
| Auth/Security | `**/auth/**`, `**/middleware/**`, `**/guards/**`, `**/policies/**`, `.env.example`, `**/permissions/**` |
| AI/LLM | `**/prompts/**`, `**/agents/**`, `**/evals/**`, `**/llm/**`, `**/ai/**`, `**/embeddings/**`, `**/chains/**` |
| Claude Code | `CLAUDE.md`, `.claude/**`, `skills/**`, `evals/project-context.json`, `.mcp.json` |

Files matching multiple layers are duplicated into each relevant slice.

### 8 layer agents — extraction targets

| Agent | Extracts |
|---|---|
| `repo-audit-runtime` | Language, version, package manager, engines constraints, Docker base image, runtime environment targets |
| `repo-audit-framework` | Primary framework, rendering strategy (SSR/CSR/SSG), API style (REST/GraphQL/tRPC), routing pattern, key libraries |
| `repo-audit-database` | DB type (SQL/NoSQL/vector), ORM/client, migration strategy, schema patterns, connection pooling |
| `repo-audit-testing` | Test framework, coverage tooling, test types (unit/integration/e2e), file naming conventions, CI integration |
| `repo-audit-cicd` | Pipeline tool, stages, deployment targets, environment strategy, secrets management pattern |
| `repo-audit-auth` | Auth strategy (JWT/session/OAuth), provider, RBAC pattern, middleware approach, security headers |
| `repo-audit-ai-llm` | Models used, providers, prompting patterns, agent framework, eval strategy, vector store, context management |
| `repo-audit-claude-code` | CLAUDE.md structure + conventions, installed skills, agents, hooks wiring, MCP servers, plugins, project-context fields |

**Each agent returns a standardized layer object:**
```json
{
  "layer": "<name>",
  "detected": true,
  "confidence": "high|medium|low",
  "signals": { },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

---

## Data Flow

**Step 1 — Invocation**
```
repo-audit https://github.com/owner/repo [--pipeline] [--layer runtime,framework] [--estimate]
```
- URL normalized to `owner/repo`
- `--layer` runs only specified layers (default: all 8)
- `--pipeline` enables injection into `evals/project-context.json`
- `--estimate` runs Repomix stats only (no agents) and prints a cost preview before committing to a full audit:
  ```
  Repo: owner/repo — 142 files, ~84,300 tokens (compressed)
  Full audit: ~8 agent calls. Proceed? [y/N]
  ```
  If the user answers N, audit aborts cleanly with no artifacts written.

**Step 2 — Repomix pack**
```bash
npx repomix --remote owner/repo --compress --output-format xml \
  --output /tmp/repo-audit-owner-repo/packed.xml
```

**Step 3 — File categorization**
```bash
node skills/repo-audit/scripts/categorize-files.js \
  /tmp/repo-audit-owner-repo/packed.xml
```
Writes 8 slice files + `manifest.json`. Layers with 0 matching files are marked `detected: false` — agent still dispatched, returns null signals.

**Step 4 — Parallel agent dispatch**

8 agents fire simultaneously. Each receives its slice path, the repo name, and its layer name.

**Step 5 — Merge**

Orchestrator collects 8 layer objects and builds the final JSON (see Output Artifacts section).

**Step 6 — Write artifacts**
```
docs/audits/
├── owner-repo-2026-06-27.json
└── owner-repo-2026-06-27.md
```

**Step 7 — Pipeline injection (if `--pipeline`)**

Merges `ref_signals` into `evals/project-context.json`. Local values always win; ref-sourced values labeled `(from deep audit)`.

**Step 8 — Cleanup**
```bash
rm -rf /tmp/repo-audit-owner-repo/
```

**Gitingest fallback** — triggered automatically if Repomix fails:
```bash
pip install gitingest -q && gitingest owner/repo --output /tmp/repo-audit-owner-repo/gitingest.txt
```
`categorize-files.js` handles both XML (Repomix) and plain text (Gitingest) formats.

---

## Pipeline Integration

**Standalone mode:**
```
repo-audit <url>  →  docs/audits/<report>
```

**Pipeline mode:**
```
repo-audit <url> --pipeline
     │
     ▼
evals/project-context.json  ←── ref_signals injected
     │
     ▼
project-setup Phase 0  ←── reads ref_signals (already wired)
     │
     ▼
skill-scout → skill-adapt → skill-eval → skill-refine
```

**Touch point 1 — `project-setup` Phase 0 enhancement**

Phase 0 prompt gains a `--deep` option per URL:
```
> "Do you have any reference projects to draw conventions from?
   Paste up to 3 GitHub URLs — or press Enter to skip.
   Add --deep to any URL for a full layer audit via repo-audit."
```
When `--deep` detected: Phase 0 invokes `repo-audit <url>`, uses resulting JSON as `ref_signals`. Without `--deep`: existing lightweight fetch is unchanged — no regression.

**Touch point 2 — `project-context.json` schema extension**

Two new optional fields (non-breaking, default to `[]`):
```json
{
  "audited_repos": [
    {
      "repo": "owner/repo",
      "audited_at": "2026-06-27",
      "report": "docs/audits/owner-repo-2026-06-27.json"
    }
  ],
  "audit_signals": {
    "architecture_patterns": [],
    "ref_stack_extended": []
  }
}
```

**Touch point 3 — `extract-project-context.js` update**

`skills/skill-eval/scripts/extract-project-context.js` currently extracts the existing 9 fields. It must be updated to also extract `audited_repos` and `audit_signals` so `skill-needs-analysis-agent` and downstream pipeline tools receive the richer context. Change is additive — existing 9 fields unchanged.

**Standalone use cases:**

| Scenario | Command |
|---|---|
| Preview token count before auditing | `repo-audit https://github.com/owner/repo --estimate` |
| Audit any repo | `repo-audit https://github.com/owner/repo` |
| Audit + feed pipeline | `repo-audit https://github.com/owner/repo --pipeline` |
| Audit specific layers only | `repo-audit https://github.com/owner/repo --layer runtime,framework,claude-code` |
| Re-audit after major changes | `repo-audit https://github.com/owner/repo` (new dated file, previous preserved) |

**What does NOT change:**
- `project-setup` Phase 0 lightweight fetch — unchanged, still default
- `project-context.json` existing 9 fields — all preserved, new fields are additive
- `skill-scout`, `skill-adapt`, `skill-eval`, `skill-refine` — no changes needed
- `install.sh` / `uninstall.sh` — new skill + agents follow existing install pattern

---

## Error Handling

| Failure | Detection | Response |
|---|---|---|
| Invalid/unparseable URL | URL normalization | Message: `"Could not parse '<url>' as a GitHub repo."` Abort. |
| Private repo (404/403) | Repomix exit code | Trigger Gitingest fallback. If also fails → abort with message. |
| Repomix unavailable / timeout >30s | Exit code / timeout | Warn user, trigger Gitingest fallback automatically. |
| Repo too large (tokens >500k) | Repomix stats | Re-run with `--include` targeting detected layer patterns only. |
| Layer slice empty (0 files) | `manifest.json` count = 0 | Agent dispatched, returns `{ "detected": false, "signals": null }`. Not an error. |
| One layer agent fails | Agent error / timeout | Layer marked `{ "detected": null, "error": "agent failed" }`. Other 7 continue. |
| All agents fail | All 8 error | Abort merge. Preserve `packed.xml` in `docs/audits/raw/`. |
| `docs/audits/` absent | Pre-write check | Created automatically. |
| `--pipeline` but no `project-context.json` | Pre-inject check | Warn + skip injection. Audit artifacts still written. |
| Gitingest not installed | `pip install` failure | Abort with manual fallback: `"Install repomix globally: npm install -g repomix"` |

**Partial audit guarantee:** a single agent failure never kills the audit. The Markdown report marks failed layers with a re-run hint. JSON always emits the layer key — never omits it — so downstream schema stays consistent.

**Temp file safety:** `/tmp/repo-audit-<owner>-<repo>/` always removed on exit. On failure, `packed.xml` is copied to `docs/audits/raw/owner-repo-<date>.xml` before cleanup.

---

## Output Artifacts

### JSON — `docs/audits/owner-repo-YYYY-MM-DD.json`

```json
{
  "repo": "owner/repo",
  "audited_at": "2026-06-27T14:32:00Z",
  "repomix_stats": {
    "total_files": 142,
    "total_tokens": 84300,
    "compressed": true,
    "fallback_tool": null
  },
  "layers": {
    "runtime": {
      "detected": true,
      "confidence": "high",
      "signals": {
        "language": "TypeScript",
        "runtime": "Node.js",
        "version": ">=18.0.0",
        "package_manager": "pnpm",
        "docker_base_image": "node:18-alpine"
      },
      "patterns": ["pnpm workspaces for monorepo", "alpine base for smaller images"],
      "gaps": ["no .nvmrc pinning exact version"],
      "notes": ""
    },
    "framework": { "..." },
    "database": { "..." },
    "testing": { "..." },
    "cicd": { "..." },
    "auth": { "..." },
    "ai_llm": { "..." },
    "claude_code": {
      "detected": true,
      "confidence": "high",
      "signals": {
        "claude_md_sections": ["Quick Facts", "Key Directories", "Pipeline", "Domain Terms", "Claude Rules"],
        "installed_skills": ["project-setup", "skill-scout", "skill-adapt"],
        "agents": ["skill-eval-agent", "skill-refine-agent"],
        "hooks": ["PreToolUse:Write", "PostToolUse:Bash"],
        "mcp_servers": ["context7"],
        "plugins": ["superpowers", "gsd"]
      },
      "patterns": ["Always/Never rules pattern in CLAUDE.md", "evals/ gitignored"],
      "gaps": ["no project-audit skill installed"],
      "notes": ""
    }
  },
  "architecture_signals": [
    "Next.js 15 App Router + tRPC + Zod",
    "Drizzle ORM on Postgres via Neon",
    "Vitest (unit) + Playwright (e2e)",
    "GitHub Actions → Vercel",
    "Claude Code with GSD workflow"
  ],
  "ref_signals": {
    "ref_purpose": "",
    "ref_stack": ["TypeScript", "Next.js", "tRPC", "Postgres", "Drizzle"],
    "ref_commands": { "test": "pnpm test", "build": "pnpm build", "lint": "pnpm lint", "deploy": "vercel --prod" },
    "ref_rules_always": [],
    "ref_rules_never": [],
    "ref_directories": [{ "path": "./src/server", "description": "tRPC routers" }],
    "ref_glossary": [{ "term": "RSC", "definition": "React Server Component" }],
    "ref_skills": ["project-setup", "skill-scout"],
    "ref_agents": ["skill-eval-agent"]
  }
}
```

> `ref_signals` shape is identical to `project-setup` Phase 0 schema — zero adaptation needed to feed the pipeline.

### Markdown — `docs/audits/owner-repo-YYYY-MM-DD.md`

```markdown
# Repo Audit: owner/repo
**Audited:** 2026-06-27 | **Files:** 142 | **Tokens:** 84,300 (compressed)

## Architecture Summary
- Next.js 15 App Router + tRPC + Zod
- Drizzle ORM on Postgres via Neon
- Vitest (unit) + Playwright (e2e)
- GitHub Actions → Vercel
- Claude Code with GSD workflow

## Layer: Runtime
**Confidence:** High
| Signal | Value |
|---|---|
| Language | TypeScript |
| Runtime | Node.js ≥18 |
| Package manager | pnpm |
| Docker base | node:18-alpine |

**Patterns worth adopting:** pnpm workspaces, alpine base image
**Gaps:** no .nvmrc version pin

## Layer: Framework
...

## Layer: Database
...

## Layer: Testing
...

## Layer: CI/CD
...

## Layer: Auth/Security
...

## Layer: AI/LLM
...

## Layer: Claude Code Config
...

## Recommendations for Future Projects
> Derived from cross-layer pattern analysis

1. ...

## Re-run
`repo-audit https://github.com/owner/repo [--pipeline] [--layer <name>]`
```

**Artifact naming convention:**
- `docs/audits/` created automatically if absent
- Named `<owner>-<repo>-<YYYY-MM-DD>.json` / `.md`
- Multiple audits accumulate — no overwrite, history preserved
- `docs/audits/raw/` holds Repomix XML only on failure

**Versioning policy:** `docs/audits/` is intentionally **committed to git** — unlike `evals/` (volatile, generated each run), audit reports are reference artifacts worth versioning and comparing over time. `.gitignore` must explicitly NOT exclude this path. Add a comment to `.gitignore`: `# docs/audits/ is intentionally committed — audit reports are reference artifacts`.

---

## Summary

| Dimension | Decision |
|---|---|
| Primary engine | Repomix via `npx repomix --remote` (zero install) |
| Fallback engine | Gitingest (Python, auto-triggered on Repomix failure) |
| Repo types | Any public GitHub repo — adaptive to all stack types |
| Layers | 8 parallel agents: Runtime, Framework, Database, Testing, CI/CD, Auth, AI/LLM, Claude Code Config |
| Output | JSON (machine/pipeline) + Markdown (human review) per audit |
| Pipeline integration | `--pipeline` flag injects `ref_signals`; `--deep` in project-setup Phase 0 |
| Breaking changes | None — all changes to existing files are additive |
| New files | 1 skill, 1 script, 8 agents, SKILL-AUDIT.md, SKILL-EVAL.md |
| Existing files touched | `project-setup/SKILL.md` (Phase 0 `--deep`), `extract-project-context.js` (2 new fields), `.gitignore` (comment only) |
| `docs/audits/` versioning | Committed to git — reference artifacts, not volatile |
| Token cost guard | `--estimate` flag shows file/token count + confirmation before running agents |
