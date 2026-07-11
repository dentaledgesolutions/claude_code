#!/usr/bin/env node
// scripts/brain/secondbrainbench-report.js — render a SecondBrainBench results.json
// into a gate-table Markdown report. Exports renderReport() for the runner; also a
// standalone CLI: secondbrainbench-report.js --results <file>.
'use strict';
const fs = require('fs');
const { getArg } = require('./brain-lib');

// The five hard gates (spec §6 Phase 7). leakage/failures must equal 0; the rest
// are floors.
const GATES = [
  { key: 'recall_at_5', label: 'Recall@5', gate: 0.90, floor: true },
  { key: 'precision_at_5', label: 'Precision@5', gate: 0.45, floor: true },
  { key: 'citation_accuracy', label: 'Citation accuracy', gate: 0.90, floor: true },
  { key: 'sensitive_leakage', label: 'Sensitive leakage', gate: 0, floor: false },
  { key: 'canon_precedence_failures', label: 'Canon-precedence failures', gate: 0, floor: false },
];
function gatePass(g, v) { return g.floor ? v >= g.gate : v === g.gate; }
function fmt(g, v) { return g.floor ? Number(v).toFixed(3) : String(v); }

function renderReport(results) {
  const a = results.aggregate;
  const gateRows = GATES.map(g =>
    `| ${g.label} | ${fmt(g, a[g.key])} | ${g.floor ? '≥ ' + g.gate : '= ' + g.gate} | ${gatePass(g, a[g.key]) ? 'PASS' : 'FAIL'} |`);
  const allPass = GATES.every(g => gatePass(g, a[g.key]));

  const byType = {};
  for (const r of results.questions) (byType[r.type] = byType[r.type] || []).push(r);
  const typeRows = Object.entries(byType).map(([t, rs]) =>
    `| ${t} | ${rs.length} | ${rs.filter(r => r.recall_hit).length}/${rs.length} |`);

  const failed = results.questions.filter(r => !r.recall_hit || (r.must_rank_first && !r.rank_first_ok));
  const failLines = failed.map(r =>
    `- Q${r.id} (${r.type}): recall_hit=${r.recall_hit}` +
    (r.must_rank_first ? `, rank_first_ok=${r.rank_first_ok}` : '') +
    `, returned=${JSON.stringify(r.returned)}`);

  return `# SecondBrainBench Report

**Mode:** ${results.mode} · **Adapter:** ${results.adapter} · **Questions:** ${results.questions.length} · **Overall:** ${allPass ? 'PASS ✅' : 'FAIL ❌'}

## Gates
| Metric | Value | Gate | Result |
|---|---|---|---|
${gateRows.join('\n')}

## Per-type recall
| Type | Questions | Recall hits |
|---|---|---|
${typeRows.join('\n')}

## Failed questions
${failLines.length ? failLines.join('\n') : '- none'}
`;
}

module.exports = { renderReport, GATES, gatePass };

if (require.main === module) {
  const rf = getArg(process.argv, '--results');
  if (!rf) { console.error('secondbrainbench-report: --results <file> required'); process.exit(1); }
  process.stdout.write(renderReport(JSON.parse(fs.readFileSync(rf, 'utf8'))));
}
