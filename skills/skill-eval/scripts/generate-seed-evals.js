#!/usr/bin/env node
// generate-seed-evals.js <skill-or-uat-file>
// Extracts test scenarios from a SKILL.md or UAT.md file.
// Outputs JSON array of test case objects.

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Usage: node generate-seed-evals.js <SKILL.md or UAT.md>');
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf8');
const fileName = path.basename(inputFile).toLowerCase();
const scenarios = [];

// --- Parse SKILL.md ---
if (fileName === 'skill.md') {
  // Extract trigger phrases from description frontmatter
  const descMatch = content.match(/^description:\s*(.+)/m);
  const description = descMatch ? descMatch[1].trim() : '';

  // Extract "Use when" triggers
  const useWhenMatch = description.match(/[Uu]se when\s+(.+)/);
  const triggerText = useWhenMatch ? useWhenMatch[1] : description;
  const triggers = triggerText.split(/[,;]/).map(t => t.trim()).filter(Boolean);

  // Extract numbered workflow steps
  const steps = [];
  const stepMatches = content.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm);
  for (const m of stepMatches) steps.push(m[1]);

  // Scenario 1: Golden path (primary trigger)
  if (triggers.length > 0) {
    scenarios.push({
      id: 1,
      type: 'golden-path',
      input_prompt: triggers[0].charAt(0).toUpperCase() + triggers[0].slice(1),
      expected: {
        triggers: true,
        checklist_steps: steps.slice(0, 3),
        output_must_contain: ['SKILL.md', steps[0] || 'step 1'].filter(Boolean),
      },
    });
  }

  // Scenario 2: Trigger boundary (should NOT trigger)
  if (triggers.length > 0) {
    const antonym = triggers[0]
      .replace(/find|search/i, 'list installed')
      .replace(/eval|evaluat/i, 'describe')
      .replace(/refine|improve/i, 'review');
    scenarios.push({
      id: 2,
      type: 'trigger-boundary',
      input_prompt: antonym !== triggers[0] ? antonym : 'What skills do I have installed?',
      expected: {
        triggers: false,
        note: 'This prompt should NOT invoke the skill',
      },
    });
  }

  // Scenario 3: Complex/messy input
  if (triggers.length > 1) {
    scenarios.push({
      id: 3,
      type: 'complex-input',
      input_prompt: `I need to ${triggers[1]} but I'm not sure where to start — the project is using GSD and there are already some related skills installed`,
      expected: {
        triggers: true,
        checklist_steps: steps,
        output_must_contain: [],
      },
    });
  }

  // Scenario 4: Edge case (last workflow step)
  if (steps.length > 2) {
    scenarios.push({
      id: 4,
      type: 'edge-case',
      input_prompt: `I already did ${steps[0]} and ${steps[1]}, now I need help with ${steps[steps.length - 1]}`,
      expected: {
        triggers: true,
        checklist_steps: [steps[steps.length - 1]],
        output_must_contain: [],
      },
    });
  }

  // Scenario 5: Composition / handoff
  scenarios.push({
    id: 5,
    type: 'composition',
    input_prompt: `After using ${path.dirname(inputFile).split('/').pop()}, what skill should I run next?`,
    expected: {
      triggers: false,
      note: 'Should answer conversationally, not invoke this skill again',
    },
  });
}

// --- Parse UAT.md or acceptance criteria ---
if (fileName === 'uat.md' || content.includes('acceptance criteria') || content.includes('## Given')) {
  // Extract Given/When/Then blocks
  const gwtMatches = content.matchAll(/\*\*Given\*\*:?\s*(.+)\n\*\*When\*\*:?\s*(.+)\n\*\*Then\*\*:?\s*(.+)/gi);
  let id = scenarios.length + 1;
  for (const m of gwtMatches) {
    scenarios.push({
      id: id++,
      type: 'uat-acceptance',
      input_prompt: `Given ${m[1].trim()}: ${m[2].trim()}`,
      expected: {
        triggers: true,
        output_must_contain: [m[3].trim()],
      },
    });
  }

  // Extract checkbox items from acceptance criteria
  const checkboxMatches = content.matchAll(/- \[[ x]\]\s+(.+)/g);
  for (const m of checkboxMatches) {
    if (scenarios.length >= 10) break;
    scenarios.push({
      id: id++,
      type: 'uat-checkbox',
      input_prompt: m[1].trim(),
      expected: {
        triggers: true,
        output_must_contain: [],
      },
    });
  }
}

if (scenarios.length === 0) {
  console.error('No scenarios could be extracted from the input file.');
  process.exit(1);
}

console.log(JSON.stringify({ source: inputFile, scenarios }, null, 2));
