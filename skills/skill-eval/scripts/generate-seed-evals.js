#!/usr/bin/env node
// generate-seed-evals.js <SKILL.md or UAT.md> [--context <project-context.json>] [--target <name>] [--lint-only <evals.json>]
// Extracts test scenarios from a skill or acceptance-criteria file.
// When --context is provided, adds 3 project-specific scenarios (project-native,
// project-workflow, multi-turn).
// Writes evals/<skill-name>/evals.json and emits JSON to stdout.
//
// Ground-truth rebuild (Phase 1):
//  - Every positive-scenario prompt names a concrete sibling target instead of
//    echoing the frontmatter description (F3).
//  - A description-echo lint runs after generation and fails loudly on overlap.
//  - expected.skill_loaded (programmatic) is split from expected.workflow_executed
//    (Phase-2 harvester-derived); negative/adversarial assert skill_loaded only (F5).
//  - expected.evidence (artifacts/transcript_markers/workflow_steps) replaces
//    step-title assertions; expected.judgment carries qualitative LLM-judge criteria.

const fs   = require('fs');
const path = require('path');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: node generate-seed-evals.js <SKILL.md|UAT.md> [--context <project-context.json>] [--target <name>]
       node generate-seed-evals.js --lint-only <evals.json>

Generate structured test scenarios for a skill or acceptance-criteria file.

Arguments:
  SKILL.md|UAT.md              Path to the skill or UAT file to generate evals for
  --context <file>             Path to project-context.json (adds 3 project-specific scenarios)
  --target <name-or-path>      Override the concrete target named in positive-scenario prompts
  --lint-only <evals.json>     Run only the description-echo lint against an existing evals.json
                                (resolves the original SKILL.md via its "generated_from" field)

Output:
  Writes evals/<skill-name>/evals.json and emits JSON to stdout.
  Without --context: 6 scenarios (direct, paraphrased, edge_case, negative, semantic, adversarial).
  With --context:    9 scenarios (above + project-native, project-workflow, multi-turn).

Examples:
  node skills/skill-eval/scripts/generate-seed-evals.js skills/skill-scout/SKILL.md
  node skills/skill-eval/scripts/generate-seed-evals.js skills/skill-scout/SKILL.md --context evals/project-context.json
  node skills/skill-eval/scripts/generate-seed-evals.js skills/skill-scout/SKILL.md --target skill-audit
  node skills/skill-eval/scripts/generate-seed-evals.js --lint-only evals/skill-scout/evals.json`);
  process.exit(0);
}

// ── Shared helpers (deterministic hashing, echo lint, target discovery) ──────

// Small FNV-1a-style hash — deterministic across runs/platforms, no dependency.
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

// Extracts the "description:" frontmatter value, correctly handling YAML
// double/single-quoted scalars that fold across multiple indented continuation
// lines. A naive single-line regex (/^description:\s*(.+)/m) silently truncates a
// multi-line description at the first newline — which fed malformed trigger text
// into scenario generation and produced generic, wrong-target scenarios for any
// skill with a folded description (the brain-* family).
function extractYamlDescription(content) {
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex(l => /^description:\s*/.test(l));
  if (startIdx === -1) return '';
  const firstRest = lines[startIdx].replace(/^description:\s*/, '');
  const quoteChar = /^["']/.test(firstRest) ? firstRest[0] : null;
  if (!quoteChar) return firstRest.trim();

  const afterQuote = firstRest.slice(1);
  const closeIdx = afterQuote.indexOf(quoteChar);
  if (closeIdx !== -1) return afterQuote.slice(0, closeIdx).trim();

  const parts = [afterQuote];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const idx = line.indexOf(quoteChar);
    if (idx !== -1) { parts.push(line.slice(0, idx).trim()); break; }
    parts.push(line.trim());
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// Stopwords excluded from the description-echo overlap calculation so the lint measures
// echoed *content* vocabulary, not incidental shared function words.
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
// prompts on historical evals.json files (verified during Phase 1 development —
// exclusion dropped the catch rate on a known-bad file from 6/9 to 4/9 flagged).
// Templates below are worded to avoid incidental collision with common SKILL.md
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

  const defPath = data.generated_from;
  if (!defPath || !fs.existsSync(defPath)) {
    console.error(`Error: could not resolve the original SKILL.md from "${evalsPath}" (expected a "generated_from" field pointing to an existing file).`);
    process.exit(1);
  }
  const defContent = fs.readFileSync(defPath, 'utf8');
  const description = extractYamlDescription(defContent);

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
  console.error('Usage: node generate-seed-evals.js <SKILL.md|UAT.md> [--context <project-context.json>] [--target <name>]');
  process.exit(1);
}

const content   = fs.readFileSync(inputFile, 'utf8');
const fileName  = path.basename(inputFile).toLowerCase();
const skillDir  = path.dirname(inputFile);
const skillName = path.basename(skillDir);
const scenarios = [];
let id = 1;

// ── Load project context (optional) ─────────────────────────────────────────
let projectCtx = null;
if (contextFile && fs.existsSync(contextFile)) {
  try { projectCtx = JSON.parse(fs.readFileSync(contextFile, 'utf8')); } catch {}
}

// ── Object-domain detection + target resolution ──────────────────────────────
// Heuristic (data-driven, not a hardcoded skill list): skills named "agent-*"
// operate on agents; everything else defaults to operating on skills.
const domain     = /^agent-/.test(skillName) ? 'agent' : 'skill';
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
    pool = scanSiblingAgents(skillName);
    source = 'agents-dir';
  } else {
    pool = (projectCtx && Array.isArray(projectCtx.installed_skills))
      ? projectCtx.installed_skills.filter(s => s !== skillName)
      : [];
    source = 'installed_skills';
    if (pool.length === 0) {
      pool = scanSiblingSkills(skillName);
      source = 'skills-dir';
    }
  }
  if (pool.length === 0) return { target: 'a sibling skill in this project', source: 'fallback' };
  return { target: pickDeterministic(skillName, pool), source };
}

const { target, source: targetSource } = resolveTarget();
const domainNoun = domain === 'agent' ? 'agent' : 'skill';

// ── Verb vocabulary (lead verb detection + templates) ────────────────────────
const VERB_SYNONYMS = {
  evaluate: ['assess', 'measure', 'benchmark', 'test', 'check'],
  find:     ['search for', 'locate', 'look for', 'discover'],
  audit:    ['review', 'inspect', 'scan', 'check'],
  adapt:    ['customize', 'modify', 'adjust', 'tailor'],
  refine:   ['improve', 'optimize', 'enhance', 'tune'],
  create:   ['build', 'write', 'generate', 'make'],
  install:  ['add', 'set up', 'deploy'],
  run:      ['execute', 'launch', 'trigger'],
  start:    ['begin', 'kick off', 'set up'],
  set:      ['configure', 'establish', 'stand up'],
  scan:     ['sweep', 'check over', 'examine'],
  extract:  ['pull out', 'derive', 'surface'],
  clarify:  ['pin down', 'nail down', 'work out'],
};

const GERUNDS = {
  evaluate: 'evaluating', find: 'finding', audit: 'auditing', adapt: 'adapting',
  refine: 'refining', create: 'creating', install: 'installing', run: 'running',
  start: 'starting', set: 'setting', scan: 'scanning', extract: 'extracting',
  clarify: 'clarifying',
};
function gerund(verb) {
  return GERUNDS[verb] || (verb.endsWith('e') ? verb.slice(0, -1) + 'ing' : `${verb}ing`);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Strip common first-person/polite prefixes so helper functions can re-frame cleanly
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

// Concrete-target sentence templates, one per known verb, plus a generic default.
const TARGET_TEMPLATES = {
  evaluate: (t, d) => `Evaluate the ${t} ${d} and tell me if it's ready to refine.`,
  find:     (t, d) => `Find ${article(d)} ${d} similar to ${t} that could work for our project.`,
  audit:    (t, d) => `Audit the ${t} ${d} and tell me what's risky about it.`,
  adapt:    (t, d) => `Adapt the ${t} ${d} so it fits how we work here.`,
  refine:   (t, d) => `Refine the ${t} ${d} — its eval scores came back below threshold.`,
  create:   (t, d) => `Create a new ${d} modeled on ${t} for our project.`,
  install:  (t, d) => `Install the ${t} ${d} into this project.`,
  run:      (t, d) => `Run the ${t} ${d} against our current setup.`,
  start:    (t, d) => `Start the ${t} ${d} workflow now.`,
  set:      (t, d) => `Set up the ${t} ${d} so it's ready to use.`,
  scan:     (t, d) => `Scan the ${t} ${d} for issues.`,
  extract:  (t, d) => `Extract the context ${t} needs before we adapt it.`,
  clarify:  (t, d) => `Clarify what the ${t} ${d} actually does before we rely on it.`,
};

function directTargetPrompt(verb, t, d) {
  const fn = TARGET_TEMPLATES[verb];
  return fn ? fn(t, d) : `${cap(verb)} the ${t} ${d} for this project.`;
}
function paraphraseTargetPrompt(verb, t, d) {
  return `I need help with the ${t} ${d} — can you ${verb} it for me?`;
}
function edgeTargetPrompt(verb, t, d, steps) {
  const first = steps[0] || 'the first step';
  const last  = steps[steps.length - 1] || 'the final step';
  return steps.length > 2
    ? `I'm already partway through ${gerund(verb)} the ${t} ${d} — I've completed the "${first}" step. Can you continue from "${last}" onwards?`
    : `I'm partway through ${gerund(verb)} the ${t} ${d} — can you pick up from where I left off?`;
}
function negativeTargetPrompt(verb, t, d) {
  return `What would ${gerund(verb)} the ${t} ${d} actually involve? I'm not asking you to do it — just explain the process so I understand it.`;
}
function semanticTargetPrompt(verb, t, d, seed) {
  const syns = VERB_SYNONYMS[verb] || ['handle'];
  const syn  = syns[hashString(`${seed}:semantic`) % syns.length];
  // Padded with generic filler content words (beyond just "verb + target + domain")
  // so a single coincidental token match (e.g. a hyphenated target name sharing a
  // word with the description) can't dominate the echo-lint overlap ratio.
  return `${cap(syn)} the ${t} ${d} for me and let me know what you find.`;
}
function adversarialTargetPrompt(directSentence, protectedTerms) {
  // Shield the concrete target/skill-under-test names from the domain-word swap below —
  // otherwise a target like "skill-scout" gets its own "skill" substring mangled into
  // "codebase-scout", which reads as a nonsense name rather than a legible wrong-scope probe.
  const sentinels = protectedTerms.filter(Boolean).map((term, i) => ({ term, token: `__protected_${i}__` }));
  let obfuscated = directSentence.toLowerCase();
  for (const { term, token } of sentinels) obfuscated = obfuscated.split(term.toLowerCase()).join(token);

  let swapped = obfuscated
    .replace(/\bskills\b/g, 'codebases')
    .replace(/\bskill\b/g, 'codebase')
    .replace(/\bagents\b/g, 'repos')
    .replace(/\bagent\b/g, 'repo')
    .replace(/\bproject\b/g, 'pull request');

  const changed = swapped !== obfuscated;
  for (const { term, token } of sentinels) swapped = swapped.split(token).join(term);

  if (!changed) {
    let restored = obfuscated;
    for (const { term, token } of sentinels) restored = restored.split(token).join(term);
    return `Before we do that, can you walk me through whether ${restored.replace(/\.$/, '')} is even the right approach for my situation?`;
  }
  return cap(swapped);
}

// ── Evidence extraction (workflow steps → artifact/marker checks) ────────────
function extractStepBlocks(text) {
  const matches = [...text.matchAll(/^(\d+)\.\s+\*\*(.+?)\*\*/gm)];
  if (matches.length > 0) {
    return matches.map((m, i) => ({
      title: m[2],
      body: text.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : text.length),
    }));
  }
  // Fallback: "### Step N: Title" heading workflows (each block runs to the next
  // heading of any level, so step bodies don't bleed into later sections).
  const headings = [...text.matchAll(/^#{2,4}\s*Step\s+\d+\s*[:.]?\s*(.+?)\s*$/gim)];
  return headings.map((m, i) => {
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const next = rest.search(/^#{1,4}\s/m);
    return { title: m[1], body: m[0] + (next === -1 ? rest : rest.slice(0, next)) };
  });
}

const PLACEHOLDER_TEST_RE    = /<skill-name>|<name>/;
const PLACEHOLDER_REPLACE_RE = /<skill-name>|<name>/g;

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

function skillLoadedMarker(name, expectPresent) {
  // Match only the Skill(<name>) invocation token — narrative mentions of the
  // skill's name (e.g. "**Skill under test**: `<name>`") must not count as a load.
  return { kind: 'tool_call', pattern: `Skill\\(\\s*["'\`]?${escapeRegExp(name)}["'\`]?\\s*\\)`, expect: expectPresent ? 'present' : 'absent' };
}

// ── Parse SKILL.md ───────────────────────────────────────────────────────────
if (fileName === 'skill.md') {
  const description = extractYamlDescription(content);
  const useWhenMatch = description.match(/[Uu]se when:?\s+(.+)/);
  const triggerText  = useWhenMatch ? useWhenMatch[1] : description;

  const stepBlocks = extractStepBlocks(content);
  const stepTitles = stepBlocks.map(s => s.title);
  const verb = extractLeadVerb(triggerText);

  const directSentence = directTargetPrompt(verb, target, domainNoun);

  // 1. direct
  {
    const wfSteps = buildWorkflowSteps(stepBlocks, target);
    scenarios.push({
      id: id++, eval_name: 'direct-primary-trigger', type: 'direct',
      prompt: directSentence,
      target,
      expected: {
        triggers: true,
        skill_loaded: true,
        workflow_executed: true,
        evidence: {
          artifacts: collectArtifacts(wfSteps),
          transcript_markers: [skillLoadedMarker(skillName, true)],
          workflow_steps: wfSteps,
        },
        judgment: [
          `Loads the ${skillName} skill and executes its workflow against the named target (${target})`,
          wfSteps.length ? `Reaches at least the "${wfSteps[wfSteps.length - 1].step}" step before stopping or asking a clarifying question` : 'Completes the workflow before stopping',
        ],
      },
    });
  }

  // 2. paraphrased
  {
    const wfSteps = buildWorkflowSteps(stepBlocks, target);
    scenarios.push({
      id: id++, eval_name: 'paraphrased-reword', type: 'paraphrased',
      prompt: paraphraseTargetPrompt(verb, target, domainNoun),
      target,
      expected: {
        triggers: true,
        skill_loaded: true,
        workflow_executed: true,
        evidence: {
          artifacts: collectArtifacts(wfSteps),
          transcript_markers: [skillLoadedMarker(skillName, true)],
          workflow_steps: wfSteps,
        },
        judgment: ['Produces the same outcome as the direct-trigger scenario despite reworded phrasing'],
      },
    });
  }

  // 3. edge_case — starts mid-workflow
  {
    const wfSteps = buildWorkflowSteps(stepBlocks, target);
    scenarios.push({
      id: id++, eval_name: 'edge-case-mid-workflow', type: 'edge_case',
      prompt: edgeTargetPrompt(verb, target, domainNoun, stepTitles),
      target,
      expected: {
        triggers: true,
        skill_loaded: true,
        workflow_executed: true,
        evidence: {
          artifacts: collectArtifacts(wfSteps),
          transcript_markers: [skillLoadedMarker(skillName, true)],
          workflow_steps: wfSteps,
        },
        judgment: ['Resumes from the stated step without restarting the whole workflow from scratch'],
      },
    });
  }

  // 4. negative — should NOT trigger (asserts skill_loaded only)
  scenarios.push({
    id: id++, eval_name: 'negative-explain-only', type: 'negative',
    prompt: negativeTargetPrompt(verb, target, domainNoun),
    target,
    expected: {
      triggers: false,
      skill_loaded: false,
      evidence: {
        artifacts: [],
        transcript_markers: [skillLoadedMarker(skillName, false)],
        workflow_steps: [],
      },
      judgment: ['Explanation request — answers conversationally without invoking the workflow'],
    },
  });

  // 5. semantic — synonym variation
  {
    const wfSteps = buildWorkflowSteps(stepBlocks, target);
    scenarios.push({
      id: id++, eval_name: 'semantic-synonym-trigger', type: 'semantic',
      prompt: semanticTargetPrompt(verb, target, domainNoun, skillName),
      target,
      expected: {
        triggers: true,
        skill_loaded: true,
        workflow_executed: true,
        evidence: {
          artifacts: collectArtifacts(wfSteps),
          transcript_markers: [skillLoadedMarker(skillName, true)],
          workflow_steps: wfSteps,
        },
        judgment: ['Synonym phrasing activates the skill correctly despite not using the literal trigger verb'],
      },
    });
  }

  // 6. adversarial — uses skill vocabulary but belongs to adjacent stage or wrong scope
  scenarios.push({
    id: id++,
    eval_name: 'adversarial-wrong-scope',
    type: 'adversarial',
    prompt: adversarialTargetPrompt(directSentence, [target]),
    target,
    expected: {
      triggers: false,
      skill_loaded: false,
      evidence: {
        artifacts: [],
        transcript_markers: [skillLoadedMarker(skillName, false)],
        workflow_steps: [],
      },
      judgment: ['Adversarial probe using skill vocabulary in the wrong context/scope — must NOT invoke the workflow; a conversational or redirecting response is correct'],
    },
  });

  // ── Project-specific scenarios (only when --context is provided) ────────────
  if (projectCtx) {
    const projectName  = projectCtx.project_name || 'this project';
    const terms        = projectCtx.workflow_terms || [];
    const stack        = projectCtx.stack || [];
    const phrases      = projectCtx.key_phrases || [];
    const artifacts    = projectCtx.artifact_paths || [];

    const projectTerm  = terms[0] || phrases[0] || projectName;
    const artifactRef  = artifacts[0] || '';
    const stackLabel   = stack.length > 0 ? ` for our ${stack.join('/')} project` : '';

    // 7. project-native — uses project vocabulary instead of generic phrasing
    {
      const wfSteps = buildWorkflowSteps(stepBlocks, target);
      scenarios.push({
        id: id++,
        eval_name: 'project-native-terminology',
        type: 'project-native',
        prompt: `${directTargetPrompt(verb, target, domainNoun).replace(/\.$/, '')}${stackLabel} — we use ${projectTerm}${artifactRef ? ` and store outputs in ${artifactRef}` : ''}.`,
        target,
        expected: {
          triggers: true,
          skill_loaded: true,
          workflow_executed: true,
          evidence: {
            artifacts: collectArtifacts(wfSteps),
            transcript_markers: [skillLoadedMarker(skillName, true)],
            workflow_steps: wfSteps,
          },
          judgment: [
            `Output references project-specific terminology (${projectTerm})`,
            artifactRef ? `Output references the correct artifact path (${artifactRef})` : null,
            `Integrates with the project's stack (${stack.join(', ') || 'as described'})`,
          ].filter(Boolean),
        },
        project_context_used: { term: projectTerm, artifact: artifactRef, stack },
      });
    }

    // 8. project-workflow — tests skill within the project's installed skill ecosystem
    {
      const installedSkills = projectCtx.installed_skills || [];
      const siblingSkill    = installedSkills.find(s => s !== skillName && s !== target) || target;
      const wfSteps = buildWorkflowSteps(stepBlocks, target);
      scenarios.push({
        id: id++,
        eval_name: 'project-workflow-integration',
        type: 'project-workflow',
        prompt: installedSkills.length > 1
          ? `After running ${siblingSkill}, now ${directTargetPrompt(verb, target, domainNoun).replace(/^[A-Z]/, c => c.toLowerCase()).replace(/\.$/, '')}${stackLabel}.`
          : `${directTargetPrompt(verb, target, domainNoun).replace(/\.$/, '')} as part of our ${projectName} workflow.`,
        target,
        expected: {
          triggers: true,
          skill_loaded: true,
          workflow_executed: true,
          evidence: {
            artifacts: collectArtifacts(wfSteps),
            transcript_markers: [skillLoadedMarker(skillName, true)],
            workflow_steps: wfSteps,
          },
          judgment: [
            'Activates correctly within the project workflow context',
            installedSkills.length > 1
              ? `Does not duplicate or conflict with ${siblingSkill}`
              : `Aligns with ${projectName} conventions`,
          ],
        },
        project_context_used: { installed_skills: installedSkills, project_name: projectName },
      });
    }

    // 9. multi-turn — resuming mid-session continuation framing
    {
      const hooks     = (projectCtx.hooks || []).map(h => h.command).slice(0, 2);
      const hookHint  = hooks.length > 0 ? ` (our hooks include ${hooks.join(', ')})` : '';
      const wfSteps = buildWorkflowSteps(stepBlocks, target);
      scenarios.push({
        id: id++,
        eval_name: 'multi-turn-resumed-context',
        type: 'multi-turn',
        prompt: [
          `[Continuing from earlier in our session]`,
          `We discussed ${projectName} and agreed I'd be ${gerund(verb)} the ${target} ${domainNoun}.`,
          projectTerm !== projectName ? `We're using ${projectTerm}${hookHint}.` : hookHint ? `Our setup includes${hookHint}.` : '',
          `Let's continue — go ahead and do that now.`,
        ].filter(Boolean).join(' '),
        target,
        expected: {
          triggers: true,
          skill_loaded: true,
          workflow_executed: true,
          evidence: {
            artifacts: collectArtifacts(wfSteps),
            transcript_markers: [skillLoadedMarker(skillName, true)],
            workflow_steps: wfSteps,
          },
          judgment: [
            'Triggers correctly despite continuation/resumption framing',
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
}

// ── Parse UAT.md / acceptance criteria ───────────────────────────────────────
if (fileName !== 'skill.md' || content.includes('acceptance criteria') || content.includes('## Given')) {
  for (const m of content.matchAll(/\*\*Given\*\*:?\s*(.+)\n\*\*When\*\*:?\s*(.+)\n\*\*Then\*\*:?\s*(.+)/gi)) {
    scenarios.push({
      id: id++, eval_name: `uat-gwt-${id}`, type: 'uat-acceptance',
      prompt: `Given ${m[1].trim()}: ${m[2].trim()}`,
      expected: {
        triggers: true,
        skill_loaded: true,
        workflow_executed: true,
        evidence: { artifacts: [], transcript_markers: [], workflow_steps: [] },
        judgment: [m[3].trim()],
      },
    });
  }
  for (const m of content.matchAll(/- \[[ x]\]\s+(.+)/g)) {
    if (scenarios.length >= 10) break;
    scenarios.push({
      id: id++, eval_name: `uat-criteria-${id}`, type: 'uat-checkbox',
      prompt: m[1].trim(),
      expected: {
        triggers: true,
        skill_loaded: true,
        workflow_executed: true,
        evidence: { artifacts: [], transcript_markers: [], workflow_steps: [] },
        judgment: [m[1].trim()],
      },
    });
  }
}

if (scenarios.length === 0) {
  console.error('No scenarios could be extracted from the input file.');
  process.exit(1);
}

// ── Description-echo lint (fail loudly before writing output) ───────────────
const descMatchTop = content.match(/^description:\s*(.+)/m);
const descriptionForLint = descMatchTop ? descMatchTop[1].trim().replace(/^(["'])(.*)\1$/, '$2') : '';
if (descriptionForLint) runLintOrExit(scenarios, descriptionForLint, { abortOnFail: true });

const output = {
  skill_name:      skillName,
  generated_from:  inputFile,
  project_context: contextFile || null,
  target_selection: { target, source: targetSource, domain },
  evals:           scenarios,
};

const outDir  = path.join(process.cwd(), 'evals', skillName);
const outPath = path.join(outDir, 'evals.json');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.error(`Wrote ${scenarios.length} scenarios to ${outPath}${projectCtx ? ' (with project context)' : ''} — target: ${target} (${targetSource})`);
console.log(JSON.stringify(output, null, 2));
