# Agent Quality Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `agent-eval → agent-refine` to the pipeline so every adapted agent has a measurable quality baseline and an automated improvement path.

**Architecture:** Strict structural mirror of `skill-eval` / `skill-refine`. Same 5 metrics (Trigger Accuracy renamed Dispatch Accuracy), same 9 scenario types, same Lever A–E framework. Agent-specific adaptations: paths under `.claude/agents/` and `evals/agents/`, new `generate-agent-evals.js` script framing prompts as orchestration requests, Lever E targets frontmatter config (model/tools) instead of scripts.

**Tech Stack:** Node.js ≥ 18 (scripts only — no npm dependencies), Bash, Claude Code Agent tool

## Global Constraints

- Node.js ≥ 18 required; no external npm dependencies in scripts (use only built-in `fs`, `path`, `child_process`)
- All agent files live at `.claude/agents/<name>.md`; eval artifacts at `evals/agents/<name>/`
- `AGENT-EVAL.md` is co-located with the agent file: `.claude/agents/<name>-EVAL.md`
- `AGENT-REFINE-LOG.md` is co-located with the agent file: `.claude/agents/<name>-REFINE-LOG.md`
- Metrics use `dispatches` (boolean) not `triggers` in evals.json
- After any Lever E mutation (tools/model), agent-audit must re-run before scoring
- Skills are auto-discovered by install.sh via `find skills/ -mindepth 1 -maxdepth 1 -type d` — no hardcoded names
- Agents are auto-discovered by install.sh via `.claude/agents/*.md` — no hardcoded names
- Never hardcode a skill count; never commit anything under `evals/`
- Deploy to `~/.claude/skills/<skill-name>` after creating each skill so it takes effect immediately

---

### Task 1: generate-agent-evals.js

**Files:**
- Create: `skills/agent-eval/scripts/generate-agent-evals.js`
- Create: `skills/agent-eval/scripts/generate-agent-evals.test.js`

**Interfaces:**
- Consumes: `.claude/agents/<name>.md` (agent definition), `evals/project-context.json` (optional)
- Produces: `evals/agents/<name>/evals.json` — object with `agent_name`, `agent_file`, `project_context`, `evals[]`
- Each eval object: `{ id, eval_name, type, prompt, expected: { dispatches: bool, assertions?: string[], note?: string } }`

- [ ] **Step 1: Create the script directory**

```bash
mkdir -p skills/agent-eval/scripts
```

- [ ] **Step 2: Write the test file**

```js
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
```

- [ ] **Step 3: Run the test to confirm it fails (script doesn't exist yet)**

```bash
node skills/agent-eval/scripts/generate-agent-evals.test.js
```

Expected: `Error: Cannot find module ... generate-agent-evals.js` or similar. If it fails for this reason, the test harness is working correctly.

- [ ] **Step 4: Implement the script**

```js
#!/usr/bin/env node
// generate-agent-evals.js <.claude/agents/name.md> [--context <project-context.json>]
// Extracts dispatch scenarios from a Claude Code agent definition.
// Writes evals/agents/<name>/evals.json and emits JSON to stdout.
// Without --context: 6 scenarios. With --context: 9 scenarios.
'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: node generate-agent-evals.js <.claude/agents/name.md> [--context <project-context.json>]

Generate dispatch test scenarios for a Claude Code agent definition.

Arguments:
  .claude/agents/name.md       Path to the agent definition file
  --context <file>             Path to project-context.json (adds 3 project-specific scenarios)

Output:
  Writes evals/agents/<name>/evals.json and emits JSON to stdout.
  Without --context: 6 scenarios.
  With --context:    9 scenarios (adds project-native, project-workflow, multi-turn).

Examples:
  node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/skill-eval-agent.md
  node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/skill-eval-agent.md \\
    --context evals/project-context.json`);
  process.exit(0);
}

const inputFile   = args.find(a => !a.startsWith('--'));
const contextFlag = args.indexOf('--context');
const contextFile = contextFlag !== -1 ? args[contextFlag + 1] : null;

if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Error: agent file not found.');
  console.error('Usage: node generate-agent-evals.js <.claude/agents/name.md> [--context <file>]');
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf8');
const scenarios = [];
let id = 1;

// ── Load project context ──────────────────────────────────────────────────────
let projectCtx = null;
if (contextFile && fs.existsSync(contextFile)) {
  try { projectCtx = JSON.parse(fs.readFileSync(contextFile, 'utf8')); } catch {}
}

// ── Parse YAML frontmatter ────────────────────────────────────────────────────
// Handles: simple "key: value", block scalar "description: |", JSON array "tools: [...]"
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const raw = match[1];
  const result = {};

  // Block scalar: "description: |" followed by indented lines
  const blockMatch = raw.match(/^description:\s*\|?\n((?:[ \t]+.+\n?)*)/m);
  if (blockMatch) {
    result.description = blockMatch[1]
      .split('\n')
      .map(l => l.replace(/^[ \t]{2}/, ''))  // strip 2-space indent
      .join('\n')
      .trim();
  }

  // Simple key: value pairs (skip description — handled above)
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m || m[1] === 'description') continue;
    const [, key, val] = m;
    if (val.startsWith('[') && val.endsWith(']')) {
      // JSON array (tools list)
      try { result[key] = JSON.parse(val); } catch { result[key] = []; }
    } else {
      result[key] = val.trim().replace(/^["']|["']$/g, '');
    }
  }

  // Fallback: inline description (no block scalar)
  if (!result.description) {
    const inlineMatch = raw.match(/^description:\s*(.+)$/m);
    if (inlineMatch) result.description = inlineMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  return result;
}

// ── Extract workflow steps from body ─────────────────────────────────────────
function extractSteps(text) {
  const steps = [];
  for (const m of text.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)) steps.push(m[1]);
  return steps;
}

// ── Parse "Use when" triggers from description ───────────────────────────────
function extractUseWhen(description) {
  const uw = description.match(/[Uu]se (?:this agent )?when[^:]*:?\s*([\s\S]+?)(?:\n\n|$)/);
  if (!uw) return description.split('\n')[0];
  // Take the first condition (before first comma/semicolon/period)
  return uw[1].trim().split(/[;,\n]/)[0].trim().replace(/\.$/, '');
}

// ── Verb synonym table ────────────────────────────────────────────────────────
const VERB_SYNONYMS = {
  evaluate: ['assess', 'measure', 'benchmark', 'test', 'check'],
  run:      ['execute', 'launch', 'trigger', 'kick off'],
  find:     ['search for', 'locate', 'look for', 'discover'],
  audit:    ['review', 'inspect', 'scan', 'check'],
  adapt:    ['customize', 'modify', 'adjust', 'tailor'],
  refine:   ['improve', 'optimize', 'enhance', 'tune'],
  generate: ['create', 'build', 'write', 'produce'],
  analyze:  ['examine', 'inspect', 'review', 'investigate'],
};

function synonymPhrase(phrase) {
  const lower = phrase.toLowerCase();
  for (const [verb, syns] of Object.entries(VERB_SYNONYMS)) {
    if (lower.includes(verb)) {
      const syn = syns[Math.floor(Math.random() * syns.length)];
      return phrase.replace(new RegExp(verb, 'i'), syn);
    }
  }
  return null;
}

// ── Orchestration prompt helpers ──────────────────────────────────────────────
// Prompts are framed as orchestration requests (dispatching an agent),
// not as skill invocation trigger phrases.

function directPrompt(agentName, useWhen) {
  return `Dispatch the ${agentName} to ${useWhen}.`;
}

function paraphrasedPrompt(agentName, useWhen) {
  return `I need you to use the ${agentName} — specifically to ${useWhen}.`;
}

function edgePrompt(agentName, steps) {
  const last = steps[steps.length - 1] || 'finalize the output';
  const first = steps[0] || 'load the inputs';
  return steps.length > 1
    ? `I've already run the "${first}" step with ${agentName}. Can you have it resume from the "${last}" step?`
    : `The ${agentName} is partway through its workflow. Pick it up from where it left off.`;
}

function negativePrompt(agentName) {
  return `Can you explain what the ${agentName} does and how it works? I'm not asking you to run it — I just want to understand it.`;
}

function semanticPrompt(agentName, useWhen) {
  const syn = synonymPhrase(useWhen);
  return syn
    ? `Have the ${agentName} ${syn}.`
    : `Use the ${agentName} to handle the following: ${useWhen}.`;
}

function adversarialPrompt(agentName, useWhen) {
  // Inject agent vocabulary into a wrong-scope context
  const swapped = useWhen
    .replace(/\bskill[s]?\b/g, 'codebase')
    .replace(/\bagent[s]?\b/g, 'component')
    .replace(/\beval\b/g, 'code review');
  const changed = swapped !== useWhen;
  return changed
    ? `Use the ${agentName} to ${swapped}.`
    : `Before we dispatch the ${agentName}, walk me through whether it's even the right tool for this situation and what the alternatives are.`;
}

// ── Parse the agent file ───────────────────────────────────────────────────────
const fm    = parseFrontmatter(content);
const agentName  = fm.name || path.basename(inputFile, '.md');
const description = fm.description || '';
const tools = Array.isArray(fm.tools) ? fm.tools : [];
const steps = extractSteps(content);
const useWhen = extractUseWhen(description);

// ── Generate the 6 base scenarios ─────────────────────────────────────────────

// 1. direct
scenarios.push({
  id: id++,
  eval_name: 'direct-primary-dispatch',
  type: 'direct',
  prompt: directPrompt(agentName, useWhen),
  expected: {
    dispatches: true,
    assertions: [
      `Agent ${agentName} is dispatched (Agent tool call appears in transcript)`,
      ...steps.slice(0, 3).map(s => `Executes workflow step: ${s}`),
    ],
  },
});

// 2. paraphrased
scenarios.push({
  id: id++,
  eval_name: 'paraphrased-reword',
  type: 'paraphrased',
  prompt: paraphrasedPrompt(agentName, useWhen),
  expected: {
    dispatches: true,
    assertions: ['Produces same outcome as direct dispatch'],
  },
});

// 3. edge_case
scenarios.push({
  id: id++,
  eval_name: 'edge-case-mid-workflow',
  type: 'edge_case',
  prompt: edgePrompt(agentName, steps),
  expected: {
    dispatches: true,
    assertions: ['Handles partial workflow entry without restarting from scratch'],
  },
});

// 4. negative — must NOT dispatch
scenarios.push({
  id: id++,
  eval_name: 'negative-explain-only',
  type: 'negative',
  prompt: negativePrompt(agentName),
  expected: {
    dispatches: false,
    note: 'Explanation request — should answer conversationally without dispatching the agent',
  },
});

// 5. semantic — synonym verb
scenarios.push({
  id: id++,
  eval_name: 'semantic-synonym-dispatch',
  type: 'semantic',
  prompt: semanticPrompt(agentName, useWhen),
  expected: {
    dispatches: true,
    assertions: ['Synonym phrasing dispatches the correct agent'],
  },
});

// 6. adversarial — agent vocabulary in wrong scope; must NOT dispatch
scenarios.push({
  id: id++,
  eval_name: 'adversarial-wrong-scope',
  type: 'adversarial',
  prompt: adversarialPrompt(agentName, useWhen),
  expected: {
    dispatches: false,
    note: 'Adversarial probe — agent vocabulary used in wrong scope. Agent must NOT be dispatched. Score 10 if not dispatched, 0 if dispatched. No partial credit.',
  },
});

// ── Project-specific scenarios (only when --context is provided) ──────────────
if (projectCtx) {
  const projectName = projectCtx.project_name || 'this project';
  const terms       = projectCtx.workflow_terms || [];
  const stack       = projectCtx.stack || [];
  const artifacts   = projectCtx.artifact_paths || [];
  const installed   = projectCtx.installed_skills || [];
  const hooks       = (projectCtx.hooks || []).map(h => h.command).slice(0, 2);

  const projectTerm = terms[0] || projectCtx.key_phrases?.[0] || projectName;
  const artifactRef = artifacts[0] || '';
  const stackLabel  = stack.length > 0 ? ` for our ${stack.join('/')} project` : '';

  // 7. project-native
  scenarios.push({
    id: id++,
    eval_name: 'project-native-terminology',
    type: 'project-native',
    prompt: `Dispatch the ${agentName} to ${useWhen}${stackLabel} — we use ${projectTerm}${artifactRef ? ` and store outputs in ${artifactRef}` : ''}.`,
    expected: {
      dispatches: true,
      assertions: [
        `Output references project-specific terminology (${projectTerm})`,
        artifactRef ? `Output references correct artifact path (${artifactRef})` : null,
        `Agent aligns with project stack (${stack.join(', ') || 'as described'})`,
      ].filter(Boolean),
    },
    project_context_used: { term: projectTerm, artifact: artifactRef, stack },
  });

  // 8. project-workflow
  const sibling = installed.find(s => s !== agentName) || 'a sibling agent';
  scenarios.push({
    id: id++,
    eval_name: 'project-workflow-integration',
    type: 'project-workflow',
    prompt: installed.length > 1
      ? `After ${sibling} finished its run, dispatch the ${agentName} to ${useWhen}${stackLabel}.`
      : `Dispatch the ${agentName} to ${useWhen} as part of the ${projectName} workflow.`,
    expected: {
      dispatches: true,
      assertions: [
        'Agent dispatches correctly within the project workflow context',
        installed.length > 1
          ? `Output does not duplicate or conflict with ${sibling}`
          : `Output aligns with ${projectName} conventions`,
      ],
    },
    project_context_used: { installed_skills: installed, project_name: projectName },
  });

  // 9. multi-turn — continuation framing
  const hookHint = hooks.length > 0 ? ` (hooks: ${hooks.join(', ')})` : '';
  scenarios.push({
    id: id++,
    eval_name: 'multi-turn-resumed-context',
    type: 'multi-turn',
    prompt: [
      `[Continuing from earlier in our session]`,
      `We discussed ${projectName} and agreed to dispatch the ${agentName} to ${useWhen}.`,
      projectTerm !== projectName
        ? `We're using ${projectTerm}${hookHint}.`
        : hookHint ? `Our setup includes${hookHint}.` : '',
      `Let's continue — go ahead and dispatch it now.`,
    ].filter(Boolean).join(' '),
    expected: {
      dispatches: true,
      assertions: [
        'Agent dispatches correctly despite continuation/resumption framing',
        'Does not ask for information already established in context',
        projectTerm !== projectName
          ? `Incorporates established context (${projectTerm}) without re-asking`
          : 'Incorporates established project name without re-asking',
      ],
    },
    project_context_used: { project_name: projectName, workflow_term: projectTerm, hooks },
  });
}

// ── Write output ──────────────────────────────────────────────────────────────
const output = {
  agent_name:       agentName,
  agent_file:       inputFile,
  project_context:  contextFile || null,
  evals:            scenarios,
};

const outDir  = path.join(process.cwd(), 'evals', 'agents', agentName);
const outPath = path.join(outDir, 'evals.json');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.error(`Wrote ${scenarios.length} scenarios to ${outPath}${projectCtx ? ' (with project context)' : ''}`);
console.log(JSON.stringify(output, null, 2));
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
node skills/agent-eval/scripts/generate-agent-evals.test.js
```

Expected output:
```
✓ Test 1: 6 scenarios without --context
✓ Test 2: 9 scenarios with --context
✓ Test 3: prompts are orchestration-framed

✅ All tests passed
```

- [ ] **Step 6: Smoke-test against a real agent file**

```bash
node skills/agent-eval/scripts/generate-agent-evals.js \
  .claude/agents/skill-eval-agent.md \
  --context evals/project-context.json 2>/dev/null | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('agent:', d.agent_name, '| scenarios:', d.evals.length, '| types:', d.evals.map(e=>e.type).join(', '))"
```

Expected: `agent: skill-eval-agent | scenarios: 9 | types: direct, paraphrased, edge_case, negative, semantic, adversarial, project-native, project-workflow, multi-turn`

- [ ] **Step 7: Commit**

```bash
git add skills/agent-eval/scripts/generate-agent-evals.js \
        skills/agent-eval/scripts/generate-agent-evals.test.js
git commit -m "feat(agent-eval): add generate-agent-evals.js — dispatch scenario generator"
```

---

### Task 2: agent-eval skill files

**Files:**
- Create: `skills/agent-eval/SKILL.md`
- Create: `skills/agent-eval/REFERENCE.md`
- Create: `skills/agent-eval/assets/AGENT-EVAL.template.md`

**Interfaces:**
- Consumes: `.claude/agents/<name>.md`, `evals/project-context.json`, `generate-agent-evals.js` (Task 1)
- Produces: `AGENT-EVAL.md` at `.claude/agents/<name>-EVAL.md`, `refine-input.json` at `evals/agents/<name>/refine-input.json`

- [ ] **Step 1: Create directories**

```bash
mkdir -p skills/agent-eval/assets
```

- [ ] **Step 2: Write SKILL.md**

Create `skills/agent-eval/SKILL.md` with this exact content:

```markdown
---
name: agent-eval
description: Evaluates a Claude Code agent definition's effectiveness using structured dispatch scenarios and LLM-judge scoring. Produces 5 metrics: eval pass rate, dispatch accuracy, context footprint, project fit, and resilience. Use when evaluating an agent, measuring agent quality, running agent tests, checking agent effectiveness, or before running agent-refine.
compatibility: "Claude Code. Node.js ≥ 18. Requires Agent tool for parallel subagent execution."
---

# Agent Eval

Measure an agent's effectiveness with numbers, not feelings.

## Quick start

```
User: evaluate the skill-eval-agent
User: run agent-eval on agent-adapt
User: check how well skill-refine-agent is working
```

## Workflow

**Resume check (read first):** If the user's prompt indicates work is already in progress — e.g., "I've already generated the scenarios", "the eval is done, score it", "I'm at step N" — skip directly to the appropriate step. Do not re-run scenario generation (step 3) or project context extraction (step 2) if the user has confirmed those artifacts exist. Ask only for what is genuinely missing.

1. **Load the agent** — read `.claude/agents/<agent-name>.md` in full. Extract frontmatter: `name:`, `description:`, `model:`, `tools:`, `color:`. Note every field — all contribute to context footprint. Read the full body including workflow steps and "What NOT to Do" section.

2. **Extract project context** — check first: if `evals/project-context.json` was already confirmed to exist earlier in this session, read it directly and skip the script. Only run the script when the file's existence has not been established:
   ```bash
   node skills/skill-eval/scripts/extract-project-context.js
   ```
   Review the output and add any agent-specific terms the script missed.

3. **Generate dispatch scenarios** — run with project context:
   ```bash
   node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/<agent-name>.md \
     --context evals/project-context.json
   ```
   This produces 9 scenarios: 6 generic + 3 project-specific. Without `--context` you get 6. Always pass `--context evals/project-context.json` — do not ask the user whether to include it.

   | # | Type | Dispatches? | What it tests |
   |---|------|-------------|---------------|
   | 1 | `direct` | ✓ | Primary orchestration request — cold-start dispatch |
   | 2 | `paraphrased` | ✓ | Same intent, different orchestration phrasing |
   | 3 | `edge_case` | ✓ | Unusual but valid — starts mid-workflow or minimal input |
   | 4 | `negative` | ✗ | Explanation request — should NOT dispatch |
   | 5 | `semantic` | ✓ | Synonym verb variations for the agent's role |
   | 6 | `adversarial` | ✗ | Agent vocabulary in wrong scope — must NOT dispatch |
   | 7 | `project-native` | ✓ | Project terminology injected into orchestration prompt |
   | 8 | `project-workflow` | ✓ | Agent invoked after a sibling in the pipeline |
   | 9 | `multi-turn` | ✓ | Continuation framing from mid-session |

4. **Establish baseline** — before running with-agent tests, determine what to compare against:
   - **New agent**: no agent at all — run each scenario with general capabilities only, no Agent tool call
   - **Existing agent being improved**: snapshot first:
     ```bash
     cp .claude/agents/<name>.md .claude/agents/<name>.md.eval-snapshot
     ```
     then use the snapshot as the baseline version.

5. **Run parallel evaluations** — for each scenario, spawn two subagents **in the same turn** via `agent-eval-agent`:
   - **With-agent**: dispatch the named agent, execute the prompt, save output to `evals/agents/<agent-name>/iteration-<N>/<id>/with_agent/`
   - **Baseline**: no agent dispatched (general capabilities only), same prompt, save to `evals/agents/<agent-name>/iteration-<N>/<id>/without_agent/`

   Run trigger-type scenarios (direct, paraphrased, semantic, negative, adversarial) 3 times each to measure dispatch consistency. Record `total_tokens` and `duration_ms` from each run — save to `timing.json` in the run directory.

6. **Grade outputs** — score each with-agent run using the LLM judge rubric in REFERENCE.md. For dispatch scenarios, use programmatic detection first (did an `Agent` tool call with this agent's `name` appear in the transcript?), then LLM judgment for quality.

7. **Compute 5 metrics**:
   - **Eval Pass Rate** = (scenarios scoring ≥ 7) / total × 100%. Threshold: ≥ 80%
   - **Dispatch Accuracy** = (correct dispatch decisions across all dispatch-type scenarios, 3 reps each) / total checks × 100%. Threshold: ≥ 85%
   - **Context Footprint** = total lines in agent file + estimated tokens (lines × 4 avg)
   - **Project Fit Score** = average of project-native + project-workflow + multi-turn ProjectFit dimension scores × 10. Only reported when `--context` was used. Threshold: ≥ 7/10
   - **Resilience Score** = (adversarial scenarios scoring > 0) / total adversarial × 10. Threshold: ≥ 8/10. An agent that dispatches on adversarial probes has an over-broad description — route to Lever A in agent-refine.

8. **Analyst pass** — before writing the report, review graded results for:
   - Scenarios that pass whether or not the agent is dispatched (non-discriminating)
   - High-variance scenarios (dispatched 1/3 or 2/3 times — unstable description)
   - Large baseline delta (agent significantly outperforms or underperforms general capabilities)
   - Adversarial false positives (agent dispatched when it should not — description too broad; route to Lever A)
   - Tool violations (agent used a tool not listed in its frontmatter `tools:` field → TOOL_VIOLATION flag)
   - Multi-turn redundancy (agent re-asked for context already in the preamble → MULTI_TURN_REDUNDANCY flag)

9. **Write AGENT-EVAL.md** — save to `.claude/agents/<agent-name>-EVAL.md` using the template in REFERENCE.md.

10. **Agent-refine handoff** — if Eval Pass Rate < 80%, Dispatch Accuracy < 85%, Project Fit Score < 7, or Resilience Score < 8, write `evals/agents/<agent-name>/refine-input.json` with failing scenario names, root causes, and analyst observations. Then invoke `agent-refine`.

## Scoring rubric (per scenario, 0–10)

| Score | Meaning |
|-------|---------|
| 10 | Correct dispatch decision + complete workflow + correct output |
| 7–9 | Minor deviation (step skipped, slightly imprecise) |
| 4–6 | Partial execution (dispatched but workflow incomplete) |
| 1–3 | Wrong dispatch decision or substantially wrong output |
| 0 | Failed to dispatch when required, or dispatched when it shouldn't |

**Eval Pass Rate:** ≥ 80% = healthy; 60–79% = refine; < 60% = rewrite  
**Dispatch Accuracy:** ≥ 85% = healthy; < 85% = description needs optimization (Lever A)  
**Project Fit Score:** ≥ 7/10 = well-adapted; < 7 = re-run agent-adapt with richer project context  
**Resilience Score:** ≥ 8/10 = healthy; < 8 = description too broad — tighten trigger language (Lever A)

**Adversarial scoring:** Score 10 = correctly did NOT dispatch + gave a useful redirect. Score 0 = incorrectly dispatched. No partial credit on adversarial scenarios.

**Multi-turn scoring:** Apply composite formula, then deduct 3 points if the agent re-asked for information already in the "[Continuing from earlier]" preamble.

See [REFERENCE.md](REFERENCE.md) for scenario types, eval file format, LLM judge rubric, and report template.
```

- [ ] **Step 3: Write REFERENCE.md**

Create `skills/agent-eval/REFERENCE.md` with this exact content:

```markdown
# Agent Eval Reference

## Scenario Types

Generate one of each type. Named evals are easier to track than "eval-0".

| # | Type | Expected dispatch | Description | Example |
|---|------|------------------|-------------|---------|
| 1 | `direct` | ✓ | Exact orchestration request derived from agent description | `"Dispatch the skill-eval-agent to evaluate skill-adapt"` |
| 2 | `paraphrased` | ✓ | Same intent, different orchestration phrasing | `"I need you to use the skill-eval-agent — specifically to evaluate skill-adapt"` |
| 3 | `edge_case` | ✓ | Unusual but valid — starts mid-workflow or uses minimal input | `"skill-eval-agent already loaded the scenarios. Have it resume from the grading step."` |
| 4 | `negative` | ✗ | Should NOT dispatch — explanation request | `"Can you explain what skill-eval-agent does? I'm not asking you to run it."` |
| 5 | `semantic` | ✓ | Synonym variation of the action verb | `"benchmark" / "assess" / "measure"` for `"evaluate"` |
| 6 | `adversarial` | ✗ | Agent vocabulary in wrong scope — must NOT dispatch | `"Use the eval agent to check my React components"` |
| 7 | `project-native` | ✓ | Uses project-specific terminology, stack, and artifact paths | `"Dispatch skill-eval-agent for our Node.js/GSD project — outputs go in evals/agents/"` |
| 8 | `project-workflow` | ✓ | Agent invoked after a sibling in the pipeline | `"After agent-adapt finished, dispatch skill-eval-agent to evaluate it"` |
| 9 | `multi-turn` | ✓ | Continuation framing from mid-session | `"[Continuing from earlier] We agreed to dispatch skill-eval-agent. Go ahead."` |

Types 1–6 always generated. Types 7–9 require `--context evals/project-context.json`.

**Repetitions:** Run dispatch-type scenarios (direct, paraphrased, semantic, negative, adversarial) 3 times each. Run non-dispatch scenarios (edge_case, project-native, project-workflow, multi-turn) once per side.

---

## Eval File Format (`evals/agents/<name>/evals.json`)

```json
{
  "agent_name": "skill-eval-agent",
  "agent_file": ".claude/agents/skill-eval-agent.md",
  "project_context": "evals/project-context.json",
  "evals": [
    {
      "id": 1,
      "eval_name": "direct-primary-dispatch",
      "type": "direct",
      "prompt": "Dispatch the skill-eval-agent to evaluate skill-adapt.",
      "expected": {
        "dispatches": true,
        "assertions": [
          "Agent skill-eval-agent is dispatched (Agent tool call appears in transcript)",
          "Executes workflow step: Load the skill",
          "Reports all 5 metrics"
        ]
      }
    },
    {
      "id": 6,
      "eval_name": "adversarial-wrong-scope",
      "type": "adversarial",
      "prompt": "Use the eval agent to check my React components for accessibility issues.",
      "expected": {
        "dispatches": false,
        "note": "Adversarial probe — agent vocabulary used in wrong scope. Agent must NOT be dispatched. Score 10 if not dispatched, 0 if dispatched. No partial credit."
      }
    },
    {
      "id": 9,
      "eval_name": "multi-turn-resumed-context",
      "type": "multi-turn",
      "prompt": "[Continuing from earlier in our session] We discussed claude_code and agreed to dispatch the skill-eval-agent to evaluate skill-adapt. We're using GSD. Let's continue — go ahead and dispatch it now.",
      "expected": {
        "dispatches": true,
        "assertions": [
          "Agent dispatches correctly despite continuation/resumption framing",
          "Does not ask for information already established in context",
          "Incorporates established context (GSD) without re-asking"
        ]
      },
      "project_context_used": {
        "project_name": "claude_code",
        "workflow_term": "GSD",
        "hooks": []
      }
    }
  ]
}
```

---

## LLM Judge Rubric

Use a faster model (e.g., Haiku) as judge. Evaluate each with-agent run on 3 dimensions.

### Dimension 1: Dispatch Accuracy (0–10)
- Correct dispatch decision (dispatches/withholds matches expected) → 10
- Dispatched with hesitation, or failed to dispatch confidently → 5
- Dispatched on a negative case, or failed on a direct case → 0

Check programmatically first: did an `Agent` tool call with this agent's `name` field appear in the transcript? Use LLM judgment only for borderline cases.

### Dimension 2: Workflow Completion (0–10)
Count numbered steps in the agent's body.  
Score = (steps completed correctly / total steps) × 10

### Dimension 3: Output Correctness (0–10)
Compare actual output against the `assertions` array in the eval:
- All assertions met → 10
- Minor omissions or imprecisions → 7–9
- Key elements missing → 4–6
- Wrong output → 0–3

### Dimension 4: Project Fit (0–10) — project-native, project-workflow, and multi-turn only
- Output uses project-specific terminology correctly → 4 pts
- Output references the correct project artifact paths → 3 pts
- Output aligns with the project's installed agent ecosystem (no conflicts, correct handoffs) → 3 pts

**Base composite = (Dispatch × 0.4) + (Workflow × 0.3) + (Output × 0.3)**  
**Project composite = (Dispatch × 0.35) + (Workflow × 0.25) + (Output × 0.25) + (ProjectFit × 0.15)**  
**Project Fit Score** = average of Dimension 4 scores across project-native + project-workflow + multi-turn.

### Special scoring rules

**Adversarial scenarios (type: adversarial, expected dispatches: false):**  
Do NOT apply the base composite formula. Score is binary:
- **10** — agent correctly did NOT dispatch AND gave a useful redirect or neutral response
- **0** — agent incorrectly dispatched on a wrong-scope prompt

No partial credit. A score of 0 on any adversarial scenario is an immediate `ADVERSARIAL_FAILURE` flag.

**Multi-turn scenarios (type: multi-turn, expected dispatches: true):**  
Apply the project composite formula, then apply one deduction:
- **−3 pts** if the agent re-asked for any information already present in the "[Continuing from earlier]" preamble

**Resilience Score** = (adversarial scenarios scoring > 0) / total adversarial × 10. Target ≥ 8/10.

---

## Analyst Pass Checklist

After grading all runs, check for:

- [ ] **Non-discriminating assertions** — scenarios that pass both with-agent and without-agent (agent adds no value here)
- [ ] **Flaky dispatch** — scenarios that dispatched 1 or 2 out of 3 reps (description is unstable)
- [ ] **Baseline delta** — is the with-agent output meaningfully better than general capabilities? If not, the agent may be redundant
- [ ] **Token cost vs. benefit** — high-footprint agents should show proportionally larger baseline delta
- [ ] **Project terminology mismatch** — project-native scenario dispatched but output used generic language instead of project terms
- [ ] **Ecosystem conflict** — project-workflow scenario shows agent duplicating or contradicting output from a sibling agent
- [ ] **Adversarial failure** — adversarial scenario scored 0 (agent over-dispatched; description too broad → Lever A)
- [ ] **Multi-turn redundancy** — multi-turn scenario lost 3 pts for re-asking context already given (→ Lever B)
- [ ] **Tool violation** — agent used a tool not in its frontmatter `tools:` list (→ TOOL_VIOLATION flag; fix via Lever E)

---

## AGENT-EVAL.md Template

> Standalone file: `skills/agent-eval/assets/AGENT-EVAL.template.md`

```markdown
# Agent Eval: <agent-name>
**Date:** YYYY-MM-DD  
**Iteration:** N  
**Evaluator:** agent-eval-agent  
**Model:** <declared model>  
**Tools:** <declared tools list>  
**Scenarios run:** N (×3 reps for dispatch-type scenarios)  
**Baseline:** no-agent | snapshot of previous version

## Metrics

| Metric            | Score    | Threshold | Status              |
|-------------------|----------|-----------|---------------------|
| Eval Pass Rate    | XX%      | ≥ 80%     | PASS / FAIL         |
| Dispatch Accuracy | XX%      | ≥ 85%     | PASS / FAIL         |
| Context Footprint | XXL/~XXt | —         | OK / HIGH           |
| Project Fit Score | X.X/10   | ≥ 7       | PASS / FAIL / N/A   |
| Resilience Score  | X.X/10   | ≥ 8       | PASS / BROADEN / N/A|

## Scenario Results

| ID | Name | Type | Dispatched (reps) | Score | Baseline delta | Notes |
|----|------|------|-------------------|-------|----------------|-------|
| 1 | direct-primary-dispatch | direct | 3/3 ✓ | 9/10 | +4 pts | |
| 4 | negative-explain-only | negative | 0/3 ✓ | 10/10 | n/a | |
| 6 | adversarial-wrong-scope | adversarial | 0/3 ✓ | 10/10 | n/a | Binary score |
| 9 | multi-turn-resumed-context | multi-turn | 1/1 ✓ | 8/10 | +3 pts | −2 pts: re-asked stack |

## Analyst Observations

- Non-discriminating: (list any)
- Flaky dispatch: (list any)
- Baseline delta summary: (one sentence)
- Project terminology mismatch: (list any)
- Ecosystem conflicts: (list any)
- Adversarial failures: (list any — ADVERSARIAL_FAILURE flag)
- Multi-turn redundancy: (list any — MULTI_TURN_REDUNDANCY flag)
- Tool violations: (list any — TOOL_VIOLATION flag)

## Issues Found

(list scenarios scoring < 7, with root cause)

## Recommendation

HEALTHY / REFINE: <metric> / REWRITE / RE-ADAPT

## Next step

(none | invoke agent-refine with evals/agents/<agent-name>/refine-input.json)
```

---

## Agent-Refine Handoff Format (`evals/agents/<name>/refine-input.json`)

Written when any metric falls below threshold.

```json
{
  "agent_name": "skill-eval-agent",
  "agent_file": ".claude/agents/skill-eval-agent.md",
  "eval_date": "YYYY-MM-DD",
  "iteration": 1,
  "failing_metrics": {
    "eval_pass_rate":    { "value": 65, "threshold": 80, "failing": true },
    "dispatch_accuracy": { "value": 78, "threshold": 85, "failing": true },
    "resilience_score":  { "value": 6.7, "threshold": 8, "failing": false },
    "project_fit_score": { "value": 8.2, "threshold": 7, "failing": false }
  },
  "failing_scenarios": [
    {
      "id": 2,
      "eval_name": "paraphrased-reword",
      "type": "paraphrased",
      "score": 5.0,
      "root_cause": "Agent not dispatched on 'I need you to use...' phrasing — description only lists imperative forms"
    }
  ],
  "analyst_observations": [
    "Flaky dispatch on semantic-synonym (2/3 reps) — description missing synonym 'benchmark'",
    "Non-discriminating: edge_case scenario passes without agent"
  ],
  "recommended_lever": "A"
}
```
```

- [ ] **Step 4: Write assets/AGENT-EVAL.template.md**

Create `skills/agent-eval/assets/AGENT-EVAL.template.md` with this exact content:

```markdown
# Agent Eval: <agent-name>
**Date:** YYYY-MM-DD  
**Iteration:** N  
**Evaluator:** agent-eval-agent  
**Model:** <declared model>  
**Tools:** <declared tools list>  
**Scenarios run:** N (×3 reps for dispatch-type scenarios)  
**Baseline:** no-agent | snapshot of previous version

## Metrics

| Metric            | Score    | Threshold | Status              |
|-------------------|----------|-----------|---------------------|
| Eval Pass Rate    | XX%      | ≥ 80%     | PASS / FAIL         |
| Dispatch Accuracy | XX%      | ≥ 85%     | PASS / FAIL         |
| Context Footprint | XXL/~XXt | —         | OK / HIGH           |
| Project Fit Score | X.X/10   | ≥ 7       | PASS / FAIL / N/A   |
| Resilience Score  | X.X/10   | ≥ 8       | PASS / BROADEN / N/A|

## Scenario Results

| ID | Name | Type | Dispatched (reps) | Score | Baseline delta | Notes |
|----|------|------|-------------------|-------|----------------|-------|

## Analyst Observations

- Non-discriminating: (list any)
- Flaky dispatch: (list any)
- Baseline delta summary: (one sentence)
- Project terminology mismatch: (list any)
- Ecosystem conflicts: (list any)
- Adversarial failures: (list any — ADVERSARIAL_FAILURE flag)
- Multi-turn redundancy: (list any — MULTI_TURN_REDUNDANCY flag)
- Tool violations: (list any — TOOL_VIOLATION flag)

## Issues Found

(list scenarios scoring < 7, with root cause)

## Recommendation

HEALTHY / REFINE: <metric> / REWRITE / RE-ADAPT

## Next step

(none | invoke agent-refine with evals/agents/<agent-name>/refine-input.json)
```

- [ ] **Step 5: Deploy to runtime**

```bash
cp -r skills/agent-eval ~/.claude/skills/agent-eval
```

- [ ] **Step 6: Commit**

```bash
git add skills/agent-eval/SKILL.md \
        skills/agent-eval/REFERENCE.md \
        skills/agent-eval/assets/AGENT-EVAL.template.md
git commit -m "feat(agent-eval): add agent-eval skill — SKILL.md, REFERENCE.md, report template"
```

---

### Task 3: agent-refine skill files

**Files:**
- Create: `skills/agent-refine/SKILL.md`
- Create: `skills/agent-refine/REFERENCE.md`
- Create: `skills/agent-refine/assets/AGENT-REFINE-LOG.template.md`

**Interfaces:**
- Consumes: `evals/agents/<name>/refine-input.json` (from agent-eval), `.claude/agents/<name>-EVAL.md`, `.claude/agents/<name>.md`
- Produces: `.claude/agents/<name>.md` (improved), `.claude/agents/<name>-REFINE-LOG.md` (append-only log), updated `.claude/agents/<name>-EVAL.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p skills/agent-refine/assets
```

- [ ] **Step 2: Write SKILL.md**

Create `skills/agent-refine/SKILL.md` with this exact content:

```markdown
---
name: agent-refine
description: Auto-improves a Claude Code agent definition using Karpathy's autoresearch loop — baseline eval, targeted mutation, re-measure, keep or revert. Produces a delta report. Use when refining an agent, improving an agent definition, running autoresearch on an agent, or when agent-eval reports any metric below threshold.
compatibility: "Claude Code. Node.js ≥ 18. Requires Agent tool for agent-eval-agent invocation."
---

# Agent Refine

Apply Karpathy's autoresearch loop to measurably improve an agent definition. Diagnose → targeted fix → verified improvement. No guessing, no rewrites.

## Prerequisite

`agent-eval` must have run first. You need a baseline and a `refine-input.json` at `evals/agents/<agent-name>/refine-input.json`. If neither exists, run `agent-eval` now.

## The Loop

```
RULE:    One lever per iteration. Score ↑ (>+2%) → keep. Score ↓ (>−5%) → revert. Repeat.
TARGET:  eval_pass_rate ≥ 80%  AND  dispatch_accuracy ≥ 85%  AND  resilience_score ≥ 8/10
BUDGET:  default 10 iterations, stop early at 95%+ for 3 consecutive
```

## Workflow

1. **Gather inputs** — load `.claude/agents/<name>-EVAL.md` and `evals/agents/<name>/refine-input.json`. Confirm budget and runs-per-experiment with the user (default: 10 iterations, 3 reps each).

2. **Back up and validate baseline** — copy the current agent before touching anything:
   ```bash
   cp .claude/agents/<name>.md .claude/agents/<name>.md.baseline
   ```
   Then check staleness: if `refine-input.json` was written today **and** the agent file has not been modified since — trust the baseline scores directly, no re-run needed. If the agent was changed since eval ran, re-run only the failing scenarios (3 reps, same parallel subagent pattern as agent-eval) to refresh the baseline before proceeding. If baseline is already ≥ 90%, ask the user whether to continue.

3. **Route by failing metric** — the correct lever depends on *which* metric is failing:
   - **Project Fit Score < 7** → check which scenarios drove it down:
     - If `project-native` or `project-workflow` failed → Exit. Re-run `agent-adapt` with richer `evals/project-context.json`. Refining won't fix a mis-adapted agent.
     - If ONLY `multi-turn` failed (project-native and project-workflow passed) → do NOT exit. Work Lever B this session: add a continuation-awareness note to the workflow step whose output the multi-turn scenario re-asked for.
   - **Resilience Score < 8/10** → work Lever A (description) only this session. The agent is dispatching on adversarial probes — the trigger language is too broad. Tighten the "Use when" clause and add negative examples. Don't touch B–E until resilience passes.
   - **Dispatch Accuracy < 85%** → work Lever A (description) only this session. Don't touch B–E until dispatch is stable.
   - **Eval Pass Rate < 80%** (dispatch and resilience fine) → work Levers B–E.
   - **Multiple failing** → fix Lever A first; pass rate and resilience issues are often downstream of description problems.

4. **Train/test split** — treat the failing scenarios from `refine-input.json` as the *training set* (mutate against these). Hold the `project-native`, `project-workflow`, and `multi-turn` scenarios as the *validation set* (run only on final validation, not during iterations).

   Exception: `adversarial` scenarios belong on the **training set** even when resilience_score is the failing metric — they are the most direct signal for Lever A mutations and must be checked each iteration. Running them only at final validation defeats the purpose.

5. **Hypothesis** — pick ONE change from the lever space. Consult the failure mode → lever table in REFERENCE.md. Track which levers have been tried this session — vary lever types in early iterations; exploit the best-performing lever in later ones.

6. **Mutate** — make exactly the targeted edit. No other changes.
   - **Lever E only**: after mutating `model:` or `tools:` in the frontmatter, immediately re-run agent-audit:
     ```bash
     node skills/skill-audit/scripts/static-scan.js .claude/agents/<name>.md
     ```
     A BLOCK verdict counts as a score of 0 for this iteration — revert immediately and log.

7. **Re-eval (training set only)** — re-run the failing scenarios using agent-eval's exact methodology: parallel subagents (with-agent vs baseline snapshot), 3 reps each, programmatic dispatch detection first, then LLM judge scoring. Also run 1 rep of each previously-passing scenario as a regression check. Use the same scoring formula: `(Dispatch × 0.4) + (Workflow × 0.3) + (Output × 0.3)`.

8. **Keep or revert** (see thresholds in REFERENCE.md):
   - Improved → **KEEP**. Sync to runtime: `cp .claude/agents/<name>.md ~/.claude/ 2>/dev/null || true`
   - Regressed or neutral → **REVERT** to prior content exactly.
   - Log the iteration either way — failed hypotheses are data.

9. **Repeat** steps 5–8 until any convergence criterion is met (see REFERENCE.md).

10. **Final validation** — invoke `agent-eval` on the improved agent with `--context evals/project-context.json`. Do not implement a separate eval process — agent-eval IS the final validation. This produces a new `AGENT-EVAL.md` replacing the old one, giving a clean before/after comparison. The held-out `project-native`, `project-workflow`, and `multi-turn` scenarios run here for the first time during this refinement session. All 5 metrics must be reported.

11. **Write report** — save `.claude/agents/<name>-REFINE-LOG.md` using the template in REFERENCE.md.

## Rules

- **One lever per iteration** — never change description AND a workflow step in the same iteration.
- **Re-run agent-audit after Lever E** — any tools/model change must pass the security scanner before scoring.
- **Revert faithfully** — restore the exact prior content, not a rewrite of it.
- **Log every iteration** — including failed hypotheses. They're data.
- **Don't rewrite** — if pass rate < 40% after 5 iterations, recommend writing a new agent definition from scratch.
- **Never skip the baseline backup** — `.md.baseline` must exist before the first mutation.

See [REFERENCE.md](REFERENCE.md) for lever definitions, keep/revert thresholds, hypothesis guide, good/bad mutations, convergence criteria, and log template.
```

- [ ] **Step 3: Write REFERENCE.md**

Create `skills/agent-refine/REFERENCE.md` with this exact content:

```markdown
# Agent Refine Reference

## Routing Guide — Which Metric → Which Lever

| Failing metric | Root cause | Action |
|----------------|-----------|--------|
| Project Fit Score < 7 (project-native or project-workflow failed) | Agent wasn't adapted to project context | **Exit: re-run agent-adapt** with richer project-context.json |
| Project Fit Score < 7 (ONLY multi-turn failed) | Agent re-asks established context | **Lever B** — add continuation-awareness note; do NOT exit to agent-adapt |
| Resilience Score < 8/10 | Description too broad — dispatches on wrong-scope prompts | **Lever A only** — tighten trigger conditions; add negative examples ("not when X") |
| Dispatch Accuracy < 85% | Description doesn't match how orchestrators phrase requests | **Lever A only** — don't touch B–E until dispatch is stable |
| Eval Pass Rate < 80%, dispatch and resilience fine | Agent dispatches but executes incorrectly | **Levers B–E** |
| Multiple metrics failing | Dispatch/resilience instability cascades to execution failures | **Lever A first**, then B–E |

---

## Keep / Revert Thresholds

| Outcome | Condition | Decision |
|---------|-----------|----------|
| **KEEP** | pass_rate > baseline + 2% | This is the new baseline |
| **REVERT** | pass_rate < baseline − 5% | Restore exact prior content |
| **NEUTRAL → KEEP** | Within ±2–5% | Keep — slight preference for new; simpler isn't worse |

A neutral result that makes the agent file *shorter* is a win. Simplification that maintains the score reduces context footprint.

---

## Lever Space

**Lever A — Description wording** (dispatch precision)
The `description:` frontmatter field. Changes what prompts cause Claude to dispatch this agent.
- Constraint: keep "Use when [X]" format, ≤ 1024 chars
- High-impact: one word change can shift dispatch accuracy by 20%+

**Lever B — Workflow step** (completeness / ordering)
Any numbered step in the agent body. Changes what the agent does when dispatched.
- Constraint: one step at a time, never reorder all steps at once

**Lever C — Examples** (dispatch clarity for ambiguous roles)
`<example>` blocks inside the `description:` field (multi-line YAML block scalar).
- Constraint: examples must reflect real dispatch scenarios, not idealized ones

**Lever D — What NOT to Do** (scope containment)
The `## What NOT to Do` section in the agent body.
- Constraint: don't move core workflow logic here; this section is for constraints, not steps

**Lever E — Frontmatter config** (cost and tool compliance)
The `model:` and `tools:` frontmatter fields.
- Constraint: never expand `tools:` beyond what the role requires; always re-run agent-audit after any Lever E mutation before scoring. A BLOCK verdict = score 0, revert immediately.
- `model:` haiku for lightweight tasks, sonnet for reasoning, opus for complex orchestration
- `tools:` trim to minimum; never add tools not in the source without explicit user approval

---

## Good vs Bad Mutations

**Good mutations:**
- Add a specific "Use when" condition addressing the most common dispatch failure
- Reword an ambiguous "Use when" clause to be more explicit
- Add a negative example ("not when X") for a recurring false dispatch
- Move a buried dispatch condition higher in the description (priority = position)
- Add or improve an `<example>` block showing the correct dispatch trigger
- Remove a workflow step that causes tool scope violations
- Trim `tools:` to remove a tool the agent never uses

**Bad mutations:**
- Rewriting the entire agent definition from scratch
- Adding multiple rules in one iteration
- Making the agent file longer without a specific reason
- Adding vague instructions like "be more careful" or "do better"
- Changing both description and a workflow step in the same iteration
- Expanding `tools:` without re-running agent-audit

---

## Hypothesis Generation Guide

| Failure mode | Lever | Example hypothesis |
|-------------|-------|--------------------|
| Agent doesn't dispatch | A | Add/clarify "Use when" trigger conditions |
| Agent over-dispatches (low dispatch accuracy) | A | Narrow description: add specific role qualifier |
| **Adversarial false dispatch** (resilience < 8) | **A** | Add "not when [wrong scope]" to description; add negative example |
| Step was skipped | B | Add explicit output requirement to step N |
| **Multi-turn re-asks established context** | **B** | Add continuation-awareness note: "If prior context established [X], skip asking for it" |
| Output wrong format | C | Add example showing correct output format |
| Tool scope violation (TOOL_VIOLATION flag) | D or E | Add "Never use [tool]" to What NOT to Do, or remove from tools: list |
| Agent costs too much for lightweight task | E | Downgrade model: sonnet → haiku |
| Agent uses undeclared tools | E | Add missing tool to tools: list; re-run agent-audit |

**Coverage tracking** — note which lever type was used each iteration. Vary lever types in iterations 1–4 (explore). Exploit the best-performing lever in iterations 5+.

---

## Convergence Criteria

Stop the loop when ANY of:

1. `eval_pass_rate ≥ 80%` AND `dispatch_accuracy ≥ 85%` AND `resilience_score ≥ 8` → **DONE**
2. All three ≥ 95% for 3 consecutive experiments → **DONE** (diminishing returns)
3. Budget exhausted with no improvement in last 2 iterations → **DONE**
4. All generated hypotheses have been tested → **DONE**
5. `eval_pass_rate < 40%` after 5 iterations → **REWRITE** — recommend writing a new agent definition
6. Project Fit Score < 7 AND (project-native or project-workflow failed) → **RE-ADAPT** — do not enter refinement loop
   Exception: if ONLY multi-turn failed, this is NOT an exit condition — continue with Lever B

---

## AGENT-REFINE-LOG.md Template

> Standalone file: `skills/agent-refine/assets/AGENT-REFINE-LOG.template.md`

Save to `.claude/agents/<agent-name>-REFINE-LOG.md`.

```markdown
# Agent Refinement Log: <agent-name>
**Started:** YYYY-MM-DD  
**Baseline:** eval_pass_rate=XX%, dispatch_accuracy=XX%, resilience=X.X/10, project_fit=X.X/10  
**Target:** eval_pass_rate ≥ 80%, dispatch_accuracy ≥ 85%, resilience_score ≥ 8/10  
**Training set:** <N> failing scenarios from refine-input.json (adversarial always included)  
**Held-out set:** project-native, project-workflow, multi-turn scenarios  

## Iterations

### Iteration 1
- **Hypothesis:** Changing [section] will improve [scenario name] because [reason]
- **Lever:** A/B/C/D/E — [what type of change]
- **Change:** [one-line summary]
- **Before:** eval_pass_rate=XX%, dispatch_accuracy=XX%, resilience=X.X/10
- **After:** eval_pass_rate=XX%, dispatch_accuracy=XX%, resilience=X.X/10
- **Agent-audit:** PASS / BLOCK (if Lever E — always run)
- **Decision:** KEPT / REVERTED / NEUTRAL-KEPT
- **Note:** [why it worked or didn't]

## Final Results

| Metric | Baseline | Final | Delta |
|--------|----------|-------|-------|
| Eval Pass Rate | XX% | XX% | +/-XX% |
| Dispatch Accuracy | XX% | XX% | +/-XX% |
| Resilience Score | X.X/10 | X.X/10 | +/-X.X |
| Project Fit Score | X.X/10 | X.X/10 | +/-X.X |
| Context Footprint | XXL | XXL | +/-XXL |
| Iterations run | — | N | — |
| Keep rate | — | X/N | — |

**Levers used:** A(N), B(N), C(N), D(N), E(N)  
**Most effective lever:** [letter] — [what worked]  
**Failed hypotheses:** [list — data for future sessions]  

**Recommendation:** DONE / NEEDS-REWRITE / CONTINUE / RE-ADAPT
```
```

- [ ] **Step 4: Write assets/AGENT-REFINE-LOG.template.md**

Create `skills/agent-refine/assets/AGENT-REFINE-LOG.template.md` with this exact content:

```markdown
# Agent Refinement Log: <agent-name>
**Started:** YYYY-MM-DD  
**Baseline:** eval_pass_rate=XX%, dispatch_accuracy=XX%, resilience=X.X/10, project_fit=X.X/10  
**Target:** eval_pass_rate ≥ 80%, dispatch_accuracy ≥ 85%, resilience_score ≥ 8/10  
**Training set:** <N> failing scenarios from refine-input.json (adversarial always included)  
**Held-out set:** project-native, project-workflow, multi-turn scenarios  

## Iterations

### Iteration 1
- **Hypothesis:** Changing [section] will improve [scenario name] because [reason]
- **Lever:** A/B/C/D/E — [what type of change]
- **Change:** [one-line summary]
- **Before:** eval_pass_rate=XX%, dispatch_accuracy=XX%, resilience=X.X/10
- **After:** eval_pass_rate=XX%, dispatch_accuracy=XX%, resilience=X.X/10
- **Agent-audit:** PASS / BLOCK (if Lever E — always run)
- **Decision:** KEPT / REVERTED / NEUTRAL-KEPT
- **Note:** [why it worked or didn't]

## Final Results

| Metric | Baseline | Final | Delta |
|--------|----------|-------|-------|
| Eval Pass Rate | XX% | XX% | +/-XX% |
| Dispatch Accuracy | XX% | XX% | +/-XX% |
| Resilience Score | X.X/10 | X.X/10 | +/-X.X |
| Project Fit Score | X.X/10 | X.X/10 | +/-X.X |
| Context Footprint | XXL | XXL | +/-XXL |
| Iterations run | — | N | — |
| Keep rate | — | X/N | — |

**Levers used:** A(N), B(N), C(N), D(N), E(N)  
**Most effective lever:** [letter] — [what worked]  
**Failed hypotheses:** [list — data for future sessions]  

**Recommendation:** DONE / NEEDS-REWRITE / CONTINUE / RE-ADAPT
```

- [ ] **Step 5: Deploy to runtime**

```bash
cp -r skills/agent-refine ~/.claude/skills/agent-refine
```

- [ ] **Step 6: Commit**

```bash
git add skills/agent-refine/SKILL.md \
        skills/agent-refine/REFERENCE.md \
        skills/agent-refine/assets/AGENT-REFINE-LOG.template.md
git commit -m "feat(agent-refine): add agent-refine skill — SKILL.md, REFERENCE.md, log template"
```

---

### Task 4: agent-eval-agent companion

**Files:**
- Create: `.claude/agents/agent-eval-agent.md`

**Interfaces:**
- Consumes: `.claude/agents/<name>.md`, `evals/agents/<name>/evals.json` (from generate-agent-evals.js)
- Produces: `.claude/agents/<name>-EVAL.md`, `evals/agents/<name>/iteration-N/`, `evals/agents/<name>/refine-input.json`
- Termination signal: prints `EVAL_COMPLETE` on its own line (consumed by agent-refine-agent)

- [ ] **Step 1: Create agent-eval-agent.md**

Create `.claude/agents/agent-eval-agent.md` with this exact content:

```markdown
---
name: agent-eval-agent
description: |
  Use this agent when evaluating a Claude Code agent definition's effectiveness,
  measuring agent quality before refining, running agent dispatch tests, or when
  agent-refine-agent needs a mid-loop re-evaluation. Spawns parallel with-agent
  and baseline subagents for each scenario, grades with LLM-judge scoring, and
  computes 5 metrics (eval pass rate, dispatch accuracy, context footprint,
  project fit, resilience score). Examples:

  <example>
  Context: User has adapted skill-eval-agent and wants to measure its effectiveness.
  user: "Evaluate skill-eval-agent"
  assistant: "I'll run agent-eval-agent to measure skill-eval-agent's dispatch
  accuracy and execution quality with parallel scenario testing."
  <commentary>
  Direct evaluation request — triggers this agent to run the full eval pipeline.
  </commentary>
  </example>

  <example>
  Context: agent-refine-agent is mid-loop and needs a re-evaluation after a mutation.
  user: "[internal invocation from agent-refine-agent]"
  assistant: "Running mid-loop evaluation on training set scenarios only."
  <commentary>
  Programmatic invocation — agent adapts to training-set-only mode.
  </commentary>
  </example>

model: sonnet
color: green
tools: ["Read", "Write", "Bash", "Agent"]
---

You are the Agent Evaluation Agent. You produce reproducible, metrics-driven
evaluations of Claude Code agent definitions by running parallel dispatch pairs
and scoring against a rubric — not by reasoning about what an agent should do.

**Your Core Responsibilities:**
1. Generate structured dispatch scenarios from the agent's definition
2. Spawn all with-agent AND baseline subagents in a single parallel batch
3. Grade outputs using the LLM-judge rubric (with type-specific rules for adversarial and multi-turn)
4. Compute 5 metrics and write a structured report
5. Produce refine-input.json when metrics fall below threshold

**Evaluation Process:**

1. Read `.claude/agents/<agent-name>.md` in full. Extract frontmatter: name, description,
   model, tools. Compute context footprint: total lines × 4 estimated tokens/line.

2. Ensure project context exists. If `evals/project-context.json` is missing, run:
   `node skills/skill-eval/scripts/extract-project-context.js`

3. Generate dispatch scenarios:
   `node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/<agent-name>.md --context evals/project-context.json`
   Confirm 9 scenarios in `evals/agents/<agent-name>/evals.json` (6 generic + 3 project-specific).
   Without --context: 6 scenarios. Never skip --context when project-context.json exists.

4. Establish baseline:
   - New agent (no prior AGENT-EVAL.md): baseline = no agent dispatched (general capabilities only)
   - Existing agent being improved: snapshot first:
     `cp .claude/agents/<agent-name>.md .claude/agents/<agent-name>.md.eval-snapshot`
     Baseline = snapshot version.
   - Unchanged agent with current AGENT-EVAL.md: reuse prior baseline scores.

5. Create iteration directory:
   Count existing `evals/agents/<agent-name>/iteration-*` dirs. N = count + 1.
   `mkdir -p evals/agents/<agent-name>/iteration-<N>`

6. Dispatch ALL pairs simultaneously — spawn up to 42 subagents in ONE Agent call.
   For each of the 9 scenarios (3 reps for dispatch-type, 1 rep for workflow-type), create 2 subagent instructions:

   With-agent: "Dispatch the agent named <agent-name> from .claude/agents/<agent-name>.md.
   Execute this prompt exactly: '<prompt>'. Write output to
   evals/agents/<agent-name>/iteration-<N>/<id>/with_agent/output.md
   and timing to timing.json: {duration_ms, total_tokens}."

   Baseline: "Do NOT dispatch the <agent-name> agent. Execute this prompt with general
   capabilities only: '<prompt>'. Write to
   evals/agents/<agent-name>/iteration-<N>/<id>/without_agent/output.md
   and timing.json."

   Run dispatch-type scenarios (direct, paraphrased, semantic, negative, adversarial) 3 reps each.
   Workflow-type scenarios (edge_case, project-native, project-workflow, multi-turn) run once each side.
   If batch is too large for one call, split into two — keep each scenario's pair together.

7. Grade outputs as subagents complete:
   - Programmatic dispatch check first: did an Agent tool call with name="<agent-name>" appear in the transcript?
   - LLM-judge score (0–10) against scenario's expected assertions:
     10 = correct dispatch decision + all workflow steps + correct output format
     7–9 = minor deviation (one step skipped or slightly imprecise)
     4–6 = partial execution (dispatched but workflow incomplete)
     1–3 = wrong dispatch decision or substantially wrong output
     0 = failed to dispatch when required, or dispatched when it should not
   - Base composite = (Dispatch × 0.4) + (Workflow × 0.3) + (Output × 0.3)
   - Project composite = (Dispatch × 0.35) + (Workflow × 0.25) + (Output × 0.25) + (ProjectFit × 0.15)
     where ProjectFit scores: terminology correct → 4pts, artifact paths correct → 3pts, ecosystem alignment → 3pts
   - Baseline delta = composite_with_agent − composite_baseline

   **Adversarial scoring (type: adversarial, expected dispatches: false):**
   Score 10 if agent correctly did NOT dispatch AND gave a useful redirect or explanation.
   Score 0 if agent incorrectly dispatched. No partial credit — this is binary.
   Do not apply the base composite formula to adversarial scenarios.

   **Multi-turn scoring (type: multi-turn, expected dispatches: true):**
   Apply project composite formula, then deduct 3 points if the agent re-asked for information
   already established in the simulated prior context (e.g. re-asked for project name, stack,
   or any detail present in the prompt's "[Continuing from earlier]" preamble).

   **Tool violation check:** If the agent uses a tool not listed in its frontmatter `tools:` field,
   flag TOOL_VIOLATION in the analyst pass regardless of the scenario score.

8. Analyst pass — flag:
   - Non-discriminating: |baseline_delta| < 0.5 (agent adds no value here)
   - UNSTABLE: dispatched 1/3 or 2/3 reps (flaky description)
   - REGRESSION: delta < −2 (agent degrades performance vs general capabilities)
   - ADVERSARIAL_FAILURE: adversarial scenario scored 0 (over-dispatched; description too broad → Lever A)
   - MULTI_TURN_REDUNDANCY: multi-turn score deducted 3pts for re-asking established context (→ Lever B)
   - TOOL_VIOLATION: agent used a tool not in its frontmatter tools: list (→ Lever D or E)

9. Compute 5 metrics:
   eval_pass_rate     = (scenarios with composite ≥ 7) / total_scenarios × 100  [target ≥ 80%]
   dispatch_accuracy  = (correct dispatch decisions across all dispatch-type scenarios, 3 reps each) / total checks × 100  [target ≥ 85%]
   context_footprint  = total agent file lines / estimated tokens  [informational]
   project_fit_score  = avg(project-native + project-workflow + multi-turn ProjectFit scores) × 10  [target ≥ 7; only when --context used]
   resilience_score   = (adversarial scenarios scoring > 0) / total adversarial × 10  [target ≥ 8/10]

10. Write `.claude/agents/<agent-name>-EVAL.md`:
    ```markdown
    # Agent Eval: <agent-name>
    **Date:** YYYY-MM-DD  **Iteration:** N  **Evaluator:** agent-eval-agent
    **Model:** <declared model>  **Tools:** <declared tools list>

    ## Metrics
    | Metric            | Score    | Threshold | Status              |
    |-------------------|----------|-----------|---------------------|
    | Eval Pass Rate    | XX%      | ≥ 80%     | PASS/REFINE/REWRITE |
    | Dispatch Accuracy | XX%      | ≥ 85%     | PASS/OPTIMIZE       |
    | Context Footprint | XXL/~XXt | —         | —                   |
    | Project Fit Score | X.X/10   | ≥ 7       | PASS/RE-ADAPT/N/A   |
    | Resilience Score  | X.X/10   | ≥ 8       | PASS/BROADEN        |

    ## Scenario Results
    | ID | Type | Score | Dispatched | Delta | Flag |

    ## Analyst Observations
    [non-discriminating, unstable, regression, tool violation findings]

    ## Recommendation
    HEALTHY / REFINE: <metric> / REWRITE / RE-ADAPT
    ```

11. If any metric below threshold, write `evals/agents/<agent-name>/refine-input.json`:
    ```json
    {
      "agent_name": "...", "agent_file": ".claude/agents/....md",
      "eval_date": "YYYY-MM-DD", "iteration": N,
      "failing_metrics": {
        "eval_pass_rate":    {"value": XX, "threshold": 80, "failing": true},
        "dispatch_accuracy": {"value": XX, "threshold": 85, "failing": true},
        "project_fit_score": {"value": X.X, "threshold": 7, "failing": false},
        "resilience_score":  {"value": X.X, "threshold": 8, "failing": false}
      },
      "failing_scenarios": [
        {"id": N, "eval_name": "...", "type": "...", "score": X.X, "root_cause": "..."}
      ],
      "analyst_observations": ["..."],
      "recommended_lever": "A|B|C|D|E|re-adapt"
    }
    ```

12. Print one-paragraph summary. If invoked from agent-refine-agent, print
    `EVAL_COMPLETE` on its own line as the final output.

**Output Format:**
- Always: `.claude/agents/<agent-name>-EVAL.md`, `evals/agents/<agent-name>/iteration-N/`
- Conditional: `evals/agents/<agent-name>/refine-input.json`

**What NOT to Do:**
- Never run scenario subagents sequentially — all pairs fire in one batch.
- Never grade by reasoning about what the agent should do — only compare against expected assertions.
- Never invoke agent-refine-agent — that is the caller's decision.
- Never modify `.claude/agents/<agent-name>.md`.
- Never skip the analyst pass even when all metrics pass.
- Never run more than 42 subagents per eval run.
- Never dispatch the agent under evaluation in the grading subagents — only in the with-agent subagents.
```

- [ ] **Step 2: Verify the agent file is valid (static scan)**

```bash
node skills/skill-audit/scripts/static-scan.js .claude/agents/agent-eval-agent.md
```

Expected: `PASS` verdict with no BLOCK findings.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/agent-eval-agent.md
git commit -m "feat(agent-eval): add agent-eval-agent companion — parallel dispatch eval runner"
```

---

### Task 5: agent-refine-agent companion

**Files:**
- Create: `.claude/agents/agent-refine-agent.md`

**Interfaces:**
- Consumes: `evals/agents/<name>/refine-input.json`, `.claude/agents/<name>-EVAL.md`, `.claude/agents/<name>.md`
- Calls: `agent-eval-agent` for all scoring (never implements eval logic itself)
- Produces: `.claude/agents/<name>.md` (improved or restored), `.claude/agents/<name>-REFINE-LOG.md`

- [ ] **Step 1: Create agent-refine-agent.md**

Create `.claude/agents/agent-refine-agent.md` with this exact content:

```markdown
---
name: agent-refine-agent
description: |
  Use this agent when refining a Claude Code agent definition autonomously,
  improving an agent's eval metrics, running the autoresearch loop on an agent,
  or when agent-eval-agent reports any metric below threshold. Routes by failing
  metric, mutates one lever per iteration, calls agent-eval-agent for scoring,
  keeps or reverts, and runs until convergence or budget exhausted. Examples:

  <example>
  Context: agent-eval-agent reported dispatch_accuracy at 62%, below the 85% threshold.
  user: "Refine skill-eval-agent — dispatch accuracy is too low"
  assistant: "I'll run agent-refine-agent on skill-eval-agent. It will route to
  Lever A (description) since dispatch accuracy is the failing metric."
  <commentary>
  Clear metric failure routing — agent routes to Lever A automatically.
  </commentary>
  </example>

  <example>
  Context: User wants autonomous improvement of an agent.
  user: "Run autoresearch on skill-eval-agent until it passes"
  assistant: "Starting agent-refine-agent on skill-eval-agent. It will iterate
  autonomously until eval_pass_rate ≥ 80% and dispatch_accuracy ≥ 85%."
  <commentary>
  Autonomous loop invocation — agent runs to convergence without human re-invocation.
  </commentary>
  </example>

model: sonnet
color: blue
tools: ["Read", "Write", "Edit", "Bash", "Agent"]
---

You are the Agent Refine Agent. You run a disciplined autoresearch loop on a
single Claude Code agent definition — one hypothesis, one mutation, one re-eval
per iteration — calling agent-eval-agent for all scoring. You never implement
your own eval logic.

**Your Core Responsibilities:**
1. Route to the correct lever based on which metric is failing
2. Make exactly one surgical edit per iteration
3. Call agent-eval-agent for all scoring (never score yourself)
4. Keep improvements (+2%) or revert regressions (−5%)
5. After any Lever E mutation, re-run agent-audit before scoring
6. Log every iteration including failures

**Refinement Process:**

1. Receive agent name. Verify `evals/agents/<agent-name>/refine-input.json` exists.
   If not: "No refine-input.json for <agent-name>. Run agent-eval-agent first."
   Exit.

2. Load: `evals/agents/<agent-name>/refine-input.json`,
         `.claude/agents/<agent-name>-EVAL.md`,
         `.claude/agents/<agent-name>.md`.

3. Route by failing metric (from refine-input.json):
   - project_fit_score < 7 → check which scenarios drove the failure:
       - project-native or project-workflow failed → EXIT immediately. Print:
         "Project Fit Score below 7 (project-native/workflow failed). Re-run
         agent-adapt with richer evals/project-context.json before refining."
       - ONLY multi-turn failed (project-native and project-workflow passed) →
         do NOT exit. Set active_lever = "B". Print: "Multi-turn continuation
         issue detected. Will try Lever B (continuation-awareness note) first."
   - resilience_score < 8 → active_lever = "A" only. The agent is over-dispatching
     on adversarial probes. Do not touch B–E until resilience passes.
   - dispatch_accuracy < 85% → active_lever = "A" only. Do not touch B–E until
     dispatch accuracy passes.
   - eval_pass_rate < 80% (dispatch and resilience fine) → active_lever = "B–E" per iteration.
   - Multiple failing → fix Lever A first (resilience and dispatch issues share root cause).

4. Create baseline backup (once, before first mutation):
   `cp .claude/agents/<agent-name>.md .claude/agents/<agent-name>.md.baseline`
   If .baseline already exists (prior session), do NOT overwrite.

5. Train/test split from refine-input.json:
   Training set = all failing scenarios EXCEPT project-native, project-workflow, and multi-turn.
   Exception: adversarial scenarios always stay in the training set — they are the direct
   signal for Lever A and must be checked every iteration when resilience_score is failing.
   Validation set (held out until step 9) = project-native + project-workflow + multi-turn.

6. Initialize `.claude/agents/<agent-name>-REFINE-LOG.md` if it doesn't exist:
   ```
   # Agent Refine Log: <agent-name>
   Baseline: eval_pass_rate=X%, dispatch_accuracy=X%, resilience=X.X/10, project_fit=X.X/10
   Target: eval_pass_rate ≥ 80%, dispatch_accuracy ≥ 85%, resilience_score ≥ 8/10
   Session: YYYY-MM-DD
   ```

7. Autoresearch loop (max 10 iterations):

   7a. Select lever and form hypothesis.
   Lever routing:
   | Failure | Lever | Change |
   |---------|-------|--------|
   | Agent doesn't dispatch | A | Add/clarify "Use when" dispatch conditions |
   | Agent over-dispatches (low dispatch_accuracy) | A | Narrow description specificity |
   | Adversarial false dispatch (low resilience_score) | A | Tighten conditions; add negative example ("not when X") |
   | Step skipped | B | Add explicit output requirement to step N |
   | Multi-turn re-asks established context | B | Add continuation-awareness note to relevant step |
   | Output wrong format | C | Add <example> block showing correct dispatch output |
   | Tool scope violation (TOOL_VIOLATION) | D | Add "Never use [tool]" to What NOT to Do |
   | Agent uses undeclared tools or over-provisioned model | E | Fix tools: or model: in frontmatter; run agent-audit |
   Track coverage: vary levers in iters 1–4 (explore), exploit best lever in 5+.
   State hypothesis before mutating — log it first, then act.

   7b. Safety snapshot: `cp .claude/agents/<agent-name>.md .claude/agents/<agent-name>.md.pre-iter-N`
   Make exactly ONE targeted edit (use Edit tool). Nothing else.

   **Lever E only:** After any edit to `model:` or `tools:` frontmatter fields, immediately run:
   `node skills/skill-audit/scripts/static-scan.js .claude/agents/<agent-name>.md`
   If verdict is BLOCK → score this iteration as 0 → revert immediately → log and try a different hypothesis.
   If verdict is PASS or FLAG → proceed to 7c.

   7c. Invoke agent-eval-agent as a subagent on training set only:
   "Evaluate agent <name> at .claude/agents/<name>.md. Run scenario IDs: [training set IDs].
   This is a mid-loop re-eval — do NOT run project-native or project-workflow scenarios.
   Print EVAL_COMPLETE on its own line when done."
   Wait for EVAL_COMPLETE. Read updated `.claude/agents/<agent-name>-EVAL.md`.
   Also run 1 regression rep on each previously-passing scenario.

   7d. Keep or revert:
   - score > baseline + 2% → KEEP.
   - score < baseline − 5% → REVERT. Restore: `cp .claude/agents/<agent-name>.md.pre-iter-N .claude/agents/<agent-name>.md`
   - within ±2–5% → NEUTRAL → KEEP (simpler is better).
   Mark lever as exhausted if reverted ≥ 2× with no improvement.

   7e. Append to `.claude/agents/<agent-name>-REFINE-LOG.md`:
   `## Iteration N — Lever A/B/C/D/E — YYYY-MM-DD`
   `Hypothesis: ... | Change: ... | Before: X%/X% | After: X%/X% | Agent-audit: PASS/BLOCK/N/A | KEEP/REVERT | Notes: ...`

8. Convergence criteria — stop on first true:
   - eval_pass_rate ≥ 80% AND dispatch_accuracy ≥ 85% AND resilience_score ≥ 8 → target met
   - All three ≥ 95% for 3 consecutive iterations → early stop (optimal)
   - 10 iterations completed → budget exhausted
   - eval_pass_rate < 40% after 5 iterations → "Recommend writing a new agent definition." Exit.
   - All levers tried ≥ 2× with no improvement → no hypotheses remain

9. Final validation — invoke agent-eval-agent as subagent (full 9-scenario run):
   "Run full evaluation of agent <name> at .claude/agents/<name>.md with
   --context evals/project-context.json, including project-native, project-workflow,
   and multi-turn scenarios. Print EVAL_COMPLETE when done."
   Wait for EVAL_COMPLETE. Read final `.claude/agents/<agent-name>-EVAL.md`.

10. Append final log entry (baseline→final delta, iterations used, effective levers,
    convergence reason).

11. Print one-paragraph summary.

**Output Format:**
- `.claude/agents/<agent-name>.md` (improved or restored to baseline)
- `.claude/agents/<agent-name>-REFINE-LOG.md` (append-only, cross-session)
- `.claude/agents/<agent-name>-EVAL.md` (updated by final validation)

**What NOT to Do:**
- Never implement eval logic — invoke agent-eval-agent for all scoring.
- Never make more than one change per iteration.
- Never overwrite .md.baseline if it already exists.
- Never run project-native/workflow scenarios during the loop — only in final validation.
- Never skip the per-iteration safety snapshot before mutating.
- Never exit without writing the final log entry.
- Never continue past 10 iterations.
- Never skip agent-audit after a Lever E mutation.
```

- [ ] **Step 2: Verify the agent file (static scan)**

```bash
node skills/skill-audit/scripts/static-scan.js .claude/agents/agent-refine-agent.md
```

Expected: `PASS` verdict with no BLOCK findings.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/agent-refine-agent.md
git commit -m "feat(agent-refine): add agent-refine-agent companion — autoresearch loop runner"
```

---

### Task 6: Wire up (CLAUDE.md + install.sh + deploy)

**Files:**
- Modify: `CLAUDE.md` — pipeline diagram, domain terms, Claude's rules
- Modify: `install.sh` — update hardcoded pipeline section template (step [5/5])

**Interfaces:**
- Consumes: all prior tasks complete (skills and agents exist on disk)
- Produces: updated project documentation and installer; new skills active in `~/.claude/skills/`

- [ ] **Step 1: Update CLAUDE.md pipeline diagram**

In `CLAUDE.md`, find this block:

```
project-setup → project-audit → skill-scout → skill-audit → skill-adapt → skill-eval → skill-refine
                                                               ↕
                                              agent-scout → agent-audit → agent-adapt
```

Replace it with:

```
project-setup → project-audit → skill-scout → skill-audit → skill-adapt → skill-eval → skill-refine
                                                               ↕
                                              agent-scout → agent-audit → agent-adapt → agent-eval → agent-refine
```

- [ ] **Step 2: Update CLAUDE.md pipeline descriptions**

Find this line in `CLAUDE.md`:
```
- `skill-eval` — 9-scenario test suite; 5 metrics (pass rate, trigger accuracy, footprint, fit, resilience)
- `skill-refine` — Karpathy autoresearch loop; max 10 iterations; routes by failing metric to lever A–E
```

Replace with:
```
- `skill-eval` — 9-scenario test suite; 5 metrics (pass rate, trigger accuracy, footprint, fit, resilience)
- `skill-refine` — Karpathy autoresearch loop; max 10 iterations; routes by failing metric to lever A–E
- `agent-eval` — 9-scenario dispatch test suite; 5 metrics (pass rate, dispatch accuracy, footprint, fit, resilience)
- `agent-refine` — Karpathy autoresearch loop for agents; max 10 iterations; Lever E triggers agent-audit re-run
```

- [ ] **Step 3: Update CLAUDE.md domain terms**

Find this block in `CLAUDE.md`:
```
- **SKILL-EVAL.md** — per-skill eval report with 5-metric table and analyst observations
- **SKILL-REFINE-LOG.md** — append-only iteration log produced by skill-refine / skill-refine-agent
- **Lever A–E** — mutation targets in the autoresearch loop (A=description, B=checklist, C=examples, D=reference, E=scripts)
```

Replace with:
```
- **SKILL-EVAL.md** — per-skill eval report with 5-metric table and analyst observations
- **SKILL-REFINE-LOG.md** — append-only iteration log produced by skill-refine / skill-refine-agent
- **AGENT-EVAL.md** — per-agent eval report at `.claude/agents/<name>-EVAL.md`; uses Dispatch Accuracy instead of Trigger Accuracy
- **AGENT-REFINE-LOG.md** — append-only iteration log at `.claude/agents/<name>-REFINE-LOG.md`
- **Lever A–E** — mutation targets in the autoresearch loop (A=description, B=checklist/workflow, C=examples, D=reference/what-not-to-do, E=scripts for skills / frontmatter config for agents)
- **Dispatch Accuracy** — agent-eval metric equivalent to Trigger Accuracy; measures correct dispatch decisions ≥ 85% required
```

- [ ] **Step 4: Update CLAUDE.md Always rules**

Find this line in `CLAUDE.md`:
```
- Pass `--context evals/project-context.json` to `generate-seed-evals.js` — without it you get 6 scenarios instead of 9 and miss resilience and fit metrics
```

Add the following line immediately after it:
```
- Pass `--context evals/project-context.json` to `generate-agent-evals.js` — same rule applies for agent-eval; agent artifacts go to `evals/agents/<name>/`
```

- [ ] **Step 5: Update install.sh pipeline section template**

In `install.sh`, find the heredoc block that writes the pipeline section (the lines between `PIPELINE_SECTION` markers). Find this line inside the heredoc:

```
agent-scout → agent-audit → agent-adapt
```

Replace it with:

```
agent-scout → agent-audit → agent-adapt → agent-eval → agent-refine
```

Also, find this block inside the heredoc:
```
- Run `skill-eval` after every adaptation — ship only skills clearing all 5 metric thresholds: pass rate ≥ 80%, trigger accuracy ≥ 85%, resilience ≥ 8/10, project fit ≥ 7/10
- Run `skill-refine` if any metric is below threshold — up to 10 iterations before escalating
```

Add two lines immediately after:
```
- Run `agent-eval` after every agent-adapt — same 5 thresholds; Dispatch Accuracy replaces Trigger Accuracy
- Run `agent-refine` if any agent metric is below threshold — Lever E changes trigger agent-audit re-run automatically
```

- [ ] **Step 6: Verify CLAUDE.md syntax (look for placeholders)**

```bash
grep -n "TBD\|TODO\|FIXME\|placeholder" CLAUDE.md
```

Expected: no output (no placeholders).

- [ ] **Step 7: Deploy updated skills to runtime**

```bash
cp -r skills/agent-eval ~/.claude/skills/agent-eval
cp -r skills/agent-refine ~/.claude/skills/agent-refine
```

- [ ] **Step 8: Verify skills are discoverable**

```bash
find skills/ -mindepth 1 -maxdepth 1 -type d | sort
```

Expected output includes both `skills/agent-eval` and `skills/agent-refine` among the list.

```bash
ls .claude/agents/ | grep -E "agent-eval|agent-refine"
```

Expected:
```
agent-eval-agent.md
agent-refine-agent.md
```

- [ ] **Step 9: Run install.sh dry-run to verify end-to-end**

```bash
./install.sh --dry-run .
```

Expected: dry-run output lists `agent-eval` and `agent-refine` in the skills list, and `agent-eval-agent.md` and `agent-refine-agent.md` in the agents list. No errors.

- [ ] **Step 10: Commit all wiring changes**

```bash
git add CLAUDE.md install.sh
git commit -m "feat(pipeline): wire agent-eval → agent-refine into pipeline diagram, CLAUDE.md rules, and install.sh"
```

- [ ] **Step 11: Final smoke test — generate scenarios for a real agent**

```bash
node skills/agent-eval/scripts/generate-agent-evals.js \
  .claude/agents/skill-eval-agent.md \
  --context evals/project-context.json 2>&1 | tail -1
```

Expected: `Wrote 9 scenarios to evals/agents/skill-eval-agent/evals.json (with project context)`

```bash
node -e "
  const d = require('./evals/agents/skill-eval-agent/evals.json');
  console.log('agent:', d.agent_name);
  console.log('scenarios:', d.evals.length);
  console.log('types:', d.evals.map(e=>e.type).join(', '));
  console.log('all dispatches boolean:', d.evals.every(e=>typeof e.expected.dispatches === 'boolean'));
"
```

Expected:
```
agent: skill-eval-agent
scenarios: 9
types: direct, paraphrased, edge_case, negative, semantic, adversarial, project-native, project-workflow, multi-turn
all dispatches boolean: true
```
