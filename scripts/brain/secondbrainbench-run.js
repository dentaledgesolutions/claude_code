#!/usr/bin/env node
// scripts/brain/secondbrainbench-run.js — run a retrieval adapter over the
// generated questions, compare against the SEALED answers (read ONLY here, never
// by the adapter), score the five hard gates, and exit 0 iff all gates pass.
// Usage: secondbrainbench-run.js --adapter brain-kernel --mode smoke|standard
//        [--workspace <dir>] [--target <capsule>]
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getArg, hasFlag, scanSensitive } = require('./brain-lib');
const { renderReport, GATES, gatePass } = require('./secondbrainbench-report');

const ADAPTERS = { 'brain-kernel': './bench-brain-kernel-adapter' };

const adapterName = getArg(process.argv, '--adapter', 'brain-kernel');
const mode = getArg(process.argv, '--mode', 'smoke');
const target = getArg(process.argv, '--target', '.project-brain');
const workspace = getArg(process.argv, '--workspace');
if (!workspace) { console.error('secondbrainbench-run: --workspace <dir> required'); process.exit(1); }
if (!ADAPTERS[adapterName]) { console.error(`secondbrainbench-run: unknown adapter '${adapterName}'`); process.exit(1); }
const adapter = require(ADAPTERS[adapterName]);

// Build the workspace via the generator (synthetic for smoke, live copy for
// standard). --no-generate scores an existing workspace as-is (used to verify the
// gates actually fail on a tampered capsule).
if (!hasFlag(process.argv, '--no-generate')) {
  const genArgs = ['--out', workspace];
  if (mode === 'smoke') genArgs.push('--synthetic');
  else genArgs.push('--target', target);
  const gen = spawnSync('node', [path.join(__dirname, 'secondbrainbench-generate.js'), ...genArgs], { encoding: 'utf8' });
  if (gen.status !== 0) { console.error('secondbrainbench-run: generate failed:\n' + gen.stderr); process.exit(1); }
}

const capsule = path.join(workspace, 'capsule');
const questions = JSON.parse(fs.readFileSync(path.join(workspace, 'questions', 'questions.json'), 'utf8'));
const answers = JSON.parse(fs.readFileSync(path.join(workspace, 'answers', 'answers.json'), 'utf8'));
const ansById = new Map(answers.map(a => [a.id, a]));

const rows = [];
let recallSum = 0, precisionSum = 0, citedTotal = 0, citedOk = 0, leakage = 0, precedenceFailures = 0;
for (const q of questions) {
  const ans = ansById.get(q.id);
  const { paths, contents } = adapter.retrieve(capsule, q);
  const recallHit = ans.correct_paths.some(p => paths.includes(p));
  recallSum += recallHit ? 1 : 0;
  const relevant = new Set(ans.relevant_paths || ans.correct_paths);
  const relevantReturned = paths.filter(p => relevant.has(p)).length;
  precisionSum += paths.length ? relevantReturned / paths.length : 0;
  for (const p of paths) { citedTotal += 1; if (fs.existsSync(path.join(capsule, p))) citedOk += 1; }
  for (const c of contents) leakage += scanSensitive(c).length;
  let rankFirstOk = true;
  if (ans.must_rank_first) { rankFirstOk = paths[0] === ans.must_rank_first; if (!rankFirstOk) precedenceFailures += 1; }
  rows.push({ id: q.id, type: q.type, returned: paths, recall_hit: recallHit, must_rank_first: !!ans.must_rank_first, rank_first_ok: rankFirstOk });
}

const n = questions.length || 1;
const aggregate = {
  recall_at_5: recallSum / n,
  precision_at_5: precisionSum / n,
  citation_accuracy: citedTotal ? citedOk / citedTotal : 1,
  sensitive_leakage: leakage,
  canon_precedence_failures: precedenceFailures,
};
const results = { mode, adapter: adapterName, questions: rows, aggregate };

fs.mkdirSync(path.join(workspace, 'reports'), { recursive: true });
fs.writeFileSync(path.join(workspace, 'results.json'), JSON.stringify(results, null, 2) + '\n');
const md = renderReport(results);
fs.writeFileSync(path.join(workspace, 'reports', 'SECONDBRAINBENCH-REPORT.md'), md);
// Mirror into the capsule's report dir — fail open if no capsule.
try {
  const capReports = path.join(target, 'reports', 'brain-evals');
  fs.mkdirSync(capReports, { recursive: true });
  fs.writeFileSync(path.join(capReports, 'SECONDBRAINBENCH-REPORT.md'), md);
} catch { /* fail open */ }

const allPass = GATES.every(g => gatePass(g, aggregate[g.key]));
console.log(`secondbrainbench: ${allPass ? 'PASS' : 'FAIL'} — recall ${aggregate.recall_at_5.toFixed(2)} · precision ${aggregate.precision_at_5.toFixed(2)} · citation ${aggregate.citation_accuracy.toFixed(2)} · leakage ${aggregate.sensitive_leakage} · precedence_fails ${aggregate.canon_precedence_failures}`);
process.exit(allPass ? 0 : 1);
