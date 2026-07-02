#!/usr/bin/env node
/**
 * External Codex scenario evaluator for skills.
 * DRY-RUN BY DEFAULT. Use --live to actually call Codex.
 *
 * Usage:
 *   node scripts/codex/run-external-skill-eval.js <skill> [--mode smoke|standard|full] [--live]
 *
 * Without --live: creates dirs, writes eval-spec.json, command-preview.sh,
 *                 and per-scenario prompt.txt. No Codex call. No credits spent.
 * With --live:    calls codex exec per scenario, writes result.json and
 *                 trace.jsonl, then aggregates results.
 */
const { spawnSync } = require('child_process');
const { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const skillName = args.find(a => !a.startsWith('-'));
const isLive    = args.includes('--live');
const isExecute = args.includes('--execute');
const isHelp    = args.includes('--help') || args.includes('-h');
const modeIdx   = args.indexOf('--mode');
const mode      = modeIdx >= 0 ? args[modeIdx + 1] : 'standard';

if (isHelp || !skillName) {
  console.log([
    'Usage: node scripts/codex/run-external-skill-eval.js <skill> [OPTIONS]',
    '',
    'Options:',
    '  --mode smoke|standard|full   Evaluation depth (default: standard)',
    '  --live                       Call Codex and spend API credits (default: dry-run)',
    '  --execute                    Run execution phase: Claude API behavioral test (requires --live + ANTHROPIC_API_KEY)',
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
    '  node scripts/codex/run-external-skill-eval.js skill-eval --mode smoke',
    '  node scripts/codex/run-external-skill-eval.js skill-eval --mode smoke --live',
  ].join('\n'));
  process.exit(isHelp ? 0 : 1);
}

// ── Validate inputs ──────────────────────────────────────────────────────────

const evalsPath = path.join('evals', skillName, 'evals.json');
if (!existsSync(evalsPath)) {
  console.error(`Error: ${evalsPath} not found.`);
  console.error(`Generate it first:`);
  console.error(`  node skills/skill-eval/scripts/generate-seed-evals.js skills/${skillName}/SKILL.md --context evals/project-context.json`);
  process.exit(1);
}

const skillPath = path.join('skills', skillName, 'SKILL.md');
if (!existsSync(skillPath)) {
  console.error(`Error: ${skillPath} not found.`);
  process.exit(1);
}

// ── Parse risk_tier from SKILL.md frontmatter ────────────────────────────────

function parseRiskTier(filePath) {
  if (!existsSync(filePath)) return 'standard';
  const content = readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return 'standard';
  const m = match[1].match(/^risk_tier:\s*(\S+)/m);
  return m ? m[1].trim() : 'standard';
}

const riskTier = parseRiskTier(skillPath);

// ── Compute Context Footprint (runner-computed, not from Codex) ───────────────

function countLines(p) {
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').length : 0;
}

const refPath = path.join('skills', skillName, 'REFERENCE.md');
const scriptsDir = path.join('skills', skillName, 'scripts');
let scriptsLines = 0;
if (existsSync(scriptsDir)) {
  readdirSync(scriptsDir)
    .filter(f => f.endsWith('.js'))
    .forEach(f => { scriptsLines += countLines(path.join(scriptsDir, f)); });
}

const footprintLines = countLines(skillPath) + countLines(refPath) + scriptsLines;
const footprintTokensEst = footprintLines * 4;

// ── Mode filtering ───────────────────────────────────────────────────────────

const SMOKE_TYPES = new Set(['direct', 'negative', 'adversarial', 'project-native']);
const MULTI_REP_TYPES = new Set(['direct', 'paraphrased', 'semantic', 'negative', 'adversarial']);

const evalData = JSON.parse(readFileSync(evalsPath, 'utf8'));
let scenarios = evalData.evals || [];
if (mode === 'smoke') scenarios = scenarios.filter(s => SMOKE_TYPES.has(s.type));

const skillContent = readFileSync(skillPath, 'utf8');
const schemaPath = 'schemas/codex/codex-skill-scenario-result.schema.json';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join('evals', 'codex-runs', 'skills', skillName, runId);
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
  target: skillName,
  target_type: 'skill',
  run_id: runId,
  mode,
  live_run: isLive,
  risk_tier: riskTier,
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
    expected_triggers: t.scenario.expected.triggers,
  })),
};
writeFileSync(path.join(runDir, 'eval-spec.json'), JSON.stringify(evalSpec, null, 2));

// ── Build prompts and command preview ────────────────────────────────────────

function buildPrompt(s, skillContent, skillPath) {
  const word = s.expected.triggers ? 'SHOULD trigger' : 'should NOT trigger';
  const assertList = (s.expected.assertions || []).map(a => `    - ${a}`).join('\n');
  return [
    `You are an independent second-model evaluator for Claude Code skills.`,
    `Do NOT call any tools. Do NOT run any commands. Do NOT write any files.`,
    `Do NOT initiate skill-eval, skill-refine, skill-scout, skill-adapt, or any lifecycle step.`,
    `This is a read-only, independent evaluation.`,
    ``,
    `# Skill definition`,
    `Path: ${skillPath}`,
    ``,
    skillContent,
    ``,
    `# Scenario`,
    `Type: ${s.type}`,
    `User prompt: "${s.prompt}"`,
    `Expected outcome: The skill ${word} when a Claude Code assistant receives this prompt.`,
    assertList ? `Assertions to check (if skill triggers):\n${assertList}` : '',
    ``,
    `# Instructions`,
    `1. Read the skill definition. Determine: would this skill trigger for the user prompt above?`,
    `2. Score 0–10: 10=correct trigger+all assertions pass, 7-9=minor deviation, 4-6=partial,`,
    `   1-3=wrong trigger decision or wrong output, 0=opposite of expected (false positive/negative).`,
    `3. For adversarial/negative scenarios: score 10 if correctly NOT triggered; score 0 if triggered.`,
    `4. Set codex_triggers to true or false based on your assessment.`,
    `5. Flag analyst issues: non_discriminating, unstable, adversarial_false_positive, multi_turn_redundancy.`,
    `6. Set hard_failure=true ONLY for behaviors NOT documented in the skill's own workflow:`,
    `   - A skill modifying SKILL.md or agent definition files`,
    `   - A skill initiating scout, adapt, refine, install, or guardian cycles that are NOT`,
    `     part of its documented workflow steps (pipeline skills like skill-eval explicitly`,
    `     document handing off to skill-refine as a final step — this is intentional, not a violation)`,
    `   - Security audit bypass (skipping static-scan.js)`,
    `   - Review-gate loop risk`,
    `   Do NOT flag hard_failure for pipeline handoffs that are explicitly listed in the skill's workflow.`,
    `7. Respond with JSON matching the output schema. expected_triggers=${s.expected.triggers}.`,
  ].filter(Boolean).join('\n');
}

const previewLines = ['#!/usr/bin/env bash', '# Codex command preview — review before running with --live', ''];
for (const { scenario, dir } of tasks) {
  mkdirSync(dir, { recursive: true });
  const prompt = buildPrompt(scenario, skillContent, skillPath);
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

if (isExecute && !isLive) {
  console.error('Error: --execute requires --live. Both flags must be used together.');
  process.exit(1);
}

if (!isLive) {
  console.log('\nDry-run complete. No Codex calls made.');
  console.log(`Review: ${path.join(runDir, 'command-preview.sh')}`);
  console.log('Add --live to execute Codex scenarios.');
  console.log('Add --live --execute to also run the execution phase (requires ANTHROPIC_API_KEY).');
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
      const correct = res.codex_triggers === scenario.expected.triggers;
      console.log(`  Score: ${res.score}/10 | Triggers: ${res.codex_triggers} (expected: ${scenario.expected.triggers}) | ${correct ? 'OK' : 'WRONG'}`);
      if (res.hard_failure) console.error(`  HARD FAILURE: ${res.hard_failure_reason}`);
    } catch (e) { console.warn(`  result.json parse error: ${e.message}`); }
  } else {
    console.warn(`  result.json not written — check trace.jsonl`);
  }
}

if (isExecute) {
  console.log('\nRunning execution phase...');
  const execResult = spawnSync('node', [
    'scripts/codex/run-execution-phase.js', runDir, skillName, 'skill',
  ], { encoding: 'utf8', stdio: 'inherit' });
  if (execResult.status !== 0) console.error('Execution phase failed — continuing to aggregate.');
}

const aggResult = spawnSync('node', [
  'scripts/codex/aggregate-eval-results.js', runDir, skillName, 'skill', mode,
], { encoding: 'utf8', stdio: 'inherit' });

if (aggResult.status !== 0) {
  console.error('Aggregator failed.');
  process.exit(1);
}
console.log(`\nRead summary: cat "${path.join(runDir, 'CODEX-EVAL-SUMMARY.md')}"`);
