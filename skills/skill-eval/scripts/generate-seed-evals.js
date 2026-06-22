#!/usr/bin/env node
// generate-seed-evals.js <SKILL.md or UAT.md> [--context <project-context.json>]
// Extracts test scenarios from a skill or acceptance-criteria file.
// When --context is provided, adds 2 project-specific scenarios (project-native,
// project-workflow) using terminology and conventions from the project.
// Writes evals/<skill-name>/evals.json and emits JSON to stdout.

const fs   = require('fs');
const path = require('path');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: node generate-seed-evals.js <SKILL.md|UAT.md> [--context <project-context.json>]

Generate structured test scenarios for a skill or acceptance-criteria file.

Arguments:
  SKILL.md|UAT.md              Path to the skill or UAT file to generate evals for
  --context <file>             Path to project-context.json (adds 3 project-specific scenarios)

Output:
  Writes evals/<skill-name>/evals.json and emits JSON to stdout.
  Without --context: 6 scenarios (direct, paraphrased, edge_case, negative, semantic, adversarial).
  With --context:    9 scenarios (above + project-native, project-workflow, multi-turn).

Examples:
  node skills/skill-eval/scripts/generate-seed-evals.js skills/skill-scout/SKILL.md
  node skills/skill-eval/scripts/generate-seed-evals.js skills/skill-scout/SKILL.md --context evals/project-context.json`);
  process.exit(0);
}
const inputFile   = args.find(a => !a.startsWith('--'));
const contextFlag = args.indexOf('--context');
const contextFile = contextFlag !== -1 ? args[contextFlag + 1] : null;

if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Usage: node generate-seed-evals.js <SKILL.md|UAT.md> [--context <project-context.json>]');
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

// ── Synonym table for common action verbs ────────────────────────────────────
const VERB_SYNONYMS = {
  evaluate: ['assess', 'measure', 'benchmark', 'test', 'check'],
  find:     ['search for', 'locate', 'look for', 'discover'],
  audit:    ['review', 'inspect', 'scan', 'check'],
  adapt:    ['customize', 'modify', 'adjust', 'tailor'],
  refine:   ['improve', 'optimize', 'enhance', 'tune'],
  create:   ['build', 'write', 'generate', 'make'],
  install:  ['add', 'set up', 'deploy'],
  run:      ['execute', 'launch', 'trigger'],
};

function synonymOf(phrase) {
  const lower = verbPhrase(phrase);
  for (const [verb, syns] of Object.entries(VERB_SYNONYMS)) {
    if (lower.includes(verb)) {
      const s = syns[Math.floor(Math.random() * syns.length)];
      return `I want to ${lower.replace(verb, s)}`;
    }
  }
  return null;
}

// Strip common first-person/polite prefixes so helper functions can re-frame cleanly
function verbPhrase(phrase) {
  return phrase.toLowerCase().trim()
    .replace(/^(please\s+|can you\s+|i want to\s+|i need to\s+|i'd like to\s+)/i, '');
}

function paraphraseOf(phrase) {
  return `I need to ${verbPhrase(phrase)}`;
}

function negativeOf(phrase) {
  return `Can you explain how to ${verbPhrase(phrase)} without actually doing it?`;
}

// Adversarial: prompt that uses the skill's vocabulary but belongs to an adjacent
// pipeline stage or wrong scope — should NOT trigger this skill.
function adversarialOf(primary, description) {
  const lower = verbPhrase(primary);
  // Pattern 1: swap the target object — e.g. "audit my code" when skill audits skills
  const swapped = lower
    .replace(/\bskill\b/g, 'codebase')
    .replace(/\bagent\b/g, 'repo')
    .replace(/\bproject\b/g, 'pull request');
  if (swapped !== lower) {
    // If the verb phrase is in gerund form (e.g. "adapting a skill"), use "help me with"
    const isGerund = /^[a-z]+ing\b/.test(lower);
    return isGerund ? `Can you help me with ${swapped}?` : `Can you ${swapped}?`;
  }
  // Pattern 2: reframe as a teaching/planning request rather than an action
  return `Before we start, can you walk me through what ${lower} would involve and whether it's the right approach for my situation?`;
}

// ── Parse SKILL.md ───────────────────────────────────────────────────────────
if (fileName === 'skill.md') {
  const descMatch = content.match(/^description:\s*(.+)/m);
  const description = descMatch ? descMatch[1].trim() : '';
  const useWhenMatch = description.match(/[Uu]se when:?\s+(.+)/);
  const triggerText  = useWhenMatch ? useWhenMatch[1] : description.replace(/^["']/, '');
  // Split on semicolons only — commas within a clause are synonym lists, not separate triggers
  const triggers     = triggerText.split(/;/).map(t => t.trim()).filter(Boolean);
  const rawPrimary   = triggers[0] || 'invoke this skill';
  // Convert third-person description to first-person command ("user wants to X" → "I want to X")
  const primary      = rawPrimary
    .replace(/^(the\s+)?user\s+wants?\s+to\s+/i, 'I want to ')
    .replace(/^(the\s+)?user\s+needs?\s+to\s+/i, 'I need to ')
    .replace(/^(the\s+)?user\s+asks?\s+/i, '')
    .replace(/^asks?\s+/i, '');

  const steps = [];
  for (const m of content.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)) steps.push(m[1]);

  // 1. direct
  scenarios.push({
    id: id++, eval_name: 'direct-primary-trigger', type: 'direct',
    prompt: primary.charAt(0).toUpperCase() + primary.slice(1),
    expected: {
      triggers: true,
      assertions: steps.slice(0, 3).map(s => `Executes step: ${s}`),
    },
  });

  // 2. paraphrased
  scenarios.push({
    id: id++, eval_name: 'paraphrased-reword', type: 'paraphrased',
    prompt: paraphraseOf(primary),
    expected: { triggers: true, assertions: ['Produces same outcome as direct trigger'] },
  });

  // 3. edge_case — starts mid-workflow
  const lastStep  = steps[steps.length - 1] || 'the final step';
  const firstStep = steps[0] || 'the first step';
  scenarios.push({
    id: id++, eval_name: 'edge-case-mid-workflow', type: 'edge_case',
    prompt: steps.length > 2
      ? `I'm already partway through — I've completed the "${firstStep}" step. Can you help me from "${lastStep}" onwards?`
      : `${primary} — I'm already partway through, can you pick up from where I left off?`,
    expected: {
      triggers: true,
      assertions: ['Handles partial workflow entry without restarting from scratch'],
    },
  });

  // 4. negative — should NOT trigger
  scenarios.push({
    id: id++, eval_name: 'negative-explain-only', type: 'negative',
    prompt: negativeOf(primary),
    expected: {
      triggers: false,
      note: 'Explanation request — should answer conversationally, not invoke the workflow',
    },
  });

  // 5. semantic — synonym variation
  const synPrompt = synonymOf(primary);
  scenarios.push({
    id: id++, eval_name: 'semantic-synonym-trigger', type: 'semantic',
    prompt: synPrompt
      ? synPrompt.charAt(0).toUpperCase() + synPrompt.slice(1)
      : `${primary} (alternate phrasing)`,
    expected: { triggers: true, assertions: ['Synonym phrasing activates skill correctly'] },
  });

  // 6. adversarial — uses skill vocabulary but belongs to adjacent stage or wrong scope
  // Must NOT trigger: tests that the skill doesn't over-fire on near-miss prompts.
  const adversarialPrompt = adversarialOf(primary, description);
  scenarios.push({
    id: id++,
    eval_name: 'adversarial-wrong-scope',
    type: 'adversarial',
    prompt: adversarialPrompt,
    expected: {
      triggers: false,
      note: 'Adversarial probe — uses skill vocabulary in wrong context or scope. Skill must NOT invoke its workflow; a conversational or redirecting response is correct.',
    },
  });

  // ── Project-specific scenarios (only when --context is provided) ────────────
  if (projectCtx) {
    const projectName  = projectCtx.project_name || 'this project';
    const terms        = projectCtx.workflow_terms || [];
    const stack        = projectCtx.stack || [];
    const phrases      = projectCtx.key_phrases || [];
    const artifacts    = projectCtx.artifact_paths || [];

    // Pick the most distinctive project term to inject
    const projectTerm  = terms[0] || phrases[0] || projectName;
    const artifactRef  = artifacts[0] || '';
    const stackLabel   = stack.length > 0 ? ` for our ${stack.join('/')} project` : '';

    // 6. project-native — uses project vocabulary instead of generic phrasing
    scenarios.push({
      id: id++,
      eval_name: 'project-native-terminology',
      type: 'project-native',
      prompt: `${primary}${stackLabel} — we use ${projectTerm}${artifactRef ? ` and store outputs in ${artifactRef}` : ''}`,
      expected: {
        triggers: true,
        assertions: [
          `Output references project-specific terminology (${projectTerm})`,
          artifactRef ? `Output references correct artifact path (${artifactRef})` : null,
          `Skill integrates with project stack (${stack.join(', ') || 'as described'})`,
        ].filter(Boolean),
      },
      project_context_used: { term: projectTerm, artifact: artifactRef, stack },
    });

    // 7. project-workflow — tests skill within the project's installed skill ecosystem
    const installedSkills = projectCtx.installed_skills || [];
    const siblingSkill    = installedSkills.find(s => s !== skillName) || 'another skill';
    scenarios.push({
      id: id++,
      eval_name: 'project-workflow-integration',
      type: 'project-workflow',
      prompt: installedSkills.length > 1
        ? `After running ${siblingSkill}, now ${primary}${stackLabel}`
        : `${primary} as part of our ${projectName} workflow`,
      expected: {
        triggers: true,
        assertions: [
          `Skill activates correctly within the project workflow context`,
          installedSkills.length > 1
            ? `Output does not duplicate or conflict with ${siblingSkill}`
            : `Output aligns with ${projectName} conventions`,
        ],
      },
      project_context_used: { installed_skills: installedSkills, project_name: projectName },
    });

    // 8. multi-turn — simulates resuming mid-session; tests that skill triggers
    // correctly under conversational continuation framing (not just cold-start prompts).
    const hooks     = (projectCtx.hooks || []).map(h => h.command).slice(0, 2);
    const hookHint  = hooks.length > 0 ? ` (our hooks include ${hooks.join(', ')})` : '';
    scenarios.push({
      id: id++,
      eval_name: 'multi-turn-resumed-context',
      type: 'multi-turn',
      prompt: [
        `[Continuing from earlier in our session]`,
        // Use "be <gerund>" if primary is gerund-form ("adapting..."), else use as-is
        `We discussed ${projectName} and agreed I'd ${/^[a-z]+ing\b/.test(verbPhrase(primary)) ? 'be ' : ''}${verbPhrase(primary)}.`,
        projectTerm !== projectName ? `We're using ${projectTerm}${hookHint}.` : hookHint ? `Our setup includes${hookHint}.` : '',
        `Let's continue — go ahead and do that now.`,
      ].filter(Boolean).join(' '),
      expected: {
        triggers: true,
        assertions: [
          'Skill triggers correctly despite continuation/resumption framing',
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

// ── Parse UAT.md / acceptance criteria ───────────────────────────────────────
if (fileName !== 'skill.md' || content.includes('acceptance criteria') || content.includes('## Given')) {
  for (const m of content.matchAll(/\*\*Given\*\*:?\s*(.+)\n\*\*When\*\*:?\s*(.+)\n\*\*Then\*\*:?\s*(.+)/gi)) {
    scenarios.push({
      id: id++, eval_name: `uat-gwt-${id}`, type: 'uat-acceptance',
      prompt: `Given ${m[1].trim()}: ${m[2].trim()}`,
      expected: { triggers: true, assertions: [m[3].trim()] },
    });
  }
  for (const m of content.matchAll(/- \[[ x]\]\s+(.+)/g)) {
    if (scenarios.length >= 10) break;
    scenarios.push({
      id: id++, eval_name: `uat-criteria-${id}`, type: 'uat-checkbox',
      prompt: m[1].trim(),
      expected: { triggers: true, assertions: [] },
    });
  }
}

if (scenarios.length === 0) {
  console.error('No scenarios could be extracted from the input file.');
  process.exit(1);
}

const output = {
  skill_name:      skillName,
  generated_from:  inputFile,
  project_context: contextFile || null,
  evals:           scenarios,
};

const outDir  = path.join(process.cwd(), 'evals', skillName);
const outPath = path.join(outDir, 'evals.json');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.error(`Wrote ${scenarios.length} scenarios to ${outPath}${projectCtx ? ' (with project context)' : ''}`);
console.log(JSON.stringify(output, null, 2));
