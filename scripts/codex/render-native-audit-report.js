#!/usr/bin/env node
/**
 * Reads audit-spec.json + result.json from a native-audit run directory,
 * computes the escalation label locally (never trusted from Codex's own output —
 * same philosophy as aggregate-eval-results.js computing "recommendation" itself),
 * and writes NATIVE-AUDIT-REPORT.md.
 *
 * Standalone and independently testable — no Codex call required. Feed it a fixture
 * result.json + audit-spec.json and it will render deterministically.
 *
 * Usage:
 *   node scripts/codex/render-native-audit-report.js <run-dir>
 */
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

const [,, runDir] = process.argv;
if (!runDir) {
  console.error('Usage: node scripts/codex/render-native-audit-report.js <run-dir>');
  process.exit(1);
}

const specPath = path.join(runDir, 'audit-spec.json');
const resultPath = path.join(runDir, 'result.json');

if (!existsSync(specPath)) {
  console.error(`Error: ${specPath} not found.`);
  process.exit(1);
}
if (!existsSync(resultPath)) {
  console.error(`Error: ${resultPath} not found.`);
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
let result;
try {
  result = JSON.parse(readFileSync(resultPath, 'utf8'));
} catch (e) {
  console.error(`Error: ${resultPath} is not valid JSON: ${e.message}`);
  process.exit(1);
}

// ── Escalation — computed locally, not read from result.json ─────────────────
const findings = result.audit_findings || [];
const hasCritical = findings.some(f => f.severity === 'critical');
const hasMajor = findings.some(f => f.severity === 'major');

let escalation;
if (result.hard_failure || result.native_conclusion_supported === false || hasCritical) {
  escalation = 'MANUAL_REVIEW_REQUIRED';
} else if (hasMajor) {
  escalation = 'REVIEW_SUGGESTED';
} else {
  escalation = 'NONE';
}

// ── Render ─────────────────────────────────────────────────────────────────

const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
const sortedFindings = [...findings].sort(
  (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
);

const checklist = result.checklist || [];
const checklistTable = checklist.length
  ? [
      '| Check | Result | Notes |',
      '|-------|--------|-------|',
      ...checklist.map(c => `| ${c.check} | ${c.result} | ${(c.notes || '').replace(/\|/g, '\\|')} |`),
    ].join('\n')
  : '_No checklist items returned._';

const findingsTable = sortedFindings.length
  ? [
      '| Severity | Type | Scenario IDs | Description | Evidence |',
      '|----------|------|--------------|--------------|----------|',
      ...sortedFindings.map(f =>
        `| ${f.severity} | ${f.finding_type} | ${(f.scenario_ids || []).join(', ') || '—'} | ${(f.description || '').replace(/\|/g, '\\|')} | "${(f.evidence_quote || '').replace(/\|/g, '\\|').slice(0, 200)}" |`
      ),
    ].join('\n')
  : '_No findings reported._';

const transcriptPaths = (spec.scenarios || [])
  .filter(s => s.transcript_included)
  .map(s => `- \`${path.join(s.dir, 'with_skill', 'output.md')}\` / \`${path.join(s.dir, 'with_agent', 'output.md')}\` (scenario ${s.id}, ${s.type})`);

const lines = [
  `# NATIVE-AUDIT-REPORT`,
  ``,
  `**Target:** ${spec.target} (${spec.target_type})  `,
  `**Run ID:** ${spec.run_id}  `,
  `**Native iteration audited:** ${spec.native_run_iteration}  `,
  `**Timestamp:** ${new Date().toISOString()}  `,
  `**Scenarios reviewed:** ${(spec.scenarios || []).length}${spec.all_reps ? ' (all reps)' : ' (1 rep per scenario id)'}  `,
  ``,
  `## Escalation: ${escalation}`,
  ``,
  `**Native report's own recommendation:** ${spec.native_recommendation || result.native_recommendation || 'unknown'}  `,
  `**Codex native-conclusion-supported:** ${result.native_conclusion_supported}  `,
  `**Audit confidence:** ${result.audit_confidence || 'unknown'}  `,
  ``,
  escalation !== 'NONE'
    ? `> This escalation overrides any HEALTHY/PASS agreement between the native eval and the cold-prediction Codex eval — route to MANUAL REVIEW regardless of the disagreement-policy 2×2 outcome. Evidence, not an auto-BLOCK; Claude Code remains the final decision-maker.`
    : `> No override triggered — this audit's findings do not conflict with the existing disagreement-policy routing.`,
  ``,
  `## Checklist`,
  ``,
  checklistTable,
  ``,
  `## Findings`,
  ``,
  findingsTable,
  ``,
  `## Native-Conclusion Assessment`,
  ``,
  result.native_conclusion_assessment || '_None provided._',
  ``,
  `## Hard Failure`,
  ``,
  result.hard_failure ? `**HARD FAILURE:** ${result.hard_failure_reason}` : '_None._',
  ``,
  `## Transcripts Reviewed`,
  ``,
  transcriptPaths.length ? transcriptPaths.join('\n') : '_None._',
  ``,
  `## Notes`,
  ``,
  result.notes || '_None._',
  ``,
];

writeFileSync(path.join(runDir, 'NATIVE-AUDIT-REPORT.md'), lines.join('\n'));

console.log(`Escalation: ${escalation}`);
console.log(`Report: ${path.join(runDir, 'NATIVE-AUDIT-REPORT.md')}`);
