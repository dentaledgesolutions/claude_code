#!/usr/bin/env node
// scripts/brain/secondbrainbench-generate.js — build a SecondBrainBench workspace:
// a capsule (synthetic planted content, or a copy of a live capsule), a questions
// file, and a SEALED answers file. The sealed answers live in answers/ and are read
// only by the runner's compare step — never by the adapter under test.
// Usage: secondbrainbench-generate.js --out <dir> [--target <capsule>] [--synthetic]
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, hasFlag, todayStamp, serializeFrontmatter } = require('./brain-lib');

// Ten question types (spec/v3 §8.1). Each gets a distinct topic word so queries
// only match their own planted docs (target + 2 same-topic distractors). rankFirst
// types plant the target in canon/ so authority ranking must put it at rank 1.
const SPECS = [
  { type: 'decision-retrieval', topic: 'aardvark', dir: 'decisions/active', status: 'active', rankFirst: false, word: 'decision' },
  { type: 'lesson-retrieval', topic: 'badger', dir: 'lessons/memories', status: 'validated', rankFirst: false, word: 'lesson' },
  { type: 'canon-precedence', topic: 'cheetah', dir: 'canon', status: 'canon', rankFirst: true, word: 'canonical rule' },
  { type: 'anti-pattern', topic: 'dingo', dir: 'lessons/anti-patterns', status: 'validated', rankFirst: false, word: 'anti-pattern' },
  { type: 'security-rule', topic: 'eagle', dir: 'canon', status: 'canon', rankFirst: true, word: 'security rule' },
  { type: 'stale-detection', topic: 'falcon', dir: 'decisions/active', status: 'active', rankFirst: false, word: 'policy' },
  { type: 'contradiction', topic: 'gazelle', dir: 'canon', status: 'canon', rankFirst: true, word: 'authoritative choice' },
  { type: 'citation', topic: 'heron', dir: 'decisions/active', status: 'active', rankFirst: false, word: 'approach' },
  { type: 'reference-pattern', topic: 'ibis', dir: 'synthesis', status: 'validated', rankFirst: false, word: 'reusable pattern' },
  { type: 'time-aware', topic: 'jaguar', dir: 'decisions/active', status: 'active', rankFirst: false, word: 'current guidance' },
];

function writeDoc(capsule, rel, fields, body) {
  const p = path.join(capsule, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, serializeFrontmatter(fields, body));
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function buildSynthetic(capsule) {
  const now = todayStamp();
  const old = '2024-01-01';
  const questions = [];
  const answers = [];
  let id = 0;
  for (const spec of SPECS) {
    id += 1;
    const t = spec.topic;
    const targetRel = `${spec.dir}/${t}-target.md`;
    // Target: authoritative doc, strong topic overlap, recent.
    writeDoc(capsule, targetRel, {
      type: 'decision', title: `${t} ${spec.word} target`, description: `the correct ${spec.word} about ${t}`,
      tags: [t], timestamp: `${now}T10:00:00`, sources: [], status: spec.status,
    }, `The ${t} ${spec.word}: this is the authoritative answer about ${t}. ${t} ${t}.\n`);
    // Distractor 1: same topic, lower authority (session note), older.
    const d1Rel = `sessions/daily/${t}-note.md`;
    writeDoc(capsule, d1Rel, {
      type: 'note', title: `${t} passing note`, description: `a low-authority mention of ${t}`,
      tags: [t], timestamp: `${old}T09:00:00`, sources: [], status: 'none',
    }, `Someone mentioned ${t} in passing. Not the ${spec.word}. ${t}.\n`);
    // Distractor 2: same topic, mid authority (a candidate), for rankFirst put it
    // in decisions/active so canon must still beat it on tier.
    const d2Dir = spec.rankFirst ? 'decisions/active' : 'decisions/candidates';
    const d2Rel = `${d2Dir}/${t}-other.md`;
    writeDoc(capsule, d2Rel, {
      type: 'decision', title: `${t} secondary`, description: `another ${t} doc, not the target`,
      tags: [t], timestamp: `${now}T08:00:00`, sources: [], status: spec.rankFirst ? 'active' : 'candidate',
    }, `A secondary ${t} document. Related to ${t} but not the ${spec.word}. ${t}.\n`);

    // Query is the distinct topic word alone — each topic word appears only in its
    // own three planted docs, so retrieval never cross-matches another type's docs
    // (which would pollute precision). spec.word is used only in titles/descriptions.
    questions.push({ id, type: spec.type, query: t, expects: 'path' });
    const answer = { id, type: spec.type, correct_paths: [targetRel], relevant_paths: [targetRel, d1Rel, d2Rel] };
    if (spec.rankFirst) answer.must_rank_first = targetRel;
    answers.push(answer);
  }
  return { questions, answers };
}

const out = getArg(process.argv, '--out');
if (!out) { console.error('secondbrainbench-generate: --out <dir> required'); process.exit(1); }
const capsule = path.join(out, 'capsule');
fs.mkdirSync(path.join(out, 'questions'), { recursive: true });
fs.mkdirSync(path.join(out, 'answers'), { recursive: true });

let questions, answers;
if (hasFlag(process.argv, '--synthetic')) {
  fs.rmSync(capsule, { recursive: true, force: true });
  fs.mkdirSync(capsule, { recursive: true });
  ({ questions, answers } = buildSynthetic(capsule));
} else {
  const target = getArg(process.argv, '--target', '.project-brain');
  if (!fs.existsSync(target)) { console.error(`secondbrainbench-generate: target capsule not found: ${target}`); process.exit(1); }
  fs.rmSync(capsule, { recursive: true, force: true });
  copyDir(target, capsule);
  // Live mode reuses the synthetic question set as a structural probe over real content.
  ({ questions, answers } = buildSynthetic(path.join(out, '__probe_scratch__')));
  fs.rmSync(path.join(out, '__probe_scratch__'), { recursive: true, force: true });
}

fs.writeFileSync(path.join(out, 'questions', 'questions.json'), JSON.stringify(questions, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'answers', 'answers.json'), JSON.stringify(answers, null, 2) + '\n');
console.log(`secondbrainbench-generate: wrote ${questions.length} questions + sealed answers to ${out}`);
