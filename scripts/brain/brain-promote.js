#!/usr/bin/env node
// scripts/brain/brain-promote.js — the ONLY writer to canon/ and decisions/active/.
// Requires explicit --approve; without it, refuses and writes NOTHING (exit 2).
// Usage: node brain-promote.js <capsule-relative-file> --approve
//        [--to active|canon] [--force] [--target <dir>]
// Exit 0 ok · 1 usage/overwrite/traversal refusal · 2 missing --approve · 3 sensitive content.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  getArg, hasFlag, positional, resolveTarget, todayStamp,
  parseFrontmatter, serializeFrontmatter, scanSensitive, resolveCapsuleRelative,
} = require('./brain-lib');

const target = resolveTarget(process.argv);
const rel = positional(process.argv)[0];
if (!rel) {
  console.error('brain-promote: usage: brain-promote.js <capsule-relative-file> --approve [--to active|canon]');
  process.exit(1);
}
// Containment check BEFORE any filesystem access: '../' segments or absolute
// paths must never let a promote reach outside the capsule (read, delete, or write).
const src = resolveCapsuleRelative(target, rel);
if (src === null) {
  console.error(`brain-promote: path escapes the capsule: ${rel}`);
  process.exit(1);
}
if (!hasFlag(process.argv, '--approve')) {
  console.error('brain-promote: REFUSED — promotion to canon/active requires explicit --approve (human decision, never autonomous)');
  process.exit(2);
}
const to = getArg(process.argv, '--to', 'active');
if (!['active', 'canon'].includes(to)) {
  console.error(`brain-promote: --to must be 'active' or 'canon' (got '${to}')`);
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`brain-promote: candidate not found: ${rel}`);
  process.exit(1);
}
const text = fs.readFileSync(src, 'utf8');
const hits = scanSensitive(text);
if (hits.length) {
  console.error(`brain-promote: REFUSED — sensitive content in candidate (${hits.join(', ')}); clean it before promoting`);
  process.exit(3);
}
const destDir = to === 'canon' ? path.join(target, 'canon') : path.join(target, 'decisions', 'active');
const dest = path.join(destDir, path.basename(src));
if (fs.existsSync(dest) && !hasFlag(process.argv, '--force')) {
  console.error(`brain-promote: destination exists (pass --force to overwrite): ${path.relative(target, dest)}`);
  process.exit(1);
}
const { fields, body } = parseFrontmatter(text);
const updated = serializeFrontmatter(
  { ...(fields || {}), status: to === 'canon' ? 'canon' : 'active', promoted_at: todayStamp() },
  body,
);
fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(dest, updated);
fs.unlinkSync(src);
// Lifecycle log — fail open: a log-write failure must not undo the promotion.
try {
  fs.appendFileSync(path.join(target, 'log.md'),
    `- ${todayStamp()} promoted ${rel} → ${path.relative(target, dest)}\n`);
} catch { /* fail open */ }
console.log(`brain-promote: ${rel} → ${path.relative(target, dest)}`);
