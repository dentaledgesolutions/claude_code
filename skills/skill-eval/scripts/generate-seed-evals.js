#!/usr/bin/env node
// generate-seed-evals.js <SKILL.md or UAT.md>
// Extracts test scenarios from a skill or acceptance-criteria file.
// Outputs evals.json to evals/<skill-name>/evals.json (and stdout).

const fs   = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Usage: node generate-seed-evals.js <SKILL.md or UAT.md>');
  process.exit(1);
}

const content  = fs.readFileSync(inputFile, 'utf8');
const fileName = path.basename(inputFile).toLowerCase();
const skillDir = path.dirname(inputFile);
const skillName = path.basename(skillDir);
const scenarios = [];
let id = 1;

// ── Synonyms for common action verbs ────────────────────────────────────────
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
  const lower = phrase.toLowerCase();
  for (const [verb, syns] of Object.entries(VERB_SYNONYMS)) {
    if (lower.includes(verb)) {
      const replacement = syns[Math.floor(Math.random() * syns.length)];
      return lower.replace(verb, replacement);
    }
  }
  return null;
}

// ── Paraphrase by restructuring (not just synonym swap) ──────────────────────
function paraphraseOf(phrase) {
  const lower = phrase.toLowerCase().trim().replace(/^(please\s+|can you\s+)/i, '');
  return `I need to ${lower}`;
}

// ── Negative (should NOT trigger): turn a task into an inquiry ───────────────
function negativeOf(phrase) {
  const lower = phrase.toLowerCase().trim();
  // Turn imperatives into "explain/describe/tell me about" questions
  return `Can you explain how to ${lower} without actually doing it?`;
}

// ── Parse SKILL.md ───────────────────────────────────────────────────────────
if (fileName === 'skill.md') {
  const descMatch = content.match(/^description:\s*(.+)/m);
  const description = descMatch ? descMatch[1].trim() : '';

  const useWhenMatch = description.match(/[Uu]se when\s+(.+)/);
  const triggerText  = useWhenMatch ? useWhenMatch[1] : description;
  const triggers     = triggerText.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  const primaryTrigger = triggers[0] || 'invoke this skill';

  // Extract numbered workflow steps
  const steps = [];
  for (const m of content.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)) steps.push(m[1]);

  // 1. direct — exact trigger phrase
  scenarios.push({
    id: id++,
    eval_name: 'direct-primary-trigger',
    type: 'direct',
    prompt: primaryTrigger.charAt(0).toUpperCase() + primaryTrigger.slice(1),
    expected: {
      triggers: true,
      assertions: steps.slice(0, 3).map(s => `Executes step: ${s}`),
    },
  });

  // 2. paraphrased — same intent, different phrasing
  scenarios.push({
    id: id++,
    eval_name: 'paraphrased-reword',
    type: 'paraphrased',
    prompt: paraphraseOf(primaryTrigger),
    expected: {
      triggers: true,
      assertions: [`Produces same outcome as direct trigger`],
    },
  });

  // 3. edge_case — starts mid-workflow or uses minimal/ambiguous input
  const lastStep = steps[steps.length - 1] || 'the final step';
  const firstStep = steps[0] || 'the first step';
  scenarios.push({
    id: id++,
    eval_name: 'edge-case-mid-workflow',
    type: 'edge_case',
    prompt: steps.length > 2
      ? `I already finished ${firstStep}, I just need help with ${lastStep}`
      : primaryTrigger,
    expected: {
      triggers: true,
      assertions: [`Handles partial workflow entry without restarting from scratch`],
    },
  });

  // 4. negative — adjacent but should NOT trigger
  scenarios.push({
    id: id++,
    eval_name: 'negative-explain-only',
    type: 'negative',
    prompt: negativeOf(primaryTrigger),
    expected: {
      triggers: false,
      note: 'Explanation request — should answer conversationally, not invoke the workflow',
    },
  });

  // 5. semantic — synonym variation of the primary action verb
  const synonymPrompt = synonymOf(primaryTrigger);
  scenarios.push({
    id: id++,
    eval_name: 'semantic-synonym-trigger',
    type: 'semantic',
    prompt: synonymPrompt
      ? synonymPrompt.charAt(0).toUpperCase() + synonymPrompt.slice(1)
      : `${primaryTrigger} (alternate phrasing)`,
    expected: {
      triggers: true,
      assertions: [`Synonym phrasing activates skill correctly`],
    },
  });
}

// ── Parse UAT.md / acceptance criteria ───────────────────────────────────────
if (fileName !== 'skill.md' || content.includes('acceptance criteria') || content.includes('## Given')) {
  // Given/When/Then blocks
  for (const m of content.matchAll(/\*\*Given\*\*:?\s*(.+)\n\*\*When\*\*:?\s*(.+)\n\*\*Then\*\*:?\s*(.+)/gi)) {
    scenarios.push({
      id: id++,
      eval_name: `uat-gwt-${id}`,
      type: 'uat-acceptance',
      prompt: `Given ${m[1].trim()}: ${m[2].trim()}`,
      expected: { triggers: true, assertions: [m[3].trim()] },
    });
  }

  // Checkbox acceptance criteria
  for (const m of content.matchAll(/- \[[ x]\]\s+(.+)/g)) {
    if (scenarios.length >= 10) break;
    scenarios.push({
      id: id++,
      eval_name: `uat-criteria-${id}`,
      type: 'uat-checkbox',
      prompt: m[1].trim(),
      expected: { triggers: true, assertions: [] },
    });
  }
}

if (scenarios.length === 0) {
  console.error('No scenarios could be extracted from the input file.');
  process.exit(1);
}

const output = { skill_name: skillName, generated_from: inputFile, evals: scenarios };

// Write to evals/<skill-name>/evals.json
const outDir = path.join(process.cwd(), 'evals', skillName);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'evals.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.error(`Wrote ${scenarios.length} scenarios to ${outPath}`);

// Emit to stdout for piping
console.log(JSON.stringify(output, null, 2));
