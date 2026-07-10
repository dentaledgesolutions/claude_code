#!/usr/bin/env node
// scripts/brain/brain-reference-repo-refresh.js — bump last_reviewed to today
// in both the registry entry and the source-card frontmatter, then regenerate
// registry.md.
// Usage: node brain-reference-repo-refresh.js --name <n> [--root <dir>]
// Exit 0 ok · 1 usage/missing entry.
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, todayStamp } = require('./brain-lib');
const { loadRegistry, saveRegistry, sourceCardFile } = require('./reference-lib');

const root = path.resolve(getArg(process.argv, '--root', '.'));
const name = getArg(process.argv, '--name');
if (!name) {
  console.error('brain-reference-repo-refresh: usage --name <n> [--root <dir>]');
  process.exit(1);
}

let data;
try {
  ({ data } = loadRegistry(root));
} catch (e) {
  console.error(`brain-reference-repo-refresh: cannot load registry at ${root} (${e.message})`);
  process.exit(1);
}
const entry = data.repositories.find(e => e.name === name);
if (!entry) {
  console.error(`brain-reference-repo-refresh: no entry named '${name}' in registry`);
  process.exit(1);
}

const today = todayStamp();
entry.last_reviewed = today;
saveRegistry(root, data);

const cardFile = sourceCardFile(root, name);
if (fs.existsSync(cardFile)) {
  const text = fs.readFileSync(cardFile, 'utf8');
  const updated = text.replace(/^last_reviewed:\s*.*$/m, `last_reviewed: ${today}`);
  fs.writeFileSync(cardFile, updated);
}

console.log(`brain-reference-repo-refresh: '${name}' last_reviewed -> ${today}`);
process.exit(0);
