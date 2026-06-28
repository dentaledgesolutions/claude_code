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
