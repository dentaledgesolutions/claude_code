#!/usr/bin/env node
// scripts/brain/brain-lint.js — quality + safety gate over brain content.
// Quality (frontmatter schema, stale timestamps, orphan [[links]]) → warnings,
// exit 0 (fail open). Sensitive content anywhere → SECURITY findings, exit 3.
// Usage: node scripts/brain/brain-lint.js [--target <dir>]
'use strict';
const fs = require('fs');
const path = require('path');
const {
  resolveTarget, todayStamp, parseFrontmatter, scanSensitive, walkMarkdown,
} = require('./brain-lib');

const REQUIRED_FIELDS = ['type', 'title', 'description', 'tags', 'timestamp', 'sources'];
const GOVERNED_DIRS = ['decisions', 'lessons', 'canon', 'synthesis'];
const STALE_DAYS = 90;

const target = resolveTarget(process.argv);
const warnings = [];
const security = [];

const allFiles = walkMarkdown(target);
const allNames = new Set(allFiles.map(p => path.basename(p, '.md')));

for (const dir of GOVERNED_DIRS) {
  for (const file of walkMarkdown(path.join(target, dir))) {
    const rel = path.relative(target, file);
    const text = fs.readFileSync(file, 'utf8');
    const { fields } = parseFrontmatter(text);
    if (!fields) {
      warnings.push(`${rel}: missing frontmatter`);
    } else {
      for (const f of REQUIRED_FIELDS) {
        if (!(f in fields)) warnings.push(`${rel}: missing frontmatter field '${f}'`);
      }
      const ts = Date.parse(fields.timestamp);
      if (!Number.isNaN(ts) && (Date.now() - ts) / 86400000 > STALE_DAYS) {
        warnings.push(`${rel}: stale (timestamp older than ${STALE_DAYS} days — review or supersede)`);
      }
    }
    for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const name = m[1].trim();
      if (!allNames.has(name)) warnings.push(`${rel}: orphan link [[${name}]]`);
    }
  }
}
for (const file of allFiles) {
  for (const hit of scanSensitive(fs.readFileSync(file, 'utf8'))) {
    security.push(`${path.relative(target, file)}: sensitive content (${hit})`);
  }
}

// Report — fail open on write errors.
try {
  const rdir = path.join(target, 'reports', 'lint');
  fs.mkdirSync(rdir, { recursive: true });
  const fmt = xs => xs.map(x => `- ${x}`).join('\n') || '- none';
  fs.writeFileSync(path.join(rdir, `${todayStamp()}.md`),
    `# brain-lint — ${todayStamp()}\n\n## Security (${security.length})\n${fmt(security)}\n\n## Warnings (${warnings.length})\n${fmt(warnings)}\n`);
} catch { /* fail open */ }

for (const s of security) console.error(`SECURITY ${s}`);
for (const w of warnings) console.error(`warn ${w}`);
console.log(`brain-lint: ${security.length} security finding(s), ${warnings.length} warning(s)`);
process.exit(security.length ? 3 : 0);
