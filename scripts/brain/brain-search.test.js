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
