// scripts/brain/brain-self-install.test.js — installs a capsule into a temp
// target, merges hooks into settings.local.json without clobbering, is
// idempotent, and passes brain-verify.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..', '..');
const SCRIPT = path.join(__dirname, 'brain-self-install.sh');
const TMP = path.join(__dirname, '__selfinstall_test_tmp__');

function run() {
  const r = spawnSync('bash', [SCRIPT, TMP], { encoding: 'utf8', cwd: REPO });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

try {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, '.claude'), { recursive: true });
  // Pre-existing hook that must survive the merge untouched
  fs.writeFileSync(path.join(TMP, '.claude', 'settings.local.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo preexisting' }] }] },
  }, null, 2));
  fs.writeFileSync(path.join(TMP, '.gitignore'), 'node_modules/\n');

  // 1. Install succeeds; capsule verifies; placeholders filled
  let r = run();
  assert.strictEqual(r.status, 0, `install failed:\n${r.stdout}\n${r.stderr}`);
  const brain = path.join(TMP, '.project-brain');
  const verify = spawnSync('node', [path.join(__dirname, 'brain-verify.js'), '--target', brain], { encoding: 'utf8' });
  assert.strictEqual(verify.status, 0, verify.stderr);
  const brainMd = fs.readFileSync(path.join(brain, 'BRAIN.md'), 'utf8');
  assert.ok(!brainMd.includes('{{PROJECT_NAME}}'), 'placeholders filled');
  const profile = JSON.parse(fs.readFileSync(path.join(brain, 'context', 'brain-profile.json'), 'utf8'));
  assert.strictEqual(profile.project_name, path.basename(TMP));
  assert.ok(/^\d{4}-\d{2}-\d{2}/.test(profile.created_at));

  // 2. Hooks merged: 5 brain registrations present, pre-existing hook intact
  const settings = JSON.parse(fs.readFileSync(path.join(TMP, '.claude', 'settings.local.json'), 'utf8'));
  const flat = JSON.stringify(settings.hooks);
  for (const h of ['brain-pre-compact.sh', 'brain-session-end.sh', 'brain-security-guard.sh', 'brain-post-lint.sh']) {
    assert.ok(flat.includes(h), `${h} registered`);
  }
  assert.ok(flat.includes('echo preexisting'), 'pre-existing hook survived');
  assert.ok(Array.isArray(settings.hooks.Stop) && Array.isArray(settings.hooks.SessionEnd),
    'session-end script registered on both SessionEnd and Stop');

  // 3. .gitignore gained the sessions line exactly once
  const gi = fs.readFileSync(path.join(TMP, '.gitignore'), 'utf8');
  assert.strictEqual((gi.match(/^\.project-brain\/sessions\/$/gm) || []).length, 1);

  // 4. Idempotent: re-run changes nothing
  const settingsBefore = fs.readFileSync(path.join(TMP, '.claude', 'settings.local.json'), 'utf8');
  const brainMdBefore = fs.readFileSync(path.join(brain, 'BRAIN.md'), 'utf8');
  r = run();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(fs.readFileSync(path.join(TMP, '.claude', 'settings.local.json'), 'utf8'), settingsBefore);
  assert.strictEqual(fs.readFileSync(path.join(brain, 'BRAIN.md'), 'utf8'), brainMdBefore);
  assert.strictEqual((fs.readFileSync(path.join(TMP, '.gitignore'), 'utf8').match(/\.project-brain\/sessions\//g) || []).length, 1);

  console.log('brain-self-install.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
