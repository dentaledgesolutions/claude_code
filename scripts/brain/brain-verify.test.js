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
