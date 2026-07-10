#!/usr/bin/env node
// scripts/brain/brain-context-pack.js — build the spec §7.3 context object for a
// task intent by running bucket-scoped brain-search queries. Fail open: a missing
// profile or empty capsule degrades to warnings/gaps, never a crash.
// Usage: brain-context-pack.js --intent "<task>" [--per-bucket N] [--target <dir>]
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, resolveTarget, scanSensitive, walkMarkdown } = require('./brain-lib');
const { search } = require('./brain-search');

const target = resolveTarget(process.argv);
const intent = getArg(process.argv, '--intent', '');
if (!intent.trim()) {
  console.error('brain-context-pack: usage: brain-context-pack.js --intent "<task>" [--per-bucket N]');
  process.exit(1);
}
const perBucket = Number(getArg(process.argv, '--per-bucket', '3'));
const warnings = [];

let profile = {};
try {
  profile = JSON.parse(fs.readFileSync(path.join(target, 'context', 'brain-profile.json'), 'utf8'));
} catch {
  warnings.push('brain-profile.json missing or unreadable — using defaults');
}

const BUCKETS = {
  relevant_canon: 'canon',
  relevant_decisions: 'decisions',
  relevant_lessons: 'lessons',
  relevant_reports: 'reports',
  reference_sources: 'reference-repositories',
};
const pack = {
  task_intent: intent,
  project: profile.project_name || path.basename(path.dirname(target)),
  retrieval_mode: profile.brain_mode || 'standard',
};
const gaps = [];
for (const [bucket, dir] of Object.entries(BUCKETS)) {
  const hits = fs.existsSync(path.join(target, dir)) ? search(target, intent, { limit: perBucket, dir }) : [];
  pack[bucket] = hits;
  if (!hits.length) gaps.push(bucket);
}
pack.excluded_context = [];

// Surface (do not fix) sensitive-content state — retrieval must not launder secrets.
let dirty = 0;
for (const file of walkMarkdown(target)) {
  if (scanSensitive(fs.readFileSync(file, 'utf8')).length) dirty++;
}
if (dirty) warnings.push(`sensitive content present in ${dirty} file(s) — run brain-lint and clean before sharing context`);

pack.gaps = gaps;
pack.warnings = warnings;
console.log(JSON.stringify(pack, null, 2));
