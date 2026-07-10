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
