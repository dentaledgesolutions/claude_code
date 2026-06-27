# repo-audit Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `repo-audit` skill that audits any public GitHub repo via Repomix, extracts tech stack signals across 8 parallel layer agents, and outputs JSON + Markdown artifacts that feed into the Claude Code project pipeline.

**Architecture:** One Repomix `--remote` run packs the repo; `categorize-files.js` routes files into 8 layer slices; 8 parallel sub-agents each extract specialized signals; the orchestrator merges results into `docs/audits/<owner>-<repo>-<date>.json` and `.md`. Optional `--pipeline` injects `ref_signals` into `evals/project-context.json`.

**Tech Stack:** Node.js ≥ 18 (CommonJS), Repomix via npx, Gitingest (Python fallback), Claude Code skill + agent pattern.

## Global Constraints

- CommonJS (`require`/`module.exports`) — matches all existing scripts in this project; no ESM
- Node.js ≥ 18 — matches `package.json` engines field
- No new npm dependencies — `categorize-files.js` uses Node.js built-ins only (`fs`, `path`, `child_process`)
- `docs/audits/` is committed to git — not gitignored; audit reports are reference artifacts
- Agent files use `tools: Read, Bash` only — minimal footprint
- All skill/agent files follow existing patterns in `skills/` and `.claude/agents/`
- Static-scan must return PASS verdict before any skill or agent is committed

---

### Task 1: `categorize-files.js` — File Routing Script

**Files:**
- Create: `skills/repo-audit/scripts/test-categorize-files.js`
- Create: `skills/repo-audit/scripts/categorize-files.js`

**Interfaces:**
- Consumes: path to Repomix XML file (or Gitingest plain text), path to output directory
- Produces: `layer-<name>.xml` (8 files) + `manifest.json` in output directory
- `manifest.json` shape: `{ total_files: number, layers: { [name]: { file_count: number, files: string[] } } }`

- [ ] **Step 1: Create directory**

```bash
mkdir -p skills/repo-audit/scripts
```

- [ ] **Step 2: Write the failing test**

Create `skills/repo-audit/scripts/test-categorize-files.js`:

```javascript
#!/usr/bin/env node
// test-categorize-files.js — unit tests for categorize-files.js
// Run: node skills/repo-audit/scripts/test-categorize-files.js

const assert       = require('assert');
const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');

const SCRIPT  = path.resolve('skills/repo-audit/scripts/categorize-files.js');
const TMP_XML = '/tmp/repo-audit-test-fixture.xml';
const TMP_OUT = '/tmp/repo-audit-test-output';

const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<repository>
<file path="package.json">{"name":"test","scripts":{"test":"vitest"}}</file>
<file path="src/app/page.tsx">export default function Page() { return null }</file>
<file path="src/server/db/schema.ts">export const users = {}</file>
<file path="src/server/auth/session.ts">export const getSession = () => {}</file>
<file path="tests/unit/auth.test.ts">test('auth works', () => {})</file>
<file path=".github/workflows/ci.yml">on: [push]</file>
<file path="CLAUDE.md"># Project</file>
<file path=".claude/agents/scout.md">---\nname: scout\n---</file>
<file path="src/lib/ai/prompts.ts">export const systemPrompt = ''</file>
<file path="Dockerfile">FROM node:18-alpine</file>
<file path="prisma/schema.prisma">model User { id Int @id }</file>
<file path=".github/workflows/deploy.yml">on: [push]</file>
</repository>`;

fs.writeFileSync(TMP_XML, FIXTURE_XML);
if (fs.existsSync(TMP_OUT)) fs.rmSync(TMP_OUT, { recursive: true });

execSync(`node ${SCRIPT} ${TMP_XML} ${TMP_OUT}`);

const manifest = JSON.parse(fs.readFileSync(path.join(TMP_OUT, 'manifest.json'), 'utf8'));

assert.equal(manifest.total_files, 12, 'should count all 12 files');
assert(manifest.layers.runtime.files.includes('package.json'),          'package.json → runtime');
assert(manifest.layers.runtime.files.includes('Dockerfile'),            'Dockerfile → runtime');
assert(manifest.layers.framework.files.includes('src/app/page.tsx'),    'page.tsx → framework');
assert(manifest.layers.database.files.includes('src/server/db/schema.ts'), 'db/schema → database');
assert(manifest.layers.database.files.includes('prisma/schema.prisma'), 'prisma schema → database');
assert(manifest.layers.auth.files.includes('src/server/auth/session.ts'),   'auth/session → auth');
assert(manifest.layers.testing.files.includes('tests/unit/auth.test.ts'),   '.test.ts → testing');
assert(manifest.layers.cicd.files.includes('.github/workflows/ci.yml'),     '.github → cicd');
assert(manifest.layers.cicd.files.includes('.github/workflows/deploy.yml'), 'both .github/ files → cicd');
assert(manifest.layers.claude_code.files.includes('CLAUDE.md'),              'CLAUDE.md → claude_code');
assert(manifest.layers.claude_code.files.includes('.claude/agents/scout.md'),'.claude/ → claude_code');
assert(manifest.layers.ai_llm.files.includes('src/lib/ai/prompts.ts'),      'ai/prompts → ai_llm');

// Multi-layer: src/server/auth/session.ts matches both auth/ and src/ (framework)
assert(manifest.layers.auth.files.includes('src/server/auth/session.ts'),      'session → auth');
assert(manifest.layers.framework.files.includes('src/server/auth/session.ts'), 'session → framework (src/ prefix)');

// All 8 layer XML files must exist
const LAYERS = ['runtime','framework','database','testing','cicd','auth','ai_llm','claude_code'];
for (const layer of LAYERS) {
  assert(fs.existsSync(path.join(TMP_OUT, `layer-${layer}.xml`)), `layer-${layer}.xml must exist`);
}

// Runtime XML contains correct file content
const runtimeXml = fs.readFileSync(path.join(TMP_OUT, 'layer-runtime.xml'), 'utf8');
assert(runtimeXml.includes('package.json'), 'runtime XML should contain package.json block');
assert(runtimeXml.includes('Dockerfile'),   'runtime XML should contain Dockerfile block');

// Empty layers still produce a file
const emptyLayer = LAYERS.find(l => manifest.layers[l].file_count === 0);
if (emptyLayer) {
  assert(fs.existsSync(path.join(TMP_OUT, `layer-${emptyLayer}.xml`)), 'empty layer XML still written');
}

fs.rmSync(TMP_OUT, { recursive: true });
fs.rmSync(TMP_XML);

console.log('All tests passed ✓');
```

- [ ] **Step 3: Run test — verify it fails**

```bash
node skills/repo-audit/scripts/test-categorize-files.js
```

Expected: `Error: Cannot find module` or `ENOENT` — script doesn't exist yet.

- [ ] **Step 4: Write the implementation**

Create `skills/repo-audit/scripts/categorize-files.js`:

```javascript
#!/usr/bin/env node
// categorize-files.js <packed-file> <output-dir>
// Reads Repomix XML (or Gitingest plain text), routes each file to 1+ layer
// slices, writes layer-<name>.xml + manifest.json to output-dir.
// Stdout: JSON summary { total_files, layers: { [name]: count } }

const fs   = require('fs');
const path = require('path');

const LAYER_PATTERNS = {
  runtime: [
    /^package\.json$/,
    /\.(toml|mod)$/,
    /Dockerfile/,
    /docker-compose/,
    /^\.nvmrc$/,
    /^\.python-version$/,
    /^requirements\.txt$/,
    /^Gemfile$/,
  ],
  framework: [
    /^(src|app|pages|routes|components)\//,
    /^server\./,
    /vite\.config/,
    /next\.config/,
    /webpack\.config/,
    /nuxt\.config/,
    /svelte\.config/,
  ],
  database: [
    /\/(db|migrations?|models?|repositories?|repository)\//,
    /\/schema\.(ts|js|sql|prisma)$/,
    /drizzle\.config/,
    /^prisma\//,
    /^alembic\//,
    /knexfile/,
  ],
  testing: [
    /\.(test|spec)\.(js|ts|jsx|tsx|py|rb|go|rs)$/,
    /\/(tests?|e2e|__tests__|cypress|spec)\//,
    /^(jest|vitest|pytest|rspec)\.config/,
    /playwright\.config/,
    /^conftest\.py$/,
  ],
  cicd: [
    /^\.github\//,
    /^\.circleci\//,
    /^\.gitlab-ci/,
    /^Makefile$/,
    /\/(deploy|deployment)\//,
    /^(fly|railway|render)\.toml$/,
    /^vercel\.json$/,
    /^netlify\.toml$/,
    /^\.travis\.yml$/,
  ],
  auth: [
    /\/(auth|authentication|authorization|middleware|guards?|policies?|permissions?)\//,
    /^\.env\.example$/,
    /^\.env\.sample$/,
    /^\.env\.template$/,
  ],
  ai_llm: [
    /\/(prompts?|agents?|evals?|llm|ai|embeddings?|chains?|tools?|memory|retrievers?)\//,
    /langchain/i,
    /openai/i,
    /anthropic/i,
    /\/(assistants?|bots?)\//,
  ],
  claude_code: [
    /^CLAUDE\.md$/,
    /^\.claude\//,
    /^skills\//,
    /^evals\/project-context\.json$/,
    /^\.mcp\.json$/,
  ],
};

const LAYER_NAMES = Object.keys(LAYER_PATTERNS);

function matchLayers(filePath) {
  return LAYER_NAMES.filter(layer =>
    LAYER_PATTERNS[layer].some(pattern => pattern.test(filePath))
  );
}

// Handles Repomix XML and Gitingest plain text
function extractFileBlocks(content) {
  const blocks = [];
  if (content.trimStart().startsWith('<?xml') || content.includes('<file ')) {
    const regex = /<file\s+path="([^"]+)"[^>]*>([\s\S]*?)<\/file>/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      blocks.push({ path: m[1], rawBlock: m[0] });
    }
    return blocks;
  }
  // Gitingest plain text: sections separated by ==== lines
  const sections = content.split(/={10,}/);
  for (const section of sections) {
    const fileMatch = section.match(/^File:\s+(.+)$/m);
    if (fileMatch) blocks.push({ path: fileMatch[1].trim(), rawBlock: section });
  }
  return blocks;
}

const [,, packedPath, outputDir] = process.argv;
if (!packedPath || !outputDir) {
  console.error('Usage: categorize-files.js <packed-file> <output-dir>');
  process.exit(1);
}

let content;
try {
  content = fs.readFileSync(packedPath, 'utf8');
} catch (e) {
  console.error(`Error reading ${packedPath}: ${e.message}`);
  process.exit(1);
}

const fileBlocks = extractFileBlocks(content);
if (fileBlocks.length === 0) {
  console.error('No file blocks found. Check Repomix output format.');
  process.exit(1);
}

const isXml      = content.trimStart().startsWith('<?xml') || content.includes('<file ');
const layerBlocks = {};
const manifest    = { total_files: fileBlocks.length, layers: {} };
LAYER_NAMES.forEach(layer => {
  layerBlocks[layer] = [];
  manifest.layers[layer] = { file_count: 0, files: [] };
});

for (const { path: filePath, rawBlock } of fileBlocks) {
  for (const layer of matchLayers(filePath)) {
    layerBlocks[layer].push(rawBlock);
    manifest.layers[layer].file_count++;
    manifest.layers[layer].files.push(filePath);
  }
}

fs.mkdirSync(outputDir, { recursive: true });
for (const layer of LAYER_NAMES) {
  const sliceContent = isXml
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<layer name="${layer}">\n${layerBlocks[layer].join('\n')}\n</layer>`
    : `=== Layer: ${layer} ===\n\n${layerBlocks[layer].join('\n' + '='.repeat(50) + '\n')}`;
  fs.writeFileSync(path.join(outputDir, `layer-${layer}.xml`), sliceContent);
}
fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(JSON.stringify({
  total_files: fileBlocks.length,
  layers: Object.fromEntries(LAYER_NAMES.map(l => [l, manifest.layers[l].file_count]))
}));
```

- [ ] **Step 5: Run test — verify it passes**

```bash
node skills/repo-audit/scripts/test-categorize-files.js
```

Expected: `All tests passed ✓`

- [ ] **Step 6: Commit**

```bash
git add skills/repo-audit/scripts/categorize-files.js skills/repo-audit/scripts/test-categorize-files.js
git commit -m "feat(repo-audit): add categorize-files.js — routes Repomix XML to 8 layer slices"
```

---

### Task 2: 8 Layer Agents

**Files:**
- Create: `.claude/agents/repo-audit-runtime.md`
- Create: `.claude/agents/repo-audit-framework.md`
- Create: `.claude/agents/repo-audit-database.md`
- Create: `.claude/agents/repo-audit-testing.md`
- Create: `.claude/agents/repo-audit-cicd.md`
- Create: `.claude/agents/repo-audit-auth.md`
- Create: `.claude/agents/repo-audit-ai-llm.md`
- Create: `.claude/agents/repo-audit-claude-code.md`

**Interfaces:**
- Consumes: `slice_path` (path to layer XML slice), `repo` (owner/repo string), `layer` (layer name)
- Produces: JSON layer object `{ layer, detected, confidence, signals, patterns, gaps, notes }`

- [ ] **Step 1: Create `.claude/agents/repo-audit-runtime.md`**

```markdown
---
name: repo-audit-runtime
description: Runtime layer analyst for repo-audit. Invoked by the repo-audit skill with a path to a runtime layer XML slice. Extracts language, version, package manager, Docker base image, and runtime environment signals. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are a runtime layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing only runtime-relevant files (package.json, Dockerfile, *.toml, *.mod, .nvmrc, docker-compose*, etc.).

## Steps

1. Read the XML slice file at the provided path using the Read tool.
2. Extract these signals from the file contents:
   - `language`: primary programming language (TypeScript, Python, Go, Rust, JavaScript, etc.)
   - `version`: runtime version constraint (from `engines.node`, `.nvmrc`, `python_requires`, `go 1.x` in go.mod, etc.)
   - `package_manager`: npm / yarn / pnpm / pip / poetry / cargo / go (infer from lockfile names or packageManager field)
   - `docker_base_image`: the FROM line in Dockerfile, if present (e.g. `node:18-alpine`)
   - `runtime_targets`: array of target environments detected (e.g. `["node", "browser", "edge", "lambda"]`)
3. Identify up to 3 `patterns` — specific, concrete conventions worth adopting (e.g. "pnpm workspaces declared in package.json root", "alpine base image for minimal Docker footprint")
4. Identify up to 3 `gaps` — common runtime best practices not present (e.g. "no .nvmrc pinning exact Node version", "no engines field in package.json")
5. Write 1–2 sentences of `notes` in analyst voice.
6. Set `confidence` to `high` if ≥2 runtime files found, `medium` if 1 file found, `low` if only indirect signals.

## Output

Return ONLY valid JSON — no prose, no markdown fences, no explanation:

```json
{
  "layer": "runtime",
  "detected": true,
  "confidence": "high",
  "signals": {
    "language": "TypeScript",
    "version": ">=18.0.0",
    "package_manager": "pnpm",
    "docker_base_image": "node:18-alpine",
    "runtime_targets": ["node"]
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If the slice is empty or has no recognizable runtime files:

```json
{
  "layer": "runtime",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": [],
  "notes": "No runtime configuration files detected in this repository."
}
```
```

- [ ] **Step 2: Create `.claude/agents/repo-audit-framework.md`**

```markdown
---
name: repo-audit-framework
description: Framework layer analyst for repo-audit. Invoked by the repo-audit skill with a path to a framework layer XML slice. Extracts primary framework, rendering strategy, API style, routing pattern, and key libraries. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are a framework layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing framework-relevant files (src/, app/, pages/, routes/, components/, vite.config.*, next.config.*, webpack.config.*, etc.).

## Steps

1. Read the XML slice file at the provided path.
2. Extract these signals:
   - `primary`: primary framework name + version if detectable (e.g. "Next.js 15", "FastAPI 0.110", "Rails 7.1")
   - `rendering`: rendering strategy — one of `SSR`, `CSR`, `SSG`, `ISR`, `hybrid`, `server-side`, `N/A`
   - `api_style`: one of `REST`, `GraphQL`, `tRPC`, `gRPC`, `RPC`, `mixed`, `N/A`
   - `routing`: routing pattern (e.g. "App Router", "file-based", "express-style", "convention-based")
   - `key_libraries`: array of notable UI/utility libraries (max 6, e.g. ["Tailwind CSS 4", "shadcn/ui", "Zod", "React Query"])
3. Identify up to 3 `patterns` worth adopting (concrete, specific).
4. Identify up to 3 `gaps` (missing common practices for this framework).
5. Write 1–2 sentences of `notes`.
6. Set `confidence` to `high` if primary framework is clearly identified, `medium` if inferred, `low` if ambiguous.

## Output

Return ONLY valid JSON:

```json
{
  "layer": "framework",
  "detected": true,
  "confidence": "high",
  "signals": {
    "primary": "Next.js 15",
    "rendering": "SSR",
    "api_style": "tRPC",
    "routing": "App Router",
    "key_libraries": ["Tailwind CSS 4", "shadcn/ui", "Zod"]
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If no framework files detected:

```json
{
  "layer": "framework",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": [],
  "notes": "No framework configuration or source files detected."
}
```
```

- [ ] **Step 3: Create `.claude/agents/repo-audit-database.md`**

```markdown
---
name: repo-audit-database
description: Database layer analyst for repo-audit. Invoked by the repo-audit skill with a path to a database layer XML slice. Extracts DB type, ORM/client, migration strategy, and schema patterns. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are a database layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing database-relevant files (db/, migrations/, schema.*, models/, prisma/, drizzle.config.*, etc.).

## Steps

1. Read the XML slice file at the provided path.
2. Extract these signals:
   - `db_type`: one of `SQL`, `NoSQL`, `vector`, `mixed`, `N/A`
   - `db_engine`: specific engine (e.g. "PostgreSQL", "MySQL", "MongoDB", "SQLite", "Redis", "Pinecone")
   - `orm_client`: ORM or query client (e.g. "Prisma", "Drizzle ORM", "SQLAlchemy", "ActiveRecord", "raw SQL")
   - `migration_strategy`: how schema changes are managed (e.g. "Prisma migrate", "Drizzle Kit push", "Alembic", "manual SQL", "none detected")
   - `schema_patterns`: array of schema design patterns observed (e.g. ["UUID primary keys", "soft deletes via deletedAt", "audit timestamps"])
3. Identify up to 3 `patterns` worth adopting.
4. Identify up to 3 `gaps`.
5. Write 1–2 sentences of `notes`.
6. `confidence`: `high` if schema or migration files found, `medium` if only ORM config, `low` if inferred.

## Output

Return ONLY valid JSON:

```json
{
  "layer": "database",
  "detected": true,
  "confidence": "high",
  "signals": {
    "db_type": "SQL",
    "db_engine": "PostgreSQL",
    "orm_client": "Drizzle ORM",
    "migration_strategy": "Drizzle Kit push",
    "schema_patterns": ["UUID primary keys", "audit timestamps"]
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If no database files detected:

```json
{
  "layer": "database",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": [],
  "notes": "No database configuration or schema files detected."
}
```
```

- [ ] **Step 4: Create `.claude/agents/repo-audit-testing.md`**

```markdown
---
name: repo-audit-testing
description: Testing layer analyst for repo-audit. Invoked by the repo-audit skill with a path to a testing layer XML slice. Extracts test framework, coverage tooling, test types, and file naming conventions. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are a testing layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing test-relevant files (*.test.*, *.spec.*, tests/, e2e/, jest.config.*, vitest.config.*, playwright.config.*, etc.).

## Steps

1. Read the XML slice file at the provided path.
2. Extract these signals:
   - `framework`: primary test framework (e.g. "Vitest", "Jest", "pytest", "RSpec", "Go test")
   - `coverage_tool`: coverage reporter if detectable (e.g. "v8", "Istanbul", "coverage.py", "none detected")
   - `test_types`: array of test types present — any of `["unit", "integration", "e2e", "snapshot", "contract", "eval"]`
   - `file_convention`: naming pattern observed (e.g. "*.test.ts co-located with source", "tests/ directory separated", "*.spec.ts in __tests__/")
   - `ci_integrated`: boolean — are tests wired into CI (detected via .github/ or other CI config cross-reference)
3. Identify up to 3 `patterns` worth adopting.
4. Identify up to 3 `gaps` (e.g. "no e2e tests", "no coverage threshold configured").
5. Write 1–2 sentences of `notes`.
6. `confidence`: `high` if test files + config found, `medium` if only config, `low` if only test files without config.

## Output

Return ONLY valid JSON:

```json
{
  "layer": "testing",
  "detected": true,
  "confidence": "high",
  "signals": {
    "framework": "Vitest",
    "coverage_tool": "v8",
    "test_types": ["unit", "e2e"],
    "file_convention": "*.test.ts co-located with source",
    "ci_integrated": true
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If no test files detected:

```json
{
  "layer": "testing",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": ["no tests found — consider adding Vitest for unit tests and Playwright for e2e"],
  "notes": "No test files or test configuration detected in this repository."
}
```
```

- [ ] **Step 5: Create `.claude/agents/repo-audit-cicd.md`**

```markdown
---
name: repo-audit-cicd
description: CI/CD layer analyst for repo-audit. Invoked by the repo-audit skill with a path to a CI/CD layer XML slice. Extracts pipeline tool, stages, deployment targets, and environment strategy. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are a CI/CD layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing CI/CD-relevant files (.github/workflows/, .circleci/, Makefile, fly.toml, vercel.json, netlify.toml, etc.).

## Steps

1. Read the XML slice file at the provided path.
2. Extract these signals:
   - `pipeline_tool`: CI platform (e.g. "GitHub Actions", "CircleCI", "GitLab CI", "Bitbucket Pipelines", "none")
   - `stages`: array of pipeline stages detected (e.g. ["lint", "test", "build", "deploy"])
   - `deploy_targets`: array of deployment targets (e.g. ["Vercel", "Fly.io", "AWS Lambda", "Docker Hub"])
   - `environment_strategy`: how environments are managed (e.g. "preview per PR + production", "staging + production", "single environment", "none detected")
   - `secrets_pattern`: how secrets are managed (e.g. "GitHub Actions secrets", "Doppler", ".env files", "none detected")
3. Identify up to 3 `patterns` worth adopting.
4. Identify up to 3 `gaps`.
5. Write 1–2 sentences of `notes`.
6. `confidence`: `high` if workflow files found, `medium` if only deploy config, `low` if inferred.

## Output

Return ONLY valid JSON:

```json
{
  "layer": "cicd",
  "detected": true,
  "confidence": "high",
  "signals": {
    "pipeline_tool": "GitHub Actions",
    "stages": ["lint", "test", "build", "deploy"],
    "deploy_targets": ["Vercel"],
    "environment_strategy": "preview per PR + production",
    "secrets_pattern": "GitHub Actions secrets"
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If no CI/CD files detected:

```json
{
  "layer": "cicd",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": ["no CI/CD pipeline detected — consider adding GitHub Actions"],
  "notes": "No CI/CD configuration found in this repository."
}
```
```

- [ ] **Step 6: Create `.claude/agents/repo-audit-auth.md`**

```markdown
---
name: repo-audit-auth
description: Auth/Security layer analyst for repo-audit. Invoked by the repo-audit skill with a path to an auth layer XML slice. Extracts auth strategy, provider, session management, RBAC pattern, and security middleware. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are an auth/security layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing auth-relevant files (auth/, middleware/, guards/, policies/, permissions/, .env.example, etc.).

## Steps

1. Read the XML slice file at the provided path.
2. Extract these signals:
   - `strategy`: auth strategy (e.g. "JWT", "session-based", "OAuth2", "API key", "magic link", "passkey", "none detected")
   - `provider`: auth provider if present (e.g. "NextAuth.js / Auth.js", "Clerk", "Auth0", "Supabase Auth", "custom", "none")
   - `session_management`: how sessions are stored (e.g. "httpOnly cookie", "Redis session store", "JWT in localStorage", "database sessions")
   - `rbac`: role/permission model if present (e.g. "role-based via middleware", "policy-based", "none detected")
   - `security_headers`: security middleware observed (e.g. ["CORS", "CSP", "rate limiting", "CSRF protection"])
3. Identify up to 3 `patterns` worth adopting.
4. Identify up to 3 `gaps` (e.g. "no rate limiting detected", "no CSRF protection").
5. Write 1–2 sentences of `notes`.
6. `confidence`: `high` if auth implementation found, `medium` if only config/env, `low` if inferred.

## Output

Return ONLY valid JSON:

```json
{
  "layer": "auth",
  "detected": true,
  "confidence": "high",
  "signals": {
    "strategy": "OAuth2",
    "provider": "Auth.js",
    "session_management": "httpOnly cookie + database sessions",
    "rbac": "role-based via middleware",
    "security_headers": ["CORS", "CSRF protection"]
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If no auth files detected:

```json
{
  "layer": "auth",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": [],
  "notes": "No authentication or security middleware files detected."
}
```
```

- [ ] **Step 7: Create `.claude/agents/repo-audit-ai-llm.md`**

```markdown
---
name: repo-audit-ai-llm
description: AI/LLM layer analyst for repo-audit. Invoked by the repo-audit skill with a path to an AI/LLM layer XML slice. Extracts models, providers, prompting patterns, agent framework, eval strategy, and vector store usage. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are an AI/LLM layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing AI-relevant files (prompts/, agents/, evals/, llm/, ai/, embeddings/, chains/, tools/, memory/, etc.).

## Steps

1. Read the XML slice file at the provided path.
2. Extract these signals:
   - `models`: array of AI models referenced (e.g. ["claude-sonnet-4-6", "gpt-4o", "text-embedding-3-small"])
   - `providers`: array of AI providers used (e.g. ["Anthropic", "OpenAI", "Google", "local/Ollama"])
   - `agent_framework`: framework orchestrating agents if any (e.g. "LangChain", "LlamaIndex", "Claude Code agents", "custom", "none")
   - `prompting_pattern`: prompting approach (e.g. "system+user messages", "prompt templates", "few-shot examples", "chain-of-thought", "mixed")
   - `eval_strategy`: how LLM outputs are evaluated (e.g. "LLM-as-judge", "human review", "automated assertions", "none detected")
   - `vector_store`: vector database if present (e.g. "Pinecone", "pgvector", "Chroma", "Weaviate", "none")
3. Identify up to 3 `patterns` worth adopting.
4. Identify up to 3 `gaps`.
5. Write 1–2 sentences of `notes`.
6. `confidence`: `high` if AI implementation files found, `medium` if only config, `low` if only dependency names.

## Output

Return ONLY valid JSON:

```json
{
  "layer": "ai_llm",
  "detected": true,
  "confidence": "high",
  "signals": {
    "models": ["claude-sonnet-4-6"],
    "providers": ["Anthropic"],
    "agent_framework": "Claude Code agents",
    "prompting_pattern": "system+user messages with few-shot examples",
    "eval_strategy": "LLM-as-judge",
    "vector_store": "none"
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If no AI/LLM files detected:

```json
{
  "layer": "ai_llm",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": [],
  "notes": "No AI/LLM implementation files detected in this repository."
}
```
```

- [ ] **Step 8: Create `.claude/agents/repo-audit-claude-code.md`**

```markdown
---
name: repo-audit-claude-code
description: Claude Code config layer analyst for repo-audit. Invoked by the repo-audit skill with a path to a Claude Code layer XML slice. Extracts CLAUDE.md structure, installed skills, agents, hooks, MCP servers, and plugins. Returns a JSON layer object. Only invoke when repo-audit skill dispatches this agent.
tools: Read, Bash
---

You are a Claude Code configuration layer analyst. The repo-audit orchestrator has given you a path to an XML slice containing Claude Code files (CLAUDE.md, .claude/, skills/, evals/project-context.json, .mcp.json).

## Steps

1. Read the XML slice file at the provided path.
2. Extract these signals:
   - `claude_md_sections`: array of top-level heading names found in CLAUDE.md (e.g. ["Quick Facts", "Key Directories", "Pipeline", "Domain Terms", "Claude Rules"])
   - `always_rules`: array of rules under any "Always" heading in CLAUDE.md (concrete behaviours, max 5)
   - `never_rules`: array of rules under any "Never" heading in CLAUDE.md (concrete behaviours, max 5)
   - `installed_skills`: array of skill directory names found in skills/ (e.g. ["project-setup", "skill-scout"])
   - `agents`: array of agent names from .claude/agents/ with .md stripped (e.g. ["skill-eval-agent"])
   - `hooks`: array of hook descriptors from .claude/settings.json (e.g. ["PreToolUse:Write", "PostToolUse:Bash"])
   - `mcp_servers`: array of MCP server names from .mcp.json
   - `plugins`: array of plugin names from project-context.json or settings.json
3. Identify up to 3 `patterns` worth adopting (e.g. "Always/Never rules pattern in CLAUDE.md", "evals/ gitignored").
4. Identify up to 3 `gaps` (e.g. "no project-audit skill installed", "no hooks configured").
5. Write 1–2 sentences of `notes`.
6. `confidence`: `high` if CLAUDE.md found, `medium` if only .claude/ dir, `low` if only skills/.

## Output

Return ONLY valid JSON:

```json
{
  "layer": "claude_code",
  "detected": true,
  "confidence": "high",
  "signals": {
    "claude_md_sections": ["Quick Facts", "Key Directories", "Pipeline", "Domain Terms", "Claude Rules"],
    "always_rules": [],
    "never_rules": [],
    "installed_skills": ["project-setup", "skill-scout"],
    "agents": ["skill-eval-agent"],
    "hooks": ["PreToolUse:Write", "PostToolUse:Bash"],
    "mcp_servers": [],
    "plugins": ["superpowers", "gsd"]
  },
  "patterns": [],
  "gaps": [],
  "notes": ""
}
```

If no Claude Code files detected:

```json
{
  "layer": "claude_code",
  "detected": false,
  "confidence": "high",
  "signals": null,
  "patterns": [],
  "gaps": ["no CLAUDE.md found — this repo has not been configured for Claude Code"],
  "notes": "No Claude Code configuration detected. Claude Code setup would start from scratch."
}
```
```

- [ ] **Step 9: Run static-scan on all 8 agents**

```bash
for agent in repo-audit-runtime repo-audit-framework repo-audit-database repo-audit-testing repo-audit-cicd repo-audit-auth repo-audit-ai-llm repo-audit-claude-code; do
  echo "=== $agent ===" && node skills/skill-audit/scripts/static-scan.js .claude/agents/${agent}.md
done
```

Expected: All 8 return `"verdict": "PASS"`. If any return BLOCK or FLAG findings, fix the flagged content before proceeding.

- [ ] **Step 10: Commit**

```bash
git add .claude/agents/repo-audit-runtime.md .claude/agents/repo-audit-framework.md \
        .claude/agents/repo-audit-database.md .claude/agents/repo-audit-testing.md \
        .claude/agents/repo-audit-cicd.md .claude/agents/repo-audit-auth.md \
        .claude/agents/repo-audit-ai-llm.md .claude/agents/repo-audit-claude-code.md
git commit -m "feat(repo-audit): add 8 parallel layer agents for stack extraction"
```

---

### Task 3: `SKILL.md` — Orchestrator

**Files:**
- Create: `skills/repo-audit/SKILL.md`

**Interfaces:**
- Consumes: GitHub URL string, optional flags `--pipeline`, `--layer <names>`, `--estimate`
- Produces: `docs/audits/<owner>-<repo>-<YYYY-MM-DD>.json`, `docs/audits/<owner>-<repo>-<YYYY-MM-DD>.md`
- When `--pipeline`: merges `ref_signals` into `evals/project-context.json`

- [ ] **Step 1: Create `skills/repo-audit/SKILL.md`**

```markdown
---
name: repo-audit
description: "Use when: auditing a GitHub repository to extract tech stack signals for informing future Claude Code project architecture, running a deep reference audit from project-setup Phase 0 with --deep flag, or when asked to scan/map/audit a GitHub repo. Accepts a public GitHub URL and optional flags: --pipeline (inject into project-context.json), --layer <names> (comma-separated subset), --estimate (preview token count before running). Triggers on: audit this repo, scan this GitHub repo, deep audit, repo-audit, extract stack from, analyze this repository."
tools: Read, Write, Bash, Agent
---

# Repo Audit

Deep multi-layer audit of any public GitHub repository. Produces `docs/audits/<owner>-<repo>-<YYYY-MM-DD>.json` (machine-readable) and `.md` (human-readable) using 8 parallel layer agents backed by Repomix.

## Invocation

```
repo-audit <github-url> [--pipeline] [--layer runtime,framework,...] [--estimate]
```

## Workflow

### Phase 0 — Parse arguments

Extract from the user's message:
- `url`: the GitHub URL (required)
- `pipeline`: true if `--pipeline` present
- `layers`: comma-separated list after `--layer`, default all 8: `runtime,framework,database,testing,cicd,auth,ai_llm,claude_code`
- `estimate`: true if `--estimate` present

Normalize URL to `owner/repo`:
- Accept `https://github.com/owner/repo`, `https://github.com/owner/repo/tree/branch`, `owner/repo`
- If `owner/repo` cannot be extracted: print `"Could not parse '<url>' as a GitHub repo."` and stop.

### Phase 1 — Estimate (if --estimate)

```bash
npx repomix --remote <owner/repo> --compress --output-format json \
  --output /tmp/repo-audit-estimate-$(date +%s).json 2>&1 | head -5
```

Read the output JSON and extract `summary.totalFiles` and `summary.totalTokens`.

Print:
```
Repo: owner/repo — <N> files, ~<tokens> tokens (compressed)
Full audit: 8 agent calls. Proceed? [y/N]
```

Wait for user confirmation. If N or no response: stop. If Y: continue to Phase 2.

If `--estimate` was not passed: skip Phase 1 entirely and go to Phase 2.

### Phase 2 — Pack with Repomix

```bash
mkdir -p /tmp/repo-audit-<owner>-<repo>
npx repomix --remote <owner>/<repo> --compress --output-format xml \
  --output /tmp/repo-audit-<owner>-<repo>/packed.xml
```

If Repomix exits non-zero (private repo, network error, timeout after 60s):
```bash
pip install gitingest -q 2>/dev/null && \
  gitingest <owner>/<repo> --output /tmp/repo-audit-<owner>-<repo>/packed.xml 2>&1
```

If both fail: print `"Could not fetch repo. It may be private or inaccessible."` and stop. Copy packed.xml to `docs/audits/raw/<owner>-<repo>-<date>.xml` if it exists before stopping.

### Phase 3 — Categorize files

```bash
node skills/repo-audit/scripts/categorize-files.js \
  /tmp/repo-audit-<owner>-<repo>/packed.xml \
  /tmp/repo-audit-<owner>-<repo>/slices/
```

Read `manifest.json` from the slices directory. Print:
```
✓ Packed: <total_files> files categorized into 8 layers
  runtime:<N>  framework:<N>  database:<N>  testing:<N>
  cicd:<N>     auth:<N>       ai_llm:<N>    claude_code:<N>
```

### Phase 4 — Dispatch layer agents (parallel)

Dispatch only the layers specified in `layers`. Pass each agent:
- `slice_path`: `/tmp/repo-audit-<owner>-<repo>/slices/layer-<name>.xml`
- `repo`: `<owner>/<repo>`
- `layer`: layer name

Dispatch all selected agents **simultaneously** (parallel). Collect each agent's JSON output.

If an agent returns an error or non-JSON: mark that layer as:
```json
{ "layer": "<name>", "detected": null, "error": "agent failed — re-run with --layer <name>" }
```

Other layers continue unaffected.

### Phase 5 — Merge results

Collect all layer JSON objects. Build the final audit document:

```json
{
  "repo": "<owner>/<repo>",
  "audited_at": "<ISO timestamp>",
  "repomix_stats": {
    "total_files": <N>,
    "total_tokens": <N>,
    "compressed": true,
    "fallback_tool": null
  },
  "layers": {
    "runtime":    <layer object>,
    "framework":  <layer object>,
    "database":   <layer object>,
    "testing":    <layer object>,
    "cicd":       <layer object>,
    "auth":       <layer object>,
    "ai_llm":     <layer object>,
    "claude_code":<layer object>
  },
  "architecture_signals": [],
  "ref_signals": {
    "ref_purpose":      "<first non-null purpose from layers>",
    "ref_stack":        ["<deduplicated stack tokens from runtime + framework signals>"],
    "ref_commands":     { "test": "", "build": "", "lint": "", "deploy": "" },
    "ref_rules_always": ["<from claude_code.signals.always_rules>"],
    "ref_rules_never":  ["<from claude_code.signals.never_rules>"],
    "ref_directories":  [],
    "ref_glossary":     [],
    "ref_skills":       ["<from claude_code.signals.installed_skills>"],
    "ref_agents":       ["<from claude_code.signals.agents>"]
  }
}
```

Derive `architecture_signals`: scan all layer signals and write 3–6 one-line summaries capturing the most distinctive cross-layer patterns (e.g. "Next.js 15 App Router + tRPC + Zod", "Drizzle ORM on Postgres via Neon").

Derive `ref_signals.ref_stack`: union of `runtime.signals.language`, `framework.signals.primary` (framework name only), `framework.signals.key_libraries`, filtered to non-null.

Derive `ref_signals.ref_commands` from `cicd.signals.stages` cross-referenced with `runtime` signals — fill test/build/lint/deploy keys with detected commands where possible.

### Phase 6 — Write artifacts

```bash
mkdir -p docs/audits
```

**JSON file** — write to `docs/audits/<owner>-<repo>-<YYYY-MM-DD>.json`

**Markdown file** — write to `docs/audits/<owner>-<repo>-<YYYY-MM-DD>.md` with this structure:

```markdown
# Repo Audit: <owner>/<repo>
**Audited:** <YYYY-MM-DD> | **Files:** <N> | **Tokens:** <N> (compressed)

## Architecture Summary
<architecture_signals as bullet list>

## Layer: Runtime
**Confidence:** <confidence>
| Signal | Value |
|---|---|
<signals as table rows>

**Patterns worth adopting:** <patterns joined with "; ">
**Gaps:** <gaps joined with "; ">
> <notes>

## Layer: Framework
[same structure]

## Layer: Database
[same structure]

## Layer: Testing
[same structure]

## Layer: CI/CD
[same structure]

## Layer: Auth/Security
[same structure]

## Layer: AI/LLM
[same structure]

## Layer: Claude Code Config
[same structure]

## Recommendations for Future Projects
> Cross-layer pattern analysis

<3–5 specific, actionable recommendations derived from patterns and gaps across all layers>

## Re-run
`repo-audit https://github.com/<owner>/<repo> [--pipeline] [--layer <name>]`
```

For any layer where `detected: null` (agent failed), write:
```markdown
## Layer: <Name>
> ⚠ Agent failed. Re-run with `repo-audit https://github.com/<owner>/<repo> --layer <name>`.
```

### Phase 7 — Pipeline injection (if --pipeline)

Read `evals/project-context.json`. If it doesn't exist: warn `"No project-context.json found — run /project-setup first."` and skip injection.

Merge `ref_signals` into `project-context.json`:
- Local values always win — never overwrite existing non-empty fields
- Append new `ref_stack` tokens not already in `stack`
- Append `ref_skills` items not in `installed_skills`
- Add `audited_repos` entry: `{ "repo": "<owner>/<repo>", "audited_at": "<date>", "report": "docs/audits/<owner>-<repo>-<date>.json" }`
- Set `audit_signals.architecture_patterns` to `architecture_signals`
- Set `audit_signals.ref_stack_extended` to `ref_signals.ref_stack`

Write updated `evals/project-context.json`.

Print:
```
✓ ref_signals injected into evals/project-context.json
  ref_stack:  <tokens added>
  ref_skills: <skills added>
  audited_repos: now <N> entries
```

### Phase 8 — Cleanup

```bash
rm -rf /tmp/repo-audit-<owner>-<repo>/
```

Print final summary:
```
✓ Audit complete: <owner>/<repo>
  docs/audits/<owner>-<repo>-<YYYY-MM-DD>.json
  docs/audits/<owner>-<repo>-<YYYY-MM-DD>.md
```

## Error handling

| Failure | Response |
|---|---|
| Private/inaccessible repo | Gitingest fallback → if also fails, abort cleanly |
| Repomix timeout (>60s) | Gitingest fallback |
| categorize-files.js returns 0 file blocks | Abort: "No files found in packed output." |
| Layer agent fails | Mark layer with error, continue other layers |
| All agents fail | Abort merge, preserve packed.xml in docs/audits/raw/ |
| --pipeline but no project-context.json | Warn + skip injection, still write audit artifacts |
```

- [ ] **Step 2: Run static-scan on the skill**

```bash
node skills/skill-audit/scripts/static-scan.js skills/repo-audit/
```

Expected: `"verdict": "PASS"` — no BLOCK or FLAG findings. If findings appear, fix the flagged content.

- [ ] **Step 3: Commit**

```bash
git add skills/repo-audit/SKILL.md
git commit -m "feat(repo-audit): add SKILL.md orchestrator — URL parse, Repomix, 8 agents, merge, artifacts"
```

---

### Task 4: `SKILL-AUDIT.md` + `SKILL-EVAL.md` — Pipeline Health Files

**Files:**
- Create: `skills/repo-audit/SKILL-AUDIT.md`
- Create: `skills/repo-audit/SKILL-EVAL.md`

**Interfaces:**
- Consumes: static-scan output from Task 3 Step 2
- Produces: pipeline health files required by `skill-guardian`

- [ ] **Step 1: Run static-scan and capture output**

```bash
node skills/skill-audit/scripts/static-scan.js skills/repo-audit/ 2>&1
```

Copy the full JSON output — you will paste it into SKILL-AUDIT.md in the next step.

- [ ] **Step 2: Create `skills/repo-audit/SKILL-AUDIT.md`**

Fill in the static-scan output from Step 1. Replace `<PASTE_SCAN_JSON>` with the actual scanner output:

```markdown
# Skill Audit: repo-audit
**Date:** <today YYYY-MM-DD>
**Source:** local — /skills/repo-audit/
**Verdict:** PASS

## Static Scan Results

| Check | Severity | Detail |
|-------|----------|--------|
| Prompt injection patterns | PASS | No issues |
| Dangerous Bash in instructions | PASS | No issues |
| Hardcoded secrets | PASS | No issues |
| Overly permissive settings rules | PASS | No issues |
| Malicious JS/Python/Shell in scripts | PASS | No issues |

**Scanner output:** `<PASTE_SCAN_JSON>`

## Permissions Audit

**Tools requested by skill:** Read, Write, Bash, Agent
**Purpose stated:** Orchestrates deep repo audit — reads packed XML, runs categorize-files.js via Bash, dispatches layer agents via Agent, writes audit artifacts via Write.
**Mismatches:** none — all 4 tools are directly required by the orchestration workflow.

## Provenance

| Attribute | Value | Flag? |
|-----------|-------|-------|
| Repo age | Project-internal — not sourced from GitHub | no |
| Stars | N/A | no |
| Last commit | <today YYYY-MM-DD> | no |
| Contributors | Project team | no |

## Diff from current version

N/A — initial implementation.

## Decision

**Verdict:** PASS
**Reason:** Static scanner found zero findings. Tool scope (Read/Write/Bash/Agent) matches the orchestration workflow's requirements exactly.
**Next step:** Proceed to skill-eval
```

- [ ] **Step 3: Generate eval scenarios**

```bash
node skills/skill-eval/scripts/generate-seed-evals.js skills/repo-audit/SKILL.md \
  --context evals/project-context.json
```

Expected: prints 9 scenario JSON objects to stdout (6 base + 3 project-specific). If it errors, run without `--context` for 6 base scenarios.

- [ ] **Step 4: Create `skills/repo-audit/SKILL-EVAL.md`**

```markdown
# Skill Eval: repo-audit
**Date:** <today YYYY-MM-DD>  **Iteration:** 0  **Evaluator:** pending first eval run

## Metrics
| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | — | ≥ 80% | PENDING |
| Trigger Accuracy | — | ≥ 85% | PENDING |
| Context Footprint | — | — | PENDING |
| Project Fit Score | — | ≥ 7 | PENDING |
| Resilience Score | — | ≥ 8/10 | PENDING |

## Scenario Seeds (generated)

<paste full output from generate-seed-evals.js here>

## Analyst Observations

Pending first evaluation run. Run `skill-eval-agent` against this skill to populate metrics.

## Recommendation

PENDING — run skill-eval-agent to establish baseline metrics before first use.
```

- [ ] **Step 5: Commit**

```bash
git add skills/repo-audit/SKILL-AUDIT.md skills/repo-audit/SKILL-EVAL.md
git commit -m "feat(repo-audit): add SKILL-AUDIT.md and SKILL-EVAL.md for pipeline health parity"
```

---

### Task 5: Pipeline Touch Points

**Files:**
- Modify: `skills/project-setup/SKILL.md` (line ~25 — Phase 0 prompt)
- Modify: `skills/skill-eval/scripts/extract-project-context.js`
- Modify: `.gitignore`
- Create: `docs/audits/.gitkeep`

**Interfaces:**
- Consumes: repo-audit `ref_signals` JSON (from Task 3)
- Produces: enriched `project-setup` Phase 0, richer `project-context.json` extraction

- [ ] **Step 1: Update `project-setup` Phase 0 prompt**

Open `skills/project-setup/SKILL.md`. Find this exact text (around line 23):

```
> "Do you have any reference projects to draw conventions from? Paste up to 3 GitHub URLs, one per line — or press Enter to skip."
```

Replace it with:

```
> "Do you have any reference projects to draw conventions from? Paste up to 3 GitHub URLs, one per line — or press Enter to skip.
>
> Add `--deep` after any URL for a full 8-layer audit via repo-audit (more thorough, takes ~1 minute per repo)."
```

Then find the section starting with `**If URLs are provided:**` and add this clause immediately after it:

```markdown
**If a URL has `--deep` suffix:**

Strip `--deep` from the URL before normalisation. Set `deep_mode = true` for that URL.

For a deep-mode URL, instead of the lightweight fetch (0b), invoke the `repo-audit` skill:
```
repo-audit <url> --pipeline
```
When repo-audit completes, read `docs/audits/<owner>-<repo>-<latest-date>.json` and use its `ref_signals` field directly as this URL's contribution to `ref_signals`. Label all values from this source `(from deep audit)` instead of `(from references)`.

Non-deep URLs continue with the existing lightweight fetch (0b–0d) unchanged.
```

- [ ] **Step 2: Verify project-setup Phase 0 is intact**

```bash
grep -n "deep\|Phase 0\|Phase 1\|ref_signals" skills/project-setup/SKILL.md | head -20
```

Expected output includes: `--deep` in Phase 0 prompt, `deep_mode` clause, and `### Phase 1` still present after Phase 0.

- [ ] **Step 3: Update `extract-project-context.js` — add new fields to initial context**

Open `skills/skill-eval/scripts/extract-project-context.js`. Find the `const context = {` block. Add two new fields after `plugins: []`:

```javascript
const context = {
  project_name:    path.basename(projectRoot),
  stack:           [],
  workflow_terms:  [],
  installed_skills:[],
  key_phrases:     [],
  artifact_paths:  [],
  hooks:           [],
  mcp_servers:     [],
  plugins:         [],
  audited_repos:   [],
  audit_signals:   { architecture_patterns: [], ref_stack_extended: [] },
};
```

- [ ] **Step 4: Preserve `audited_repos` and `audit_signals` when refreshing context**

In the same file, find the block that preserves security fields (around `// Preserve security fields`):

```javascript
try {
  const prior = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  if (prior.security_grade)        context.security_grade        = prior.security_grade;
  if (prior.security_score !== undefined) context.security_score = prior.security_score;
  if (prior.security_last_scanned) context.security_last_scanned = prior.security_last_scanned;
} catch { /* file doesn't exist yet — no prior security data to preserve */ }
```

Add two lines inside the `try` block, immediately after the security fields:

```javascript
  if (prior.audited_repos && prior.audited_repos.length) context.audited_repos = prior.audited_repos;
  if (prior.audit_signals) context.audit_signals = prior.audit_signals;
```

- [ ] **Step 5: Verify extract-project-context.js is valid**

```bash
node --check skills/skill-eval/scripts/extract-project-context.js
```

Expected: no output (syntax check passes).

- [ ] **Step 6: Run extract-project-context.js and verify new fields appear**

```bash
node skills/skill-eval/scripts/extract-project-context.js | grep -E "audited_repos|audit_signals"
```

Expected output:
```
  "audited_repos": [],
  "audit_signals": {
```

- [ ] **Step 7: Add comment to `.gitignore` and create `docs/audits/.gitkeep`**

Add to `.gitignore` (append at end of file):

```
# docs/audits/ is intentionally committed — audit reports are reference artifacts, not volatile outputs
```

Create the audits directory tracker:

```bash
mkdir -p docs/audits && touch docs/audits/.gitkeep
```

- [ ] **Step 8: Commit all pipeline touch points**

```bash
git add skills/project-setup/SKILL.md \
        skills/skill-eval/scripts/extract-project-context.js \
        .gitignore \
        docs/audits/.gitkeep
git commit -m "feat(repo-audit): wire pipeline touch points — project-setup --deep, extract-project-context new fields, docs/audits tracking"
```

---

## Self-Review Against Spec

**Spec section → Task coverage:**

| Spec section | Covered by |
|---|---|
| `categorize-files.js` script | Task 1 |
| 8 layer agents + standardized layer object schema | Task 2 |
| SKILL.md orchestrator (URL parse, --estimate, Repomix, Gitingest fallback, agents, merge, write, inject, cleanup) | Task 3 |
| `--estimate` flag | Task 3 (SKILL.md Phase 1) |
| SKILL-AUDIT.md + SKILL-EVAL.md | Task 4 |
| `project-setup` Phase 0 `--deep` option | Task 5 Step 1 |
| `extract-project-context.js` new fields | Task 5 Steps 3–4 |
| `docs/audits/` committed to git | Task 5 Steps 7 |
| Error handling (all 10 failure modes) | Task 3 SKILL.md |
| `ref_signals` shape matches project-setup Phase 0 schema | Task 3 Phase 5 |
| Partial audit guarantee (one agent fail ≠ full abort) | Task 3 Phase 4 |
| Gitingest plain-text fallback in categorize-files.js | Task 1 (`extractFileBlocks`) |
| Multi-layer file routing | Task 1 (files duplicated into each matching layer) |
| `docs/audits/raw/` for failure preservation | Task 3 Phase 2 error handling |

**Placeholder scan:** No TBDs, no "implement later", no "similar to Task N". All agent files contain complete JSON output schemas. SKILL.md has concrete phase-by-phase instructions with exact commands.

**Type consistency:** `ref_signals` object shape in Task 3 Phase 5 matches the `project-setup` Phase 0 schema exactly (9 fields: `ref_purpose`, `ref_stack`, `ref_commands`, `ref_rules_always`, `ref_rules_never`, `ref_directories`, `ref_glossary`, `ref_skills`, `ref_agents`). Layer object shape in Task 2 (all 8 agents) matches the merge step in Task 3 Phase 5 (`layer`, `detected`, `confidence`, `signals`, `patterns`, `gaps`, `notes`).
