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
