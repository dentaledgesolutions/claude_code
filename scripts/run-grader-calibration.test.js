// scripts/run-grader-calibration.test.js — tests for the grader-calibration harness.
// `generate` is exercised against the real committed golden-target fixture; `check`
// against synthetic scores files in a temp dir. The script never calls an LLM.
'use strict';
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const SCRIPT = path.join(__dirname, 'run-grader-calibration.js');
const TMP = path.join(__dirname, '__grader_test_tmp__');
const EXPECTED = JSON.parse(fs.readFileSync(path.join(REPO, 'fixtures', 'golden-target', 'expected-scores.json'), 'utf8'));

function setup() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
}
function teardown() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

function run(cmd, extraArgs = [], cwd = REPO) {
  const r = spawnSync('node', [SCRIPT, cmd, ...extraArgs], { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// A synthetic judge scores file covering every expected dimension.
function scoresFile(judge, scoreFor) {
  return {
    judge,
    dimensions: EXPECTED.dimensions.map(d => ({ dimension: d.dimension, score: scoreFor(d) })),
    overall_score: scoreFor(EXPECTED.dimensions.find(d => d.dimension.startsWith('overall_score'))),
  };
}

function writeScores(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  files.forEach((f, i) => fs.writeFileSync(path.join(dir, `scores-${i + 1}.json`),
    typeof f === 'string' ? f : JSON.stringify(f, null, 2)));
}

const midBand = d => Math.round((d.expected_score_band[0] + d.expected_score_band[1]) / 2);

try {
  setup();

  // Test 1: generate --judges 3 writes spec + 3 identical prompts containing the
  // transcript and every dimension name — and NONE of the expected bands/notes.
  {
    const out = path.join(TMP, 'gen');
    const r = run('generate', ['--judges', '3', '--out', out]);
    assert.strictEqual(r.status, 0, `generate must exit 0:\n${r.stdout}${r.stderr}`);
    assert.ok(fs.existsSync(path.join(out, 'judging-spec.json')), 'judging-spec.json must be written');
    const prompts = [1, 2, 3].map(i => fs.readFileSync(path.join(out, `judge-prompt-${i}.md`), 'utf8'));
    const normalizeIdentity = p => p
      .replace(/scores-\d+\.json/g, 'scores-N.json')
      .replace(/Judge pass \d+/g, 'Judge pass N')
      .replace(/"judge": \d+/g, '"judge": N');
    assert.strictEqual(new Set(prompts.map(normalizeIdentity)).size, 1,
      'prompts must be identical apart from judge number and output filename');

    const transcript = fs.readFileSync(path.join(REPO, 'fixtures', 'golden-target', 'golden-transcript.md'), 'utf8');
    const transcriptCore = transcript.split('---')[1] || transcript; // body after the fixture preamble
    assert.ok(prompts[0].includes(transcriptCore.trim().slice(0, 200)), 'prompt must embed the transcript');
    for (const d of EXPECTED.dimensions) {
      assert.ok(prompts[0].includes(d.dimension), `prompt must name dimension "${d.dimension}"`);
    }
    // Blindness: no band values, no "band" wording, none of the fixture's notes text.
    assert.ok(!/band/i.test(prompts[0]), 'prompt must not mention bands');
    assert.ok(!/expected_score/i.test(prompts[0]), 'prompt must not leak expected_score fields');
    for (const d of EXPECTED.dimensions) {
      if (d.notes) assert.ok(!prompts[0].includes(d.notes.slice(0, 40)),
        `prompt must not leak the fixture's notes for "${d.dimension}"`);
    }
    console.log('✓ Test 1: generate writes spec + N blind, identical prompts');
  }

  // Test 2: check with all scores mid-band → exit 0; report has per-dimension mean + spread.
  {
    const dir = path.join(TMP, 'ok');
    writeScores(dir, [1, 2, 3].map(j => scoresFile(j, midBand)));
    const r = run('check', ['--dir', dir]);
    assert.strictEqual(r.status, 0, `all-in-band must exit 0:\n${r.stdout}${r.stderr}`);
    const report = fs.readFileSync(path.join(dir, 'GRADER-CALIBRATION-REPORT.md'), 'utf8');
    assert.ok(/PASS/.test(report), 'report must carry PASS verdict');
    assert.ok(/mean/i.test(report) && /spread/i.test(report), 'report must show mean and spread');
    console.log('✓ Test 2: all-in-band scores pass with mean/spread in the report');
  }

  // Test 3: one out-of-band score → exit 1; report names the dimension and judge.
  {
    const dir = path.join(TMP, 'oob');
    const bad = scoresFile(2, midBand);
    bad.dimensions[0].score = EXPECTED.dimensions[0].expected_score_band[0] - 3; // far below band
    writeScores(dir, [scoresFile(1, midBand), bad, scoresFile(3, midBand)]);
    const r = run('check', ['--dir', dir]);
    assert.strictEqual(r.status, 1, 'out-of-band score must exit 1');
    const report = fs.readFileSync(path.join(dir, 'GRADER-CALIBRATION-REPORT.md'), 'utf8');
    assert.ok(report.includes(EXPECTED.dimensions[0].dimension), 'report must name the out-of-band dimension');
    assert.ok(/judge 2/i.test(report), 'report must name the offending judge');
    console.log('✓ Test 3: out-of-band score fails, naming dimension and judge');
  }

  // Test 4: all in-band but spread 3 on one dimension → HIGH-VARIANCE + exit 1.
  {
    const dir = path.join(TMP, 'var');
    const d0 = EXPECTED.dimensions[0];
    const [lo] = d0.expected_score_band;
    const hi = d0.expected_score_band[1];
    assert.ok(hi - lo >= 2, 'fixture band must be wide enough for this test');
    const mk = (j, first) => { const s = scoresFile(j, midBand); s.dimensions[0].score = first; return s; };
    // spread = (lo+3) - lo = 3 > 2, all values still within [lo, hi] iff lo+3 <= hi... use lo and hi where hi-lo>=3? band is [8,10] → spread 2 max in band.
    // Bands are 3 wide ([8,10] inclusive = spread up to 2), so an in-band spread >2 is impossible;
    // use scores that straddle the band edges legally only if the band allows. Instead relax: one
    // judge at band-min minus 0? -> Not in band. So this test uses a *custom* expected file.
    const custom = JSON.parse(JSON.stringify(EXPECTED));
    custom.dimensions[0].expected_score_band = [4, 10]; // wide band so spread>2 stays in-band
    const customPath = path.join(dir, 'expected-custom.json');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(customPath, JSON.stringify(custom, null, 2));
    writeScores(dir, [mk(1, 4), mk(2, 7), mk(3, 5)]); // dimension 0: spread 3, all within [4,10]
    const r = run('check', ['--dir', dir, '--expected', customPath]);
    assert.strictEqual(r.status, 1, 'high variance must exit 1 even when all scores are in-band');
    const report = fs.readFileSync(path.join(dir, 'GRADER-CALIBRATION-REPORT.md'), 'utf8');
    assert.ok(/HIGH-VARIANCE/.test(report), 'report must flag HIGH-VARIANCE');
    console.log('✓ Test 4: in-band but spread > 2 flags HIGH-VARIANCE and fails');
  }

  // Test 5: malformed scores file → loud error naming the file, exit 1.
  {
    const dir = path.join(TMP, 'bad');
    writeScores(dir, [scoresFile(1, midBand), '{not json']);
    const r = run('check', ['--dir', dir]);
    assert.strictEqual(r.status, 1, 'malformed scores file must exit 1');
    assert.ok(/scores-2\.json/.test(r.stdout + r.stderr), 'error must name the malformed file');

    const dir2 = path.join(TMP, 'bad2');
    const missing = scoresFile(1, midBand);
    missing.dimensions.pop(); // drop a required dimension
    writeScores(dir2, [missing]);
    const r2 = run('check', ['--dir', dir2]);
    assert.strictEqual(r2.status, 1, 'scores file missing a dimension must exit 1');
    assert.ok(/scores-1\.json/.test(r2.stdout + r2.stderr), 'error must name the incomplete file');
    console.log('✓ Test 5: malformed or incomplete scores files fail loudly by name');
  }

  console.log('\n✅ All tests passed');
} finally {
  teardown();
}
