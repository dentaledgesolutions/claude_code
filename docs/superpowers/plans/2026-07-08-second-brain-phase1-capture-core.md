# Second Brain Phase 1 — Capture Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the write path of the project brain capsule — template skeleton, five governance scripts (capture, compile, lint, promote, verify), and the brain-profile schema — per the approved spec `docs/superpowers/specs/2026-07-08-second-brain-capture-first-design.md` §6 Phase 1.

**Architecture:** A `templates/second-brain/` directory holding the full `.project-brain/` skeleton, plus `scripts/brain/` CommonJS scripts sharing one helper module (`brain-lib.js`). `brain-promote.js` is the only writer to `canon/` and `decisions/active/`. Everything is deterministic, offline, and test-covered by sibling `*.test.js` files runnable standalone.

**Tech Stack:** Node.js ≥ 18, CommonJS, zero external dependencies (repo convention — no AJV, hand-rolled validation), plain `assert` + `spawnSync` tests.

## Global Constraints

- Node ≥ 18, CommonJS (`'use strict'`, `require`), **no new dependencies** — package.json stays dependency-free
- Scripts: deterministic; **no network calls**; never read sensitive paths; refuse overwrite without `--force`; reports written under `<target>/reports/` (report writes fail open); security failures exit nonzero; non-security optional tasks fail open
- All timestamps **UTC** (`toISOString()`-derived) for determinism across machines
- Exit-code convention: `0` ok · `1` usage/structure/overwrite refusal · `2` missing `--approve` (promote only) · `3` sensitive-content refusal
- Do NOT touch: `skills/skill-eval/`, `skills/agent-eval/`, `scripts/codex/`, `schemas/codex/`, `scripts/run-all-tests.js`, `scripts/run-calibration*`, `scripts/run-grader-calibration*`, `scripts/telemetry/`, `install.sh`, `uninstall.sh`, `CLAUDE.md`
- Do NOT commit anything under `evals/`
- Tests must pass standalone: `node scripts/brain/<name>.test.js` exits 0
- Frontmatter required-field set (spec delta 5): `type, title, description, tags, timestamp, sources`

---

### Task 1: Template skeleton, brain-profile.json, and schema

**Files:**
- Create: `templates/second-brain/README.md`, `templates/second-brain/BRAIN.md`, `templates/second-brain/MEMORY.md`, `templates/second-brain/brain-profile.json`
- Create: `schemas/brain/brain-profile.schema.json`
- Create: `templates/second-brain/project-brain/` tree (index.md, log.md, context stubs, 14 dirs with `.gitkeep`)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: the template tree that Task 3's verify test installs via the **install recipe** (documented below, reused by Phase 2's self-install): copy `project-brain/` → `<target>`, copy `BRAIN.md` `MEMORY.md` `README.md` → `<target>/`, copy `brain-profile.json` → `<target>/context/brain-profile.json`

- [ ] **Step 1: Create the directory skeleton**

```bash
cd /Users/erick/projects/claude_code
B=templates/second-brain/project-brain
mkdir -p $B/context $B/sessions/daily $B/sessions/closed \
  $B/decisions/active $B/decisions/superseded $B/decisions/candidates \
  $B/lessons/memories $B/lessons/anti-patterns $B/lessons/skill-stubs \
  $B/canon $B/synthesis $B/support $B/reference-repositories $B/reports \
  schemas/brain
for d in sessions/daily sessions/closed decisions/active decisions/superseded \
  decisions/candidates lessons/memories lessons/anti-patterns lessons/skill-stubs \
  canon synthesis support reference-repositories reports; do touch $B/$d/.gitkeep; done
```

- [ ] **Step 2: Write `templates/second-brain/project-brain/index.md`**

```markdown
# Project Brain Index

Entry points, most authoritative first:

- `../BRAIN.md` — status page and Second Brain Protocol (installed at capsule root)
- `canon/` — approved knowledge (written only by brain-promote --approve)
- `decisions/active/` — current decisions
- `lessons/memories/` — validated and candidate lessons
- `decisions/candidates/` — compiled candidates awaiting review
- `sessions/daily/` — raw session logs (scratch authority)
- `log.md` — append-only promotion and lifecycle log
```

- [ ] **Step 3: Write `templates/second-brain/project-brain/log.md`**

```markdown
# Brain Log

Append-only record of promotions and lifecycle events. Written by brain-promote.js.
```

- [ ] **Step 4: Write the five context stubs**

`templates/second-brain/project-brain/context/stack.md`:

```markdown
# Stack

<!-- Filled by second-brain-setup (Phase 5) or by hand. -->
```

Create `commands.md`, `conventions.md`, `installed-skills.md`, `installed-agents.md` in the same directory with the same shape — heading matching the filename (`# Commands`, `# Conventions`, `# Installed Skills`, `# Installed Agents`) followed by the same one-line comment.

- [ ] **Step 5: Write `templates/second-brain/BRAIN.md`**

```markdown
# Project Brain — {{PROJECT_NAME}}

> **Created:** {{CREATED_AT}} · **Mode:** standard · **Capsule:** `.project-brain/`

Status page and operating protocol for this project's Second Brain.

## Second Brain Protocol

Before architecture, workflow, skill, agent, hook, or governance decisions:

1. Read this file and `MEMORY.md`.
2. Check `index.md` for entry points; prefer existing decisions over new assumptions.
3. Authority ranking: canon > active decision > validated lesson > synthesis > session note > raw source.
4. If memory conflicts with the task, state the conflict before proceeding.

## Memory Routing

- Durable project knowledge → `.project-brain/` (this capsule — git-versioned, shared).
- Personal machine-local observations → Claude Code native auto-memory (`~/.claude/projects/<project>/memory/`).
- Current task context → stays in the session.
- Repeated corrections → lesson candidates via capture-learning.
- Canon → only through `brain-promote --approve`. Never write `canon/` directly.

## Hard Rules

- No secrets, credentials, tokens, client-private, patient, financial, or legal-sensitive content in memory.
- Do not install directly from reference repositories.
- External skills/agents must pass scout → audit → adapt → eval before activation.
```

- [ ] **Step 6: Write `templates/second-brain/MEMORY.md`**

```markdown
# Memory Routing Rules

| Knowledge | Destination |
|---|---|
| Durable project knowledge | `.project-brain/` (this capsule) |
| Cross-project knowledge | Central Operator Brain (deferred — note in `support/` until it exists) |
| Personal machine-local notes | Claude Code native auto-memory |
| Current task context | session only |
| Approved knowledge (canon) | `canon/` via `brain-promote --approve` ONLY |

Lifecycle: scratch → candidate → validated → canon_candidate → canon → retired/superseded.
```

- [ ] **Step 7: Write `templates/second-brain/README.md`**

```markdown
# Second Brain Template

Source template for a project brain capsule. Installed into a target project as
`.project-brain/` (Phase 2 self-install; install.sh --with-second-brain from Phase 5).

Install recipe:
1. Copy `project-brain/` → `<target>/.project-brain/`
2. Copy `BRAIN.md`, `MEMORY.md`, `README.md` → `<target>/.project-brain/`
3. Copy `brain-profile.json` → `<target>/.project-brain/context/brain-profile.json`
4. Fill `{{PROJECT_NAME}}` / `{{CREATED_AT}}` placeholders and profile identity fields
5. Run `node scripts/brain/brain-verify.js --target <target>/.project-brain`

Managed by the brain-kernel scripts in `scripts/brain/`. Source of truth is Markdown + Git.
```

- [ ] **Step 8: Write `templates/second-brain/brain-profile.json`** (spec/v3 §17 defaults)

```json
{
  "project_name": "",
  "project_slug": "",
  "central_brain_path": "~/DES/second-brain",
  "project_brain_path": ".project-brain",
  "brain_mode": "standard",
  "brain_kernel_enabled": true,
  "gbrain_enabled": false,
  "gbrain_evals_enabled": false,
  "graphify_enabled": false,
  "reference_repositories_enabled": true,
  "canon_requires_approval": true,
  "sensitive_paths": [
    ".env", ".env.*", "secrets/", "credentials/", "private/",
    "legal-sensitive/", "client-sensitive/", "patient/", "financial/"
  ],
  "created_at": "",
  "last_brain_lint": "",
  "last_memory_compile": ""
}
```

- [ ] **Step 9: Write `schemas/brain/brain-profile.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "brain-profile",
  "description": "Configuration profile for a project brain capsule (spec §6 Phase 1, v3 §17)",
  "type": "object",
  "required": [
    "project_name", "project_slug", "project_brain_path", "brain_mode",
    "brain_kernel_enabled", "gbrain_enabled", "canon_requires_approval", "sensitive_paths"
  ],
  "properties": {
    "project_name": { "type": "string" },
    "project_slug": { "type": "string" },
    "central_brain_path": { "type": "string" },
    "project_brain_path": { "type": "string" },
    "brain_mode": { "type": "string", "enum": ["lightweight", "standard", "enhanced-with-gbrain", "enhanced-with-graphify", "lab-multimodal"] },
    "brain_kernel_enabled": { "type": "boolean" },
    "gbrain_enabled": { "type": "boolean" },
    "gbrain_evals_enabled": { "type": "boolean" },
    "graphify_enabled": { "type": "boolean" },
    "reference_repositories_enabled": { "type": "boolean" },
    "canon_requires_approval": { "type": "boolean", "const": true },
    "sensitive_paths": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "created_at": { "type": "string" },
    "last_brain_lint": { "type": "string" },
    "last_memory_compile": { "type": "string" }
  }
}
```

- [ ] **Step 10: Sanity-check both JSON files parse and align**

```bash
node -e "
const s = require('./schemas/brain/brain-profile.schema.json');
const p = require('./templates/second-brain/brain-profile.json');
const missing = s.required.filter(f => !(f in p));
if (missing.length) { console.error('profile missing:', missing); process.exit(1); }
if (p.gbrain_enabled !== false) { console.error('gbrain_enabled must default to false'); process.exit(1); }
if (p.canon_requires_approval !== true) { console.error('canon_requires_approval must be true'); process.exit(1); }
console.log('OK: profile satisfies schema required set, gbrain off, canon gated');
"
```

Expected: `OK: profile satisfies schema required set, gbrain off, canon gated`

- [ ] **Step 11: Commit**

```bash
git add templates/second-brain schemas/brain
git commit -m "feat(brain): second-brain template skeleton, brain-profile defaults + schema"
```

---

### Task 2: brain-lib.js shared helpers

**Files:**
- Create: `scripts/brain/brain-lib.js`
- Test: `scripts/brain/brain-lib.test.js`

**Interfaces:**
- Consumes: nothing
- Produces (exact exports, used by every later task):
  - `getArg(argv, name, def=null) → string|def` · `hasFlag(argv, name) → boolean`
  - `positional(argv) → string[]` (skips `--flags` and the values of `--target`/`--to`)
  - `resolveTarget(argv) → string` (abs path of `--target`, default `.project-brain`)
  - `todayStamp(d?) → 'YYYY-MM-DD'` (UTC) · `timeStamp(d?) → 'HH:MM'` (UTC)
  - `scanSensitive(text) → string[]` (matched pattern names, empty = clean)
  - `parseFrontmatter(text) → { fields: object|null, body: string }`
  - `serializeFrontmatter(fields, body) → string`
  - `walkMarkdown(dir) → string[]` (abs paths of `.md` files, recursive, missing dir → `[]`)
  - `slugify(s) → string` (lowercase, hyphenated, ≤60 chars)

- [ ] **Step 1: Write the failing test `scripts/brain/brain-lib.test.js`**

```js
// scripts/brain/brain-lib.test.js — unit tests for shared brain-kernel helpers.
'use strict';
const assert = require('assert');
const lib = require('./brain-lib');

// frontmatter round-trip
{
  const fm = lib.serializeFrontmatter(
    { type: 'decision', title: 'Use X', tags: ['a', 'b'], timestamp: '2026-07-08T10:00:00' },
    'Body line 1\n');
  const { fields, body } = lib.parseFrontmatter(fm);
  assert.strictEqual(fields.type, 'decision');
  assert.strictEqual(fields.title, 'Use X');
  assert.deepStrictEqual(fields.tags, ['a', 'b']);
  assert.ok(body.startsWith('Body line 1'));
}
// no frontmatter → fields null, body intact
{
  const { fields, body } = lib.parseFrontmatter('# Just a doc\n');
  assert.strictEqual(fields, null);
  assert.strictEqual(body, '# Just a doc\n');
}
// sensitive scanner catches planted secrets, passes clean text
{
  assert.ok(lib.scanSensitive('key is sk-ant-abc123def456ghi789').length >= 1);
  assert.ok(lib.scanSensitive('-----BEGIN RSA PRIVATE KEY-----').length >= 1);
  assert.ok(lib.scanSensitive('password = hunter22').length >= 1);
  assert.deepStrictEqual(lib.scanSensitive('we decided to use pipeline() here'), []);
}
// args
{
  const argv = ['node', 's.js', 'decisions/candidates/x.md', '--to', 'canon', '--approve', '--target', '/tmp/b'];
  assert.strictEqual(lib.getArg(argv, '--to'), 'canon');
  assert.ok(lib.hasFlag(argv, '--approve'));
  assert.deepStrictEqual(lib.positional(argv), ['decisions/candidates/x.md']);
  assert.ok(lib.resolveTarget(argv).endsWith('/tmp/b') || lib.resolveTarget(argv) === '/tmp/b');
}
// stamps are UTC-shaped; slugify
{
  const d = new Date('2026-07-08T14:03:00Z');
  assert.strictEqual(lib.todayStamp(d), '2026-07-08');
  assert.strictEqual(lib.timeStamp(d), '14:03');
  assert.strictEqual(lib.slugify('Use FTS5, not grep!'), 'use-fts5-not-grep');
}
console.log('brain-lib.test.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-lib.test.js`
Expected: FAIL — `Cannot find module './brain-lib'`

- [ ] **Step 3: Write `scripts/brain/brain-lib.js`**

```js
// scripts/brain/brain-lib.js — shared helpers for brain-kernel scripts.
// Zero dependencies, no network, deterministic (UTC timestamps).
'use strict';
const fs = require('fs');
const path = require('path');

const SENSITIVE_CONTENT_PATTERNS = [
  { name: 'anthropic-api-key', re: /\bsk-ant-[A-Za-z0-9_-]{10,}/ },
  { name: 'generic-sk-key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'password-assignment', re: /\bpassword\s*[:=]\s*['"]?[^\s'"]{4,}/i },
];

function getArg(argv, name, def = null) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : def;
}
function hasFlag(argv, name) { return argv.includes(name); }
function positional(argv) {
  const flagsWithValue = new Set(['--target', '--to', '--message', '--title', '--type', '--date']);
  const out = [];
  for (let i = 2; i < argv.length; i++) {
    if (flagsWithValue.has(argv[i])) { i++; continue; }
    if (String(argv[i]).startsWith('--')) continue;
    out.push(argv[i]);
  }
  return out;
}
function resolveTarget(argv) { return path.resolve(getArg(argv, '--target', '.project-brain')); }
function todayStamp(d = new Date()) { return d.toISOString().slice(0, 10); }
function timeStamp(d = new Date()) { return d.toISOString().slice(11, 16); }
function scanSensitive(text) {
  return SENSITIVE_CONTENT_PATTERNS.filter(p => p.re.test(text)).map(p => p.name);
}
// Frontmatter: leading '---' block of `key: value` lines. Values are scalars or
// inline lists like [a, b]. Enough for brain files; deliberately not full YAML.
function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { fields: null, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { fields: null, body: text };
  const fields = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }
    fields[m[1]] = v;
  }
  return { fields, body: text.slice(end + 4).replace(/^\n+/, '') };
}
function serializeFrontmatter(fields, body) {
  const lines = Object.entries(fields).map(([k, v]) =>
    Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}`;
}
function walkMarkdown(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(p));
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out;
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

module.exports = {
  getArg, hasFlag, positional, resolveTarget, todayStamp, timeStamp,
  scanSensitive, parseFrontmatter, serializeFrontmatter, walkMarkdown, slugify,
  SENSITIVE_CONTENT_PATTERNS,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/brain/brain-lib.test.js`
Expected: `brain-lib.test.js: all assertions passed`, exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-lib.js scripts/brain/brain-lib.test.js
git commit -m "feat(brain): brain-lib shared helpers — frontmatter, sensitive scan, args, stamps"
```

---

### Task 3: brain-verify.js (acceptance criteria 1 and 4)

**Files:**
- Create: `scripts/brain/brain-verify.js`
- Test: `scripts/brain/brain-verify.test.js`

**Interfaces:**
- Consumes: `brain-lib` (`resolveTarget`), Task 1's template + install recipe
- Produces: CLI `node scripts/brain/brain-verify.js [--target <dir>]` → exit 0 valid / exit 1 with violations listed on stderr. Later tasks' tests call it to validate fixtures; Phase 2 self-install ends with it.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-verify.test.js`**

```js
// scripts/brain/brain-verify.test.js — verify passes on an installed template
// copy and fails loudly on broken structures. Uses the Task 1 install recipe.
'use strict';
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..', '..');
const SCRIPT = path.join(__dirname, 'brain-verify.js');
const TMP = path.join(__dirname, '__verify_test_tmp__');

// The install recipe from templates/second-brain/README.md — Phase 2 will script this.
function installTemplate(target) {
  const T = path.join(REPO, 'templates', 'second-brain');
  fs.cpSync(path.join(T, 'project-brain'), target, { recursive: true });
  for (const f of ['BRAIN.md', 'MEMORY.md', 'README.md']) {
    fs.copyFileSync(path.join(T, f), path.join(target, f));
  }
  fs.copyFileSync(path.join(T, 'brain-profile.json'), path.join(target, 'context', 'brain-profile.json'));
}
function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  // 1. Freshly installed template → exit 0 (spec acceptance criterion 1)
  const good = path.join(TMP, 'good');
  installTemplate(good);
  let r = run(['--target', good]);
  assert.strictEqual(r.status, 0, `expected 0 on fresh template:\n${r.stderr}`);

  // 2. Missing required dir → exit 1, violation names the dir
  const broken = path.join(TMP, 'broken');
  installTemplate(broken);
  fs.rmSync(path.join(broken, 'decisions', 'candidates'), { recursive: true });
  r = run(['--target', broken]);
  assert.strictEqual(r.status, 1, 'missing dir must fail');
  assert.ok(r.stderr.includes('decisions/candidates'), `stderr should name the dir:\n${r.stderr}`);

  // 3. Profile missing a schema-required field → exit 1 (acceptance criterion 4)
  const badprof = path.join(TMP, 'badprof');
  installTemplate(badprof);
  const profPath = path.join(badprof, 'context', 'brain-profile.json');
  const prof = JSON.parse(fs.readFileSync(profPath, 'utf8'));
  delete prof.canon_requires_approval;
  fs.writeFileSync(profPath, JSON.stringify(prof, null, 2));
  r = run(['--target', badprof]);
  assert.strictEqual(r.status, 1, 'profile missing required field must fail');
  assert.ok(r.stderr.includes('canon_requires_approval'), `stderr should name the field:\n${r.stderr}`);

  // 4. canon_requires_approval: false → exit 1 (security invariant)
  const nogate = path.join(TMP, 'nogate');
  installTemplate(nogate);
  const p2Path = path.join(nogate, 'context', 'brain-profile.json');
  const p2 = JSON.parse(fs.readFileSync(p2Path, 'utf8'));
  p2.canon_requires_approval = false;
  fs.writeFileSync(p2Path, JSON.stringify(p2, null, 2));
  r = run(['--target', nogate]);
  assert.strictEqual(r.status, 1, 'canon gate disabled must fail');

  // 5. Nonexistent target → exit 1
  r = run(['--target', path.join(TMP, 'nope')]);
  assert.strictEqual(r.status, 1);

  console.log('brain-verify.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-verify.test.js`
Expected: FAIL — spawnSync status null / module not found (script doesn't exist yet)

- [ ] **Step 3: Write `scripts/brain/brain-verify.js`**

```js
#!/usr/bin/env node
// scripts/brain/brain-verify.js — structural integrity check for a project brain
// capsule. Fails loudly: exit 1 on any violation, listing each on stderr.
// Usage: node scripts/brain/brain-verify.js [--target <dir>]
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveTarget } = require('./brain-lib');

const REQUIRED_DIRS = [
  'context', 'sessions/daily', 'sessions/closed',
  'decisions/active', 'decisions/superseded', 'decisions/candidates',
  'lessons/memories', 'lessons/anti-patterns', 'lessons/skill-stubs',
  'canon', 'synthesis', 'support', 'reference-repositories', 'reports',
];
const REQUIRED_FILES = ['BRAIN.md', 'MEMORY.md', 'index.md', 'log.md', 'context/brain-profile.json'];
const PROFILE_REQUIRED = [
  'project_name', 'project_slug', 'project_brain_path', 'brain_mode',
  'brain_kernel_enabled', 'gbrain_enabled', 'canon_requires_approval', 'sensitive_paths',
];

const target = resolveTarget(process.argv);
const violations = [];

if (!fs.existsSync(target)) {
  violations.push(`target does not exist: ${target}`);
} else {
  for (const d of REQUIRED_DIRS) {
    const p = path.join(target, d);
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) violations.push(`missing directory: ${d}`);
  }
  for (const f of REQUIRED_FILES) {
    const p = path.join(target, f);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) violations.push(`missing file: ${f}`);
  }
  const profilePath = path.join(target, 'context', 'brain-profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      for (const f of PROFILE_REQUIRED) {
        if (!(f in profile)) violations.push(`brain-profile.json missing required field: ${f}`);
      }
      if ('canon_requires_approval' in profile && profile.canon_requires_approval !== true) {
        violations.push('brain-profile.json: canon_requires_approval must be true');
      }
      if ('sensitive_paths' in profile &&
          (!Array.isArray(profile.sensitive_paths) || profile.sensitive_paths.length === 0)) {
        violations.push('brain-profile.json: sensitive_paths must be a non-empty array');
      }
    } catch (e) {
      violations.push(`brain-profile.json unreadable: ${e.message}`);
    }
  }
}

if (violations.length) {
  console.error(`brain-verify: FAIL — ${violations.length} violation(s) in ${target}`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`brain-verify: OK — ${target}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/brain/brain-verify.test.js`
Expected: `brain-verify.test.js: all assertions passed`, exit 0

- [ ] **Step 5: Run spec acceptance criterion 1 by hand**

```bash
rm -rf /tmp/test-brain && mkdir -p /tmp/test-brain
cp -R templates/second-brain/project-brain/. /tmp/test-brain/
cp templates/second-brain/{BRAIN.md,MEMORY.md,README.md} /tmp/test-brain/
cp templates/second-brain/brain-profile.json /tmp/test-brain/context/brain-profile.json
node scripts/brain/brain-verify.js --target /tmp/test-brain; echo "exit=$?"
```

Expected: `brain-verify: OK — /tmp/test-brain` then `exit=0`

- [ ] **Step 6: Commit**

```bash
git add scripts/brain/brain-verify.js scripts/brain/brain-verify.test.js
git commit -m "feat(brain): brain-verify structural integrity check — exit 1 on violation"
```

---

### Task 4: brain-capture.js (acceptance criterion 2)

**Files:**
- Create: `scripts/brain/brain-capture.js`
- Test: `scripts/brain/brain-capture.test.js`

**Interfaces:**
- Consumes: `brain-lib` (`getArg`, `resolveTarget`, `todayStamp`, `timeStamp`, `scanSensitive`)
- Produces: CLI `node scripts/brain/brain-capture.js --message "text" [--type note|decision|lesson] [--title "t"] [--target <dir>]` (stdin when `--message` absent). Appends to `<target>/sessions/daily/YYYY-MM-DD.md`. **Entry format consumed by Task 5's compile:** `## HH:MM [type] optional title` heading followed by a blank line and the message body.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-capture.test.js`**

```js
// scripts/brain/brain-capture.test.js — capture appends (never overwrites),
// stamps entries compile can parse, and refuses sensitive content.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, 'brain-capture.js');
const TMP = path.join(__dirname, '__capture_test_tmp__');
const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(TMP, 'sessions', 'daily', `${today}.md`);

function run(args, input) {
  const r = spawnSync('node', [SCRIPT, '--target', TMP, ...args], { encoding: 'utf8', input });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'sessions', 'daily'), { recursive: true });

  // 1. First capture creates today's log with a dated header + typed entry
  let r = run(['--message', 'Chose pipeline() over parallel()', '--type', 'decision', '--title', 'Pipeline default']);
  assert.strictEqual(r.status, 0, r.stderr);
  let text = fs.readFileSync(logFile, 'utf8');
  assert.ok(text.startsWith(`# Session log — ${today}`), 'new file gets dated header');
  assert.ok(/^## \d{2}:\d{2} \[decision\] Pipeline default$/m.test(text), 'entry heading format');
  assert.ok(text.includes('Chose pipeline() over parallel()'));

  // 2. Second capture same day APPENDS — both entries present (acceptance criterion 2)
  r = run(['--message', 'A plain note'], '');
  assert.strictEqual(r.status, 0, r.stderr);
  text = fs.readFileSync(logFile, 'utf8');
  assert.ok(text.includes('Chose pipeline() over parallel()'), 'first entry survives');
  assert.ok(text.includes('A plain note'), 'second entry added');
  assert.strictEqual((text.match(/^# Session log/gm) || []).length, 1, 'header not duplicated');

  // 3. stdin capture works when --message absent
  r = run(['--type', 'lesson'], 'Learned: verify before claiming success');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.readFileSync(logFile, 'utf8').includes('Learned: verify before claiming success'));

  // 4. Sensitive content → exit 3, nothing written
  const before = fs.readFileSync(logFile, 'utf8');
  r = run(['--message', 'the key is sk-ant-abc123def456ghi789 ok']);
  assert.strictEqual(r.status, 3, 'sensitive content must exit 3');
  assert.strictEqual(fs.readFileSync(logFile, 'utf8'), before, 'log unchanged after refusal');

  // 5. Empty message → exit 1; unknown type → exit 1
  assert.strictEqual(run(['--message', '   ']).status, 1);
  assert.strictEqual(run(['--message', 'x', '--type', 'canon']).status, 1);

  // 6. Missing sessions/daily (not a capsule) → exit 1
  fs.rmSync(path.join(TMP, 'sessions'), { recursive: true });
  assert.strictEqual(run(['--message', 'x']).status, 1);

  console.log('brain-capture.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-capture.test.js`
Expected: FAIL (script missing)

- [ ] **Step 3: Write `scripts/brain/brain-capture.js`**

```js
#!/usr/bin/env node
// scripts/brain/brain-capture.js — append one entry to today's session log.
// Usage: node brain-capture.js --message "text" [--type note|decision|lesson]
//        [--title "t"] [--target <dir>]     (reads stdin when --message absent)
// Append-only: never overwrites. Exit 0 ok · 1 usage/structure · 3 sensitive refusal.
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, resolveTarget, todayStamp, timeStamp, scanSensitive } = require('./brain-lib');

const target = resolveTarget(process.argv);
const type = getArg(process.argv, '--type', 'note');
if (!['note', 'decision', 'lesson'].includes(type)) {
  console.error(`brain-capture: unknown --type '${type}' (note|decision|lesson)`);
  process.exit(1);
}
let message = getArg(process.argv, '--message');
if (message === null) {
  try { message = fs.readFileSync(0, 'utf8'); } catch { message = ''; }
}
if (!message || !message.trim()) {
  console.error('brain-capture: empty message (use --message or pipe stdin)');
  process.exit(1);
}
const hits = scanSensitive(message);
if (hits.length) {
  console.error(`brain-capture: REFUSED — sensitive content detected (${hits.join(', ')})`);
  process.exit(3);
}
const dailyDir = path.join(target, 'sessions', 'daily');
if (!fs.existsSync(dailyDir)) {
  console.error(`brain-capture: not a project brain capsule (missing sessions/daily under ${target}) — run brain-verify`);
  process.exit(1);
}
const file = path.join(dailyDir, `${todayStamp()}.md`);
const title = getArg(process.argv, '--title', '');
const header = fs.existsSync(file) ? '' : `# Session log — ${todayStamp()}\n`;
const entry = `\n## ${timeStamp()} [${type}]${title ? ` ${title}` : ''}\n\n${message.trim()}\n`;
fs.appendFileSync(file, header + entry);
console.log(`brain-capture: appended [${type}] entry to ${path.relative(process.cwd(), file)}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/brain/brain-capture.test.js`
Expected: `brain-capture.test.js: all assertions passed`, exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-capture.js scripts/brain/brain-capture.test.js
git commit -m "feat(brain): brain-capture — append-only session log entries with sensitive-content refusal"
```

---

### Task 5: brain-compile.js

**Files:**
- Create: `scripts/brain/brain-compile.js`
- Test: `scripts/brain/brain-compile.test.js`

**Interfaces:**
- Consumes: `brain-lib`; Task 4's entry format `## HH:MM [decision|lesson] optional title`
- Produces: CLI `node scripts/brain/brain-compile.js [--date YYYY-MM-DD | --all] [--force] [--target <dir>]`. Writes candidates with `status: candidate` frontmatter — decisions → `decisions/candidates/<date>-<slug>.md`, lessons → `lessons/memories/<date>-<slug>.md`. **Never writes `decisions/active/` or `canon/`.** Candidate filename format is consumed by Task 7's promote test.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-compile.test.js`**

```js
// scripts/brain/brain-compile.test.js — compile extracts decision/lesson entries
// into candidate files with required frontmatter; notes are ignored; re-runs
// skip existing candidates; active/ and canon/ are never touched.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, 'brain-compile.js');
const LIB = require('./brain-lib');
const TMP = path.join(__dirname, '__compile_test_tmp__');

function run(args) {
  const r = spawnSync('node', [SCRIPT, '--target', TMP, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const d of ['sessions/daily', 'decisions/candidates', 'decisions/active', 'lessons/memories', 'canon', 'reports']) {
    fs.mkdirSync(path.join(TMP, d), { recursive: true });
  }
  const date = '2026-07-08';
  fs.writeFileSync(path.join(TMP, 'sessions', 'daily', `${date}.md`), `# Session log — ${date}

## 10:00 [note]

Just a passing observation.

## 10:05 [decision] Use pipeline by default

We default to pipeline() over parallel() barriers.

## 11:30 [lesson]

Always run brain-verify before claiming install success.
`);

  // 1. Compile writes one decision candidate + one lesson, skips the note
  let r = run(['--date', date]);
  assert.strictEqual(r.status, 0, r.stderr);
  const dec = path.join(TMP, 'decisions', 'candidates', `${date}-use-pipeline-by-default.md`);
  assert.ok(fs.existsSync(dec), 'decision candidate written with date-slug name');
  const lessons = fs.readdirSync(path.join(TMP, 'lessons', 'memories')).filter(f => f.endsWith('.md'));
  assert.strictEqual(lessons.length, 1, 'exactly one lesson candidate');
  assert.strictEqual(fs.readdirSync(path.join(TMP, 'decisions', 'candidates')).filter(f => f.endsWith('.md')).length, 1, 'note was not compiled');

  // 2. Candidate has required frontmatter (spec delta 5) + status: candidate
  const { fields, body } = LIB.parseFrontmatter(fs.readFileSync(dec, 'utf8'));
  for (const f of ['type', 'title', 'description', 'tags', 'timestamp', 'sources']) {
    assert.ok(f in fields, `frontmatter has '${f}'`);
  }
  assert.strictEqual(fields.type, 'decision');
  assert.strictEqual(fields.status, 'candidate');
  assert.deepStrictEqual(fields.sources, [`sessions/daily/${date}.md`]);
  assert.ok(body.includes('pipeline() over parallel()'));

  // 3. Governance: nothing in active/ or canon/
  assert.strictEqual(fs.readdirSync(path.join(TMP, 'decisions', 'active')).length, 0);
  assert.strictEqual(fs.readdirSync(path.join(TMP, 'canon')).length, 0);

  // 4. Re-run without --force skips; with --force rewrites
  r = run(['--date', date]);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('0 candidate(s) written'), `re-run skips: ${r.stdout}`);
  r = run(['--date', date, '--force']);
  assert.ok(r.stdout.includes('2 candidate(s) written'), `--force rewrites: ${r.stdout}`);

  // 5. Report written (fail-open contract: presence checked, content minimal)
  const reports = path.join(TMP, 'reports', 'compile');
  assert.ok(fs.existsSync(reports) && fs.readdirSync(reports).length >= 1, 'compile report written');

  // 6. Missing session file for date → exit 0, zero written (fail open)
  r = run(['--date', '2001-01-01']);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('0 candidate(s) written'));

  console.log('brain-compile.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-compile.test.js`
Expected: FAIL (script missing)

- [ ] **Step 3: Write `scripts/brain/brain-compile.js`**

```js
#!/usr/bin/env node
// scripts/brain/brain-compile.js — extract [decision] and [lesson] entries from
// session logs into candidate files. Notes stay in the log. NEVER writes to
// decisions/active/ or canon/ — that is brain-promote's job, behind --approve.
// Usage: node brain-compile.js [--date YYYY-MM-DD | --all] [--force] [--target <dir>]
// Exit 0 ok (including nothing to do) · 1 structure error.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  getArg, hasFlag, resolveTarget, todayStamp, serializeFrontmatter, slugify,
} = require('./brain-lib');

const target = resolveTarget(process.argv);
const dailyDir = path.join(target, 'sessions', 'daily');
if (!fs.existsSync(dailyDir)) {
  console.error(`brain-compile: not a project brain capsule (missing sessions/daily under ${target})`);
  process.exit(1);
}
const files = hasFlag(process.argv, '--all')
  ? fs.readdirSync(dailyDir).filter(f => f.endsWith('.md')).map(f => path.join(dailyDir, f))
  : [path.join(dailyDir, `${getArg(process.argv, '--date', todayStamp())}.md`)];

const DEST = {
  decision: path.join(target, 'decisions', 'candidates'),
  lesson: path.join(target, 'lessons', 'memories'),
};
const ENTRY_RE = /^## (\d{2}:\d{2}) \[(decision|lesson)\] ?(.*)$/gm;
let written = 0, skipped = 0;
const outputs = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const date = path.basename(file, '.md');
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = ENTRY_RE.exec(text)) !== null) {
    const [, time, type, titleRaw] = m;
    const bodyStart = text.indexOf('\n', m.index) + 1;
    const nextHeading = text.indexOf('\n## ', bodyStart);
    const body = text.slice(bodyStart, nextHeading === -1 ? undefined : nextHeading).trim();
    const title = titleRaw.trim() || body.split('\n')[0].slice(0, 60);
    const dest = path.join(DEST[type], `${date}-${slugify(title)}.md`);
    if (fs.existsSync(dest) && !hasFlag(process.argv, '--force')) { skipped++; continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, serializeFrontmatter({
      type,
      title,
      description: body.split('\n')[0].slice(0, 120),
      tags: [],
      timestamp: `${date}T${time}:00`,
      sources: [`sessions/daily/${date}.md`],
      status: 'candidate',
    }, `${body}\n`));
    outputs.push(path.relative(target, dest));
    written++;
  }
}

// Report — fail open: a report-write failure must not fail the compile.
try {
  const rdir = path.join(target, 'reports', 'compile');
  fs.mkdirSync(rdir, { recursive: true });
  fs.writeFileSync(path.join(rdir, `${todayStamp()}.json`),
    JSON.stringify({ written, skipped, outputs }, null, 2));
} catch { /* fail open */ }

console.log(`brain-compile: ${written} candidate(s) written, ${skipped} skipped`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/brain/brain-compile.test.js`
Expected: `brain-compile.test.js: all assertions passed`, exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-compile.js scripts/brain/brain-compile.test.js
git commit -m "feat(brain): brain-compile — session logs to decision/lesson candidates, never to canon"
```

---

### Task 6: brain-lint.js (acceptance criterion 5)

**Files:**
- Create: `scripts/brain/brain-lint.js`
- Test: `scripts/brain/brain-lint.test.js`

**Interfaces:**
- Consumes: `brain-lib` (`resolveTarget`, `todayStamp`, `parseFrontmatter`, `scanSensitive`, `walkMarkdown`)
- Produces: CLI `node scripts/brain/brain-lint.js [--target <dir>]` → exit 0 clean-or-warnings (fail open), exit 3 on sensitive content (security). Report at `<target>/reports/lint/YYYY-MM-DD.md`. Phase 2's `brain-post-lint.sh` wraps this.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-lint.test.js`**

```js
// scripts/brain/brain-lint.test.js — lint warns on schema/staleness/orphans
// (exit 0, fail open) and fails with exit 3 on sensitive content anywhere.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, 'brain-lint.js');
const TMP = path.join(__dirname, '__lint_test_tmp__');

function run() {
  const r = spawnSync('node', [SCRIPT, '--target', TMP], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function seed() {
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const d of ['sessions/daily', 'decisions/active', 'lessons/memories', 'canon', 'synthesis', 'reports']) {
    fs.mkdirSync(path.join(TMP, d), { recursive: true });
  }
}
const GOOD = `---
type: decision
title: Good decision
description: A well-formed decision
tags: [pipeline]
timestamp: ${new Date().toISOString().slice(0, 19)}
sources: [sessions/daily/2026-07-08.md]
status: active
---

Body referencing [[good-lesson]].
`;
const GOOD_LESSON = GOOD.replace('type: decision', 'type: lesson').replace('Good decision', 'good lesson');

try {
  // 1. Clean brain → exit 0, zero findings
  seed();
  fs.writeFileSync(path.join(TMP, 'decisions', 'active', 'good-decision.md'), GOOD);
  fs.writeFileSync(path.join(TMP, 'lessons', 'memories', 'good-lesson.md'), GOOD_LESSON);
  let r = run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('0 security finding(s)'), r.stdout);

  // 2. Missing frontmatter field + stale timestamp + orphan link → warnings, still exit 0
  fs.writeFileSync(path.join(TMP, 'decisions', 'active', 'bad.md'), `---
type: decision
title: No description or tags
timestamp: 2024-01-01T00:00:00
sources: []
---

Links to [[does-not-exist]].
`);
  r = run();
  assert.strictEqual(r.status, 0, 'quality issues fail open');
  assert.ok(r.stderr.includes("missing frontmatter field 'description'"), r.stderr);
  assert.ok(r.stderr.includes('stale'), r.stderr);
  assert.ok(r.stderr.includes('orphan link [[does-not-exist]]'), r.stderr);

  // 3. Planted fake token in a session log → exit 3 (spec acceptance criterion 5)
  fs.writeFileSync(path.join(TMP, 'sessions', 'daily', '2026-07-08.md'),
    '# Session log\n\n## 10:00 [note]\n\napi key sk-ant-abc123def456ghi789 leaked here\n');
  r = run();
  assert.strictEqual(r.status, 3, 'sensitive content must exit 3');
  assert.ok(r.stderr.includes('SECURITY'), r.stderr);

  // 4. Report file written with both sections
  const reportDir = path.join(TMP, 'reports', 'lint');
  const reports = fs.readdirSync(reportDir);
  assert.ok(reports.length >= 1, 'lint report written');
  const report = fs.readFileSync(path.join(reportDir, reports[0]), 'utf8');
  assert.ok(report.includes('## Security') && report.includes('## Warnings'));

  console.log('brain-lint.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-lint.test.js`
Expected: FAIL (script missing)

- [ ] **Step 3: Write `scripts/brain/brain-lint.js`**

```js
#!/usr/bin/env node
// scripts/brain/brain-lint.js — quality + safety gate over brain content.
// Quality (frontmatter schema, stale timestamps, orphan [[links]]) → warnings,
// exit 0 (fail open). Sensitive content anywhere → SECURITY findings, exit 3.
// Usage: node scripts/brain/brain-lint.js [--target <dir>]
'use strict';
const fs = require('fs');
const path = require('path');
const {
  resolveTarget, todayStamp, parseFrontmatter, scanSensitive, walkMarkdown,
} = require('./brain-lib');

const REQUIRED_FIELDS = ['type', 'title', 'description', 'tags', 'timestamp', 'sources'];
const GOVERNED_DIRS = ['decisions', 'lessons', 'canon', 'synthesis'];
const STALE_DAYS = 90;

const target = resolveTarget(process.argv);
const warnings = [];
const security = [];

const allFiles = walkMarkdown(target);
const allNames = new Set(allFiles.map(p => path.basename(p, '.md')));

for (const dir of GOVERNED_DIRS) {
  for (const file of walkMarkdown(path.join(target, dir))) {
    const rel = path.relative(target, file);
    const text = fs.readFileSync(file, 'utf8');
    const { fields } = parseFrontmatter(text);
    if (!fields) {
      warnings.push(`${rel}: missing frontmatter`);
    } else {
      for (const f of REQUIRED_FIELDS) {
        if (!(f in fields)) warnings.push(`${rel}: missing frontmatter field '${f}'`);
      }
      const ts = Date.parse(fields.timestamp);
      if (!Number.isNaN(ts) && (Date.now() - ts) / 86400000 > STALE_DAYS) {
        warnings.push(`${rel}: stale (timestamp older than ${STALE_DAYS} days — review or supersede)`);
      }
    }
    for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const name = m[1].trim();
      if (!allNames.has(name)) warnings.push(`${rel}: orphan link [[${name}]]`);
    }
  }
}
for (const file of allFiles) {
  for (const hit of scanSensitive(fs.readFileSync(file, 'utf8'))) {
    security.push(`${path.relative(target, file)}: sensitive content (${hit})`);
  }
}

// Report — fail open on write errors.
try {
  const rdir = path.join(target, 'reports', 'lint');
  fs.mkdirSync(rdir, { recursive: true });
  const fmt = xs => xs.map(x => `- ${x}`).join('\n') || '- none';
  fs.writeFileSync(path.join(rdir, `${todayStamp()}.md`),
    `# brain-lint — ${todayStamp()}\n\n## Security (${security.length})\n${fmt(security)}\n\n## Warnings (${warnings.length})\n${fmt(warnings)}\n`);
} catch { /* fail open */ }

for (const s of security) console.error(`SECURITY ${s}`);
for (const w of warnings) console.error(`warn ${w}`);
console.log(`brain-lint: ${security.length} security finding(s), ${warnings.length} warning(s)`);
process.exit(security.length ? 3 : 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/brain/brain-lint.test.js`
Expected: `brain-lint.test.js: all assertions passed`, exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-lint.js scripts/brain/brain-lint.test.js
git commit -m "feat(brain): brain-lint — frontmatter/staleness/orphan warnings, exit 3 on sensitive content"
```

---

### Task 7: brain-promote.js (acceptance criterion 3)

**Files:**
- Create: `scripts/brain/brain-promote.js`
- Test: `scripts/brain/brain-promote.test.js`

**Interfaces:**
- Consumes: `brain-lib` (`getArg`, `hasFlag`, `positional`, `resolveTarget`, `todayStamp`, `parseFrontmatter`, `serializeFrontmatter`, `scanSensitive`); Task 5's candidate files
- Produces: CLI `node scripts/brain/brain-promote.js <capsule-relative-file> --approve [--to active|canon] [--force] [--target <dir>]`. The **only** writer to `canon/` and `decisions/active/`. Moves the file, sets `status` + `promoted_at` frontmatter, appends to `log.md`.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-promote.test.js`**

```js
// scripts/brain/brain-promote.test.js — promote hard-fails without --approve
// (writing NOTHING), moves candidates to active/ or canon/ with updated
// frontmatter + log entry, refuses overwrite without --force and sensitive content.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, 'brain-promote.js');
const LIB = require('./brain-lib');
const TMP = path.join(__dirname, '__promote_test_tmp__');
const CAND = 'decisions/candidates/2026-07-08-use-pipeline.md';

function run(args) {
  const r = spawnSync('node', [SCRIPT, '--target', TMP, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function snapshot(dir) {
  const out = {};
  for (const f of LIB.walkMarkdown(path.join(TMP, dir))) out[f] = fs.readFileSync(f, 'utf8');
  return JSON.stringify(out);
}
function seed() {
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const d of ['decisions/candidates', 'decisions/active', 'canon']) {
    fs.mkdirSync(path.join(TMP, d), { recursive: true });
  }
  fs.writeFileSync(path.join(TMP, 'log.md'), '# Brain Log\n');
  fs.writeFileSync(path.join(TMP, CAND), LIB.serializeFrontmatter({
    type: 'decision', title: 'Use pipeline', description: 'd', tags: [],
    timestamp: '2026-07-08T10:05:00', sources: ['sessions/daily/2026-07-08.md'],
    status: 'candidate',
  }, 'We default to pipeline().\n'));
}

try {
  // 1. Without --approve → exit 2, capsule byte-identical (acceptance criterion 3)
  seed();
  const before = snapshot('.');
  let r = run([CAND]);
  assert.strictEqual(r.status, 2, `must exit 2 without --approve:\n${r.stderr}`);
  assert.ok(r.stderr.includes('--approve'), 'refusal names the missing flag');
  assert.strictEqual(snapshot('.'), before, 'NOTHING written on refusal');

  // 2. With --approve → moved to decisions/active/, status+promoted_at set, logged
  r = run([CAND, '--approve']);
  assert.strictEqual(r.status, 0, r.stderr);
  const dest = path.join(TMP, 'decisions', 'active', '2026-07-08-use-pipeline.md');
  assert.ok(fs.existsSync(dest), 'moved to active');
  assert.ok(!fs.existsSync(path.join(TMP, CAND)), 'removed from candidates');
  const { fields } = LIB.parseFrontmatter(fs.readFileSync(dest, 'utf8'));
  assert.strictEqual(fields.status, 'active');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(fields.promoted_at));
  assert.ok(fs.readFileSync(path.join(TMP, 'log.md'), 'utf8').includes('promoted decisions/candidates/2026-07-08-use-pipeline.md'));

  // 3. --to canon → lands in canon/ with status: canon
  seed();
  r = run([CAND, '--approve', '--to', 'canon']);
  assert.strictEqual(r.status, 0, r.stderr);
  const canonDest = path.join(TMP, 'canon', '2026-07-08-use-pipeline.md');
  assert.strictEqual(LIB.parseFrontmatter(fs.readFileSync(canonDest, 'utf8')).fields.status, 'canon');

  // 4. Destination exists → exit 1 without --force; succeeds with --force
  seed();
  fs.writeFileSync(path.join(TMP, 'decisions', 'active', '2026-07-08-use-pipeline.md'), 'existing\n');
  r = run([CAND, '--approve']);
  assert.strictEqual(r.status, 1, 'overwrite refused without --force');
  assert.ok(fs.existsSync(path.join(TMP, CAND)), 'candidate not consumed on refusal');
  r = run([CAND, '--approve', '--force']);
  assert.strictEqual(r.status, 0, r.stderr);

  // 5. Sensitive content in candidate → exit 3, not promoted
  seed();
  fs.appendFileSync(path.join(TMP, CAND), '\nkey: sk-ant-abc123def456ghi789\n');
  r = run([CAND, '--approve']);
  assert.strictEqual(r.status, 3, 'sensitive candidate must exit 3');
  assert.ok(fs.existsSync(path.join(TMP, CAND)), 'candidate stays put');

  // 6. Usage errors → exit 1: no file given; bad --to; missing file
  seed();
  assert.strictEqual(run(['--approve']).status, 1);
  assert.strictEqual(run([CAND, '--approve', '--to', 'superseded']).status, 1);
  assert.strictEqual(run(['decisions/candidates/nope.md', '--approve']).status, 1);

  console.log('brain-promote.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-promote.test.js`
Expected: FAIL (script missing)

- [ ] **Step 3: Write `scripts/brain/brain-promote.js`**

```js
#!/usr/bin/env node
// scripts/brain/brain-promote.js — the ONLY writer to canon/ and decisions/active/.
// Requires explicit --approve; without it, refuses and writes NOTHING (exit 2).
// Usage: node brain-promote.js <capsule-relative-file> --approve
//        [--to active|canon] [--force] [--target <dir>]
// Exit 0 ok · 1 usage/overwrite refusal · 2 missing --approve · 3 sensitive content.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  getArg, hasFlag, positional, resolveTarget, todayStamp,
  parseFrontmatter, serializeFrontmatter, scanSensitive,
} = require('./brain-lib');

const target = resolveTarget(process.argv);
const rel = positional(process.argv)[0];
if (!rel) {
  console.error('brain-promote: usage: brain-promote.js <capsule-relative-file> --approve [--to active|canon]');
  process.exit(1);
}
if (!hasFlag(process.argv, '--approve')) {
  console.error('brain-promote: REFUSED — promotion to canon/active requires explicit --approve (human decision, never autonomous)');
  process.exit(2);
}
const to = getArg(process.argv, '--to', 'active');
if (!['active', 'canon'].includes(to)) {
  console.error(`brain-promote: --to must be 'active' or 'canon' (got '${to}')`);
  process.exit(1);
}
const src = path.join(target, rel);
if (!fs.existsSync(src)) {
  console.error(`brain-promote: candidate not found: ${rel}`);
  process.exit(1);
}
const text = fs.readFileSync(src, 'utf8');
const hits = scanSensitive(text);
if (hits.length) {
  console.error(`brain-promote: REFUSED — sensitive content in candidate (${hits.join(', ')}); clean it before promoting`);
  process.exit(3);
}
const destDir = to === 'canon' ? path.join(target, 'canon') : path.join(target, 'decisions', 'active');
const dest = path.join(destDir, path.basename(src));
if (fs.existsSync(dest) && !hasFlag(process.argv, '--force')) {
  console.error(`brain-promote: destination exists (pass --force to overwrite): ${path.relative(target, dest)}`);
  process.exit(1);
}
const { fields, body } = parseFrontmatter(text);
const updated = serializeFrontmatter(
  { ...(fields || {}), status: to === 'canon' ? 'canon' : 'active', promoted_at: todayStamp() },
  body,
);
fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(dest, updated);
fs.unlinkSync(src);
// Lifecycle log — fail open: a log-write failure must not undo the promotion.
try {
  fs.appendFileSync(path.join(target, 'log.md'),
    `- ${todayStamp()} promoted ${rel} → ${path.relative(target, dest)}\n`);
} catch { /* fail open */ }
console.log(`brain-promote: ${rel} → ${path.relative(target, dest)}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/brain/brain-promote.test.js`
Expected: `brain-promote.test.js: all assertions passed`, exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-promote.js scripts/brain/brain-promote.test.js
git commit -m "feat(brain): brain-promote — sole canon/active writer, hard --approve gate"
```

---

### Task 8: Full acceptance run

**Files:**
- No new files — verification only

**Interfaces:**
- Consumes: everything above
- Produces: evidence that all five spec acceptance criteria pass end-to-end on one capsule

- [ ] **Step 1: Run every brain test standalone**

```bash
for t in scripts/brain/*.test.js; do echo "== $t"; node "$t" || exit 1; done
```

Expected: five `all assertions passed` lines, exit 0

- [ ] **Step 2: End-to-end acceptance sequence on a fresh capsule**

```bash
set -e
rm -rf /tmp/test-brain && mkdir -p /tmp/test-brain
cp -R templates/second-brain/project-brain/. /tmp/test-brain/
cp templates/second-brain/{BRAIN.md,MEMORY.md,README.md} /tmp/test-brain/
cp templates/second-brain/brain-profile.json /tmp/test-brain/context/brain-profile.json

# Criterion 1: verify exits 0 on fresh template
node scripts/brain/brain-verify.js --target /tmp/test-brain

# Criterion 2: two same-day captures append
node scripts/brain/brain-capture.js --target /tmp/test-brain --type decision --title "E2E decision" --message "Adopt the capture-first roadmap"
node scripts/brain/brain-capture.js --target /tmp/test-brain --message "A second entry the same day"
grep -c '^## ' /tmp/test-brain/sessions/daily/*.md   # expect: 2

# Compile → one decision candidate
node scripts/brain/brain-compile.js --target /tmp/test-brain
ls /tmp/test-brain/decisions/candidates/             # expect: <today>-e2e-decision.md

# Criterion 3: promote without --approve exits nonzero, writes nothing
CAND="decisions/candidates/$(ls /tmp/test-brain/decisions/candidates | head -1)"
node scripts/brain/brain-promote.js --target /tmp/test-brain "$CAND" && exit 1 || echo "refused as expected (exit $?)"
ls /tmp/test-brain/decisions/active/                 # expect: only .gitkeep

# Promote WITH --approve succeeds
node scripts/brain/brain-promote.js --target /tmp/test-brain "$CAND" --approve
ls /tmp/test-brain/decisions/active/                 # expect: the promoted file

# Criterion 4: covered by brain-verify profile checks (step above) + Task 1 step 10
# Criterion 5: planted token → lint exits 3
node scripts/brain/brain-capture.js --target /tmp/test-brain --message "harmless note" 
printf '\nplanted: sk-ant-abc123def456ghi789\n' >> /tmp/test-brain/sessions/daily/$(date -u +%F).md
node scripts/brain/brain-lint.js --target /tmp/test-brain && exit 1 || echo "lint flagged secret (exit $?)"
```

Expected: verify OK · grep prints `2` · one candidate listed · promote refusal exits 2 with active/ untouched · approved promote lands file in active/ · lint exits 3 on the planted token

- [ ] **Step 3: Confirm no forbidden files were touched**

```bash
git status --porcelain -- skills/skill-eval skills/agent-eval scripts/codex schemas/codex \
  scripts/telemetry install.sh uninstall.sh CLAUDE.md evals scripts/run-all-tests.js
```

Expected: no output

- [ ] **Step 4: Final commit (only if anything is uncommitted)**

```bash
git status --porcelain
# if clean: done. Phase 1 complete — capture core is live.
```

---

## Deferred to later phases (do NOT build now)

Hooks and self-install (Phase 2) · skills (Phase 3) · brain-search/context-pack (Phase 4) · install.sh step 8 + CLAUDE.md marker (Phase 5) · reference-repositories/ (Phase 6) · SecondBrainBench (Phase 7) · wiring brain tests into `scripts/run-all-tests.js` (eval-team file — coordinate later).
