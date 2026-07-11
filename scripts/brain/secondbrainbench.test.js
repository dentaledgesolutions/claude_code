// scripts/brain/secondbrainbench.test.js — the sealed-answer benchmark: generation
// plants a capsule + questions + sealed answers; the adapter never reads the key;
// the smoke run passes all five gates on synthetic data; a sabotaged capsule fails
// the canon-precedence gate and exits 1.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = __dirname;
const TMP = path.join(DIR, '__bench_test_tmp__');
const adapter = require('./bench-brain-kernel-adapter');

function node(script, args) {
  const r = spawnSync('node', [path.join(DIR, script), ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });

  // 1. Generation plants capsule + 10 questions + 10 sealed answers; every
  //    correct_paths entry exists in the synthetic capsule.
  const ws = path.join(TMP, 'ws');
  let r = node('secondbrainbench-generate.js', ['--out', ws, '--synthetic']);
  assert.strictEqual(r.status, 0, r.stderr);
  const questions = JSON.parse(fs.readFileSync(path.join(ws, 'questions', 'questions.json'), 'utf8'));
  const answers = JSON.parse(fs.readFileSync(path.join(ws, 'answers', 'answers.json'), 'utf8'));
  assert.strictEqual(questions.length, 10, 'ten questions');
  assert.strictEqual(answers.length, 10, 'ten sealed answers');
  for (const a of answers) {
    for (const p of a.correct_paths) {
      assert.ok(fs.existsSync(path.join(ws, 'capsule', p)), `correct path exists: ${p}`);
    }
  }

  // 2. Adapter returns ≤5 capsule-relative paths for a sample question and never
  //    reads the sealed key (the source contains no reference to the answer file).
  const out = adapter.retrieve(path.join(ws, 'capsule'), questions[2]);
  assert.ok(Array.isArray(out.paths) && out.paths.length <= 5, 'adapter returns ≤5 paths');
  assert.ok(out.paths.every(p => !p.startsWith('/')), 'paths are capsule-relative');
  const adapterSrc = fs.readFileSync(path.join(DIR, 'bench-brain-kernel-adapter.js'), 'utf8');
  assert.ok(!/answers/.test(adapterSrc), 'adapter source must not reference the answer key');

  // 3. Smoke run exits 0 with all five gates green; results.json has all aggregates;
  //    report file written.
  const smokeWs = path.join(TMP, 'smoke');
  r = node('secondbrainbench-run.js', ['--adapter', 'brain-kernel', '--mode', 'smoke',
    '--workspace', smokeWs, '--target', path.join(TMP, 'no-capsule')]);
  assert.strictEqual(r.status, 0, `smoke must pass all gates:\n${r.stdout}\n${r.stderr}`);
  const results = JSON.parse(fs.readFileSync(path.join(smokeWs, 'results.json'), 'utf8'));
  for (const k of ['recall_at_5', 'precision_at_5', 'citation_accuracy', 'sensitive_leakage', 'canon_precedence_failures']) {
    assert.ok(k in results.aggregate, `aggregate has ${k}`);
  }
  assert.strictEqual(results.aggregate.sensitive_leakage, 0, 'no leakage on clean synthetic data');
  assert.ok(fs.existsSync(path.join(smokeWs, 'reports', 'SECONDBRAINBENCH-REPORT.md')), 'report written');

  // 4. Sabotage: delete the canon-precedence target so it can no longer rank first;
  //    re-score the same workspace (--no-generate) → precedence gate fails → exit 1,
  //    and the report names the failed gate.
  const precAns = answers.find(a => a.type === 'canon-precedence' && a.must_rank_first);
  assert.ok(precAns, 'have a canon-precedence answer with must_rank_first');
  fs.rmSync(path.join(smokeWs, 'capsule', precAns.must_rank_first), { force: true });
  r = node('secondbrainbench-run.js', ['--adapter', 'brain-kernel', '--mode', 'smoke',
    '--workspace', smokeWs, '--target', path.join(TMP, 'no-capsule'), '--no-generate']);
  assert.strictEqual(r.status, 1, 'sabotaged capsule must fail (exit 1)');
  const report = fs.readFileSync(path.join(smokeWs, 'reports', 'SECONDBRAINBENCH-REPORT.md'), 'utf8');
  assert.ok(/Canon-precedence failures \| [1-9]/.test(report) && /FAIL/.test(report),
    'report names the failed canon-precedence gate');

  console.log('secondbrainbench.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
