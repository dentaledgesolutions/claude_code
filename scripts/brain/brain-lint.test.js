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
