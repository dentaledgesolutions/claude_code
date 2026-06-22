#!/usr/bin/env node
// validate-skills.js
// Validates SKILL.md frontmatter across all skills in the skills/ directory.
// Exits 0 if all pass, 1 if any fail.

const fs   = require('fs');
const path = require('path');

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(`Usage: node scripts/validate-skills.js [skills-dir]

Validate SKILL.md frontmatter for all skills.

Arguments:
  skills-dir   Path to skills directory (default: ./skills)

Checks:
  - name field present and ≤ 64 chars (Agent Skills spec)
  - description field present and ≤ 1024 chars (Agent Skills spec)
  - compatibility field present
  - description contains "Use when" trigger clause
  - No description starts with raw quotes (parsing artifact)

Exit codes:
  0  All skills pass
  1  One or more skills fail`);
  process.exit(0);
}

const skillsDir = process.argv[2] || path.join(process.cwd(), 'skills');
const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort();

let passed = 0;
let failed = 0;

for (const skill of skills) {
  const skillFile = path.join(skillsDir, skill, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    console.log(`  FAIL  ${skill}: SKILL.md not found`);
    failed++;
    continue;
  }

  const content = fs.readFileSync(skillFile, 'utf8');

  // Extract frontmatter between --- delimiters
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) {
    console.log(`  FAIL  ${skill}: no YAML frontmatter found`);
    failed++;
    continue;
  }
  const fm = fmMatch[1];

  const errors = [];

  // name
  const nameMatch = fm.match(/^name:\s*(.+)/m);
  if (!nameMatch) {
    errors.push('missing name field');
  } else {
    const name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    if (name.length > 64) errors.push(`name too long (${name.length} chars, max 64)`);
    if (/[A-Z]/.test(name)) errors.push('name must be lowercase');
    if (/[^a-z0-9-]/.test(name)) errors.push('name must use only lowercase letters, numbers, hyphens');
  }

  // description
  const descMatch = fm.match(/^description:\s*(.+)/m);
  if (!descMatch) {
    errors.push('missing description field');
  } else {
    const desc = descMatch[1].trim().replace(/^["']|["']$/g, '');
    if (desc.length > 1024) errors.push(`description too long (${desc.length} chars, max 1024)`);
    if (desc.length < 20)   errors.push(`description too short (${desc.length} chars)`);
    if (!/[Uu]se when/i.test(desc)) errors.push('description missing "Use when" trigger clause');
    // A stray quote is one that remains AFTER stripping outer YAML delimiters
    if (/^["']/.test(desc)) errors.push('description starts with stray quote after YAML parsing (artifact)');
  }

  // compatibility
  if (!/^compatibility:/m.test(fm)) {
    errors.push('missing compatibility field (Agent Skills spec requirement)');
  }

  if (errors.length === 0) {
    console.log(`  PASS  ${skill}`);
    passed++;
  } else {
    errors.forEach(e => console.log(`  FAIL  ${skill}: ${e}`));
    failed++;
  }
}

console.log(`\n${passed + failed} skills checked — ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
