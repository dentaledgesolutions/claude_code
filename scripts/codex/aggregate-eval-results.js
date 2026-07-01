#!/usr/bin/env node
/**
 * Reads all per-scenario result.json files in a Codex run directory,
 * computes the 5 native eval metrics (runner-computed footprint, not from Codex),
 * and writes aggregate-results.json + CODEX-EVAL-SUMMARY.md.
 *
 * Usage:
 *   node scripts/codex/aggregate-eval-results.js <run-dir> <target> <skill|agent> <mode>
 */
const { readFileSync, writeFileSync, readdirSync, existsSync } = require('fs');
const path = require('path');

const [,, runDir, target, targetType, mode] = process.argv;
if (!runDir || !target || !targetType || !mode) {
  console.error('Usage: aggregate-eval-results.js <run-dir> <target> <skill|agent> <mode>');
  process.exit(1);
}

// ── Load eval-spec for runner-computed footprint ─────────────────────────────
const specPath = path.join(runDir, 'eval-spec.json');
const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, 'utf8')) : {};
const footprint = spec.context_footprint || { lines: 0, tokens_est: 0 };

// ── Load per-scenario results ────────────────────────────────────────────────
const resultPaths = readdirSync(runDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => path.join(runDir, e.name, 'result.json'))
  .filter(existsSync);

if (!resultPaths.length) {
  console.error(`No result.json files found under ${runDir}`);
  process.exit(1);
}

const results = resultPaths.map(p => {
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { console.warn(`Skipping ${p}: ${e.message}`); return null; }
}).filter(Boolean);

const total = results.length;

// ── Load execution-result.json files (optional — only if execution phase ran) ─
const executionResults = readdirSync(runDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => path.join(runDir, e.name, 'execution-result.json'))
  .filter(existsSync)
  .map(p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } })
  .filter(Boolean);

const hasExecution = executionResults.length > 0;
const execPassCount = executionResults.filter(r => r.execution_pass).length;
const execution_pass_rate = hasExecution
  ? Math.round(execPassCount / executionResults.length * 100) : null;

// ── Eval Pass Rate ───────────────────────────────────────────────────────────
const eval_pass_rate = total > 0
  ? Math.round((results.filter(r => r.score >= 7).length / total) * 100) : 0;

// ── Trigger / Dispatch Accuracy ──────────────────────────────────────────────
const isSkill = targetType === 'skill';
const correctDecisions = results.filter(r => {
  const expected = isSkill ? r.expected_triggers : r.expected_dispatches;
  const actual   = isSkill ? r.codex_triggers    : r.codex_dispatches;
  return actual === expected;
}).length;
const accuracy = total > 0 ? Math.round((correctDecisions / total) * 100) : 0;

// ── Project Fit Score ────────────────────────────────────────────────────────
const FIT_TYPES = ['project-native', 'project-workflow', 'multi-turn'];
const fitResults = results.filter(r => FIT_TYPES.includes(r.scenario_type));
let project_fit_score;
if (mode === 'smoke') {
  project_fit_score = 'partial';
} else if (!fitResults.length) {
  project_fit_score = 'N/A';
} else {
  project_fit_score = Math.round(
    (fitResults.reduce((s, r) => s + r.score, 0) / fitResults.length) * 10
  ) / 10;
}

// ── Resilience Score ─────────────────────────────────────────────────────────
const adversarials = results.filter(r => r.scenario_type === 'adversarial');
const resilience_score = !adversarials.length ? 'N/A' :
  Math.round(
    (adversarials.filter(r => {
      const expected = isSkill ? r.expected_triggers : r.expected_dispatches;
      const actual   = isSkill ? r.codex_triggers    : r.codex_dispatches;
      return expected === false && actual === false;
    }).length / adversarials.length) * 10 * 10
  ) / 10;

// ── Analyst Summary ──────────────────────────────────────────────────────────
function flagged(flag) {
  return results.filter(r => r.analyst_flags && r.analyst_flags.includes(flag))
    .map(r => r.scenario_type);
}

const analyst_summary = {
  non_discriminating_scenarios: flagged('non_discriminating'),
  unstable_scenarios:           flagged('unstable'),
  adversarial_false_positives:  flagged('adversarial_false_positive'),
  multi_turn_redundancy:        flagged('multi_turn_redundancy'),
  tool_scope_violations:        flagged('tool_scope_violation'),
};

// ── Hard Failures ────────────────────────────────────────────────────────────
const hard_failures = results
  .filter(r => r.hard_failure)
  .map(r => r.hard_failure_reason || `hard failure in scenario ${r.scenario_id}`);

// ── Recommendation ───────────────────────────────────────────────────────────
let recommendation;
if (hard_failures.length) {
  recommendation = 'BLOCK';
} else if (eval_pass_rate < 60 || accuracy < 70) {
  recommendation = 'BLOCK';
} else if (eval_pass_rate < 80 || accuracy < 85 || analyst_summary.adversarial_false_positives.length) {
  recommendation = 'REFINE';
} else {
  recommendation = 'HEALTHY';
}

// ── Build metrics object ─────────────────────────────────────────────────────
const metrics = {
  eval_pass_rate,
  context_footprint_lines: footprint.lines,
  context_footprint_tokens_est: footprint.tokens_est,
  project_fit_score,
  resilience_score,
};
if (isSkill) metrics.trigger_accuracy  = accuracy;
else         metrics.dispatch_accuracy = accuracy;
if (hasExecution) metrics.execution_pass_rate = execution_pass_rate;

// ── Write aggregate-results.json ─────────────────────────────────────────────
const aggregate = {
  target,
  target_type: targetType,
  run_id: path.basename(runDir),
  mode,
  timestamp: new Date().toISOString(),
  scenario_count: total,
  context_footprint: footprint,
  hard_failures,
  metrics,
  analyst_summary,
  recommendation,
  ...(hasExecution ? { execution_summary: {
    scenarios_executed: executionResults.length,
    scenarios_passed: execPassCount,
    execution_pass_rate,
    execution_model: executionResults[0]?.execution_model || '',
    grader_model: executionResults[0]?.grader_model || '',
  }} : {}),
};
writeFileSync(path.join(runDir, 'aggregate-results.json'), JSON.stringify(aggregate, null, 2));

// ── Write CODEX-EVAL-SUMMARY.md ──────────────────────────────────────────────
const accuracyLabel = isSkill ? 'Trigger Accuracy' : 'Dispatch Accuracy';

function statusCell(val, threshold) {
  if (typeof val !== 'number') return String(val);
  return val >= threshold ? 'OK' : `BELOW (≥${threshold})`;
}

const scenarioDirs = readdirSync(runDir, { withFileTypes: true }).filter(e => e.isDirectory());

const summaryLines = [
  `# CODEX-EVAL-SUMMARY`,
  ``,
  `**Target:** ${target} (${targetType})  `,
  `**Run ID:** ${path.basename(runDir)}  `,
  `**Mode:** ${mode}  `,
  `**Timestamp:** ${aggregate.timestamp}  `,
  `**Scenarios evaluated:** ${total}  `,
  ``,
  `## Recommendation: ${recommendation}`,
  ``,
  `## Metrics`,
  ``,
  `| Metric | Value | Threshold | Status |`,
  `|--------|-------|-----------|--------|`,
  `| Eval Pass Rate | ${eval_pass_rate}% | ≥ 80% | ${statusCell(eval_pass_rate, 80)} |`,
  `| ${accuracyLabel} | ${accuracy}% | ≥ 85% | ${statusCell(accuracy, 85)} |`,
  `| Project Fit Score | ${project_fit_score}${typeof project_fit_score === 'number' ? '/10' : ''} | ≥ 7/10 | ${typeof project_fit_score === 'number' ? statusCell(project_fit_score, 7) : project_fit_score} |`,
  `| Resilience Score | ${resilience_score}${typeof resilience_score === 'number' ? '/10' : ''} | ≥ 8/10 | ${typeof resilience_score === 'number' ? statusCell(resilience_score, 8) : resilience_score} |`,
  `| Context Footprint | ${footprint.lines} lines / ~${footprint.tokens_est} tokens | informational | — |`,
  ``,
  `## Hard Failures`,
  hard_failures.length ? hard_failures.map(f => `- ${f}`).join('\n') : '_None_',
  ``,
  `## Analyst Findings`,
  ``,
  `- **Non-discriminating scenarios:** ${analyst_summary.non_discriminating_scenarios.join(', ') || 'none'}`,
  `- **Unstable scenarios:** ${analyst_summary.unstable_scenarios.join(', ') || 'none'}`,
  `- **Adversarial false positives:** ${analyst_summary.adversarial_false_positives.join(', ') || 'none'}`,
  `- **Multi-turn redundancy:** ${analyst_summary.multi_turn_redundancy.join(', ') || 'none'}`,
  `- **Tool scope violations:** ${analyst_summary.tool_scope_violations.join(', ') || 'none'}`,
  ``,
  ...(hasExecution ? [
    ``,
    `## Execution Phase`,
    ``,
    `> Behavioral test: Claude API called with ${isSkill ? 'skill' : 'agent'} as system prompt; output graded against assertions.`,
    `> Execution model: ${executionResults[0]?.execution_model || ''} | Grader: ${executionResults[0]?.grader_model || ''}`,
    ``,
    `| Metric | Value | Threshold | Status |`,
    `|--------|-------|-----------|--------|`,
    `| Execution Pass Rate | ${execution_pass_rate}% | ≥ 80% | ${statusCell(execution_pass_rate, 80)} |`,
    `| Scenarios executed | ${executionResults.length} of ${total} | positive triggers only | — |`,
    ``,
    `**Per-scenario:**`,
    ...executionResults.map(r => {
      const p = r.assertions_result.filter(a => a.passed).length;
      const t = r.assertions_result.length;
      return `- Scenario ${r.scenario_id} (${r.scenario_type}): ${r.score}/10 — ${t > 0 ? `${p}/${t} assertions` : 'no assertions'} — ${r.execution_pass ? 'PASS' : 'FAIL'}`;
    }),
  ] : []),
  ``,
  `## Scenario Result Paths`,
  ...scenarioDirs.map(e => `- \`${path.join(runDir, e.name, 'result.json')}\``),
  ``,
  `## Trace Paths (evidence only — do not parse for scores)`,
  ...scenarioDirs.map(e => `- \`${path.join(runDir, e.name, 'trace.jsonl')}\``),
  ``,
];
writeFileSync(path.join(runDir, 'CODEX-EVAL-SUMMARY.md'), summaryLines.join('\n'));

console.log(`Aggregated ${total} scenarios for ${target} (${mode} mode).`);
console.log(`Recommendation: ${recommendation}`);
console.log(`Summary: ${path.join(runDir, 'CODEX-EVAL-SUMMARY.md')}`);
