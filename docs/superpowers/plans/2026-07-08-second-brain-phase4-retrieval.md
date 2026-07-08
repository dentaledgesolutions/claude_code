# Second Brain Phase 4 — Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make accumulated brain content retrievable: authority-ranked lexical search, task-scoped context packs, and a SessionStart hook that loads the brain into every session.

**Architecture:** `brain-search.js` scans capsule Markdown, parses frontmatter, and ranks by authority × keyword overlap × recency — plain lexical scoring, **no FTS index** (spec: `brain-index.js` deferred until search is measurably slow). `brain-context-pack.js` runs scoped searches per bucket and emits the spec §7.3 JSON shape. `brain-load.sh` (SessionStart) injects BRAIN.md's protocol plus top-authority titles via `additionalContext`, capped under 2k tokens. Two skills wrap the scripts.

**Tech Stack:** Node ≥ 18 CommonJS, zero dependencies, reusing `brain-lib.js`.

## Global Constraints

- Phases 1–3 complete; live capsule has real content
- Authority ranking (spec §4): `canon > active decision > validated lesson > synthesis > session note > raw source` — implemented as directory/status weights
- `brain-load.sh` output hard-capped at 8,000 characters (< 2k tokens); non-blocking, exit 0 always
- Same script contract as Phase 1 (offline, deterministic, fail open on non-security paths)
- Do NOT touch eval-team files; do NOT commit `evals/`

## Preflight — re-verify before executing

- [ ] Phase 1–3 tests green: `for t in scripts/brain/*.test.js; do node "$t" || exit 1; done`
- [ ] Live capsule verifies: `node scripts/brain/brain-verify.js`
- [ ] SessionStart `additionalContext` shape unchanged in hooks docs (`hookSpecificOutput.additionalContext`)
- [ ] Confirm capsule has ≥ 1 promoted item in `decisions/active/` or `canon/` (promote one via /brain-promote if empty — search tests plant their own fixtures, but the live smoke needs real content)

---

### Task 1: brain-search.js

**Files:**
- Create: `scripts/brain/brain-search.js`
- Test: `scripts/brain/brain-search.test.js`

**Interfaces:**
- Consumes: `brain-lib` (`getArg`, `hasFlag`, `resolveTarget`, `parseFrontmatter`, `walkMarkdown`)
- Produces: CLI `node scripts/brain/brain-search.js --query "<terms>" [--limit N] [--json] [--dir <subdir>] [--target <dir>]`. Human output: `score  path — title` lines. `--json`: array of `{ path, title, score, authority, type, status }` (capsule-relative path). Task 2's context-pack requires the exported function `search(target, query, { limit, dir }) → result[]` via `module.exports`.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-search.test.js`**

```js
// scripts/brain/brain-search.test.js — authority beats keyword frequency:
// a canon doc outranks a session note on the same term; keyword overlap and
// recency break ties; --dir scopes; --json is machine-readable.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, 'brain-search.js');
const LIB = require('./brain-lib');
const TMP = path.join(__dirname, '__search_test_tmp__');

function doc(fields, body) { return LIB.serializeFrontmatter(fields, body); }
function write(rel, content) {
  const p = path.join(TMP, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(args) {
  const r = spawnSync('node', [SCRIPT, '--target', TMP, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  const now = new Date().toISOString().slice(0, 19);
  // Same keyword everywhere; different authority tiers
  write('canon/pipeline-rule.md', doc({ type: 'decision', title: 'Pipeline canon rule',
    description: 'canonical pipeline guidance', tags: ['pipeline'], timestamp: now,
    sources: [], status: 'canon' }, 'Use pipeline for eval batches.\n'));
  write('decisions/active/pipeline-choice.md', doc({ type: 'decision', title: 'Pipeline choice',
    description: 'active decision on pipeline', tags: ['pipeline'], timestamp: now,
    sources: [], status: 'active' }, 'pipeline pipeline pipeline — high term frequency should NOT beat canon.\n'));
  write('sessions/daily/2026-07-01.md', '# log\n\n## 10:00 [note]\n\npipeline chatter in a session note\n');
  write('synthesis/pipeline-review.md', doc({ type: 'synthesis', title: 'Pipeline review',
    description: 'synthesis of pipeline options', tags: [], timestamp: now,
    sources: [], status: 'validated' }, 'pipeline synthesis body\n'));

  // 1. Authority ordering: canon > active > synthesis > session (spec acceptance)
  let r = run(['--query', 'pipeline', '--json', '--limit', '10']);
  assert.strictEqual(r.status, 0, r.stderr);
  const results = JSON.parse(r.stdout);
  const order = results.map(x => x.path);
  assert.ok(order.indexOf('canon/pipeline-rule.md') < order.indexOf('decisions/active/pipeline-choice.md'), 'canon above active');
  assert.ok(order.indexOf('decisions/active/pipeline-choice.md') < order.indexOf('synthesis/pipeline-review.md'), 'active above synthesis');
  assert.ok(order.indexOf('synthesis/pipeline-review.md') < order.indexOf('sessions/daily/2026-07-01.md'), 'synthesis above session note');

  // 2. Keyword relevance: unrelated docs rank below matching ones / are absent
  write('decisions/active/unrelated.md', doc({ type: 'decision', title: 'Naming convention',
    description: 'nothing about the query term', tags: [], timestamp: now,
    sources: [], status: 'active' }, 'kebab-case everywhere\n'));
  r = run(['--query', 'pipeline', '--json', '--limit', '10']);
  const hits = JSON.parse(r.stdout);
  const unrelated = hits.find(x => x.path === 'decisions/active/unrelated.md');
  assert.ok(!unrelated || unrelated.score < hits.find(x => x.path === 'canon/pipeline-rule.md').score);

  // 3. --dir scopes to a subtree
  r = run(['--query', 'pipeline', '--json', '--dir', 'decisions']);
  assert.ok(JSON.parse(r.stdout).every(x => x.path.startsWith('decisions/')));

  // 4. --limit respected; human format has score and title
  r = run(['--query', 'pipeline', '--limit', '2']);
  assert.strictEqual(r.stdout.trim().split('\n').length, 2);
  assert.ok(r.stdout.includes('Pipeline canon rule'));

  // 5. Empty query → exit 1; empty capsule → exit 0, empty result
  assert.strictEqual(run(['--query', '   ']).status, 1);
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'canon'), { recursive: true });
  r = run(['--query', 'anything', '--json']);
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(JSON.parse(r.stdout), []);

  console.log('brain-search.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-search.test.js` — Expected: FAIL (script missing)

- [ ] **Step 3: Write `scripts/brain/brain-search.js`**

```js
#!/usr/bin/env node
// scripts/brain/brain-search.js — authority-ranked lexical search over a brain
// capsule. No index, no network: scan + score is fast at capsule scale (spec:
// brain-index.js deferred until measurably slow).
// Usage: brain-search.js --query "<terms>" [--limit N] [--json] [--dir sub] [--target <dir>]
// Also exports search() for brain-context-pack.js.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  getArg, hasFlag, resolveTarget, parseFrontmatter, walkMarkdown,
} = require('./brain-lib');

// Directory-tier authority; frontmatter status refines within tier.
const DIR_AUTHORITY = [
  { prefix: 'canon/', weight: 60, label: 'canon' },
  { prefix: 'decisions/active/', weight: 50, label: 'active decision' },
  { prefix: 'lessons/', weight: 40, label: 'lesson' },
  { prefix: 'synthesis/', weight: 30, label: 'synthesis' },
  { prefix: 'decisions/candidates/', weight: 25, label: 'candidate' },
  { prefix: 'sessions/', weight: 20, label: 'session note' },
  { prefix: 'support/', weight: 10, label: 'raw source' },
];
const STATUS_BONUS = { canon: 5, active: 4, validated: 3, candidate: 1 };

function tokenize(s) {
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

function search(target, query, { limit = 5, dir = null } = {}) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const root = dir ? path.join(target, dir) : target;
  const results = [];
  for (const file of walkMarkdown(root)) {
    const rel = path.relative(target, file).split(path.sep).join('/');
    if (rel.startsWith('reports/')) continue; // generated artifacts are not knowledge
    const text = fs.readFileSync(file, 'utf8');
    const { fields } = parseFrontmatter(text);
    const tier = DIR_AUTHORITY.find(t => rel.startsWith(t.prefix)) || { weight: 10, label: 'raw source' };
    const title = (fields && fields.title) || path.basename(rel, '.md');
    const tags = (fields && Array.isArray(fields.tags)) ? fields.tags : [];
    const bodyTokens = new Set(tokenize(text));
    const titleTokens = new Set(tokenize(title));
    const tagTokens = new Set(tags.flatMap(tokenize));
    let overlap = 0;
    for (const t of terms) {
      if (titleTokens.has(t)) overlap += 3;
      if (tagTokens.has(t)) overlap += 2;
      if (bodyTokens.has(t)) overlap += 1;
    }
    if (overlap === 0) continue;
    const status = (fields && fields.status) || '';
    const ts = fields ? Date.parse(fields.timestamp) : NaN;
    const ageDays = Number.isNaN(ts) ? 365 : (Date.now() - ts) / 86400000;
    const recency = Math.max(0, 5 - ageDays / 30); // ≤5 pts, decays over ~5 months
    const score = tier.weight + (STATUS_BONUS[status] || 0) + overlap * 2 + recency;
    results.push({
      path: rel, title, score: Math.round(score * 10) / 10,
      authority: tier.label, type: (fields && fields.type) || 'unknown', status: status || 'none',
    });
  }
  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return results.slice(0, limit);
}

if (require.main === module) {
  const query = getArg(process.argv, '--query', '');
  if (!query.trim()) {
    console.error('brain-search: usage: brain-search.js --query "<terms>" [--limit N] [--json] [--dir sub]');
    process.exit(1);
  }
  const results = search(resolveTarget(process.argv), query, {
    limit: Number(getArg(process.argv, '--limit', '5')),
    dir: getArg(process.argv, '--dir', null),
  });
  if (hasFlag(process.argv, '--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) console.log(`${String(r.score).padStart(6)}  ${r.path} — ${r.title}`);
  }
}
module.exports = { search };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/brain/brain-search.test.js` — Expected: all assertions passed

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-search.js scripts/brain/brain-search.test.js
git commit -m "feat(brain): brain-search — authority-ranked lexical retrieval, no index"
```

---

### Task 2: brain-context-pack.js

**Files:**
- Create: `scripts/brain/brain-context-pack.js`
- Test: `scripts/brain/brain-context-pack.test.js`

**Interfaces:**
- Consumes: `brain-search.js` (`search()`), `brain-lib`, capsule profile
- Produces: CLI `node scripts/brain/brain-context-pack.js --intent "<task>" [--per-bucket N] [--target <dir>]` → spec §7.3 JSON on stdout: `{ task_intent, project, retrieval_mode, relevant_canon, relevant_decisions, relevant_lessons, relevant_reports, reference_sources, excluded_context, gaps, warnings }`. Bucket entries are search results; `gaps` lists empty buckets; `warnings` carries lint-security state.

- [ ] **Step 1: Write the failing test `scripts/brain/brain-context-pack.test.js`**

```js
// scripts/brain/brain-context-pack.test.js — context pack emits the §7.3 shape,
// buckets scope to their dirs, empty buckets land in gaps, and a security-dirty
// capsule surfaces a warning.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPT = path.join(__dirname, 'brain-context-pack.js');
const LIB = require('./brain-lib');
const TMP = path.join(__dirname, '__ctxpack_test_tmp__');

function write(rel, content) {
  const p = path.join(TMP, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(args) {
  const r = spawnSync('node', [SCRIPT, '--target', TMP, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
const now = new Date().toISOString().slice(0, 19);
const doc = (type, title, status) => LIB.serializeFrontmatter(
  { type, title, description: title, tags: ['evals'], timestamp: now, sources: [], status },
  'Body about running skill evals.\n');

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const d of ['canon', 'decisions/active', 'lessons/memories', 'reports', 'context', 'sessions/daily']) {
    fs.mkdirSync(path.join(TMP, d), { recursive: true });
  }
  fs.writeFileSync(path.join(TMP, 'context', 'brain-profile.json'), JSON.stringify({
    project_name: 'claude_code', brain_mode: 'standard',
  }));
  write('canon/eval-rule.md', doc('decision', 'Eval canon rule', 'canon'));
  write('decisions/active/eval-choice.md', doc('decision', 'Evals run via pipeline', 'active'));
  // lessons left EMPTY on purpose → must appear in gaps

  // 1. Shape + bucket scoping + gaps
  let r = run(['--intent', 'skill evals']);
  assert.strictEqual(r.status, 0, r.stderr);
  const pack = JSON.parse(r.stdout);
  for (const k of ['task_intent', 'project', 'retrieval_mode', 'relevant_canon', 'relevant_decisions',
    'relevant_lessons', 'relevant_reports', 'reference_sources', 'excluded_context', 'gaps', 'warnings']) {
    assert.ok(k in pack, `pack has ${k}`);
  }
  assert.strictEqual(pack.task_intent, 'skill evals');
  assert.strictEqual(pack.project, 'claude_code');
  assert.strictEqual(pack.retrieval_mode, 'standard');
  assert.strictEqual(pack.relevant_canon.length, 1);
  assert.ok(pack.relevant_canon[0].path.startsWith('canon/'));
  assert.strictEqual(pack.relevant_decisions.length, 1);
  assert.ok(pack.gaps.includes('relevant_lessons'), `empty lessons bucket in gaps: ${JSON.stringify(pack.gaps)}`);

  // 2. Sensitive content in capsule → warning entry
  write('sessions/daily/2026-07-08.md', '# log\n\n## 10:00 [note]\n\nsk-ant-abc123def456ghi789\n');
  r = run(['--intent', 'skill evals']);
  const pack2 = JSON.parse(r.stdout);
  assert.ok(pack2.warnings.some(w => /sensitive/i.test(w)), `warnings: ${JSON.stringify(pack2.warnings)}`);

  // 3. Missing intent → exit 1; missing profile → still works with warnings
  assert.strictEqual(run([]).status, 1);
  fs.rmSync(path.join(TMP, 'context', 'brain-profile.json'));
  r = run(['--intent', 'x']);
  assert.strictEqual(r.status, 0, 'missing profile fails open');
  assert.ok(JSON.parse(r.stdout).warnings.some(w => /profile/i.test(w)));

  console.log('brain-context-pack.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/brain/brain-context-pack.test.js` — Expected: FAIL (script missing)

- [ ] **Step 3: Write `scripts/brain/brain-context-pack.js`**

```js
#!/usr/bin/env node
// scripts/brain/brain-context-pack.js — build the spec §7.3 context object for a
// task intent by running bucket-scoped brain-search queries. Fail open: a missing
// profile or empty capsule degrades to warnings/gaps, never a crash.
// Usage: brain-context-pack.js --intent "<task>" [--per-bucket N] [--target <dir>]
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, resolveTarget, scanSensitive, walkMarkdown } = require('./brain-lib');
const { search } = require('./brain-search');

const target = resolveTarget(process.argv);
const intent = getArg(process.argv, '--intent', '');
if (!intent.trim()) {
  console.error('brain-context-pack: usage: brain-context-pack.js --intent "<task>" [--per-bucket N]');
  process.exit(1);
}
const perBucket = Number(getArg(process.argv, '--per-bucket', '3'));
const warnings = [];

let profile = {};
try {
  profile = JSON.parse(fs.readFileSync(path.join(target, 'context', 'brain-profile.json'), 'utf8'));
} catch {
  warnings.push('brain-profile.json missing or unreadable — using defaults');
}

const BUCKETS = {
  relevant_canon: 'canon',
  relevant_decisions: 'decisions',
  relevant_lessons: 'lessons',
  relevant_reports: 'reports',
  reference_sources: 'reference-repositories',
};
const pack = {
  task_intent: intent,
  project: profile.project_name || path.basename(path.dirname(target)),
  retrieval_mode: profile.brain_mode || 'standard',
};
const gaps = [];
for (const [bucket, dir] of Object.entries(BUCKETS)) {
  const hits = fs.existsSync(path.join(target, dir)) ? search(target, intent, { limit: perBucket, dir }) : [];
  pack[bucket] = hits;
  if (!hits.length) gaps.push(bucket);
}
pack.excluded_context = [];

// Surface (do not fix) sensitive-content state — retrieval must not launder secrets.
let dirty = 0;
for (const file of walkMarkdown(target)) {
  if (scanSensitive(fs.readFileSync(file, 'utf8')).length) dirty++;
}
if (dirty) warnings.push(`sensitive content present in ${dirty} file(s) — run brain-lint and clean before sharing context`);

pack.gaps = gaps;
pack.warnings = warnings;
console.log(JSON.stringify(pack, null, 2));
```

- [ ] **Step 4: Run test to verify it passes** — `node scripts/brain/brain-context-pack.test.js`

- [ ] **Step 5: Commit**

```bash
git add scripts/brain/brain-context-pack.js scripts/brain/brain-context-pack.test.js
git commit -m "feat(brain): brain-context-pack — §7.3 context object from bucket-scoped search"
```

---

### Task 3: brain-load.sh SessionStart hook

**Files:**
- Create: `hooks/brain/brain-load.sh`
- Test: extend `scripts/brain/brain-hooks.test.js` (append the block below before the final `console.log`)
- Modify: `.claude/settings.local.json` via re-running `bash scripts/brain/brain-self-install.sh` after Step 4's registration edit

**Interfaces:**
- Consumes: capsule BRAIN.md + `decisions/active/` + `canon/` titles
- Produces: SessionStart `additionalContext` JSON, ≤ 8,000 chars. Registered as SessionStart (no matcher) → `brain-load.sh`.

- [ ] **Step 1: Append failing test block to `scripts/brain/brain-hooks.test.js`**

```js
  // 8. brain-load: emits additionalContext with protocol + top titles, ≤8000 chars
  seedCapsule();
  fs.writeFileSync(path.join(BRAIN, 'BRAIN.md'), '# Project Brain — t\n\n## Second Brain Protocol\n\n1. Read first.\n');
  fs.mkdirSync(path.join(BRAIN, 'decisions', 'active'), { recursive: true });
  fs.writeFileSync(path.join(BRAIN, 'decisions', 'active', 'd1.md'),
    '---\ntype: decision\ntitle: Loaded decision one\ndescription: d\ntags: []\ntimestamp: 2026-07-08T00:00:00\nsources: []\nstatus: active\n---\n\nBody.\n');
  r = runHook('brain-load.sh', { hook_event_name: 'SessionStart' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('"additionalContext"'), 'emits additionalContext');
  assert.ok(r.stdout.includes('Second Brain Protocol'), 'includes protocol');
  assert.ok(r.stdout.includes('Loaded decision one'), 'includes active decision title');
  assert.ok(r.stdout.length < 8500, 'respects size cap');
  // no capsule → silent
  r = runHook('brain-load.sh', { hook_event_name: 'SessionStart' }, path.join(TMP, 'nowhere'));
  assert.strictEqual(r.stdout.trim(), '');
```

- [ ] **Step 2: Run to verify the new block fails** — `node scripts/brain/brain-hooks.test.js`

- [ ] **Step 3: Write `hooks/brain/brain-load.sh`**

```bash
#!/usr/bin/env bash
# hooks/brain/brain-load.sh — SessionStart: inject the brain protocol and
# top-authority titles into session context. ≤ 8000 chars. Always exits 0.
set -u
INPUT="$(cat)"
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BRAIN="${ROOT}/.project-brain"
[ -f "${BRAIN}/BRAIN.md" ] || exit 0
node -e '
const fs = require("fs");
const path = require("path");
const lib = require(process.argv[2] + "/../../scripts/brain/brain-lib.js");
const brain = process.argv[1];
const parts = [];
parts.push(fs.readFileSync(path.join(brain, "BRAIN.md"), "utf8").slice(0, 3000));
function titles(dir, label) {
  const files = lib.walkMarkdown(path.join(brain, dir)).slice(0, 10);
  if (!files.length) return;
  parts.push(`\n${label}:`);
  for (const f of files) {
    const { fields } = lib.parseFrontmatter(fs.readFileSync(f, "utf8"));
    parts.push(`- ${path.relative(brain, f)} — ${(fields && fields.title) || path.basename(f, ".md")}`);
  }
}
titles("canon", "Canon (highest authority)");
titles("decisions/active", "Active decisions");
parts.push("\nRetrieve more: node scripts/brain/brain-search.js --query \"<terms>\" · context pack: brain-context-pack.js --intent \"<task>\"");
const ctx = parts.join("\n").slice(0, 8000);
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } }));
' "${BRAIN}" "${HOOK_DIR}" 2>/dev/null || true
exit 0
```

- [ ] **Step 4: Register in the self-installer** — in `scripts/brain/brain-self-install.sh`, add one line after the other `ensureHookEntry` calls:

```js
if (ensureHookEntry("SessionStart", null, H("brain-load.sh"))) added++;
```

- [ ] **Step 5: Run tests, re-run self-install, verify live**

```bash
chmod +x hooks/brain/brain-load.sh
node scripts/brain/brain-hooks.test.js
node scripts/brain/brain-self-install.test.js   # idempotency assertion now expects 6 entries — update its loop to include brain-load.sh
bash scripts/brain/brain-self-install.sh        # registers SessionStart on this repo
```

Expected: both test files pass (after extending the self-install test's hook list with `brain-load.sh`); live merge reports 1 added.

- [ ] **Step 6: Commit**

```bash
git add hooks/brain/brain-load.sh scripts/brain/brain-hooks.test.js scripts/brain/brain-self-install.sh scripts/brain/brain-self-install.test.js .claude/settings.local.json
git commit -m "feat(brain): brain-load SessionStart hook — protocol + top-authority context, <2k tokens"
```

---

### Task 4: brain-search and brain-context-pack skills

Follow Phase 3's shared 8-step workflow (scout → SKILL.md → deploy → context refresh → evals → eval → refine → commit) for each.

**`skills/brain-search/SKILL.md`:**

```markdown
---
name: brain-search
description: "Use when the user asks what the brain knows — 'search the brain for X',
  'did we decide anything about Y', 'what do we know about Z', 'check the project
  brain'. Runs authority-ranked search over .project-brain/ and presents hits with
  their authority level. Not for: searching code (use Grep/Explore), the web, or
  Claude Code native auto-memory."
risk_tier: standard
---

# Brain Search

## Workflow
1. Distill the user's question into 2–5 search terms.
2. Run: `node scripts/brain/brain-search.js --query "<terms>" --json --limit 8`
3. Present hits grouped by authority (canon first), each with title, path, and a one-line gist from reading the file. State the authority level explicitly — a session note is a hint, canon is law.
4. Zero hits: say so plainly and suggest related terms; never invent brain content.
5. If the user acts on a canon/active item, remind that changes go through candidates + brain-promote.

## Files it may edit — none (read-only skill).
## Success criteria — answers cite capsule paths; authority always labeled; no fabricated memory.
```

**`skills/brain-context-pack/SKILL.md`:**

```markdown
---
name: brain-context-pack
description: "Use at the start of a substantial task to load relevant brain context —
  'pack context for X', 'what should I know before doing Y', 'load the brain for this
  task'. Runs brain-context-pack.js and folds the result into the working context.
  Not for: one-off lookups (brain-search) or session bootstrapping (the SessionStart
  hook already loads the protocol)."
risk_tier: standard
---

# Brain Context Pack

## Workflow
1. State the task intent in ≤ 6 words.
2. Run: `node scripts/brain/brain-context-pack.js --intent "<intent>"`
3. Read every file listed in relevant_canon and relevant_decisions (they are few by design); skim lesson hits.
4. Summarize to the user: which prior decisions constrain this task, which lessons apply, and what the gaps mean ('no lessons recorded on this topic yet').
5. Surface any warnings verbatim — especially sensitive-content warnings. If memory conflicts with the requested task, state the conflict before proceeding (Second Brain Protocol rule).

## Files it may edit — none (read-only skill).
## Success criteria — constraining decisions surfaced before work starts; conflicts stated; gaps named, not papered over.
```

- [ ] Execute Phase 3 Steps A–H for `brain-search`
- [ ] Execute Phase 3 Steps A–H for `brain-context-pack`

---

### Task 5: Phase acceptance

- [ ] All brain tests green: `for t in scripts/brain/*.test.js; do node "$t" || exit 1; done`
- [ ] **Spec criterion:** planted canon decision outranks a session note on the same keyword (covered by brain-search.test.js assertion 1 — cite it)
- [ ] **Spec criterion:** context pack validates against the §7.3 shape (context-pack test assertion 1)
- [ ] **Spec criterion:** SessionStart adds < 2k tokens — start a fresh session in this repo, run `/context`, confirm the brain-load contribution is under ~2k tokens and the protocol text is present
- [ ] Live retrieval smoke: "did we decide anything about pipelines?" → brain-search triggers and cites real capsule paths
- [ ] Capture the milestone: `node scripts/brain/brain-capture.js --type decision --title "Phase 4 complete" --message "Retrieval live: authority-ranked search, context packs, SessionStart brain-load under 2k tokens."`

## Deferred

`brain-index.js` FTS (until search is measurably slow) · GBrain adapter (gbrain_enabled stays false) · install.sh integration (Phase 5).
