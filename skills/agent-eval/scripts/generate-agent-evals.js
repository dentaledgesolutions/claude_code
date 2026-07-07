#!/usr/bin/env node
// generate-agent-evals.js <.claude/agents/name.md> [--context <project-context.json>] [--target <name>] [--lint-only <evals.json>]
// Extracts dispatch scenarios from a Claude Code agent definition.
// Writes evals/agents/<name>/evals.json and emits JSON to stdout.
// Without --context: 6 scenarios. With --context: 9 scenarios.
//
// Ground-truth rebuild (Phase 1) — mirrors skills/skill-eval/scripts/generate-seed-evals.js:
//  - Every positive-scenario prompt names a concrete sibling target instead of
//    echoing the frontmatter description (F3).
//  - A description-echo lint runs after generation and fails loudly on overlap.
//  - expected.agent_dispatched (programmatic) is split from expected.workflow_executed
//    (Phase-2 harvester-derived); negative/adversarial assert agent_dispatched only (F5).
//  - expected.evidence (artifacts/transcript_markers/workflow_steps) replaces
//    step-title assertions; expected.judgment carries qualitative LLM-judge criteria.
'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: node generate-agent-evals.js <.claude/agents/name.md> [--context <project-context.json>] [--target <name>]
       node generate-agent-evals.js --lint-only <evals.json>

Generate dispatch test scenarios for a Claude Code agent definition.

Arguments:
  .claude/agents/name.md       Path to the agent definition file
  --context <file>             Path to project-context.json (adds 3 project-specific scenarios)
  --target <name-or-path>      Override the concrete target named in positive-scenario prompts
  --lint-only <evals.json>     Run only the description-echo lint against an existing evals.json
                                (resolves the original agent .md via its "agent_file" field)

Output:
  Writes evals/agents/<name>/evals.json and emits JSON to stdout.
  Without --context: 6 scenarios.
  With --context:    9 scenarios (adds project-native, project-workflow, multi-turn).

Examples:
  node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/skill-eval-agent.md
  node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/skill-eval-agent.md \\
    --context evals/project-context.json
  node skills/agent-eval/scripts/generate-agent-evals.js --lint-only evals/agents/skill-eval-agent/evals.json`);
  process.exit(0);
}

// ── Shared helpers (deterministic hashing, echo lint, target discovery) ──────
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickDeterministic(seed, candidates) {
  if (!candidates.length) return null;
  return candidates[hashString(seed) % candidates.length];
}

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','else','when','while','for','to','of','in','on','at','by',
  'with','without','from','into','onto','up','down','out','over','under','again','further','once','here','there',
  'all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so',
  'than','too','very','s','t','can','will','just','don','should','now','is','are','was','were','be','been','being',
  'have','has','had','having','do','does','did','doing','would','could','might','must','shall','i','you','he','she',
  'it','we','they','me','him','her','us','them','my','your','his','its','our','their','this','that','these','those',
  'what','which','who','whom','as','about','against','between','through','during','before','after','above','below',
  'use','uses','used','using','one','also','ll','re','ve',
]);
// Deliberately NOT excluding "skill"/"agent"/"project" from the token universe:
// doing so measurably weakened the lint's ability to catch real description-echo
// prompts on historical evals.json files (verified during Phase 1 development).
// Templates below are worded to avoid incidental collision with common description
// phrasing instead (see TARGET_TEMPLATES).

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(t => !STOPWORDS.has(t));
}

function echoOverlapRatio(prompt, description) {
  const promptTokens = tokenize(prompt);
  if (promptTokens.length === 0 || !description) return 0;
  const descTokens = new Set(tokenize(description));
  if (descTokens.size === 0) return 0;
  const overlapping = promptTokens.filter(t => descTokens.has(t));
  return overlapping.length / promptTokens.length;
}

const ECHO_THRESHOLD = 0.6;

function lintScenarios(scenarios, description) {
  return scenarios.map(sc => {
    const ratio = echoOverlapRatio(sc.prompt, description);
    return { id: sc.id, eval_name: sc.eval_name, type: sc.type, ratio, pass: ratio <= ECHO_THRESHOLD };
  });
}

function runLintOrExit(scenarios, description, { abortOnFail }) {
  const results = lintScenarios(scenarios, description);
  const failed = results.filter(r => !r.pass);
  if (failed.length > 0 && abortOnFail) {
    console.error(`Description-echo lint FAILED (${failed.length}/${results.length} scenarios exceed ${(ECHO_THRESHOLD * 100).toFixed(0)}% token overlap with the frontmatter description):`);
    for (const f of failed) {
      console.error(`  Scenario ${f.id} (${f.eval_name}, type=${f.type}): ${(f.ratio * 100).toFixed(0)}% overlap`);
    }
    console.error('Generator aborted — prompts must read as concrete user tasks naming a real target, not paraphrases of the description.');
    process.exit(1);
  }
  return results;
}

// ── Frontmatter parsing (handles block-scalar description) ──────────────────
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const raw = match[1];
  const result = {};

  const blockMatch = raw.match(/^description:\s*\|?\n((?:[ \t]+.+\n?)*)/m);
  if (blockMatch) {
    result.description = blockMatch[1]
      .split('\n')
      .map(l => l.replace(/^[ \t]{2}/, ''))
      .join('\n')
      .trim();
  }

  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m || m[1] === 'description') continue;
    const [, key, val] = m;
    if (val.startsWith('[') && val.endsWith(']')) {
      try { result[key] = JSON.parse(val); } catch { result[key] = []; }
    } else {
      result[key] = val.trim().replace(/^["']|["']$/g, '');
    }
  }

  if (!result.description) {
    const inlineMatch = raw.match(/^description:\s*(.+)$/m);
    if (inlineMatch) result.description = inlineMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  return result;
}

// ── --lint-only mode ─────────────────────────────────────────────────────────
const lintOnlyFlag = args.indexOf('--lint-only');
if (lintOnlyFlag !== -1) {
  const evalsPath = args[lintOnlyFlag + 1];
  if (!evalsPath || !fs.existsSync(evalsPath)) {
    console.error('Error: --lint-only requires a path to an existing evals.json file.');
    process.exit(1);
  }
  let data;
  try { data = JSON.parse(fs.readFileSync(evalsPath, 'utf8')); }
  catch (e) { console.error(`Error: could not parse ${evalsPath}: ${e.message}`); process.exit(1); }

  const defPath = data.agent_file;
  if (!defPath || !fs.existsSync(defPath)) {
    console.error(`Error: could not resolve the original agent .md from "${evalsPath}" (expected an "agent_file" field pointing to an existing file).`);
    process.exit(1);
  }
  const defContent = fs.readFileSync(defPath, 'utf8');
  const fm = parseFrontmatter(defContent);
  const description = fm.description || '';

  const results = lintScenarios(data.evals || [], description);
  console.log(`Description-echo lint for ${evalsPath} (against ${defPath}):`);
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] id=${r.id} ${r.eval_name} (type=${r.type}) — ${(r.ratio * 100).toFixed(0)}% overlap`);
  }
  const failCount = results.filter(r => !r.pass).length;
  console.log(`${failCount}/${results.length} scenarios flagged as description-echo (threshold >${(ECHO_THRESHOLD * 100).toFixed(0)}%).`);
  process.exit(failCount > 0 ? 1 : 0);
}

// ── Normal generation mode ────────────────────────────────────────────────────
const inputFile   = args.find(a => !a.startsWith('--'));
const contextFlag = args.indexOf('--context');
const contextFile = contextFlag !== -1 ? args[contextFlag + 1] : null;
const targetFlag  = args.indexOf('--target');
const targetOverride = targetFlag !== -1 ? args[targetFlag + 1] : null;

if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Error: agent file not found.');
  console.error('Usage: node generate-agent-evals.js <.claude/agents/name.md> [--context <file>] [--target <name>]');
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf8');
const scenarios = [];
let id = 1;

// ── Load project context ──────────────────────────────────────────────────────
let projectCtx = null;
if (contextFile && fs.existsSync(contextFile)) {
  try { projectCtx = JSON.parse(fs.readFileSync(contextFile, 'utf8')); }
  catch (e) { console.error(`Warning: could not parse context file ${contextFile}: ${e.message}. Generating 6 scenarios only.`); }
}

// ── Extract workflow steps from body ─────────────────────────────────────────
function extractSteps(text) {
  const steps = [];
  for (const m of text.matchAll(/^\d+\.\s+(?:\*\*(.+?)\*\*|(.+?)(?:\s*—|\s*$))/gm)) {
    steps.push((m[1] || m[2] || '').trim());
  }
  return steps;
}

function extractStepBlocks(text) {
  const matches = [...text.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)];
  if (matches.length > 0) {
    return matches.map((m, i) => ({
      title: m[1],
      body: text.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : text.length),
    }));
  }
  // Fallback: "### Step N: Title" heading workflows (each block runs to the next
  // heading of any level, so step bodies don't bleed into later sections).
  const headings = [...text.matchAll(/^#{2,4}\s*Step\s+\d+\s*[:.]?\s*(.+?)\s*$/gim)];
  return headings.map(m => {
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const next = rest.search(/^#{1,4}\s/m);
    return { title: m[1], body: m[0] + (next === -1 ? rest : rest.slice(0, next)) };
  });
}

const PLACEHOLDER_TEST_RE    = /<agent-name>|<name>/;
const PLACEHOLDER_REPLACE_RE = /<agent-name>|<name>/g;

function extractArtifactTemplate(body) {
  // Inline backtick spans only ([^`\n]) — excludes fenced ``` code blocks, whose
  // closing fence would otherwise greedily terminate the match across many lines.
  const backticks = [...body.matchAll(/`([^`\n]+)`/g)].map(m => m[1]);
  for (const tok of backticks) {
    if (tok.includes('/') && PLACEHOLDER_TEST_RE.test(tok)) return tok;
  }
  return null;
}

function buildWorkflowSteps(stepBlocks, targetName) {
  return stepBlocks.slice(0, 3).map(sb => {
    const tmpl = extractArtifactTemplate(sb.body);
    if (tmpl) {
      return { step: sb.title, check: 'artifact', ref: tmpl.replace(PLACEHOLDER_REPLACE_RE, targetName) };
    }
    return { step: sb.title, check: 'marker', ref: sb.title };
  });
}

function collectArtifacts(workflowSteps) {
  const seen = new Set();
  const out = [];
  for (const ws of workflowSteps) {
    if (ws.check === 'artifact' && !seen.has(ws.ref)) {
      seen.add(ws.ref);
      out.push({ path: ws.ref, must_exist: true });
    }
  }
  return out;
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function agentDispatchedMarker(name, expectPresent) {
  // Match only the Agent(<name>) dispatch token — narrative mentions of the
  // agent's name (e.g. "**Agent under test**: `<name>`") must not count as a dispatch.
  return { kind: 'tool_call', pattern: `Agent\\(\\s*["'\`]?${escapeRegExp(name)}["'\`]?\\s*\\)`, expect: expectPresent ? 'present' : 'absent' };
}

// ── Parse "Use when" triggers from description ───────────────────────────────
function extractUseWhen(description) {
  const normalized = description.replace(/\s*\n\s*/g, ' ').trim();
  const stripped = normalized
    .replace(/<example>[\s\S]*$/i, '')
    .replace(/Examples?:[\s\S]*$/i, '')
    .trim();
  const uw = stripped.match(/[Uu]se (?:this agent )?when\s+(.+)/);
  if (uw && uw[1].trim().length > 2) {
    return uw[1].trim().split(/[;]/)[0].trim().replace(/\.$/, '');
  }
  const noLeadIn = stripped
    .replace(/^[Uu]se (?:this agent )?when\s+/i, '')
    .replace(/^[Uu]se when:?\s*/i, '');
  const firstClause = noLeadIn.split(/[.;,]/)[0].trim();
  return firstClause.length > 5 ? firstClause : stripped.slice(0, 80).trim();
}

// ── Verb vocabulary (lead verb detection + templates) ────────────────────────
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

const GERUNDS = {
  evaluate: 'evaluating', run: 'running', find: 'finding', audit: 'auditing', adapt: 'adapting',
  refine: 'refining', generate: 'generating', analyze: 'analyzing',
};
function gerund(verb) {
  return GERUNDS[verb] || (verb.endsWith('e') ? verb.slice(0, -1) + 'ing' : `${verb}ing`);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function verbPhrase(phrase) {
  return phrase.toLowerCase().trim()
    .replace(/^(please\s+|can you\s+|i want to\s+|i need to\s+|i'd like to\s+)/i, '');
}

function extractLeadVerb(text) {
  const lower = verbPhrase(text);
  let best = null;
  for (const verb of Object.keys(VERB_SYNONYMS)) {
    const stem  = verb.endsWith('e') ? verb.slice(0, -1) : verb;
    const match = lower.match(new RegExp(`\\b${stem}\\w*\\b`, 'i'));
    if (match && (!best || match.index < best.index)) best = { verb, index: match.index };
  }
  return best ? best.verb : 'evaluate';
}

// "a"/"an" agreement for domain nouns ("agent" takes "an", "skill" takes "a").
function article(d) { return /^[aeiou]/i.test(d) ? 'an' : 'a'; }

// Concrete-target action-phrase templates (embedded after "to " / "when asked to ").
const TARGET_TEMPLATES = {
  evaluate: (t, d) => `evaluate the ${t} ${d} and tell me if it's ready to refine`,
  run:      (t, d) => `run against the ${t} ${d} and report the outcome`,
  find:     (t, d) => `find ${article(d)} ${d} similar to ${t} that could work for our project`,
  audit:    (t, d) => `audit the ${t} ${d} and tell me what's risky about it`,
  adapt:    (t, d) => `adapt the ${t} ${d} so it fits how we work here`,
  refine:   (t, d) => `refine the ${t} ${d} — its eval scores came back below threshold`,
  generate: (t, d) => `generate a new ${d} modeled on ${t} for our project`,
  analyze:  (t, d) => `analyze the ${t} ${d} and summarize the findings`,
};

function actionPhrase(verb, t, d) {
  const fn = TARGET_TEMPLATES[verb];
  return fn ? fn(t, d) : `${verb} the ${t} ${d}`;
}

// ── Object-domain detection + target resolution ──────────────────────────────
const fm          = parseFrontmatter(content);
const agentName    = fm.name || path.basename(inputFile, '.md');
const description  = fm.description || '';
const steps        = extractSteps(content);
const stepBlocks   = extractStepBlocks(content);
const useWhen      = extractUseWhen(description);
const verb         = extractLeadVerb(useWhen);

// Heuristic (data-driven, not a hardcoded agent list): agents named "agent-*"
// operate on other agents; everything else defaults to operating on skills.
const domain     = /^agent-/.test(agentName) ? 'agent' : 'skill';
const domainNoun = domain;
const repoRoot   = process.cwd();

function scanSiblingSkills(excludeName) {
  const dir = path.join(repoRoot, 'skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== excludeName)
    .map(e => e.name)
    .sort();
}

function scanSiblingAgents(excludeName) {
  const dir = path.join(repoRoot, '.claude', 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.endsWith('-EVAL.md') && !f.endsWith('-REFINE-LOG.md'))
    .map(f => f.replace(/\.md$/, ''))
    .filter(n => n !== excludeName)
    .sort();
}

function resolveTarget() {
  if (targetOverride) {
    return { target: path.basename(targetOverride).replace(/\.md$/, '').replace(/\/$/, ''), source: 'cli' };
  }
  let pool = [];
  let source = '';
  if (domain === 'agent') {
    pool = scanSiblingAgents(agentName);
    source = 'agents-dir';
  } else {
    pool = (projectCtx && Array.isArray(projectCtx.installed_skills))
      ? projectCtx.installed_skills.filter(s => s !== agentName)
      : [];
    source = 'installed_skills';
    if (pool.length === 0) {
      pool = scanSiblingSkills(agentName);
      source = 'skills-dir';
    }
  }
  if (pool.length === 0) return { target: 'a sibling skill in this project', source: 'fallback' };
  return { target: pickDeterministic(agentName, pool), source };
}

const { target, source: targetSource } = resolveTarget();

// ── Orchestration prompt helpers ──────────────────────────────────────────────
// Prompts are framed as orchestration requests (dispatching an agent),
// not as skill invocation trigger phrases.

function directPrompt(agentName, verb, t, d) {
  return `Dispatch the ${agentName} to ${actionPhrase(verb, t, d)}.`;
}

function paraphrasedPrompt(agentName, verb, t, d) {
  return `I need you to use the ${agentName} — specifically to ${actionPhrase(verb, t, d)}.`;
}

function edgePrompt(agentName, verb, t, d, stepTitles) {
  const first = stepTitles[0] || 'load the inputs';
  const last  = stepTitles[stepTitles.length - 1] || 'finalize the output';
  return stepTitles.length > 1
    ? `I've already had the ${agentName} ${gerund(verb)} the ${t} ${d} — it completed the "${first}" step. Can you have it resume from the "${last}" step?`
    : `The ${agentName} is partway through ${gerund(verb)} the ${t} ${d}. Pick it up from where it left off.`;
}

function negativePrompt(agentName, verb, t, d) {
  return `Can you explain what the ${agentName} does when asked to ${actionPhrase(verb, t, d)}? I'm not asking you to run it — I just want to understand it.`;
}

function semanticPrompt(agentName, verb, t, d, seed) {
  const syns = VERB_SYNONYMS[verb] || ['handle'];
  const syn  = syns[hashString(`${seed}:semantic`) % syns.length];
  // Padded with generic filler content words so a single coincidental token match
  // (e.g. a hyphenated target name sharing a word with the description) can't
  // dominate the echo-lint overlap ratio.
  return `Have the ${agentName} ${syn} the ${t} ${d} and report back what it finds.`;
}

function adversarialPrompt(directSentence, protectedTerms) {
  // Shield the agent-under-test name and the concrete target name from the domain-word
  // swap below — otherwise a name like "skill-eval-agent" gets its own "skill"/"eval"/
  // "agent" substrings mangled into a garbled, illegible compound.
  const sentinels = protectedTerms.filter(Boolean).map((term, i) => ({ term, token: `__protected_${i}__` }));
  let obfuscated = directSentence.toLowerCase();
  for (const { term, token } of sentinels) obfuscated = obfuscated.split(term.toLowerCase()).join(token);

  let swapped = obfuscated
    .replace(/\bskills\b/g, 'codebases')
    .replace(/\bskill\b/g, 'codebase')
    .replace(/\bagents\b/g, 'components')
    .replace(/\bagent\b/g, 'component')
    .replace(/\beval\b/g, 'code review')
    .replace(/\bdispatch\b/g, 'analyze');

  const changed = swapped !== obfuscated;
  for (const { term, token } of sentinels) swapped = swapped.split(token).join(term);

  if (!changed) {
    let restored = obfuscated;
    for (const { term, token } of sentinels) restored = restored.split(token).join(term);
    const agentMatch = restored.match(/dispatch the (\S+)/);
    return `Before we dispatch the ${agentMatch ? agentMatch[1] : 'agent'}, walk me through whether it's even the right tool for this situation and what the alternatives are.`;
  }
  return cap(swapped);
}

const directSentence = directPrompt(agentName, verb, target, domainNoun);

// ── Generate the 6 base scenarios ─────────────────────────────────────────────

// 1. direct
{
  const wfSteps = buildWorkflowSteps(stepBlocks, target);
  scenarios.push({
    id: id++,
    eval_name: 'direct-primary-dispatch',
    type: 'direct',
    prompt: directSentence,
    target,
    expected: {
      dispatches: true,
      agent_dispatched: true,
      workflow_executed: true,
      evidence: {
        artifacts: collectArtifacts(wfSteps),
        transcript_markers: [agentDispatchedMarker(agentName, true)],
        workflow_steps: wfSteps,
      },
      judgment: [
        `Dispatches the ${agentName} agent (Agent tool call appears in the transcript) against the named target (${target})`,
        wfSteps.length ? `Reaches at least the "${wfSteps[wfSteps.length - 1].step}" step before stopping` : 'Completes the workflow before stopping',
      ],
    },
  });
}

// 2. paraphrased
{
  const wfSteps = buildWorkflowSteps(stepBlocks, target);
  scenarios.push({
    id: id++,
    eval_name: 'paraphrased-reword',
    type: 'paraphrased',
    prompt: paraphrasedPrompt(agentName, verb, target, domainNoun),
    target,
    expected: {
      dispatches: true,
      agent_dispatched: true,
      workflow_executed: true,
      evidence: {
        artifacts: collectArtifacts(wfSteps),
        transcript_markers: [agentDispatchedMarker(agentName, true)],
        workflow_steps: wfSteps,
      },
      judgment: ['Produces the same outcome as the direct-dispatch scenario despite reworded phrasing'],
    },
  });
}

// 3. edge_case
{
  const wfSteps = buildWorkflowSteps(stepBlocks, target);
  scenarios.push({
    id: id++,
    eval_name: 'edge-case-mid-workflow',
    type: 'edge_case',
    prompt: edgePrompt(agentName, verb, target, domainNoun, steps),
    target,
    expected: {
      dispatches: true,
      agent_dispatched: true,
      workflow_executed: true,
      evidence: {
        artifacts: collectArtifacts(wfSteps),
        transcript_markers: [agentDispatchedMarker(agentName, true)],
        workflow_steps: wfSteps,
      },
      judgment: ['Handles partial workflow entry without restarting from scratch'],
    },
  });
}

// 4. negative — must NOT dispatch (asserts agent_dispatched only)
scenarios.push({
  id: id++,
  eval_name: 'negative-explain-only',
  type: 'negative',
  prompt: negativePrompt(agentName, verb, target, domainNoun),
  target,
  expected: {
    dispatches: false,
    agent_dispatched: false,
    evidence: {
      artifacts: [],
      transcript_markers: [agentDispatchedMarker(agentName, false)],
      workflow_steps: [],
    },
    judgment: ['Explanation request — answers conversationally without dispatching the agent'],
  },
});

// 5. semantic — synonym verb
{
  const wfSteps = buildWorkflowSteps(stepBlocks, target);
  scenarios.push({
    id: id++,
    eval_name: 'semantic-synonym-dispatch',
    type: 'semantic',
    prompt: semanticPrompt(agentName, verb, target, domainNoun, agentName),
    target,
    expected: {
      dispatches: true,
      agent_dispatched: true,
      workflow_executed: true,
      evidence: {
        artifacts: collectArtifacts(wfSteps),
        transcript_markers: [agentDispatchedMarker(agentName, true)],
        workflow_steps: wfSteps,
      },
      judgment: ['Synonym phrasing dispatches the correct agent despite not using the literal trigger verb'],
    },
  });
}

// 6. adversarial — agent vocabulary in wrong scope; must NOT dispatch
scenarios.push({
  id: id++,
  eval_name: 'adversarial-wrong-scope',
  type: 'adversarial',
  prompt: adversarialPrompt(directSentence, [agentName, target]),
  target,
  expected: {
    dispatches: false,
    agent_dispatched: false,
    evidence: {
      artifacts: [],
      transcript_markers: [agentDispatchedMarker(agentName, false)],
      workflow_steps: [],
    },
    judgment: ['Adversarial probe — agent vocabulary used in wrong scope. Agent must NOT be dispatched. Score 10 if not dispatched, 0 if dispatched — no partial credit.'],
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
  {
    const wfSteps = buildWorkflowSteps(stepBlocks, target);
    scenarios.push({
      id: id++,
      eval_name: 'project-native-terminology',
      type: 'project-native',
      prompt: `Dispatch the ${agentName} to ${actionPhrase(verb, target, domainNoun)}${stackLabel} — we use ${projectTerm}${artifactRef ? ` and store outputs in ${artifactRef}` : ''}.`,
      target,
      expected: {
        dispatches: true,
        agent_dispatched: true,
        workflow_executed: true,
        evidence: {
          artifacts: collectArtifacts(wfSteps),
          transcript_markers: [agentDispatchedMarker(agentName, true)],
          workflow_steps: wfSteps,
        },
        judgment: [
          `Output references project-specific terminology (${projectTerm})`,
          artifactRef ? `Output references the correct artifact path (${artifactRef})` : null,
          `Aligns with the project's stack (${stack.join(', ') || 'as described'})`,
        ].filter(Boolean),
      },
      project_context_used: { term: projectTerm, artifact: artifactRef, stack },
    });
  }

  // 8. project-workflow
  {
    const sibling = installed.find(s => s !== agentName && s !== target) || target;
    const wfSteps = buildWorkflowSteps(stepBlocks, target);
    scenarios.push({
      id: id++,
      eval_name: 'project-workflow-integration',
      type: 'project-workflow',
      prompt: installed.length > 1
        ? `After ${sibling} finished its run, dispatch the ${agentName} to ${actionPhrase(verb, target, domainNoun)}${stackLabel}.`
        : `Dispatch the ${agentName} to ${actionPhrase(verb, target, domainNoun)} as part of the ${projectName} workflow.`,
      target,
      expected: {
        dispatches: true,
        agent_dispatched: true,
        workflow_executed: true,
        evidence: {
          artifacts: collectArtifacts(wfSteps),
          transcript_markers: [agentDispatchedMarker(agentName, true)],
          workflow_steps: wfSteps,
        },
        judgment: [
          'Dispatches correctly within the project workflow context',
          installed.length > 1
            ? `Does not duplicate or conflict with ${sibling}`
            : `Aligns with ${projectName} conventions`,
        ],
      },
      project_context_used: { installed_skills: installed, project_name: projectName },
    });
  }

  // 9. multi-turn — continuation framing
  {
    const hookHint = hooks.length > 0 ? ` (hooks: ${hooks.join(', ')})` : '';
    const wfSteps = buildWorkflowSteps(stepBlocks, target);
    scenarios.push({
      id: id++,
      eval_name: 'multi-turn-resumed-context',
      type: 'multi-turn',
      prompt: [
        `[Continuing from earlier in our session]`,
        `We discussed ${projectName} and agreed to dispatch the ${agentName} to ${actionPhrase(verb, target, domainNoun)}.`,
        projectTerm !== projectName
          ? `We're using ${projectTerm}${hookHint}.`
          : hookHint ? `Our setup includes${hookHint}.` : '',
        `Let's continue — go ahead and dispatch it now.`,
      ].filter(Boolean).join(' '),
      target,
      expected: {
        dispatches: true,
        agent_dispatched: true,
        workflow_executed: true,
        evidence: {
          artifacts: collectArtifacts(wfSteps),
          transcript_markers: [agentDispatchedMarker(agentName, true)],
          workflow_steps: wfSteps,
        },
        judgment: [
          'Dispatches correctly despite continuation/resumption framing',
          'Does not ask for information already established in context',
          projectTerm !== projectName
            ? `Incorporates established context (${projectTerm}) without re-asking`
            : 'Incorporates established project name without re-asking',
        ],
      },
      project_context_used: { project_name: projectName, workflow_term: projectTerm, hooks },
    });
  }
}

if (scenarios.length === 0) {
  console.error('No scenarios could be extracted from the input file.');
  process.exit(1);
}

// ── Description-echo lint (fail loudly before writing output) ───────────────
if (description) runLintOrExit(scenarios, description, { abortOnFail: true });

// ── Write output ──────────────────────────────────────────────────────────────
const output = {
  agent_name:       agentName,
  agent_file:       inputFile,
  project_context:  contextFile || null,
  target_selection: { target, source: targetSource, domain },
  evals:            scenarios,
};

const outDir  = path.join(process.cwd(), 'evals', 'agents', agentName);
const outPath = path.join(outDir, 'evals.json');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.error(`Wrote ${scenarios.length} scenarios to ${outPath}${projectCtx ? ' (with project context)' : ''} — target: ${target} (${targetSource})`);
console.log(JSON.stringify(output, null, 2));
