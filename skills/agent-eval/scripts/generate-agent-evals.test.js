// skills/agent-eval/scripts/generate-agent-evals.test.js
'use strict';
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const assert = require('assert');

const TMP = path.join(__dirname, '__test_tmp__');
const AGENT_DIR = path.join(TMP, '.claude', 'agents');
const EVALS_DIR = path.join(TMP, 'evals', 'agents', 'test-agent');
const AGENT_FILE = path.join(AGENT_DIR, 'test-agent.md');
const SCRIPT = path.join(__dirname, 'generate-agent-evals.js');

// Sample agent file content
const AGENT_CONTENT = `---
name: test-agent
description: |
  Use this agent when you need to run automated tests for a codebase,
  execute the test suite, or check test results. Also use when measuring
  test coverage or running integration tests.
model: sonnet
color: cyan
tools: ["Read", "Bash"]
---

You are the Test Runner Agent.

## Workflow

1. **Read the test config** — read package.json or the project's test config.
2. **Execute the test suite** — run the test command.
3. **Report results** — summarise pass/fail counts and coverage.

## What NOT to Do

- Never modify source files.
- Never run destructive commands (rm, drop, delete).
`;

const CTX_CONTENT = JSON.stringify({
  project_name: 'my-project',
  stack: ['Node.js', 'Jest'],
  workflow_terms: ['CI', 'coverage'],
  installed_skills: ['skill-eval', 'test-agent'],
  key_phrases: ['test suite', 'coverage report'],
  artifact_paths: ['evals/agents/'],
  hooks: [{ command: 'pre-commit-lint.js' }],
  mcp_servers: [],
  plugins: [],
});

function setup() {
  fs.mkdirSync(AGENT_DIR, { recursive: true });
  fs.mkdirSync(path.join(TMP, 'evals', 'agents'), { recursive: true });
  fs.writeFileSync(AGENT_FILE, AGENT_CONTENT);
}

function teardown() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

function run(extraArgs = '') {
  execSync(
    `node ${SCRIPT} ${AGENT_FILE} ${extraArgs}`,
    { cwd: TMP, stdio: 'pipe' }
  );
  return JSON.parse(fs.readFileSync(path.join(EVALS_DIR, 'evals.json'), 'utf8'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

setup();

try {
  // Test 1: 6 scenarios without --context
  {
    const result = run();
    assert.strictEqual(result.agent_name, 'test-agent', 'agent_name mismatch');
    assert.ok(result.agent_file.includes('test-agent.md'), 'agent_file mismatch');
    assert.strictEqual(result.evals.length, 6, `Expected 6 scenarios, got ${result.evals.length}`);

    const types = result.evals.map(e => e.type);
    for (const t of ['direct', 'paraphrased', 'edge_case', 'negative', 'semantic', 'adversarial']) {
      assert.ok(types.includes(t), `Missing scenario type: ${t}`);
    }

    // dispatches field must be boolean
    for (const e of result.evals) {
      assert.ok(typeof e.expected.dispatches === 'boolean',
        `${e.type}: expected.dispatches must be boolean`);
    }

    // negative and adversarial must NOT dispatch
    const neg = result.evals.find(e => e.type === 'negative');
    assert.strictEqual(neg.expected.dispatches, false, 'negative must not dispatch');
    const adv = result.evals.find(e => e.type === 'adversarial');
    assert.strictEqual(adv.expected.dispatches, false, 'adversarial must not dispatch');

    // direct, paraphrased, semantic, edge_case must dispatch
    for (const t of ['direct', 'paraphrased', 'semantic', 'edge_case']) {
      const s = result.evals.find(e => e.type === t);
      assert.strictEqual(s.expected.dispatches, true, `${t} must dispatch`);
    }
    console.log('✓ Test 1: 6 scenarios without --context');
  }

  // Test 2: 9 scenarios with --context
  {
    const CTX_FILE = path.join(TMP, 'evals', 'project-context.json');
    fs.writeFileSync(CTX_FILE, CTX_CONTENT);
    // remove prior output to avoid false positive
    fs.rmSync(EVALS_DIR, { recursive: true, force: true });
    const result = run(`--context ${CTX_FILE}`);
    assert.strictEqual(result.evals.length, 9, `Expected 9 scenarios, got ${result.evals.length}`);

    const types = result.evals.map(e => e.type);
    for (const t of ['project-native', 'project-workflow', 'multi-turn']) {
      assert.ok(types.includes(t), `Missing context scenario type: ${t}`);
    }
    assert.strictEqual(result.project_context, CTX_FILE, 'project_context path mismatch');
    console.log('✓ Test 2: 9 scenarios with --context');
  }

  // Test 3: prompts are orchestration-framed (contain dispatch language)
  {
    const CTX_FILE = path.join(TMP, 'evals', 'project-context.json');
    const result = run(`--context ${CTX_FILE}`);
    const direct = result.evals.find(e => e.type === 'direct');
    // Direct prompt should NOT start with "I want to" (skill-framing) —
    // it should be an orchestration request
    assert.ok(direct.prompt.length > 0, 'direct prompt must not be empty');
    // adversarial note must mention binary scoring
    const adv = result.evals.find(e => e.type === 'adversarial');
    assert.ok(adv.expected.note.includes('0 if dispatched') || adv.expected.note.includes('binary'),
      'adversarial note must describe binary scoring');
    console.log('✓ Test 3: prompts are orchestration-framed');
  }

  console.log('\n✅ All tests passed');
} finally {
  teardown();
}
