#!/usr/bin/env node
// scripts/brain/brain-reference-repo-map.js — parse a source card's Reusable
// Patterns / Candidate Skills / Candidate Agents sections into a structured
// handoff for skill-scout / agent-scout.
// Usage: node brain-reference-repo-map.js --name <n> [--json] [--root <dir>]
// Exit 0 ok · 1 usage/missing card.
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, hasFlag } = require('./brain-lib');
const { sourceCardFile, parseSourceCardMap } = require('./reference-lib');

const root = path.resolve(getArg(process.argv, '--root', '.'));
const name = getArg(process.argv, '--name');
if (!name) {
  console.error('brain-reference-repo-map: usage --name <n> [--json] [--root <dir>]');
  process.exit(1);
}

const cardFile = sourceCardFile(root, name);
if (!fs.existsSync(cardFile)) {
  console.error(`brain-reference-repo-map: no source card at ${path.relative(root, cardFile)}`);
  process.exit(1);
}

const text = fs.readFileSync(cardFile, 'utf8');
const map = parseSourceCardMap(text);

if (hasFlag(process.argv, '--json')) {
  console.log(JSON.stringify(map, null, 2));
} else {
  console.log(`brain-reference-repo-map: ${name}`);
  console.log(`\nPatterns (${map.patterns.length}):`);
  map.patterns.forEach(p => console.log(`- ${p}`));
  console.log(`\nCandidate skills (${map.candidate_skills.length}):`);
  map.candidate_skills.forEach(p => console.log(`- ${p}`));
  console.log(`\nCandidate agents (${map.candidate_agents.length}):`);
  map.candidate_agents.forEach(p => console.log(`- ${p}`));
}
process.exit(0);
