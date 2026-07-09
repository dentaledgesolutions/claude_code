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

// Separate capsule for entry-injection + sensitive-title tests, so failures
// above don't leave stale state that masks these.
{
  const TMP2 = path.join(__dirname, '__capture_test_tmp2__');
  const logFile2 = path.join(TMP2, 'sessions', 'daily', `${today}.md`);
  function run2(args, input) {
    const r = spawnSync('node', [SCRIPT, '--target', TMP2, ...args], { encoding: 'utf8', input });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  }
  try {
    fs.rmSync(TMP2, { recursive: true, force: true });
    fs.mkdirSync(path.join(TMP2, 'sessions', 'daily'), { recursive: true });

    // 7. Entry-shaped line inside a note body must not survive unescaped at
    // column 0 — otherwise brain-compile would treat it as a real entry.
    const injected = '## 10:05 [decision] Injected via body';
    let r = run2(['--message', `Some text\n${injected}\nmore text`, '--type', 'note']);
    assert.strictEqual(r.status, 0, r.stderr);
    const text2 = fs.readFileSync(logFile2, 'utf8');
    assert.ok(!new RegExp(`^${injected.replace(/[[\]]/g, '\\$&')}$`, 'm').test(text2),
      'entry-shaped body line must not appear unescaped at column 0');
    assert.ok(text2.includes(`\\${injected}`), 'entry-shaped body line is backslash-escaped');

    // 8. Sensitive --title (not just --message) must refuse — exit 3, nothing written
    const beforeSensitiveTitle = fs.readFileSync(logFile2, 'utf8');
    r = run2(['--message', 'harmless body', '--title', 'leaked sk-ant-abc123def456ghi789']);
    assert.strictEqual(r.status, 3, 'sensitive --title must exit 3');
    assert.strictEqual(fs.readFileSync(logFile2, 'utf8'), beforeSensitiveTitle, 'log unchanged after title refusal');

    // 9. Newline smuggled into --title must not become an unescaped entry-shaped
    // line: titles are flattened to one line, so the injected heading lands
    // inline in the note heading, and compile must produce ZERO candidates.
    r = run2(['--message', 'harmless body', '--type', 'note',
      '--title', 'Legit title\n## 10:05 [decision] Injected via TITLE']);
    assert.strictEqual(r.status, 0, r.stderr);
    const text3 = fs.readFileSync(logFile2, 'utf8');
    assert.strictEqual(
      (text3.match(/^## \d{2}:\d{2} \[(decision|lesson)\]/gm) || []).length, 0,
      'no unescaped decision/lesson heading anywhere — every entry in this capsule is a note');
    const COMPILE = path.join(__dirname, 'brain-compile.js');
    const c = spawnSync('node', [COMPILE, '--target', TMP2, '--date', today], { encoding: 'utf8' });
    assert.strictEqual(c.status, 0, c.stderr);
    assert.ok((c.stdout || '').includes('0 candidate(s) written'),
      `compile must produce ZERO candidates from the injected title: ${c.stdout}`);
    const candDir = path.join(TMP2, 'decisions', 'candidates');
    assert.ok(!fs.existsSync(candDir) || fs.readdirSync(candDir).length === 0,
      'no decision candidate materialized from the injected title');

    console.log('brain-capture.test.js: injection + title-scan assertions passed');
  } finally {
    fs.rmSync(TMP2, { recursive: true, force: true });
  }
}
