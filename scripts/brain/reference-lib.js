#!/usr/bin/env node
// scripts/brain/reference-lib.js — shared load/save/render for the reference
// repository registry (Phase 6). Zero dependencies, deterministic, no network.
'use strict';
const fs = require('fs');
const path = require('path');

const REQUIRED_ENTRY_FIELDS = ['name', 'url', 'status', 'types', 'install_policy', 'last_reviewed'];
const TYPE_ENUM = [
  'methodology-source', 'skill-pattern-source', 'agent-pattern-source',
  'candidate-skill-source', 'eval-scenario-source', 'governance-source',
  'retrieval-source', 'research-source', 'human-workflow-source',
];
const STATUS_ENUM = ['reference', 'unreachable', 'retired'];
const INSTALL_POLICY = 'do-not-install-directly';
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function registryDir(root) { return path.join(root, 'reference-repositories'); }
function registryFile(root) { return path.join(registryDir(root), 'registry.json'); }
function registryMdFile(root) { return path.join(registryDir(root), 'registry.md'); }
function sourceDir(root, name) { return path.join(registryDir(root), 'sources', name); }
function sourceCardFile(root, name) { return path.join(sourceDir(root, name), 'source-card.md'); }

function loadRegistry(root) {
  const file = registryFile(root);
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function renderRegistryMd(data) {
  const rows = data.repositories.map(e =>
    `| ${e.name} | ${e.status} | ${e.types.join(', ')} | ${e.install_policy} | ${e.last_reviewed} |`);
  return `# Reference Repository Registry\n\n_Generated from registry.json — do not hand-edit._\n\n| name | status | types | install_policy | last_reviewed |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

function saveRegistry(root, data) {
  fs.writeFileSync(registryFile(root), JSON.stringify(data, null, 2) + '\n');
  fs.writeFileSync(registryMdFile(root), renderRegistryMd(data));
}

// §9.4 source-card template — scaffolded for a new entry when no card exists yet.
function sourceCardTemplate(entry) {
  return `---
name: ${entry.name}
url: ${entry.url}
owner:
type: [${entry.types.join(', ')}]
status: ${entry.status}
trust_level:
install_policy: ${entry.install_policy}
last_reviewed: ${entry.last_reviewed}
review_owner:
allowed_uses: []
prohibited_uses: [direct install without audit, global install without approval, auto-update without approval, bypass skill-audit, bypass agent-audit]
---

# Source Summary
TODO — one paragraph on what this repository is.

# Why It Matters
TODO — why this source is worth keeping in the library.

# Reusable Patterns
- TODO

# Candidate Skills
TODO — skills worth sourcing through scout -> audit -> adapt -> eval.

# Candidate Agents
TODO — agent roles worth sourcing through the same pipeline.

# Security / Governance Notes
TODO

# Adaptation Strategy
TODO

# Eval Ideas
TODO
`;
}

// Scaffolds sources/<name>/source-card.md from the template if it does not
// already exist. Never overwrites a hand-edited card.
function scaffoldSourceCard(root, entry) {
  const dir = sourceDir(root, entry.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = sourceCardFile(root, entry.name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, sourceCardTemplate(entry));
  return file;
}

// Extracts the bullet list (or, absent bullets, the whole paragraph as one
// item) under a top-level `# Heading` in a source card body.
function parseSourceCardSection(body, heading) {
  const re = new RegExp(`^# ${heading}\\s*$`, 'm');
  const m = re.exec(body);
  if (!m) return [];
  const rest = body.slice(m.index + m[0].length);
  const next = /^# /m.exec(rest);
  const block = next ? rest.slice(0, next.index) : rest;
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => l.startsWith('- '));
  if (bullets.length) return bullets.map(l => l.replace(/^- /, '').trim());
  return lines.length ? [lines.join(' ')] : [];
}

function parseSourceCardMap(body) {
  return {
    patterns: parseSourceCardSection(body, 'Reusable Patterns'),
    candidate_skills: parseSourceCardSection(body, 'Candidate Skills'),
    candidate_agents: parseSourceCardSection(body, 'Candidate Agents'),
  };
}

module.exports = {
  REQUIRED_ENTRY_FIELDS, TYPE_ENUM, STATUS_ENUM, INSTALL_POLICY, NAME_PATTERN,
  registryDir, registryFile, registryMdFile, sourceDir, sourceCardFile,
  loadRegistry, saveRegistry, renderRegistryMd,
  sourceCardTemplate, scaffoldSourceCard,
  parseSourceCardSection, parseSourceCardMap,
};
