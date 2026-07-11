#!/usr/bin/env node
// scripts/brain/bench-brain-kernel-adapter.js — SecondBrainBench adapter for the
// brain-kernel retrieval path. Given a capsule dir and a question, returns the
// top-5 authority-ranked hits via brain-search. It NEVER reads the sealed key —
// this file imports only the retrieval layer; the runner does the comparison.
'use strict';
const fs = require('fs');
const path = require('path');
const { search } = require('./brain-search');

// retrieve(capsuleDir, question) → { paths: string[], contents: string[] }
// paths are capsule-relative (as brain-search returns them); contents are read
// from disk for the runner's leakage scan.
function retrieve(capsuleDir, question) {
  const hits = search(capsuleDir, question.query, { limit: 5 });
  const paths = hits.map(h => h.path);
  const contents = paths.map(p => {
    try { return fs.readFileSync(path.join(capsuleDir, p), 'utf8'); } catch { return ''; }
  });
  return { paths, contents };
}

module.exports = { retrieve };
