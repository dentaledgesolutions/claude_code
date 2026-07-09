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
