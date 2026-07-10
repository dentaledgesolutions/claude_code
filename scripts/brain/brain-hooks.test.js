// scripts/brain/brain-hooks.test.js — hooks parse event JSON, are no-ops without
// a capsule, capture/compile/lint through the Phase 1 scripts, and only the
// security guard ever denies.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..', '..');
const HOOKS = path.join(REPO, 'hooks', 'brain');
const TMP = path.join(__dirname, '__hooks_test_tmp__');
const BRAIN = path.join(TMP, '.project-brain');
const today = new Date().toISOString().slice(0, 10);

function runHook(name, event, root = TMP) {
  const r = spawnSync('bash', [path.join(HOOKS, name)], {
    encoding: 'utf8', input: JSON.stringify(event),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function seedCapsule() {
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const d of ['sessions/daily', 'decisions/candidates', 'decisions/active',
    'lessons/memories', 'canon', 'synthesis', 'reports']) {
    fs.mkdirSync(path.join(BRAIN, d), { recursive: true });
  }
  fs.writeFileSync(path.join(BRAIN, 'log.md'), '# Brain Log\n');
}

try {
  // 1. No capsule → every hook is a silent no-op, exit 0
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  for (const h of ['brain-pre-compact.sh', 'brain-session-end.sh', 'brain-post-lint.sh']) {
    const r = runHook(h, { hook_event_name: 'x' });
    assert.strictEqual(r.status, 0, `${h} must exit 0 without capsule: ${r.stderr}`);
    assert.strictEqual(r.stdout.trim(), '', `${h} must stay silent without capsule`);
  }

  // 2. PreCompact appends a snapshot note to today's log
  seedCapsule();
  let r = runHook('brain-pre-compact.sh', { hook_event_name: 'PreCompact', trigger: 'auto' });
  assert.strictEqual(r.status, 0, r.stderr);
  const log = path.join(BRAIN, 'sessions', 'daily', `${today}.md`);
  assert.ok(fs.existsSync(log), 'daily log created');
  assert.ok(fs.readFileSync(log, 'utf8').includes('pre-compact snapshot (auto)'));

  // 3. SessionEnd compiles: plant a decision entry, expect a candidate afterward
  seedCapsule();
  fs.writeFileSync(log, `# Session log — ${today}\n\n## 10:00 [decision] Hook test decision\n\nBody.\n`);
  r = runHook('brain-session-end.sh', { hook_event_name: 'SessionEnd' });
  assert.strictEqual(r.status, 0, r.stderr);
  const cands = fs.readdirSync(path.join(BRAIN, 'decisions', 'candidates')).filter(f => f.endsWith('.md'));
  assert.strictEqual(cands.length, 1, 'SessionEnd compiled the decision');

  // 4. Stop suggests exactly once when uncompiled entries exist
  seedCapsule();
  fs.writeFileSync(log, `# Session log — ${today}\n\n## 10:00 [lesson] L\n\nBody.\n`);
  r = runHook('brain-session-end.sh', { hook_event_name: 'Stop' });
  assert.ok(r.stdout.includes('additionalContext'), 'first Stop suggests');
  r = runHook('brain-session-end.sh', { hook_event_name: 'Stop' });
  assert.strictEqual(r.stdout.trim(), '', 'second Stop same day is silent');

  // 5. Security guard denies Write into canon/, allows normal writes
  seedCapsule();
  r = runHook('brain-security-guard.sh', {
    hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(BRAIN, 'canon', 'x.md'), content: 'hi' },
  });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('"permissionDecision":"deny"'), `canon write must be denied: ${r.stdout}`);
  r = runHook('brain-security-guard.sh', {
    hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(TMP, 'src', 'app.js'), content: 'hi' },
  });
  assert.strictEqual(r.stdout.trim(), '', 'normal write passes silently');

  // 6. Guard: Bash touching canon denied unless brain-promote --approve; rm -rf on capsule denied
  const denyBash = cmd => runHook('brain-security-guard.sh',
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: cmd } });
  assert.ok(denyBash('echo x >> .project-brain/canon/y.md').stdout.includes('deny'));
  assert.strictEqual(denyBash('node scripts/brain/brain-promote.js decisions/candidates/a.md --approve --to canon').stdout.trim(), '');
  assert.ok(denyBash('rm -rf .project-brain').stdout.includes('deny'));

  // 6b. Hardening regressions: path traversal, cd+relative canon, interpreter writes.
  // Raw string concat on purpose — path.join would normalize the ".." away.
  r = runHook('brain-security-guard.sh', {
    hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(BRAIN, 'decisions') + '/../canon/x.md', content: 'hi' },
  });
  assert.ok(r.stdout.includes('"permissionDecision":"deny"'), `traversal into canon must be denied: ${r.stdout}`);
  assert.ok(denyBash('cd .project-brain && echo x >> canon/y.md').stdout.includes('deny'),
    'cd + relative canon append must be denied');
  assert.ok(denyBash('node -e "require(\'fs\').writeFileSync(\'.project-brain/canon/x.md\',\'x\')"').stdout.includes('deny'),
    'interpreter write into canon must be denied');
  assert.strictEqual(denyBash('node scripts/brain/brain-promote.js decisions/candidates/a.md --approve --to canon').stdout.trim(), '',
    'approved promote still passes after hardening');
  r = runHook('brain-security-guard.sh', {
    hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(TMP, 'src', 'app.js'), content: 'hi' },
  });
  assert.strictEqual(r.stdout.trim(), '', 'normal write still passes silently after hardening');

  // 7. Post-lint: always exit 0; warns via additionalContext only on sensitive content
  seedCapsule();
  fs.writeFileSync(path.join(BRAIN, 'sessions', 'daily', `${today}.md`),
    '# log\n\n## 10:00 [note]\n\nleak sk-ant-abc123def456ghi789\n');
  r = runHook('brain-post-lint.sh', {
    hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(BRAIN, 'sessions', 'daily', `${today}.md`) },
  });
  assert.strictEqual(r.status, 0, 'post-lint never blocks');
  assert.ok(r.stdout.includes('SENSITIVE'), 'sensitive content surfaces a warning');
  r = runHook('brain-post-lint.sh', {
    hook_event_name: 'PostToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(TMP, 'README.md') },
  });
  assert.strictEqual(r.stdout.trim(), '', 'non-brain writes are ignored');

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

  console.log('brain-hooks.test.js: all assertions passed');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
