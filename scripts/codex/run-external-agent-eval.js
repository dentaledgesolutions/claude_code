#!/usr/bin/env node
/**
 * External Codex scenario evaluator for agents.
 * DRY-RUN BY DEFAULT. Use --live to actually call Codex.
 *
 * Usage:
 *   node scripts/codex/run-external-agent-eval.js <agent> [--mode smoke|standard|full] [--live]
 *
 * Without --live: creates dirs, writes eval-spec.json, command-preview.sh,
 *                 and per-scenario prompt.txt. No Codex call. No credits spent.
 * With --live:    calls codex exec per scenario, writes result.json and
 *                 trace.jsonl, then aggregates results.
 */
const { spawnSync } = require('child_process');
const { mkdirSync, writeFileSync, readFileSync, existsSync } = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const agentName = args.find(a => !a.startsWith('-'));
const isLive = args.includes('--live');
const isHelp = args.includes('--help') || args.includes('-h');
const modeIdx = args.indexOf('--mode');
const mode = modeIdx >= 0 ? args[modeIdx + 1] : 'standard';

if (isHelp || !agentName) {
  console.log([
    'Usage: node scripts/codex/run-external-agent-eval.js <agent> [OPTIONS]',
    '',
    'Options:',
    '  --mode smoke|standard|full   Evaluation depth (default: standard)',
    '  --live                       Call Codex and spend API credits (default: dry-run)',
    '  --help                       Show this help',
    '',
    'DRY-RUN IS THE DEFAULT. Use --live only when ready to spend API credits.',
    '',
    'Modes:',
    '  smoke     direct, negative, adversarial, project-native (1 rep, partial project fit)',
    '  standard  all 9 scenario types (1 rep, complete metrics)',
    '  full      all 9 types (3 reps for trigger-sensitive scenarios)',
    '',
    'Examples:',
    '  node scripts/codex/run-external-agent-eval.js skill-eval-agent --mode smoke',
    '  node scripts/codex/run-external-agent-eval.js skill-eval-agent --mode smoke --live',
  ].join('\n'));
  process.exit(isHelp ? 0 : 1);
}

// ── Validate inputs ──────────────────────────────────────────────────────────

const evalsPath = path.join('evals', 'agents', agentName, 'evals.json');
if (!existsSync(evalsPath)) {
  console.error(`Error: ${evalsPath} not found.`);
  console.error(`Generate it first:`);
  console.error(`  node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/${agentName}.md --context evals/project-context.json`);
  process.exit(1);
}

const agentPath = path.join('.claude', 'agents', `${agentName}.md`);
if (!existsSync(agentPath)) {
  console.error(`Error: ${agentPath} not found.`);
  process.exit(1);
}

// ── Compute Context Footprint (runner-computed, not from Codex) ───────────────

function countLines(p) {
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').length : 0;
}

const footprintLines = countLines(agentPath);
const footprintTokensEst = footprintLines * 4;

// ── Mode filtering ───────────────────────────────────────────────────────────

const SMOKE_TYPES = new Set(['direct', 'negative', 'adversarial', 'project-native']);
const MULTI_REP_TYPES = new Set(['direct', 'paraphrased', 'semantic', 'negative', 'adversarial']);

const evalData = JSON.parse(readFileSync(evalsPath, 'utf8'));
let scenarios = evalData.evals || [];
if (mode === 'smoke') scenarios = scenarios.filter(s => SMOKE_TYPES.has(s.type));

const agentContent = readFileSync(agentPath, 'utf8');
const schemaPath = 'schemas/codex/codex-agent-scenario-result.schema.json';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join('evals', 'codex-runs', 'agents', agentName, runId);
mkdirSync(runDir, { recursive: true });

// ── Build tasks (with repetitions for full mode) ─────────────────────────────

const tasks = [];
for (const s of scenarios) {
  const reps = (mode === 'full' && MULTI_REP_TYPES.has(s.type)) ? 3 : 1;
  for (let rep = 1; rep <= reps; rep++) {
    const suffix = reps > 1 ? `-rep${rep}` : '';
    tasks.push({
      scenario: s,
      dir: path.join(runDir, `${String(s.id).padStart(2, '0')}-${s.type}${suffix}`),
    });
  }
}

// ── Write eval-spec.json ─────────────────────────────────────────────────────

const evalSpec = {
  target: agentName,
  target_type: 'agent',
  run_id: runId,
  mode,
  live_run: isLive,
  timestamp: new Date().toISOString(),
  scenario_count: tasks.length,
  context_footprint: { lines: footprintLines, tokens_est: footprintTokensEst },
  project_fit_note: mode === 'smoke'
    ? 'partial — project-workflow and multi-turn not in smoke mode'
    : 'complete',
  scenarios: tasks.map(t => ({
    id: t.scenario.id,
    type: t.scenario.type,
    dir: t.dir,
    expected_dispatches: t.scenario.expected.dispatches,
  })),
};
writeFileSync(path.join(runDir, 'eval-spec.json'), JSON.stringify(evalSpec, null, 2));

// ── Build prompts and command preview ────────────────────────────────────────

function buildPrompt(s, agentContent, agentPath) {
  const word = s.expected.dispatches ? 'SHOULD be dispatched' : 'should NOT be dispatched';
  const assertList = (s.expected.assertions || []).map(a => `    - ${a}`).join('\n');
  return [
    `You are an independent second-model evaluator for Claude Code agents.`,
    `Do NOT call any tools. Do NOT run any commands. Do NOT write any files.`,
    `Do NOT initiate skill-eval, agent-eval, agent-refine, or any lifecycle step.`,
    `This is a read-only, independent evaluation.`,
    ``,
    `# Agent definition`,
    `Path: ${agentPath}`,
    ``,
    agentContent,
    ``,
    `# Scenario`,
    `Type: ${s.type}`,
    `User prompt: "${s.prompt}"`,
    `Expected: This agent ${word} (via the Agent tool) for this prompt.`,
    assertList ? `Assertions (if dispatched):\n${assertList}` : '',
    ``,
    `# Instructions`,
    `1. Read the agent definition. Would this agent be dispatched for the prompt above?`,
    `2. Score 0–10 (same rubric as skill eval): 10=correct+all assertions, 0=opposite of expected.`,
    `3. For adversarial/negative: score 10 if correctly NOT dispatched; score 0 if dispatched.`,
    `4. Set codex_dispatches to true or false based on your assessment.`,
    `5. Flag: non_discriminating, unstable, adversarial_false_positive, multi_turn_redundancy, tool_scope_violation.`,
    `6. Set hard_failure=true ONLY for: lifecycle ownership attempt, security bypass, review-gate loop risk, tool-scope policy breach.`,
    `7. Respond with JSON matching the output schema. expected_dispatches=${s.expected.dispatches}.`,
  ].filter(Boolean).join('\n');
}

const previewLines = ['#!/usr/bin/env bash', '# Codex agent eval command preview — review before running with --live', ''];
for (const { scenario, dir } of tasks) {
  mkdirSync(dir, { recursive: true });
  const prompt = buildPrompt(scenario, agentContent, agentPath);
  writeFileSync(path.join(dir, 'prompt.txt'), prompt);
  previewLines.push(
    `# Scenario ${scenario.id}: ${scenario.type}`,
    `codex exec \\`,
    `  --json --sandbox read-only \\`,
    `  --output-schema ${schemaPath} \\`,
    `  -o "${path.join(dir, 'result.json')}" \\`,
    `  "$(cat '${path.join(dir, 'prompt.txt')}')" \\`,
    `  > "${path.join(dir, 'trace.jsonl')}"`,
    '',
  );
}
writeFileSync(path.join(runDir, 'command-preview.sh'), previewLines.join('\n'));

console.log(`\nRun dir: ${runDir}`);
console.log(`Scenarios: ${tasks.length} | Mode: ${mode} | Context: ${footprintLines} lines (~${footprintTokensEst} tokens)`);
console.log(`project_fit note: ${evalSpec.project_fit_note}`);

if (!isLive) {
  console.log('\nDry-run complete. No Codex calls made.');
  console.log(`Review: ${path.join(runDir, 'command-preview.sh')}`);
  console.log('Add --live to execute.');
  process.exit(0);
}

// ── Live execution ───────────────────────────────────────────────────────────

console.log('\nRunning live Codex evaluations...');
for (const { scenario, dir } of tasks) {
  const prompt = readFileSync(path.join(dir, 'prompt.txt'), 'utf8');
  console.log(`\nScenario ${scenario.id} (${scenario.type})...`);

  const r = spawnSync('codex', [
    'exec', '--json', '--sandbox', 'read-only',
    '--output-schema', schemaPath,
    '-o', path.join(dir, 'result.json'),
    prompt,
  ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });

  if (r.error) { console.error(`  error: ${r.error.message}`); continue; }
  writeFileSync(path.join(dir, 'trace.jsonl'), r.stdout || '');

  if (existsSync(path.join(dir, 'result.json'))) {
    try {
      const res = JSON.parse(readFileSync(path.join(dir, 'result.json'), 'utf8'));
      const correct = res.codex_dispatches === scenario.expected.dispatches;
      console.log(`  Score: ${res.score}/10 | Dispatches: ${res.codex_dispatches} (expected: ${scenario.expected.dispatches}) | ${correct ? 'OK' : 'WRONG'}`);
      if (res.hard_failure) console.error(`  HARD FAILURE: ${res.hard_failure_reason}`);
    } catch (e) { console.warn(`  result.json parse error: ${e.message}`); }
  } else {
    console.warn(`  result.json not written — check trace.jsonl`);
  }
}

const aggResult = spawnSync('node', [
  'scripts/codex/aggregate-eval-results.js', runDir, agentName, 'agent', mode,
], { encoding: 'utf8', stdio: 'inherit' });

if (aggResult.status !== 0) {
  console.error('Aggregator failed.');
  process.exit(1);
}
console.log(`\nRead summary: cat "${path.join(runDir, 'CODEX-EVAL-SUMMARY.md')}"`);
