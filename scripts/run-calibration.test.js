// scripts/run-calibration.test.js — matcher + fixture-resolution tests for run-calibration.js `check`.
// No Codex calls, no generator runs: `check` is exercised via child process against synthetic
// reports and ground-truth manifests in a temp dir (--expected/--eval-report/--audit-report).
'use strict';
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const SCRIPT = path.join(__dirname, 'run-calibration.js');
const TMP = path.join(__dirname, '__calibration_test_tmp__');

function setup() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
}

function teardown() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

function writeInputs(name, { expected, evalReport, auditReport }) {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  const p = {
    expected: path.join(dir, 'expected-findings.json'),
    evalReport: path.join(dir, 'SKILL-EVAL.md'),
    auditReport: path.join(dir, 'NATIVE-AUDIT-REPORT.md'),
  };
  fs.writeFileSync(p.expected, JSON.stringify(expected, null, 2));
  fs.writeFileSync(p.evalReport, evalReport);
  fs.writeFileSync(p.auditReport, auditReport);
  return p;
}

function runCheck(extraArgs, cwd = TMP) {
  const r = spawnSync('node', [SCRIPT, 'check', ...extraArgs], { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function defect(id, cls, anchor, catcher, extra = {}) {
  return { id, defect_class: cls, description: `synthetic ${cls}`, anchor_quote: anchor, expected_catcher: catcher, ...extra };
}

const BLAND = 'Nothing relevant here. The weather was pleasant and the build was green.\n';

try {
  setup();

  // Test 1: anchor-quote matching — verbatim hit, elided 5-word-window hit, and
  // markdown-noise normalization (backticks/asterisks/double quotes).
  {
    const expected = {
      fixture: 'synthetic',
      defects: [
        defect('verbatim', 'internal_self_contradiction',
          'never ask the user follow-up questions during this workflow', 'native_metric:analyst_observations'),
        defect('elided', 'internal_self_contradiction',
          'interview the user with targeted follow-up questions before moving on', 'native_metric:analyst_observations'),
        defect('noisy', 'internal_self_contradiction',
          'save the result to BRIEF.md in the project root', 'native_metric:analyst_observations'),
      ],
    };
    const evalReport = [
      '# Report',
      'The definition says "never ask the user follow-up questions during this workflow" which conflicts.',
      // elided: only a middle 5-word window of the anchor appears
      'One step tells the model: user with targeted follow-up questions, then forbids it.',
      // noisy: backticks + asterisks around the quoted text
      'Step 3 instructs: **Save** the result to `BRIEF.md` in the *project root*.',
    ].join('\n');
    const p = writeInputs('t1', { expected, evalReport, auditReport: BLAND });
    const r = runCheck(['--expected', p.expected, '--eval-report', p.evalReport, '--audit-report', p.auditReport]);
    assert.strictEqual(r.status, 0, `expected 3/3 anchor catches, got:\n${r.stdout}${r.stderr}`);
    assert.ok(/\[CAUGHT\] verbatim .*via anchor-quote/.test(r.stdout), 'verbatim anchor must be caught via anchor-quote');
    assert.ok(/\[CAUGHT\] elided .*via anchor-quote/.test(r.stdout), 'elided 5-word window must be caught via anchor-quote');
    assert.ok(/\[CAUGHT\] noisy .*via anchor-quote/.test(r.stdout), 'markdown-noisy quote must be caught via anchor-quote');
    console.log('✓ Test 1: anchor-quote matching (verbatim, elided window, normalization)');
  }

  // Test 2: keyword fallback fires for all 8 defect classes (anchors deliberately absent).
  {
    const MISSING_ANCHOR = 'zzz qqq xxx never appears vvv bbb nnn mmm';
    const cases = [
      // [class, catcher, report prose that the class regex must match]
      ['vague_trigger_description', 'native_metric:analyst_observations',
        'The trigger description is too broad to discriminate this skill from any other work.'],
      ['internal_self_contradiction', 'native_audit:instruction_self_consistency',
        'The steps give conflicting instruction about follow-ups.'],
      ['silently_dropped_step', 'native_audit:workflow_step_fidelity',
        'The interview phase is a dropped step — listed in the overview, never implemented.'],
      ['broken_output_filename_integration', 'native_metric:project_fit_score',
        'There is a filename mismatch between the save step and the handoff step.'],
      ['over_narrow_trigger', 'native_metric:trigger_accuracy',
        'The description is too narrow: paraphrased requests failed to trigger the skill in 3 of 3 reps.'],
      ['phantom_script_reference', 'native_audit:output_integration_claims',
        'Step 2 invokes scripts/notes/extract-actions.js, but that script does not exist in the repository.'],
      ['multi_turn_redundancy', 'native_metric:analyst_observations',
        'The workflow forces the model to re-confirm the attendee list already provided in the prompt.'],
      ['dead_step', 'native_audit:workflow_step_fidelity',
        'Step 5 is unreachable: its guard condition can never be true given what Step 2 guarantees.'],
    ];
    const expected = {
      fixture: 'synthetic-keywords',
      defects: cases.map(([cls, catcher], i) => defect(`kw-${cls}`, cls, `${MISSING_ANCHOR} ${i}`, catcher)),
    };
    const evalReport  = cases.filter(c => c[1].startsWith('native_metric')).map(c => c[2]).join('\n');
    const auditReport = cases.filter(c => c[1].startsWith('native_audit')).map(c => c[2]).join('\n');
    const p = writeInputs('t2', { expected, evalReport, auditReport });
    const r = runCheck(['--expected', p.expected, '--eval-report', p.evalReport, '--audit-report', p.auditReport]);
    assert.strictEqual(r.status, 0, `expected 8/8 keyword catches, got:\n${r.stdout}${r.stderr}`);
    for (const [cls] of cases) {
      assert.ok(new RegExp(`\\[CAUGHT\\] kw-${cls} .*via keyword`).test(r.stdout),
        `class ${cls} must be caught via keyword fallback; got:\n${r.stdout}`);
    }
    console.log('✓ Test 2: keyword fallback fires for all 8 defect classes');
  }

  // Test 3: checklist-fail row counts for native_audit catchers when anchor + keyword miss.
  {
    const expected = {
      fixture: 'synthetic-checklist',
      defects: [defect('cl', 'dead_step', 'zzz absent anchor qqq xxx vvv bbb', 'native_audit:workflow_step_fidelity')],
    };
    const auditReport = [
      '# Audit', '',
      '| Check | Result | Notes |',
      '|-------|--------|-------|',
      '| workflow_step_fidelity | fail | see findings section |',
    ].join('\n');
    const p = writeInputs('t3', { expected, evalReport: BLAND, auditReport });
    const r = runCheck(['--expected', p.expected, '--eval-report', p.evalReport, '--audit-report', p.auditReport]);
    assert.strictEqual(r.status, 0, `checklist fail row should count as caught:\n${r.stdout}${r.stderr}`);
    assert.ok(/via checklist-fail/.test(r.stdout), 'mechanism must be checklist-fail');
    console.log('✓ Test 3: failing checklist row counts for native_audit catchers');
  }

  // Test 4: 4/4 → exit 0 + PASS; 3/4 → exit 1 and the missed defect is named.
  {
    const mk = (bothCaught) => ({
      fixture: 'synthetic-verdict',
      defects: [
        defect('a', 'over_narrow_trigger', 'the skill fires only on one exact phrase', 'native_metric:trigger_accuracy'),
        defect('b', 'phantom_script_reference', 'run node scripts/notes/extract-actions.js first', 'native_audit:output_integration_claims'),
        defect('c', 'multi_turn_redundancy', 're-confirm the attendee list and meeting date', 'native_metric:analyst_observations'),
        defect('d', 'dead_step', bothCaught
          ? 'only if step 2 found zero action items'
          : 'zz yy xx ww vv uu tt ss', 'native_audit:workflow_step_fidelity'),
      ],
    });
    const evalReport = 'The skill fires only on one exact phrase. It makes you re-confirm the attendee list and meeting date every step.';
    const auditReport = 'Step 3 says run node scripts/notes/extract-actions.js first. Step 5 applies only if Step 2 found zero action items.';

    const pass = writeInputs('t4-pass', { expected: mk(true), evalReport, auditReport });
    const rPass = runCheck(['--expected', pass.expected, '--eval-report', pass.evalReport, '--audit-report', pass.auditReport]);
    assert.strictEqual(rPass.status, 0, `4/4 must exit 0:\n${rPass.stdout}${rPass.stderr}`);
    assert.ok(/PASS — 4\/4/.test(rPass.stdout), '4/4 must print PASS');

    const failCase = writeInputs('t4-fail', { expected: mk(false), evalReport, auditReport: BLAND });
    const rFail = runCheck(['--expected', failCase.expected, '--eval-report', failCase.evalReport, '--audit-report', failCase.auditReport]);
    assert.strictEqual(rFail.status, 1, '3/4 must exit 1');
    assert.ok(/\[MISSED\] d /.test(rFail.stdout), `the missed defect must be named:\n${rFail.stdout}`);
    console.log('✓ Test 4: 4/4 exits 0 with PASS; 3/4 exits 1 naming the missed defect');
  }

  // Test 5: --fixture resolves the second fixture's committed ground truth and the
  // calibration report filename carries the fixture suffix.
  {
    const fixtureName = 'mutant-notes-summarizer';
    // Mirror the committed fixture into the temp cwd so path resolution is exercised
    // exactly as it would be at the repo root.
    const srcDir = path.join(REPO, 'fixtures', fixtureName);
    assert.ok(fs.existsSync(path.join(srcDir, 'expected-findings.json')),
      `committed fixture ${srcDir} must exist`);
    const dstDir = path.join(TMP, 'fixtures', fixtureName);
    fs.mkdirSync(dstDir, { recursive: true });
    for (const f of ['SKILL.md', 'expected-findings.json']) {
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(dstDir, 'expected-findings.json'), 'utf8'));
    // Synthetic reports that quote every anchor verbatim → 4/4.
    const evalReport = manifest.defects.map(d => `Finding: "${d.anchor_quote}"`).join('\n');
    const auditReport = evalReport;
    const evalP = path.join(TMP, 't5-eval.md');
    const auditP = path.join(TMP, 't5-audit.md');
    fs.writeFileSync(evalP, evalReport);
    fs.writeFileSync(auditP, auditReport);

    const r = runCheck(['--fixture', fixtureName, '--eval-report', evalP, '--audit-report', auditP]);
    assert.strictEqual(r.status, 0, `--fixture check should pass 4/4 on anchor echoes:\n${r.stdout}${r.stderr}`);
    const reportPath = path.join(TMP, 'evals', 'fixtures', `CALIBRATION-REPORT-${fixtureName}.md`);
    assert.ok(fs.existsSync(reportPath), `report must be written to ${reportPath}`);
    assert.ok(fs.readFileSync(reportPath, 'utf8').includes(fixtureName), 'report must name the fixture');
    console.log('✓ Test 5: --fixture resolves committed ground truth; report filename carries fixture suffix');
  }

  // Test 6: structural validation of BOTH committed fixtures — required fields present,
  // every anchor quote appears verbatim in its SKILL.md, catchers use known layers, and
  // every defect_class has a keyword fallback in run-calibration.js.
  {
    const scriptSrc = fs.readFileSync(SCRIPT, 'utf8');
    for (const name of ['mutant-brief-writer', 'mutant-notes-summarizer']) {
      const dir = path.join(REPO, 'fixtures', name);
      const skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'expected-findings.json'), 'utf8'));
      assert.strictEqual(manifest.fixture, name, `${name}: manifest.fixture must equal dir name`);
      assert.strictEqual(manifest.defects.length, 4, `${name}: must declare exactly 4 defects`);
      for (const d of manifest.defects) {
        for (const field of ['id', 'defect_class', 'description', 'anchor_quote', 'expected_catcher']) {
          assert.ok(d[field], `${name}/${d.id || '?'}: missing field ${field}`);
        }
        assert.ok(/^native_(metric|audit):/.test(d.expected_catcher),
          `${name}/${d.id}: expected_catcher must be native_metric:* or native_audit:*`);
        for (const q of [d.anchor_quote, d.anchor_quote_contradicting, d.anchor_quote_conflicting].filter(Boolean)) {
          assert.ok(skill.includes(q), `${name}/${d.id}: anchor quote not found verbatim in SKILL.md: "${q}"`);
        }
        assert.ok(new RegExp(`\\b${d.defect_class}\\b`).test(scriptSrc),
          `${name}/${d.id}: defect_class ${d.defect_class} has no CLASS_KEYWORDS entry in run-calibration.js`);
      }
      const header = skill.split('\n')[0];
      assert.ok(/CALIBRATION FIXTURE/.test(header), `${name}: SKILL.md must carry the calibration-fixture header comment`);
    }
    console.log('✓ Test 6: both committed fixtures are structurally valid with verbatim anchors');
  }

  console.log('\n✅ All tests passed');
} finally {
  teardown();
}
