#!/usr/bin/env node
// scripts/brain/brain-reference-repo-audit.js — security + quality audit for one
// reference-repository entry and its sources/<name>/ card tree.
// Usage: node brain-reference-repo-audit.js --name <n> [--root <dir>]
// Security violations (bad install_policy, executables under sources/<name>/,
// sensitive content) -> exit 3. Quality issues (missing prohibited_uses,
// stale last_reviewed) -> warnings, exit 0. Reports append to
// <root>/.project-brain/reports/security/ when a capsule exists (fail open).
'use strict';
const fs = require('fs');
const path = require('path');
const {
  getArg, todayStamp, scanSensitive, parseFrontmatter, walkMarkdown,
} = require('./brain-lib');
const { loadRegistry, sourceDir, sourceCardFile, INSTALL_POLICY } = require('./reference-lib');

const STALE_DAYS = 180;
const EXECUTABLE_RE = /\.(sh|js|py|rb|ps1)$/;

const root = path.resolve(getArg(process.argv, '--root', '.'));
const name = getArg(process.argv, '--name');
if (!name) {
  console.error('brain-reference-repo-audit: usage --name <n> [--root <dir>]');
  process.exit(1);
}

let data;
try {
  ({ data } = loadRegistry(root));
} catch (e) {
  console.error(`brain-reference-repo-audit: cannot load registry at ${root} (${e.message})`);
  process.exit(1);
}
const entry = data.repositories.find(e => e.name === name);
if (!entry) {
  console.error(`brain-reference-repo-audit: no entry named '${name}' in registry`);
  process.exit(1);
}

const security = [];
const warnings = [];

if (entry.install_policy !== INSTALL_POLICY) {
  security.push(`${name}: install_policy is '${entry.install_policy}', must be '${INSTALL_POLICY}'`);
}

const cardFile = sourceCardFile(root, name);
if (!fs.existsSync(cardFile)) {
  warnings.push(`${name}: no source card at ${path.relative(root, cardFile)}`);
} else {
  const cardText = fs.readFileSync(cardFile, 'utf8');
  const { fields } = parseFrontmatter(cardText);
  if (!fields) {
    warnings.push(`${name}: source card missing frontmatter`);
  } else if (!Array.isArray(fields.prohibited_uses) || fields.prohibited_uses.length === 0) {
    warnings.push(`${name}: source card frontmatter has empty/missing prohibited_uses`);
  }
}

// Sensitive-content scan over every markdown file under sources/<name>/
// (source card plus any supplementary notes/maps).
const dir = sourceDir(root, name);
for (const file of walkMarkdown(dir)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const hit of scanSensitive(text)) {
    security.push(`${path.relative(root, file)}: sensitive content (${hit})`);
  }
}

// Docs-only enforcement: no executables anywhere under sources/<name>/.
const execHits = [];
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXECUTABLE_RE.test(e.name)) execHits.push(path.relative(root, p));
  }
})(dir);
if (execHits.length) {
  security.push(`${name}: executable file(s) under sources/${name}/ (docs only): ${execHits.join(', ')}`);
}

const reviewed = Date.parse(entry.last_reviewed);
if (!Number.isNaN(reviewed) && (Date.now() - reviewed) / 86400000 > STALE_DAYS) {
  warnings.push(`${name}: last_reviewed (${entry.last_reviewed}) older than ${STALE_DAYS} days`);
}

// Report — append, fail open on write errors, only when a capsule exists.
const capsuleDir = path.join(root, '.project-brain');
if (fs.existsSync(capsuleDir)) {
  try {
    const rdir = path.join(capsuleDir, 'reports', 'security');
    fs.mkdirSync(rdir, { recursive: true });
    const fmt = xs => xs.map(x => `- ${x}`).join('\n') || '- none';
    const reportFile = path.join(rdir, `reference-repo-audit-${name}-${todayStamp()}.md`);
    fs.appendFileSync(reportFile,
      `# reference-repo-audit — ${name} — ${todayStamp()}\n\n## Security (${security.length})\n${fmt(security)}\n\n## Warnings (${warnings.length})\n${fmt(warnings)}\n\n`);
  } catch { /* fail open */ }
}

for (const s of security) console.error(`SECURITY ${s}`);
for (const w of warnings) console.error(`warn ${w}`);
console.log(`brain-reference-repo-audit: ${name} — ${security.length} security finding(s), ${warnings.length} warning(s)`);
process.exit(security.length ? 3 : 0);
