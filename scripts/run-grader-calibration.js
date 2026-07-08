#!/usr/bin/env node
/**
 * run-grader-calibration.js — measure LLM-judge grading variance against the
 * golden-target fixture (eval-hardening design Part 3).
 *
 * THIS SCRIPT NEVER CALLS AN LLM. Like run-calibration.js, it only prepares
 * inputs ("generate") and verifies outputs ("check"); the judge passes in
 * between are run by a human/Claude session spawning independent subagents.
 *
 * Steps:
 *   generate [--judges N] [--out <dir>]
 *       Packages fixtures/golden-target/golden-transcript.md + the grading
 *       rubric into N identical, BLIND judge prompts (judge-prompt-<i>.md) and
 *       a judging-spec.json. Blind = the prompts contain the dimension names
 *       and the transcript but never the expected score bands, targets, or the
 *       fixture's notes. Each judge pass must write scores-<i>.json to the same
 *       directory: { "judge": i, "dimensions": [{"dimension", "score"}], "overall_score" }.
 *
 *   check [--dir <dir>] [--expected <path>]
 *       Validates every scores-*.json against expected-scores.json's bands
 *       (bands already include the fixture's ±1 tolerance), computes per-
 *       dimension mean and spread (max − min), flags spread > 2 as
 *       HIGH-VARIANCE, and writes GRADER-CALIBRATION-REPORT.md.
 *       Exit 0 ⇔ every score in-band AND no HIGH-VARIANCE dimension.
 *
 * The rubric embedded in the prompts is the LLM-judge scale from the skill-eval
 * methodology (see .claude/agents/skill-eval-agent.md step 8), restated in a
 * self-contained form so the prompt cannot accidentally leak fixture
 * expectations from a file read.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

const DEFAULTS = {
  transcript: path.join('fixtures', 'golden-target', 'golden-transcript.md'),
  expectedScores: path.join('fixtures', 'golden-target', 'expected-scores.json'),
  outDir: path.join('evals', 'fixtures', 'grader-calibration'),
  judges: 5,
  spreadThreshold: 2,
};

const HELP = `Usage: node scripts/run-grader-calibration.js <generate|check> [OPTIONS]

Measures LLM-judge grading variance against the known-correct golden-target
transcript. Makes NO LLM calls itself — judge passes are run separately.

  generate [--judges N] [--out <dir>]
      Write judging-spec.json + N blind judge prompts to <dir>
      (default: ${DEFAULTS.outDir}, N=${DEFAULTS.judges}).
  check [--dir <dir>] [--expected <path>]
      Validate scores-*.json in <dir> against the fixture's score bands,
      compute per-dimension mean/spread, write GRADER-CALIBRATION-REPORT.md.
      Exit 0 = all scores in-band and no dimension with spread > ${DEFAULTS.spreadThreshold}.
`;

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(HELP);
  process.exit(args.length === 0 ? 1 : 0);
}

const step = args[0];

// Self-contained restatement of the skill-eval LLM-judge scale. Deliberately
// contains no reference to this fixture's expectations.
const RUBRIC = `Scoring scale (apply per dimension, 0-10):
- 10: the dimension's behavior is fully and correctly demonstrated in the transcript, with correct output format.
- 7-9: demonstrated with only minor deviation (one aspect partially satisfied).
- 4-6: partially demonstrated — the behavior was attempted but the execution is incomplete.
- 1-3: substantially wrong — the behavior is claimed but the transcript does not support it.
- 0: the behavior is absent or the transcript contradicts it.
Judge ONLY from what the transcript actually shows. A claim without visible supporting
action (tool call, diff, file content) earns at most partial credit. Do not reward
intentions, plans, or self-assessments.`;

function stepGenerate() {
  const judges = parseInt(flagValue('--judges') || String(DEFAULTS.judges), 10);
  if (!Number.isInteger(judges) || judges < 1) fail('--judges must be a positive integer.');
  const outDir = flagValue('--out') || DEFAULTS.outDir;

  if (!fs.existsSync(DEFAULTS.transcript)) fail(`${DEFAULTS.transcript} not found.`);
  if (!fs.existsSync(DEFAULTS.expectedScores)) fail(`${DEFAULTS.expectedScores} not found.`);

  // Strip the fixture's own preamble (everything before the first `---`): it names
  // expected-scores.json and its bands, which judges must never see.
  const transcriptRaw = fs.readFileSync(DEFAULTS.transcript, 'utf8');
  const sep = transcriptRaw.indexOf('\n---\n');
  const transcript = sep === -1 ? transcriptRaw : transcriptRaw.slice(sep + 5).trim();
  const expected = JSON.parse(fs.readFileSync(DEFAULTS.expectedScores, 'utf8'));
  const dimensions = expected.dimensions.map(d => d.dimension);

  fs.mkdirSync(outDir, { recursive: true });

  const spec = {
    fixture: expected.fixture,
    skill: expected.skill,
    transcript_path: DEFAULTS.transcript,
    judges,
    dimensions,
    output_schema: {
      judge: '<judge number>',
      dimensions: [{ dimension: '<exact dimension name>', score: '<integer 0-10>' }],
      overall_score: '<integer 0-10, equal to the overall_score dimension>',
    },
    note: 'Judge prompts are blind: expected score bands live only in fixtures/golden-target/expected-scores.json and are read by `check`, never shown to judges.',
  };
  fs.writeFileSync(path.join(outDir, 'judging-spec.json'), JSON.stringify(spec, null, 2));

  for (let i = 1; i <= judges; i++) {
    const prompt = [
      `# Judge pass ${i} — grade one eval transcript`,
      '',
      'You are one of several independent graders scoring the SAME transcript. Do not',
      'coordinate with, reference, or assume the existence of other graders. Score only',
      'what this transcript demonstrates.',
      '',
      `The transcript is a with-skill eval run of the \`${expected.skill}\` skill executing this prompt:`,
      `"${expected.prompt}"`,
      '',
      '## Dimensions to score (0-10 each; use the exact names)',
      '',
      ...dimensions.map(d => `- ${d}`),
      '',
      '## Rubric',
      '',
      RUBRIC,
      '',
      '## Output',
      '',
      `Write EXACTLY one JSON file at \`${path.join(outDir, `scores-${i}.json`)}\` and nothing else:`,
      '',
      '```json',
      JSON.stringify({
        judge: i,
        dimensions: dimensions.map(d => ({ dimension: d, score: 0 })),
        overall_score: 0,
      }, null, 2),
      '```',
      '',
      '(Replace every 0 with your actual integer score. `overall_score` must equal the',
      'score you gave the overall_score dimension.)',
      '',
      '## Transcript to grade',
      '',
      '---',
      '',
      transcript,
    ].join('\n');
    fs.writeFileSync(path.join(outDir, `judge-prompt-${i}.md`), prompt);
  }

  console.log(`Wrote judging-spec.json + ${judges} blind judge prompts to ${outDir}/`);
  console.log(`Each judge pass must write ${path.join(outDir, 'scores-<i>.json')}.`);
  console.log(`Then run: node scripts/run-grader-calibration.js check --dir ${outDir}`);
  process.exit(0);
}

function stepCheck() {
  const dir = flagValue('--dir') || DEFAULTS.outDir;
  const expectedPath = flagValue('--expected') || DEFAULTS.expectedScores;
  if (!fs.existsSync(dir)) fail(`${dir} not found — run generate first, or pass --dir.`);
  if (!fs.existsSync(expectedPath)) fail(`${expectedPath} not found.`);

  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const scoreFiles = fs.readdirSync(dir).filter(f => /^scores-\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  if (scoreFiles.length === 0) fail(`no scores-*.json files found in ${dir} — run the judge passes first.`);

  const judges = scoreFiles.map(f => {
    const p = path.join(dir, f);
    let data;
    try { data = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { fail(`${f} is not valid JSON: ${e.message}`); }
    for (const d of expected.dimensions) {
      const entry = (data.dimensions || []).find(x => x.dimension === d.dimension);
      if (!entry || !Number.isFinite(entry.score)) {
        fail(`${f} is missing a numeric score for dimension "${d.dimension}".`);
      }
    }
    return { file: f, judge: data.judge, data };
  });

  const rows = [];
  const problems = [];
  for (const d of expected.dimensions) {
    const [lo, hi] = d.expected_score_band;
    const scores = judges.map(j => ({
      file: j.file,
      judge: j.judge,
      score: j.data.dimensions.find(x => x.dimension === d.dimension).score,
    }));
    const values = scores.map(s => s.score);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const spread = Math.max(...values) - Math.min(...values);
    const outOfBand = scores.filter(s => s.score < lo || s.score > hi);
    const highVariance = spread > DEFAULTS.spreadThreshold;

    for (const o of outOfBand) {
      problems.push(`OUT-OF-BAND: "${d.dimension}" — judge ${o.judge} (${o.file}) scored ${o.score}, band [${lo}, ${hi}]`);
    }
    if (highVariance) {
      problems.push(`HIGH-VARIANCE: "${d.dimension}" — spread ${spread} > ${DEFAULTS.spreadThreshold} (scores: ${values.join(', ')})`);
    }
    rows.push({ d, lo, hi, values, mean, spread, outOfBand, highVariance });
  }

  const verdict = problems.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# GRADER-CALIBRATION-REPORT',
    '',
    `**Fixture:** ${expected.fixture}  `,
    `**Ground truth:** \`${expectedPath}\`  `,
    `**Judges:** ${judges.length} (${scoreFiles.join(', ')})  `,
    `**Generated:** ${new Date().toISOString()}  `,
    '',
    `## Verdict: ${verdict}`,
    '',
    verdict === 'PASS'
      ? 'Every judge score landed inside its expected band and no dimension shows high variance — the grader reproduces the known-correct scoring within tolerance.'
      : 'The grader drifted outside the golden fixture\'s known-correct bands and/or shows high variance. Per the fixture\'s rule: investigate the grader/rubric, never edit the bands to match a drifted grader.',
    '',
    '## Per-dimension results',
    '',
    `| Dimension | Band | Scores | Mean | Spread | Verdict |`,
    `|-----------|------|--------|------|--------|---------|`,
    ...rows.map(r =>
      `| ${r.d.dimension} | [${r.lo}, ${r.hi}] | ${r.values.join(', ')} | ${r.mean.toFixed(1)} | ${r.spread} | ${r.outOfBand.length ? 'OUT-OF-BAND' : r.highVariance ? 'HIGH-VARIANCE' : 'ok'} |`),
    '',
  ];
  if (problems.length) {
    lines.push('## Problems', '', ...problems.map(p => `- ${p}`), '');
  }
  lines.push(
    '## Rules',
    '',
    `In-band = score within the dimension's expected_score_band (inclusive; bands already`,
    `include the fixture's ±${expected.tolerance ?? 1} tolerance). HIGH-VARIANCE = spread (max − min) > ${DEFAULTS.spreadThreshold}`,
    'across judges. PASS requires every score in-band AND no high-variance dimension.',
    '',
  );

  const reportPath = path.join(dir, 'GRADER-CALIBRATION-REPORT.md');
  fs.writeFileSync(reportPath, lines.join('\n'));

  console.log(`Grader calibration: ${verdict} — ${judges.length} judges, ${rows.length} dimensions.`);
  for (const p of problems) console.log(`  ${p}`);
  console.log(`Report written: ${reportPath}`);
  process.exit(verdict === 'PASS' ? 0 : 1);
}

if (step === 'generate') {
  stepGenerate();
} else if (step === 'check') {
  stepCheck();
} else {
  console.error(`Error: unknown step "${step}". Use generate, check, or --help.`);
  process.exit(1);
}
