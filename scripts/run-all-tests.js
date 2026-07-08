#!/usr/bin/env node
// scripts/run-all-tests.js — one command for "did I break the eval pipeline?".
//
// Discovers every *.test.js under skills/ and scripts/ (plus the named non-.test.js
// suites below) and runs each in its own node process. Run this after ANY change
// under skills/*/scripts/, scripts/codex/, scripts/telemetry/, or the calibration
// scripts (see fixtures/GATE-RUNBOOK.md). Exits non-zero if any suite fails.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

// Suites that don't follow the *.test.js naming convention.
const NAMED_SUITES = [
  path.join('scripts', 'codex', 'test-schemas.js'),
  path.join('scripts', 'codex', 'test-runners.js'),
  path.join('scripts', 'telemetry', 'test-telemetry.js'),
];

function discoverTestFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name.startsWith('__')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) discoverTestFiles(p, out);
    else if (entry.name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const discovered = [
  ...discoverTestFiles(path.join(REPO, 'skills'), []),
  ...discoverTestFiles(path.join(REPO, 'scripts'), []),
].map(p => path.relative(REPO, p));

const suites = [...new Set([...discovered, ...NAMED_SUITES])].sort()
  .filter(p => fs.existsSync(path.join(REPO, p)));

if (suites.length === 0) {
  console.error('Error: no test suites found — expected *.test.js files under skills/ and scripts/.');
  process.exit(1);
}

let failed = 0;
for (const suite of suites) {
  const r = spawnSync('node', [suite], { cwd: REPO, encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${suite}`);
  if (!ok) {
    process.stdout.write((r.stdout || '').split('\n').slice(-15).join('\n') + '\n');
    process.stderr.write((r.stderr || '').split('\n').slice(-15).join('\n') + '\n');
  }
}

console.log(`\n${suites.length - failed}/${suites.length} suites passed`);
process.exit(failed === 0 ? 0 : 1);
