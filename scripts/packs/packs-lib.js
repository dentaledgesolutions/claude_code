#!/usr/bin/env node
// scripts/packs/packs-lib.js — shared load/save/render + paths + constants for the
// domain-packs registry. Zero dependencies, deterministic, no network. Mirrors the
// reference-repository library (scripts/brain/reference-lib.js) by design.
'use strict';
const fs = require('fs');
const path = require('path');

// A domain pack = knowledge + tools + guardrails, mountable as a filesystem-as-registry
// folder. Contract-first phase: tool-defs are DECLARATIVE (no executor); nothing runs live.
const INSTALL_POLICY = 'do-not-install-directly';
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const EXECUTION_MODES = ['read-only', 'hitl', 'staging-autonomous', 'mixed'];
const RISK_TIERS = ['standard', 'critical'];
const TOOL_EFFECTS = ['read', 'write'];
// Docs-only + declarative: no executable/source files anywhere inside a pack in this phase.
const EXECUTABLE_RE = /\.(sh|js|py|rb|ps1|ts|mjs|cjs)$/;
const REQUIRED_MANIFEST_FIELDS = [
  'name', 'version', 'domain', 'description', 'install_policy', 'execution_mode', 'last_reviewed',
];
// Frontmatter every governed knowledge doc must carry (aligned with brain-lint's schema).
const REQUIRED_KNOWLEDGE_FIELDS = ['type', 'title', 'description', 'tags', 'timestamp', 'sources'];

function packsDir(root) { return path.join(root, 'packs'); }
function packsRegistryFile(root) { return path.join(packsDir(root), 'registry.json'); }
function packsRegistryMdFile(root) { return path.join(packsDir(root), 'registry.md'); }
function packDir(root, name) { return path.join(packsDir(root), name); }
function packManifestFile(root, name) { return path.join(packDir(root, name), 'pack.json'); }
function packKnowledgeDir(root, name) { return path.join(packDir(root, name), 'knowledge'); }
function packToolsDir(root, name) { return path.join(packDir(root, name), 'tools'); }
function packSkillsDir(root, name) { return path.join(packDir(root, name), 'skills'); }
function packGuardrailsFile(root, name) { return path.join(packDir(root, name), 'guardrails', 'policy.json'); }
function packClientsDir(root, name) { return path.join(packDir(root, name), 'clients'); }

function loadPacksRegistry(root) {
  const file = packsRegistryFile(root);
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function renderPacksRegistryMd(data) {
  const rows = data.packs.map(e =>
    `| ${e.name} | ${e.domain} | ${e.version} | ${e.execution_mode} | ${e.risk_tier || 'standard'} | ${e.install_policy} | ${e.last_reviewed} |`);
  return `# Domain Packs Registry\n\n_Generated from registry.json — do not hand-edit._\n\n| name | domain | version | execution_mode | risk_tier | install_policy | last_reviewed |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

function savePacksRegistry(root, data) {
  fs.writeFileSync(packsRegistryFile(root), JSON.stringify(data, null, 2) + '\n');
  fs.writeFileSync(packsRegistryMdFile(root), renderPacksRegistryMd(data));
}

// Every file under a pack (recursive), for docs-only + sensitive-content enforcement.
function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

module.exports = {
  INSTALL_POLICY, NAME_PATTERN, EXECUTION_MODES, RISK_TIERS, TOOL_EFFECTS, EXECUTABLE_RE,
  REQUIRED_MANIFEST_FIELDS, REQUIRED_KNOWLEDGE_FIELDS,
  packsDir, packsRegistryFile, packsRegistryMdFile, packDir, packManifestFile,
  packKnowledgeDir, packToolsDir, packSkillsDir, packGuardrailsFile, packClientsDir,
  loadPacksRegistry, renderPacksRegistryMd, savePacksRegistry, walkFiles,
};
