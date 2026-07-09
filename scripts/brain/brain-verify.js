#!/usr/bin/env node
// scripts/brain/brain-verify.js — structural integrity check for a project brain
// capsule. Fails loudly: exit 1 on any violation, listing each on stderr.
// Usage: node scripts/brain/brain-verify.js [--target <dir>]
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveTarget } = require('./brain-lib');

const REQUIRED_DIRS = [
  'context', 'sessions/daily', 'sessions/closed',
  'decisions/active', 'decisions/superseded', 'decisions/candidates',
  'lessons/memories', 'lessons/anti-patterns', 'lessons/skill-stubs',
  'canon', 'synthesis', 'support', 'reference-repositories', 'reports',
];
const REQUIRED_FILES = ['BRAIN.md', 'MEMORY.md', 'index.md', 'log.md', 'context/brain-profile.json'];
const PROFILE_REQUIRED = [
  'project_name', 'project_slug', 'project_brain_path', 'brain_mode',
  'brain_kernel_enabled', 'gbrain_enabled', 'canon_requires_approval', 'sensitive_paths',
];

const target = resolveTarget(process.argv);
const violations = [];

if (!fs.existsSync(target)) {
  violations.push(`target does not exist: ${target}`);
} else {
  for (const d of REQUIRED_DIRS) {
    const p = path.join(target, d);
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) violations.push(`missing directory: ${d}`);
  }
  for (const f of REQUIRED_FILES) {
    const p = path.join(target, f);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) violations.push(`missing file: ${f}`);
  }
  const profilePath = path.join(target, 'context', 'brain-profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      for (const f of PROFILE_REQUIRED) {
        if (!(f in profile)) violations.push(`brain-profile.json missing required field: ${f}`);
      }
      if ('canon_requires_approval' in profile && profile.canon_requires_approval !== true) {
        violations.push('brain-profile.json: canon_requires_approval must be true');
      }
      if ('sensitive_paths' in profile &&
          (!Array.isArray(profile.sensitive_paths) || profile.sensitive_paths.length === 0)) {
        violations.push('brain-profile.json: sensitive_paths must be a non-empty array');
      }
    } catch (e) {
      violations.push(`brain-profile.json unreadable: ${e.message}`);
    }
  }
}

if (violations.length) {
  console.error(`brain-verify: FAIL — ${violations.length} violation(s) in ${target}`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`brain-verify: OK — ${target}`);
