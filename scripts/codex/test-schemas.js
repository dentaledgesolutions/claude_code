#!/usr/bin/env node
// Validates schemas are parseable JSON with required top-level fields. No AJV.
const { readFileSync } = require('fs');
const REQUIRED = ['$schema', 'title', 'type', 'required', 'properties'];
let ok = true;

function check(p) {
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    const missing = REQUIRED.filter(f => !(f in s));
    if (missing.length) { console.error(`FAIL ${p}: missing: ${missing.join(', ')}`); return false; }
    console.log(`PASS ${p}`); return true;
  } catch (e) { console.error(`FAIL ${p}: ${e.message}`); return false; }
}

ok = [
  check('schemas/codex/codex-skill-scenario-result.schema.json'),
  check('schemas/codex/codex-agent-scenario-result.schema.json'),
  check('schemas/codex/codex-aggregate-result.schema.json'),
  check('schemas/codex/execution-result.schema.json'),
].every(Boolean);
process.exit(ok ? 0 : 1);
