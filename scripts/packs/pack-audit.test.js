// scripts/packs/pack-audit.test.js — covers packs-lib.js + pack-audit.js.
// Standalone, zero deps. Builds a synthetic pack tree under a temp --root so nothing
// real is touched, then asserts a clean pack passes (exit 0) and each violation trips
// the security gate (exit 3).
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const TMP = path.join(__dirname, '__pack_audit_test_tmp__');
const AUDIT = path.join(__dirname, 'pack-audit.js');
const lib = require('./packs-lib');

function audit(name) {
  const r = spawnSync('node', [AUDIT, '--name', name, '--root', TMP], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function writeJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }
function writeFile(p, s) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }

// Build a clean, valid read-only pack named "test-pack".
function seedClean() {
  fs.rmSync(TMP, { recursive: true, force: true });
  const base = path.join(TMP, 'packs', 'test-pack');
  writeJson(path.join(TMP, 'packs', 'registry.json'), {
    packs: [{
      name: 'test-pack', domain: 'test', version: '0.1.0',
      execution_mode: 'read-only', risk_tier: 'standard',
      install_policy: 'do-not-install-directly', last_reviewed: '2026-07-17',
    }],
  });
  writeJson(path.join(base, 'pack.json'), {
    name: 'test-pack', version: '0.1.0', domain: 'test', description: 'fixture',
    install_policy: 'do-not-install-directly', execution_mode: 'read-only',
    risk_tier: 'standard', last_reviewed: '2026-07-17', review_owner: 'tester',
    review_cadence_days: 180,
  });
  writeJson(path.join(base, 'guardrails', 'policy.json'), { execution_mode: 'read-only', allow_effects: ['read'], deny_effects: ['write'] });
  writeJson(path.join(base, 'tools', 't_read.tool.json'), { name: 't_read', description: 'reads', effect: 'read' });
  writeFile(path.join(base, 'knowledge', 'doc.md'),
    '---\ntype: knowledge\ntitle: "Doc"\ndescription: "d"\ntags: [test]\ntimestamp: 2026-07-17\nsources: [https://example.com]\n---\n\nbody\n');
  writeFile(path.join(base, 'clients', '.gitkeep'), '');
  return base;
}

try {
  // 0. lib unit checks
  assert.deepStrictEqual(lib.EXECUTION_MODES, ['read-only', 'hitl', 'staging-autonomous', 'mixed']);
  assert.strictEqual(lib.INSTALL_POLICY, 'do-not-install-directly');
  assert.ok(lib.renderPacksRegistryMd({ packs: [{ name: 'p', domain: 'd', version: '0.1.0', execution_mode: 'read-only', risk_tier: 'standard', install_policy: 'do-not-install-directly', last_reviewed: '2026-01-01' }] }).includes('| p | d |'));

  // 1. clean pack → exit 0
  seedClean();
  assert.strictEqual(audit('test-pack').status, 0, 'clean pack should pass');

  // 2. bad install_policy → exit 3
  let base = seedClean();
  { const m = JSON.parse(fs.readFileSync(path.join(base, 'pack.json'))); m.install_policy = 'install-ok'; writeJson(path.join(base, 'pack.json'), m); }
  assert.strictEqual(audit('test-pack').status, 3, 'bad install_policy must fail');

  // 3. committed secret in knowledge → exit 3
  base = seedClean();
  fs.appendFileSync(path.join(base, 'knowledge', 'doc.md'), '\nkey: ' + 'sk-ant-' + 'A'.repeat(24) + '\n');
  assert.strictEqual(audit('test-pack').status, 3, 'committed secret must fail');

  // 4. executable/source file inside pack → exit 3
  base = seedClean();
  writeFile(path.join(base, 'tools', 'runner.js'), 'console.log(1)\n');
  assert.strictEqual(audit('test-pack').status, 3, 'executable in pack must fail');

  // 5. write-effect tool in a read-only pack → exit 3
  base = seedClean();
  writeJson(path.join(base, 'tools', 't_write.tool.json'), { name: 't_write', description: 'mutates', effect: 'write' });
  assert.strictEqual(audit('test-pack').status, 3, 'write tool in read-only pack must fail');

  // 6. missing guardrails policy → exit 3
  base = seedClean();
  fs.rmSync(path.join(base, 'guardrails', 'policy.json'));
  assert.strictEqual(audit('test-pack').status, 3, 'missing guardrails must fail');

  // 7. guardrails execution_mode mismatch → exit 3
  base = seedClean();
  writeJson(path.join(base, 'guardrails', 'policy.json'), { execution_mode: 'hitl' });
  assert.strictEqual(audit('test-pack').status, 3, 'guardrails mode mismatch must fail');

  // 8. stale last_reviewed → still exit 0, but a warning is emitted
  base = seedClean();
  { const m = JSON.parse(fs.readFileSync(path.join(base, 'pack.json'))); m.last_reviewed = '2000-01-01'; writeJson(path.join(base, 'pack.json'), m);
    const rj = JSON.parse(fs.readFileSync(path.join(TMP, 'packs', 'registry.json'))); rj.packs[0].last_reviewed = '2000-01-01'; writeJson(path.join(TMP, 'packs', 'registry.json'), rj); }
  const stale = audit('test-pack');
  assert.strictEqual(stale.status, 0, 'stale review is a warning, not a failure');
  assert.ok(/warn .*last_reviewed/.test(stale.stderr), 'stale review should warn');

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('pack-audit.test.js: all assertions passed');
} catch (e) {
  fs.rmSync(TMP, { recursive: true, force: true });
  console.error('pack-audit.test.js FAILED:', e.message);
  process.exit(1);
}
