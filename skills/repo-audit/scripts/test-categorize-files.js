#!/usr/bin/env node
// test-categorize-files.js — unit tests for categorize-files.js
// Run: node skills/repo-audit/scripts/test-categorize-files.js

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const { run } = require('./categorize-files');

const TMP_XML = '/tmp/repo-audit-test-fixture.xml';
const TMP_OUT = '/tmp/repo-audit-test-output';

const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<repository>
<file path="package.json">{"name":"test","scripts":{"test":"vitest"}}</file>
<file path="src/app/page.tsx">export default function Page() { return null }</file>
<file path="src/server/db/schema.ts">export const users = {}</file>
<file path="src/server/auth/session.ts">export const getSession = () => {}</file>
<file path="tests/unit/auth.test.ts">test('auth works', () => {})</file>
<file path=".github/workflows/ci.yml">on: [push]</file>
<file path="CLAUDE.md"># Project</file>
<file path=".claude/agents/scout.md">---\nname: scout\n---</file>
<file path="src/lib/ai/prompts.ts">export const systemPrompt = ''</file>
<file path="Dockerfile">FROM node:18-alpine</file>
<file path="prisma/schema.prisma">model User { id Int @id }</file>
<file path=".github/workflows/deploy.yml">on: [push]</file>
</repository>`;

fs.writeFileSync(TMP_XML, FIXTURE_XML);
if (fs.existsSync(TMP_OUT)) fs.rmSync(TMP_OUT, { recursive: true });

run(TMP_XML, TMP_OUT);

const manifest = JSON.parse(fs.readFileSync(path.join(TMP_OUT, 'manifest.json'), 'utf8'));

assert.equal(manifest.total_files, 12, 'should count all 12 files');
assert(manifest.layers.runtime.files.includes('package.json'),          'package.json → runtime');
assert(manifest.layers.runtime.files.includes('Dockerfile'),            'Dockerfile → runtime');
assert(manifest.layers.framework.files.includes('src/app/page.tsx'),    'page.tsx → framework');
assert(manifest.layers.database.files.includes('src/server/db/schema.ts'), 'db/schema → database');
assert(manifest.layers.database.files.includes('prisma/schema.prisma'), 'prisma schema → database');
assert(manifest.layers.auth.files.includes('src/server/auth/session.ts'),   'auth/session → auth');
assert(manifest.layers.testing.files.includes('tests/unit/auth.test.ts'),   '.test.ts → testing');
assert(manifest.layers.cicd.files.includes('.github/workflows/ci.yml'),     '.github → cicd');
assert(manifest.layers.cicd.files.includes('.github/workflows/deploy.yml'), 'both .github/ files → cicd');
assert(manifest.layers.claude_code.files.includes('CLAUDE.md'),              'CLAUDE.md → claude_code');
assert(manifest.layers.claude_code.files.includes('.claude/agents/scout.md'),'.claude/ → claude_code');
assert(manifest.layers.ai_llm.files.includes('src/lib/ai/prompts.ts'),      'ai/prompts → ai_llm');

// Multi-layer: src/server/auth/session.ts matches both auth/ and src/ (framework)
assert(manifest.layers.auth.files.includes('src/server/auth/session.ts'),      'session → auth');
assert(manifest.layers.framework.files.includes('src/server/auth/session.ts'), 'session → framework (src/ prefix)');

// All 8 layer XML files must exist
const LAYERS = ['runtime','framework','database','testing','cicd','auth','ai_llm','claude_code'];
for (const layer of LAYERS) {
  assert(fs.existsSync(path.join(TMP_OUT, `layer-${layer}.xml`)), `layer-${layer}.xml must exist`);
}

// Runtime XML contains correct file content
const runtimeXml = fs.readFileSync(path.join(TMP_OUT, 'layer-runtime.xml'), 'utf8');
assert(runtimeXml.includes('package.json'), 'runtime XML should contain package.json block');
assert(runtimeXml.includes('Dockerfile'),   'runtime XML should contain Dockerfile block');

// Empty layers still produce a file
const emptyLayer = LAYERS.find(l => manifest.layers[l].file_count === 0);
if (emptyLayer) {
  assert(fs.existsSync(path.join(TMP_OUT, `layer-${emptyLayer}.xml`)), 'empty layer XML still written');
}

fs.rmSync(TMP_OUT, { recursive: true });
fs.rmSync(TMP_XML);

// ─── Test 2: Gitingest plain-text branch ─────────────────────────────────────

const TS              = Date.now();
const TMP_GITINGEST   = `/tmp/test-categorize-gitingest-${TS}.txt`;
const TMP_GITINGEST_OUT = `/tmp/test-categorize-gitingest-${TS}-out`;

// Gitingest plain-text format: sections separated by ===...=== (≥10 chars)
// Each section contains a "File: <path>" line followed by file content.
const FIXTURE_GITINGEST = [
  '='.repeat(80),
  'File: package.json',
  '='.repeat(80),
  '{"name":"test-gi","scripts":{"test":"vitest","build":"tsc"}}',
  '='.repeat(80),
  'File: Dockerfile',
  '='.repeat(80),
  'FROM node:20-alpine',
  'CMD ["node","server.js"]',
].join('\n');

fs.writeFileSync(TMP_GITINGEST, FIXTURE_GITINGEST);
if (fs.existsSync(TMP_GITINGEST_OUT)) fs.rmSync(TMP_GITINGEST_OUT, { recursive: true });

run(TMP_GITINGEST, TMP_GITINGEST_OUT);

const giManifest = JSON.parse(fs.readFileSync(path.join(TMP_GITINGEST_OUT, 'manifest.json'), 'utf8'));

// At least one layer-*.xml file must exist
const giXmlFiles = fs.readdirSync(TMP_GITINGEST_OUT).filter(f => f.startsWith('layer-') && f.endsWith('.xml'));
assert(giXmlFiles.length > 0, 'Gitingest: at least one layer-*.xml must be created');

// manifest must have at least one layer with file_count > 0
const giNonEmpty = Object.values(giManifest.layers).some(l => l.file_count > 0);
assert(giNonEmpty, 'Gitingest: manifest must have at least one layer with file_count > 0');

// package.json → runtime, Dockerfile → runtime
assert(giManifest.layers.runtime.files.includes('package.json'), 'Gitingest: package.json → runtime');
assert(giManifest.layers.runtime.files.includes('Dockerfile'),   'Gitingest: Dockerfile → runtime');

// The two files route to different layers (runtime has both; verify total_files is 2)
assert.equal(giManifest.total_files, 2, 'Gitingest: total_files should be 2');

fs.rmSync(TMP_GITINGEST_OUT, { recursive: true });
fs.rmSync(TMP_GITINGEST);

console.log('All tests passed ✓');
