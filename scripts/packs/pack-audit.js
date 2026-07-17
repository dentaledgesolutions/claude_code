#!/usr/bin/env node
// scripts/packs/pack-audit.js — security + quality audit for one domain pack.
// Usage: node pack-audit.js --name <n> [--root <dir>]
// Security violations -> exit 3: bad/missing install_policy or execution_mode, executable
//   files inside the pack (docs-only + declarative phase), committed secrets, missing/mismatched
//   guardrails policy, or a tool-def whose effect contradicts the pack's execution_mode.
// Quality issues -> warnings, exit 0: stale last_reviewed, missing review_owner, knowledge docs
//   missing frontmatter, registry/manifest drift.
// Reports append to <root>/.project-brain/reports/security/ when a capsule exists (fail open).
// Mirrors scripts/brain/brain-reference-repo-audit.js by design.
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, todayStamp, scanSensitive, parseFrontmatter } = require('../brain/brain-lib');
const {
  INSTALL_POLICY, EXECUTION_MODES, TOOL_EFFECTS, EXECUTABLE_RE,
  REQUIRED_MANIFEST_FIELDS, REQUIRED_KNOWLEDGE_FIELDS,
  loadPacksRegistry, packDir, packManifestFile, packKnowledgeDir, packToolsDir,
  packGuardrailsFile, packClientsDir, walkFiles,
} = require('./packs-lib');

const STALE_DAYS = 180;

const root = path.resolve(getArg(process.argv, '--root', '.'));
const name = getArg(process.argv, '--name');
if (!name) {
  console.error('pack-audit: usage --name <n> [--root <dir>]');
  process.exit(1);
}

let registry;
try {
  ({ data: registry } = loadPacksRegistry(root));
} catch (e) {
  console.error(`pack-audit: cannot load packs registry at ${root} (${e.message})`);
  process.exit(1);
}
const entry = (registry.packs || []).find(e => e.name === name);
if (!entry) {
  console.error(`pack-audit: no pack named '${name}' in packs/registry.json`);
  process.exit(1);
}

const dir = packDir(root, name);
if (!fs.existsSync(dir)) {
  console.error(`pack-audit: pack directory not found: ${path.relative(root, dir)}`);
  process.exit(1);
}

const security = [];
const warnings = [];
const rel = p => path.relative(root, p);

// ── Manifest ────────────────────────────────────────────────────────────────
let manifest = null;
const manifestFile = packManifestFile(root, name);
if (!fs.existsSync(manifestFile)) {
  security.push(`${name}: missing pack.json manifest`);
} else {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (e) {
    security.push(`${rel(manifestFile)}: invalid JSON (${e.message})`);
  }
}

if (manifest) {
  if (manifest.install_policy !== INSTALL_POLICY) {
    security.push(`${name}: install_policy is '${manifest.install_policy}', must be '${INSTALL_POLICY}'`);
  }
  if (!EXECUTION_MODES.includes(manifest.execution_mode)) {
    security.push(`${name}: execution_mode '${manifest.execution_mode}' invalid (allowed: ${EXECUTION_MODES.join(', ')})`);
  }
  for (const f of REQUIRED_MANIFEST_FIELDS) {
    if (!(f in manifest)) warnings.push(`${name}: pack.json missing field '${f}'`);
  }
  if (!manifest.review_owner) warnings.push(`${name}: pack.json missing review_owner`);
  const cadence = Number(manifest.review_cadence_days) || STALE_DAYS;
  const reviewed = Date.parse(manifest.last_reviewed);
  if (!Number.isNaN(reviewed) && (Date.now() - reviewed) / 86400000 > cadence) {
    warnings.push(`${name}: last_reviewed (${manifest.last_reviewed}) older than review cadence (${cadence}d)`);
  }
  // Registry / manifest drift.
  for (const k of ['version', 'execution_mode', 'last_reviewed']) {
    if (entry[k] !== undefined && manifest[k] !== undefined && entry[k] !== manifest[k]) {
      warnings.push(`${name}: registry ${k} '${entry[k]}' != pack.json '${manifest[k]}'`);
    }
  }
}

// ── Docs-only + declarative: no executables anywhere in the pack ─────────────
const allFiles = walkFiles(dir);
const execHits = allFiles.filter(f => EXECUTABLE_RE.test(f)).map(rel);
if (execHits.length) {
  security.push(`${name}: executable/source file(s) inside pack (docs-only + declarative phase): ${execHits.join(', ')}`);
}

// ── Sensitive-content scan over every file in the pack (esp. clients/) ───────
for (const file of allFiles) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const hit of scanSensitive(text)) {
    security.push(`${rel(file)}: sensitive content (${hit})`);
  }
}
// clients/ must never hold secrets — it is per-tenant binding metadata + credential *references* only.
// (covered by the scan above; called out here for report clarity)
const clientsDir = packClientsDir(root, name);
void clientsDir;

// ── Guardrails policy ────────────────────────────────────────────────────────
const guardFile = packGuardrailsFile(root, name);
let policy = null;
if (!fs.existsSync(guardFile)) {
  security.push(`${name}: missing guardrails/policy.json`);
} else {
  try {
    policy = JSON.parse(fs.readFileSync(guardFile, 'utf8'));
  } catch (e) {
    security.push(`${rel(guardFile)}: invalid JSON (${e.message})`);
  }
  if (policy && manifest && policy.execution_mode !== manifest.execution_mode) {
    security.push(`${name}: guardrails execution_mode '${policy.execution_mode}' != pack.json '${manifest.execution_mode}'`);
  }
}

// ── Tool defs (declarative) ──────────────────────────────────────────────────
const toolsDir = packToolsDir(root, name);
if (fs.existsSync(toolsDir)) {
  for (const file of fs.readdirSync(toolsDir).filter(f => f.endsWith('.tool.json'))) {
    const p = path.join(toolsDir, file);
    let tool;
    try {
      tool = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      security.push(`${rel(p)}: invalid JSON (${e.message})`);
      continue;
    }
    for (const f of ['name', 'description', 'effect']) {
      if (!tool[f]) security.push(`${rel(p)}: tool-def missing '${f}'`);
    }
    if (tool.effect && !TOOL_EFFECTS.includes(tool.effect)) {
      security.push(`${rel(p)}: tool-def effect '${tool.effect}' invalid (allowed: ${TOOL_EFFECTS.join(', ')})`);
    }
    if (tool.effect === 'write' && manifest && manifest.execution_mode === 'read-only') {
      security.push(`${rel(p)}: write-effect tool in a read-only pack — policy violation`);
    }
  }
}

// ── Knowledge frontmatter (quality) ──────────────────────────────────────────
const knowledgeDir = packKnowledgeDir(root, name);
const knowledgeDocs = fs.existsSync(knowledgeDir)
  ? fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md')).map(f => path.join(knowledgeDir, f))
  : [];
if (!knowledgeDocs.length) warnings.push(`${name}: no knowledge/*.md documents`);
for (const file of knowledgeDocs) {
  const { fields } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  if (!fields) { warnings.push(`${rel(file)}: missing frontmatter`); continue; }
  for (const f of REQUIRED_KNOWLEDGE_FIELDS) {
    if (!(f in fields)) warnings.push(`${rel(file)}: missing frontmatter field '${f}'`);
  }
}

// ── Report (append, fail open, only when a capsule exists) ───────────────────
const capsuleDir = path.join(root, '.project-brain');
if (fs.existsSync(capsuleDir)) {
  try {
    const rdir = path.join(capsuleDir, 'reports', 'security');
    fs.mkdirSync(rdir, { recursive: true });
    const fmt = xs => xs.map(x => `- ${x}`).join('\n') || '- none';
    const reportFile = path.join(rdir, `pack-audit-${name}-${todayStamp()}.md`);
    fs.appendFileSync(reportFile,
      `# pack-audit — ${name} — ${todayStamp()}\n\n## Security (${security.length})\n${fmt(security)}\n\n## Warnings (${warnings.length})\n${fmt(warnings)}\n\n`);
  } catch { /* fail open */ }
}

for (const s of security) console.error(`SECURITY ${s}`);
for (const w of warnings) console.error(`warn ${w}`);
console.log(`pack-audit: ${name} — ${security.length} security finding(s), ${warnings.length} warning(s)`);
process.exit(security.length ? 3 : 0);
