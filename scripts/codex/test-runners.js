#!/usr/bin/env node
/**
 * Tests for: aggregator deterministic scoring, runner --help, runner dry-run.
 * All tests run without calling Codex. No API credits spent.
 */
const { spawnSync } = require('child_process');
const { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = require('fs');
const path = require('path');
let ok = true;

function test(label, fn) {
  try { fn(); console.log(`PASS ${label}`); }
  catch (e) { console.error(`FAIL ${label}: ${e.message}`); ok = false; }
}

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeResult(overrides) {
  return {
    scenario_id: 1,
    scenario_type: 'direct',
    expected_triggers: true,
    codex_triggers: true,
    score: 9,
    assertions_result: [{ assertion: 'skill triggers', passed: true }],
    analyst_flags: [],
    hard_failure: false,
    notes: '',
    ...overrides,
  };
}

function makeSpec(footprintLines = 200) {
  return { context_footprint: { lines: footprintLines, tokens_est: footprintLines * 4 } };
}

function setupFixture(fixtureDir, results, footprintLines = 200) {
  if (existsSync(fixtureDir)) rmSync(fixtureDir, { recursive: true });
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(path.join(fixtureDir, 'eval-spec.json'), JSON.stringify(makeSpec(footprintLines)));
  results.forEach((r, i) => {
    const d = path.join(fixtureDir, `0${i + 1}-${r.scenario_type}`);
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, 'result.json'), JSON.stringify(r));
  });
}

function runAgg(fixtureDir, target, type, mode) {
  const r = spawnSync('node', [
    'scripts/codex/aggregate-eval-results.js', fixtureDir, target, type, mode
  ], { stdio: 'pipe', encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || 'aggregator exited non-zero');
  return JSON.parse(readFileSync(path.join(fixtureDir, 'aggregate-results.json'), 'utf8'));
}

// ── Aggregator fixture tests ─────────────────────────────────────────────────

test('aggregator: all PASS → HEALTHY', () => {
  const dir = 'evals/codex-runs/.test/healthy';
  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct',        expected_triggers: true,  codex_triggers: true,  score: 9 }),
    makeResult({ scenario_id: 4, scenario_type: 'negative',      expected_triggers: false, codex_triggers: false, score: 10 }),
    makeResult({ scenario_id: 6, scenario_type: 'adversarial',   expected_triggers: false, codex_triggers: false, score: 10 }),
    makeResult({ scenario_id: 7, scenario_type: 'project-native', expected_triggers: true,  codex_triggers: true,  score: 8 }),
  ]);
  const agg = runAgg(dir, 'skill-eval', 'skill', 'smoke');
  if (agg.recommendation !== 'HEALTHY') throw new Error(`Expected HEALTHY, got ${agg.recommendation}`);
  if (agg.metrics.eval_pass_rate < 80) throw new Error(`Pass rate too low: ${agg.metrics.eval_pass_rate}`);
  if (agg.metrics.project_fit_score !== 'partial') throw new Error('Smoke mode should mark project_fit_score as partial');
});

test('aggregator: low pass rate → REFINE', () => {
  const dir = 'evals/codex-runs/.test/refine';
  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct',            expected_triggers: true,  codex_triggers: true,  score: 9 }),
    makeResult({ scenario_id: 2, scenario_type: 'paraphrased',       expected_triggers: true,  codex_triggers: false, score: 0 }),
    makeResult({ scenario_id: 3, scenario_type: 'edge_case',         expected_triggers: true,  codex_triggers: false, score: 0 }),
    makeResult({ scenario_id: 4, scenario_type: 'negative',          expected_triggers: false, codex_triggers: false, score: 10 }),
    makeResult({ scenario_id: 5, scenario_type: 'semantic',          expected_triggers: true,  codex_triggers: false, score: 0 }),
    makeResult({ scenario_id: 6, scenario_type: 'adversarial',       expected_triggers: false, codex_triggers: false, score: 10 }),
    makeResult({ scenario_id: 7, scenario_type: 'project-native',    expected_triggers: true,  codex_triggers: false, score: 0 }),
    makeResult({ scenario_id: 8, scenario_type: 'project-workflow',  expected_triggers: true,  codex_triggers: true,  score: 8 }),
    makeResult({ scenario_id: 9, scenario_type: 'multi-turn',        expected_triggers: true,  codex_triggers: true,  score: 7 }),
  ]);
  const agg = runAgg(dir, 'skill-eval', 'skill', 'standard');
  if (!['REFINE', 'BLOCK'].includes(agg.recommendation))
    throw new Error(`Expected REFINE or BLOCK, got ${agg.recommendation}`);
});

test('aggregator: hard failure → BLOCK', () => {
  const dir = 'evals/codex-runs/.test/block';
  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct', score: 9,
      hard_failure: true, hard_failure_reason: 'skill attempted lifecycle ownership' }),
  ]);
  const agg = runAgg(dir, 'skill-eval', 'skill', 'standard');
  if (agg.recommendation !== 'BLOCK') throw new Error(`Expected BLOCK, got ${agg.recommendation}`);
  if (!agg.hard_failures.length) throw new Error('hard_failures should be populated');
});

test('aggregator: adversarial false positive → REFINE', () => {
  const dir = 'evals/codex-runs/.test/adversarial-fp';
  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct',      expected_triggers: true,  codex_triggers: true,  score: 9 }),
    makeResult({ scenario_id: 6, scenario_type: 'adversarial', expected_triggers: false, codex_triggers: true,  score: 0,
      analyst_flags: ['adversarial_false_positive'] }),
  ]);
  const agg = runAgg(dir, 'skill-eval', 'skill', 'standard');
  if (!['REFINE', 'BLOCK'].includes(agg.recommendation))
    throw new Error(`Expected REFINE or BLOCK, got ${agg.recommendation}`);
  if (!agg.analyst_summary.adversarial_false_positives.length)
    throw new Error('adversarial_false_positives not captured');
});

test('aggregator: CODEX-EVAL-SUMMARY.md is written', () => {
  const dir = 'evals/codex-runs/.test/summary-check';
  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct', score: 9 }),
  ]);
  runAgg(dir, 'skill-eval', 'skill', 'standard');
  if (!existsSync(path.join(dir, 'CODEX-EVAL-SUMMARY.md')))
    throw new Error('CODEX-EVAL-SUMMARY.md not written');
  const content = readFileSync(path.join(dir, 'CODEX-EVAL-SUMMARY.md'), 'utf8');
  if (!content.includes('Recommendation:')) throw new Error('Summary missing Recommendation');
  if (!content.includes('Context Footprint')) throw new Error('Summary missing Context Footprint');
});

test('aggregator: execution-result.json included in summary', () => {
  const dir = 'evals/codex-runs/.test/execution';
  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct', expected_triggers: true, codex_triggers: true, score: 9 }),
  ]);
  writeFileSync(path.join(dir, '01-direct', 'execution-result.json'), JSON.stringify({
    scenario_id: 1, scenario_type: 'direct',
    execution_model: 'claude-haiku-4-5-20251001', grader_model: 'claude-sonnet-4-6',
    response_preview: 'I will help set up the project...',
    assertions_result: [{ assertion: 'skill triggers', passed: true, notes: 'response confirms activation' }],
    score: 9, execution_pass: true, notes: '',
  }));
  runAgg(dir, 'skill-eval', 'skill', 'standard');
  const summary = readFileSync(path.join(dir, 'CODEX-EVAL-SUMMARY.md'), 'utf8');
  if (!summary.includes('Execution Phase')) throw new Error('Summary missing Execution Phase section');
  const agg = JSON.parse(readFileSync(path.join(dir, 'aggregate-results.json'), 'utf8'));
  if (agg.metrics.execution_pass_rate === undefined) throw new Error('execution_pass_rate missing from metrics');
  if (agg.metrics.execution_pass_rate !== 100) throw new Error(`Expected 100%, got ${agg.metrics.execution_pass_rate}%`);
});

// ── Gap 3: Risk stratification ───────────────────────────────────────────────

test('aggregator: critical tier raises thresholds — 89% → REFINE, standard → HEALTHY', () => {
  const results = [];
  for (let i = 1; i <= 8; i++) {
    results.push(makeResult({ scenario_id: i, scenario_type: 'direct', expected_triggers: true, codex_triggers: true, score: 9 }));
  }
  results.push(makeResult({ scenario_id: 9, scenario_type: 'paraphrased', expected_triggers: true, codex_triggers: false, score: 0 }));

  const critDir = 'evals/codex-runs/.test/critical-tier';
  setupFixture(critDir, results, 200);
  const critSpec = { context_footprint: { lines: 200, tokens_est: 800 }, risk_tier: 'critical' };
  const { writeFileSync: wf } = require('fs');
  wf(path.join(critDir, 'eval-spec.json'), JSON.stringify(critSpec));
  const critAgg = runAgg(critDir, 'skill-audit', 'skill', 'standard');
  // eval_pass_rate=89, trigger_accuracy=89 — both < 90/95 critical thresholds
  if (critAgg.recommendation !== 'REFINE')
    throw new Error(`Critical tier: expected REFINE, got ${critAgg.recommendation}`);

  const stdDir = 'evals/codex-runs/.test/critical-tier-std';
  setupFixture(stdDir, results, 200);
  const stdSpec = { context_footprint: { lines: 200, tokens_est: 800 }, risk_tier: 'standard' };
  wf(path.join(stdDir, 'eval-spec.json'), JSON.stringify(stdSpec));
  const stdAgg = runAgg(stdDir, 'skill-audit', 'skill', 'standard');
  // 89% passes standard 80%/85% thresholds
  if (stdAgg.recommendation !== 'HEALTHY')
    throw new Error(`Standard tier: expected HEALTHY, got ${stdAgg.recommendation}`);
});

// ── Gap 4: Trigger accuracy positive-only ────────────────────────────────────

test('aggregator: trigger accuracy only counts positive-expected scenarios', () => {
  const dir = 'evals/codex-runs/.test/accuracy-positive-only';
  setupFixture(dir, [
    // 3 positive-expected: 2 correct, 1 wrong
    makeResult({ scenario_id: 1, scenario_type: 'direct',      expected_triggers: true,  codex_triggers: true,  score: 9 }),
    makeResult({ scenario_id: 2, scenario_type: 'paraphrased', expected_triggers: true,  codex_triggers: true,  score: 8 }),
    makeResult({ scenario_id: 3, scenario_type: 'edge_case',   expected_triggers: true,  codex_triggers: false, score: 0 }),
    // 3 non-positive: all correct — must NOT count toward trigger_accuracy
    makeResult({ scenario_id: 4, scenario_type: 'negative',    expected_triggers: false, codex_triggers: false, score: 10 }),
    makeResult({ scenario_id: 5, scenario_type: 'adversarial', expected_triggers: false, codex_triggers: false, score: 10 }),
    makeResult({ scenario_id: 6, scenario_type: 'adversarial', expected_triggers: false, codex_triggers: false, score: 10 }),
  ]);
  const agg = runAgg(dir, 'skill-eval', 'skill', 'standard');
  // positive-only: 2/3 = 67%; old all-scenarios: 5/6 = 83%
  if (agg.metrics.trigger_accuracy !== 67)
    throw new Error(`Expected trigger_accuracy=67 (positive-only), got ${agg.metrics.trigger_accuracy}`);
  if (!['REFINE', 'BLOCK'].includes(agg.recommendation))
    throw new Error(`67% accuracy should produce REFINE or BLOCK, got ${agg.recommendation}`);
});

// ── Gap 6: Regression detection ──────────────────────────────────────────────

test('aggregator: writes codex-baseline.json on HEALTHY result', () => {
  const dir = 'evals/codex-runs/.test/baseline-write';
  const baselinePath = path.join('evals', 'skill-eval', 'codex-baseline.json');
  const { rmSync: rm, existsSync: ex } = require('fs');
  if (ex(baselinePath)) rm(baselinePath);

  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct',      expected_triggers: true,  codex_triggers: true,  score: 9 }),
    makeResult({ scenario_id: 4, scenario_type: 'negative',    expected_triggers: false, codex_triggers: false, score: 10 }),
    makeResult({ scenario_id: 6, scenario_type: 'adversarial', expected_triggers: false, codex_triggers: false, score: 10 }),
  ]);
  const agg = runAgg(dir, 'skill-eval', 'skill', 'standard');
  if (agg.recommendation !== 'HEALTHY') throw new Error(`Expected HEALTHY, got ${agg.recommendation}`);
  if (!existsSync(baselinePath)) throw new Error('codex-baseline.json not written');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (!baseline.metrics) throw new Error('baseline missing metrics');
  if (baseline.risk_tier !== 'standard') throw new Error('baseline missing risk_tier');
});

test('aggregator: regression detection warns on metric decline', () => {
  const dir = 'evals/codex-runs/.test/regression-check';
  const baselinePath = path.join('evals', 'skill-eval', 'codex-baseline.json');
  const { mkdirSync: mkdir } = require('fs');

  // Write a high-score baseline
  mkdir('evals/skill-eval', { recursive: true });
  writeFileSync(baselinePath, JSON.stringify({
    target: 'skill-eval',
    metrics: { eval_pass_rate: 100, trigger_accuracy: 100, project_fit_score: 9, resilience_score: 10 },
  }));

  // Run with lower scores: 1/2 positive correct = 50% accuracy, 1/2 pass = 50% pass rate
  setupFixture(dir, [
    makeResult({ scenario_id: 1, scenario_type: 'direct',      expected_triggers: true,  codex_triggers: true,  score: 9 }),
    makeResult({ scenario_id: 2, scenario_type: 'paraphrased', expected_triggers: true,  codex_triggers: false, score: 0 }),
  ]);
  const agg = runAgg(dir, 'skill-eval', 'skill', 'standard');
  if (!agg.regressions || !agg.regressions.length)
    throw new Error('Expected regressions to be detected');
  const r = agg.regressions.find(x => x.metric === 'eval_pass_rate');
  if (!r) throw new Error('eval_pass_rate regression not found');
  if (r.severity !== 'REGRESSION') throw new Error(`Expected REGRESSION severity, got ${r.severity}`);
  const summary = readFileSync(path.join(dir, 'CODEX-EVAL-SUMMARY.md'), 'utf8');
  if (!summary.includes('Regression Warnings')) throw new Error('Summary missing Regression Warnings section');
});

// ── Runner tests (conditional on runners existing) ───────────────────────────

function runnerExists(name) {
  return existsSync(`scripts/codex/${name}`);
}

if (runnerExists('run-external-skill-eval.js')) {
  test('run-external-skill-eval --help exits 0', () => {
    const r = spawnSync('node', ['scripts/codex/run-external-skill-eval.js', '--help'], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`--help exited ${r.status}`);
  });
  test('run-external-skill-eval smoke dry-run (default) creates artifacts', () => {
    const r = spawnSync('node', ['scripts/codex/run-external-skill-eval.js', 'skill-scout', '--mode', 'smoke'], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || `exited ${r.status}`);
    const base = 'evals/codex-runs/skills/skill-scout';
    if (!existsSync(base)) throw new Error('output dir not created');
    const runs = require('fs').readdirSync(base).sort();
    const runDir = path.join(base, runs[runs.length - 1]);
    if (!existsSync(path.join(runDir, 'eval-spec.json'))) throw new Error('eval-spec.json missing');
    if (!existsSync(path.join(runDir, 'command-preview.sh'))) throw new Error('command-preview.sh missing');
    const spec = JSON.parse(readFileSync(path.join(runDir, 'eval-spec.json'), 'utf8'));
    if (spec.live_run !== false) throw new Error('dry-run default: live_run should be false');
  });
}

if (runnerExists('run-external-agent-eval.js')) {
  test('run-external-agent-eval --help exits 0', () => {
    const r = spawnSync('node', ['scripts/codex/run-external-agent-eval.js', '--help'], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`--help exited ${r.status}`);
  });
  test('run-external-agent-eval smoke dry-run (default) creates artifacts', () => {
    const r = spawnSync('node', ['scripts/codex/run-external-agent-eval.js', 'skill-eval-agent', '--mode', 'smoke'], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || `exited ${r.status}`);
    const base = 'evals/codex-runs/agents/skill-eval-agent';
    if (!existsSync(base)) throw new Error('output dir not created');
    const runs = require('fs').readdirSync(base).sort();
    const runDir = path.join(base, runs[runs.length - 1]);
    if (!existsSync(path.join(runDir, 'eval-spec.json'))) throw new Error('eval-spec.json missing');
  });
}

if (runnerExists('run-execution-phase.js')) {
  test('run-execution-phase no args exits non-zero with usage', () => {
    const r = spawnSync('node', ['scripts/codex/run-execution-phase.js'], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status === 0) throw new Error('Expected non-zero exit with no args');
    if (!r.stdout.includes('Usage')) throw new Error('Expected usage message in stdout');
  });
  test('run-execution-phase missing ANTHROPIC_API_KEY exits 1', () => {
    const env = { ...process.env, ANTHROPIC_API_KEY: '' };
    const r = spawnSync('node', ['scripts/codex/run-execution-phase.js', 'some-dir', 'skill-eval', 'skill'],
      { stdio: 'pipe', encoding: 'utf8', env });
    if (r.status !== 1) throw new Error(`Expected exit 1, got ${r.status}`);
    if (!r.stderr.includes('ANTHROPIC_API_KEY')) throw new Error('Expected API key error in stderr');
  });
}

process.exit(ok ? 0 : 1);
