#!/usr/bin/env node
// scripts/brain/brain-search.js — authority-ranked lexical search over a brain
// capsule. No index, no network: scan + score is fast at capsule scale (spec:
// brain-index.js deferred until measurably slow).
// Usage: brain-search.js --query "<terms>" [--limit N] [--json] [--dir sub] [--target <dir>]
// Also exports search() for brain-context-pack.js.
'use strict';
const fs = require('fs');
const path = require('path');
const {
  getArg, hasFlag, resolveTarget, parseFrontmatter, walkMarkdown,
} = require('./brain-lib');

// Directory-tier authority; frontmatter status refines within tier.
const DIR_AUTHORITY = [
  { prefix: 'canon/', weight: 60, label: 'canon' },
  { prefix: 'decisions/active/', weight: 50, label: 'active decision' },
  { prefix: 'lessons/', weight: 40, label: 'lesson' },
  { prefix: 'synthesis/', weight: 30, label: 'synthesis' },
  { prefix: 'decisions/candidates/', weight: 25, label: 'candidate' },
  { prefix: 'sessions/', weight: 20, label: 'session note' },
  { prefix: 'support/', weight: 10, label: 'raw source' },
];
const STATUS_BONUS = { canon: 5, active: 4, validated: 3, candidate: 1 };

function tokenize(s) {
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}

function search(target, query, { limit = 5, dir = null } = {}) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const root = dir ? path.join(target, dir) : target;
  const results = [];
  for (const file of walkMarkdown(root)) {
    const rel = path.relative(target, file).split(path.sep).join('/');
    if (rel.startsWith('reports/')) continue; // generated artifacts are not knowledge
    const text = fs.readFileSync(file, 'utf8');
    const { fields } = parseFrontmatter(text);
    const tier = DIR_AUTHORITY.find(t => rel.startsWith(t.prefix)) || { weight: 10, label: 'raw source' };
    const title = (fields && fields.title) || path.basename(rel, '.md');
    const tags = (fields && Array.isArray(fields.tags)) ? fields.tags : [];
    const bodyTokens = new Set(tokenize(text));
    const titleTokens = new Set(tokenize(title));
    const tagTokens = new Set(tags.flatMap(tokenize));
    let overlap = 0;
    for (const t of terms) {
      if (titleTokens.has(t)) overlap += 3;
      if (tagTokens.has(t)) overlap += 2;
      if (bodyTokens.has(t)) overlap += 1;
    }
    if (overlap === 0) continue;
    const status = (fields && fields.status) || '';
    const ts = fields ? Date.parse(fields.timestamp) : NaN;
    const ageDays = Number.isNaN(ts) ? 365 : (Date.now() - ts) / 86400000;
    const recency = Math.max(0, 5 - ageDays / 30); // ≤5 pts, decays over ~5 months
    const score = tier.weight + (STATUS_BONUS[status] || 0) + overlap * 2 + recency;
    results.push({
      path: rel, title, score: Math.round(score * 10) / 10,
      authority: tier.label, type: (fields && fields.type) || 'unknown', status: status || 'none',
    });
  }
  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return results.slice(0, limit);
}

if (require.main === module) {
  const query = getArg(process.argv, '--query', '');
  if (!query.trim()) {
    console.error('brain-search: usage: brain-search.js --query "<terms>" [--limit N] [--json] [--dir sub]');
    process.exit(1);
  }
  const results = search(resolveTarget(process.argv), query, {
    limit: Number(getArg(process.argv, '--limit', '5')),
    dir: getArg(process.argv, '--dir', null),
  });
  if (hasFlag(process.argv, '--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) console.log(`${String(r.score).padStart(6)}  ${r.path} — ${r.title}`);
  }
}
module.exports = { search };
