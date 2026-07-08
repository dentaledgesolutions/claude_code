// skills/team-eval/scripts/generate-team-evals.test.js
'use strict';
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const assert = require('assert');

const TMP = path.join(__dirname, '__team_test_tmp__');
const AGENT_DIR = path.join(TMP, '.claude', 'agents');
const TEAM_FILE = path.join(TMP, 'team.json');
const SCRIPT = path.join(__dirname, 'generate-team-evals.js');

const MEMBERS = ['alpha-analyst', 'beta-analyst', 'gamma-analyst'];

const TEAM = {
  team_name: 'test-ensemble',
  description: 'A three-analyst test orchestration.',
  orchestrator: { type: 'skill', name: 'test-orchestrator' },
  members: MEMBERS.map(m => ({ agent: m, role: `${m} layer` })),
  handoff_contract: 'each member receives a slice path and returns a JSON layer object',
  expected_artifacts: ['docs/audits/'],
  example_target: 'https://github.com/example/repo',
};

function agentStub(name) {
  return `---\nname: ${name}\ndescription: ${name} layer analyst for the test ensemble.\ntools: ["Read", "Bash"]\n---\n\nYou are the ${name}. Read the slice, return a JSON layer object.\n`;
}

function setup() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(AGENT_DIR, { recursive: true });
  fs.mkdirSync(path.join(TMP, 'skills', 'test-orchestrator'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'skills', 'test-orchestrator', 'SKILL.md'),
    '---\nname: test-orchestrator\ndescription: Orchestrates the test ensemble.\n---\n\n# Test Orchestrator\n');
  for (const m of MEMBERS) fs.writeFileSync(path.join(AGENT_DIR, `${m}.md`), agentStub(m));
  fs.writeFileSync(TEAM_FILE, JSON.stringify(TEAM, null, 2));
}

function teardown() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

function run(teamFile = TEAM_FILE, extraArgs = []) {
  const r = spawnSync('node', [SCRIPT, teamFile, ...extraArgs], { cwd: TMP, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function readEvals() {
  return JSON.parse(fs.readFileSync(path.join(TMP, 'evals', 'teams', TEAM.team_name, 'evals.json'), 'utf8'));
}

// Structural validator mirroring schemas/evals.schema.json's teamEvalsFile shape.
function validateEvalsFile(data) {
  const errors = [];
  for (const field of ['team_name', 'team_file', 'orchestrator', 'members', 'project_context', 'evals']) {
    if (!(field in data)) errors.push(`missing top-level field: ${field}`);
  }
  for (const sc of data.evals || []) {
    for (const field of ['id', 'eval_name', 'type', 'prompt', 'expected']) {
      if (!(field in sc)) errors.push(`scenario ${sc.id || '?'}: missing ${field}`);
    }
    if (!sc.expected || !sc.expected.evidence || !Array.isArray(sc.expected.judgment) || sc.expected.judgment.length === 0) {
      errors.push(`scenario ${sc.id}: expected.evidence/judgment malformed`);
      continue;
    }
    for (const field of ['artifacts', 'transcript_markers', 'workflow_steps']) {
      if (!Array.isArray(sc.expected.evidence[field])) errors.push(`scenario ${sc.id}: evidence.${field} must be an array`);
    }
    for (const m of sc.expected.evidence.transcript_markers) {
      if (!m.kind || !m.pattern || !['present', 'absent'].includes(m.expect)) {
        errors.push(`scenario ${sc.id}: malformed marker ${JSON.stringify(m)}`);
      }
    }
  }
  return errors;
}

function markersFor(sc, member) {
  return sc.expected.evidence.transcript_markers.filter(m => m.pattern.includes(member));
}

const TYPES = ['full-run', 'partial-team', 'member-failure', 'handoff-integrity', 'negative', 'adversarial'];

try {
  setup();

  // Test 1: 6 scenarios, one per type, structurally valid.
  {
    const r = run();
    assert.strictEqual(r.status, 0, `generator must exit 0:\n${r.stdout}${r.stderr}`);
    const data = readEvals();
    assert.deepStrictEqual(data.evals.map(s => s.type).sort(), [...TYPES].sort(), 'one scenario per team type');
    const errors = validateEvalsFile(data);
    assert.deepStrictEqual(errors, [], `structural errors: ${errors.join('; ')}`);
    console.log('✓ Test 1: 6 team scenario types, structurally valid evals.json');
  }

  // Test 2: full-run expects one PRESENT dispatch-token marker per member, and the
  // marker regex matches only the Agent(<name>) token — never narrative mentions.
  {
    const sc = readEvals().evals.find(s => s.type === 'full-run');
    for (const m of MEMBERS) {
      const marks = markersFor(sc, m);
      assert.strictEqual(marks.length, 1, `full-run must carry exactly one marker for ${m}`);
      assert.strictEqual(marks[0].expect, 'present', `${m} marker must expect present`);
      const re = new RegExp(marks[0].pattern, 'i');
      assert.ok(re.test(`\`Agent(${m})\` dispatched with the slice path`), `${m}: must match the dispatch token`);
      assert.ok(!re.test(`**Agent under test**: \`${m}\` (not dispatched)`), `${m}: must not match narrative mention`);
      assert.ok(!re.test(`the ${m} agent was deliberately not dispatched`), `${m}: must not match decline narration`);
    }
    console.log('✓ Test 2: full-run has one present Agent(<member>) token marker per member');
  }

  // Test 3: partial-team names a subset — present markers for the subset only, absent for the rest.
  {
    const sc = readEvals().evals.find(s => s.type === 'partial-team');
    const present = MEMBERS.filter(m => markersFor(sc, m).some(x => x.expect === 'present'));
    const absent  = MEMBERS.filter(m => markersFor(sc, m).some(x => x.expect === 'absent'));
    assert.ok(present.length >= 1 && present.length < MEMBERS.length, 'subset must be a strict, non-empty subset');
    assert.strictEqual(present.length + absent.length, MEMBERS.length, 'every member must carry a marker');
    for (const m of present) assert.ok(sc.prompt.includes(m) || sc.prompt.includes(`${m} layer`), `prompt must name subset member ${m}`);
    console.log('✓ Test 3: partial-team expects the named subset present, the rest absent');
  }

  // Test 4: member-failure excludes exactly one member (absent) and keeps the rest present,
  // with a graceful-degradation judgment criterion.
  {
    const sc = readEvals().evals.find(s => s.type === 'member-failure');
    const absent = MEMBERS.filter(m => markersFor(sc, m).some(x => x.expect === 'absent'));
    const present = MEMBERS.filter(m => markersFor(sc, m).some(x => x.expect === 'present'));
    assert.strictEqual(absent.length, 1, 'exactly one member must be excluded');
    assert.strictEqual(present.length, MEMBERS.length - 1, 'the remaining members must be expected present');
    assert.ok(sc.prompt.includes(absent[0]), 'prompt must name the unavailable member');
    assert.ok(sc.expected.judgment.some(j => /gap|degrad|fabricat|missing/i.test(j)),
      'judgment must require graceful degradation without fabricating the missing layer');
    console.log('✓ Test 4: member-failure excludes one member and requires graceful degradation');
  }

  // Test 5: handoff-integrity carries artifact checks from expected_artifacts and a
  // consumption judgment criterion.
  {
    const sc = readEvals().evals.find(s => s.type === 'handoff-integrity');
    assert.ok(sc.expected.evidence.artifacts.some(a => a.path === 'docs/audits/' && a.must_exist),
      'expected_artifacts must become artifact evidence');
    assert.ok(sc.expected.judgment.some(j => /consum|re-?deriv|member output|handoff/i.test(j)),
      'judgment must require member outputs to be consumed, not re-derived');
    console.log('✓ Test 5: handoff-integrity checks artifacts and output consumption');
  }

  // Test 6: negative and adversarial expect ALL member markers absent.
  {
    for (const type of ['negative', 'adversarial']) {
      const sc = readEvals().evals.find(s => s.type === type);
      for (const m of MEMBERS) {
        const marks = markersFor(sc, m);
        assert.strictEqual(marks.length, 1, `${type}: exactly one marker for ${m}`);
        assert.strictEqual(marks[0].expect, 'absent', `${type}: ${m} marker must expect absent`);
      }
      assert.ok(!('workflow_executed' in sc.expected), `${type} must not assert workflow_executed`);
    }
    console.log('✓ Test 6: negative and adversarial expect every member marker absent');
  }

  // Test 7: manifest validation fails loudly — missing members, unknown agent file.
  {
    const noMembers = { ...TEAM, members: [] };
    fs.writeFileSync(path.join(TMP, 'team-empty.json'), JSON.stringify(noMembers));
    const r1 = run(path.join(TMP, 'team-empty.json'));
    assert.strictEqual(r1.status, 1, 'empty members must fail');
    assert.ok(/members/.test(r1.stderr + r1.stdout), 'error must mention members');

    const ghost = { ...TEAM, members: [...TEAM.members, { agent: 'ghost-analyst', role: 'ghost' }] };
    fs.writeFileSync(path.join(TMP, 'team-ghost.json'), JSON.stringify(ghost));
    const r2 = run(path.join(TMP, 'team-ghost.json'));
    assert.strictEqual(r2.status, 1, 'unknown member agent file must fail');
    assert.ok(/ghost-analyst/.test(r2.stderr + r2.stdout), 'error must name the missing agent');
    console.log('✓ Test 7: manifest validation fails loudly on missing members / unknown agents');
  }

  console.log('\n✅ All tests passed');
} finally {
  teardown();
}
