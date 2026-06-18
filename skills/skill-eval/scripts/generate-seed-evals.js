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
  const lower = phrase.toLowerCase();
  for (const [verb, syns] of Object.entries(VERB_SYNONYMS)) {
    if (lower.includes(verb)) {
      const s = syns[Math.floor(Math.random() * syns.length)];
      return lower.replace(verb, s);
    }
  }
  return null;
}

function paraphraseOf(phrase) {
  return `I need to ${phrase.toLowerCase().trim().replace(/^(please\s+|can you\s+)/i, '')}`;
}

function negativeOf(phrase) {
  return `Can you explain how to ${phrase.toLowerCase().trim()} without actually doing it?`;
}

// ── Parse SKILL.md ───────────────────────────────────────────────────────────
if (fileName === 'skill.md') {
  const descMatch = content.match(/^description:\s*(.+)/m);
  const description = descMatch ? descMatch[1].trim() : '';
  const useWhenMatch = description.match(/[Uu]se when\s+(.+)/);
  const triggerText  = useWhenMatch ? useWhenMatch[1] : description;
  const triggers     = triggerText.split(/[,;]/).map(t => t.trim()).filter(Boolean);
  const primary      = triggers[0] || 'invoke this skill';

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
      ? `I already finished ${firstStep}, I just need help with ${lastStep}`
      : primary,
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
