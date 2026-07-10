#!/usr/bin/env node
// scripts/brain/brain-reference-repo-add.js — register a new reference repository.
// Usage: node brain-reference-repo-add.js --name <n> --url <u> --types a,b
//        [--use "..."] [--risk "..."] [--force] [--root <dir>]
// Every entry is registered docs-only: install_policy is always forced to
// 'do-not-install-directly'. Exit 0 ok · 1 usage/duplicate/unknown-type.
'use strict';
const path = require('path');
const { getArg, hasFlag, todayStamp } = require('./brain-lib');
const {
  loadRegistry, saveRegistry, scaffoldSourceCard, TYPE_ENUM, NAME_PATTERN, INSTALL_POLICY,
} = require('./reference-lib');

const root = path.resolve(getArg(process.argv, '--root', '.'));
const name = getArg(process.argv, '--name');
const url = getArg(process.argv, '--url');
const typesArg = getArg(process.argv, '--types');
const force = hasFlag(process.argv, '--force');

if (!name || !url || !typesArg) {
  console.error('brain-reference-repo-add: usage --name <n> --url <u> --types a,b [--use "..."] [--risk "..."] [--force] [--root <dir>]');
  process.exit(1);
}
if (!NAME_PATTERN.test(name)) {
  console.error(`brain-reference-repo-add: invalid name '${name}' — must match ${NAME_PATTERN}`);
  process.exit(1);
}
const types = typesArg.split(',').map(s => s.trim()).filter(Boolean);
if (!types.length) {
  console.error('brain-reference-repo-add: --types must list at least one type');
  process.exit(1);
}
const badTypes = types.filter(t => !TYPE_ENUM.includes(t));
if (badTypes.length) {
  console.error(`brain-reference-repo-add: unknown type(s): ${badTypes.join(', ')} (allowed: ${TYPE_ENUM.join(', ')})`);
  process.exit(1);
}

let data;
try {
  ({ data } = loadRegistry(root));
} catch (e) {
  console.error(`brain-reference-repo-add: cannot load registry at ${root} (${e.message})`);
  process.exit(1);
}

const existingIdx = data.repositories.findIndex(e => e.name === name);
if (existingIdx !== -1 && !force) {
  console.error(`brain-reference-repo-add: '${name}' already exists — use --force to overwrite`);
  process.exit(1);
}

const use = getArg(process.argv, '--use');
const risk = getArg(process.argv, '--risk');
const entry = {
  name,
  url,
  status: 'reference',
  types,
  install_policy: INSTALL_POLICY,
  last_reviewed: todayStamp(),
  preferred_use: use ? use.split(',').map(s => s.trim()).filter(Boolean) : [],
  risk_notes: risk ? risk.split(',').map(s => s.trim()).filter(Boolean) : [],
};

if (existingIdx !== -1) data.repositories[existingIdx] = entry;
else data.repositories.push(entry);

saveRegistry(root, data);
const cardFile = scaffoldSourceCard(root, entry);

console.log(`brain-reference-repo-add: ${existingIdx !== -1 ? 'updated' : 'added'} '${name}' (card: ${path.relative(root, cardFile)})`);
process.exit(0);
