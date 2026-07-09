// scripts/brain/brain-lib.test.js — unit tests for shared brain-kernel helpers.
'use strict';
const assert = require('assert');
const lib = require('./brain-lib');

// frontmatter round-trip
{
  const fm = lib.serializeFrontmatter(
    { type: 'decision', title: 'Use X', tags: ['a', 'b'], timestamp: '2026-07-08T10:00:00' },
    'Body line 1\n');
  const { fields, body } = lib.parseFrontmatter(fm);
  assert.strictEqual(fields.type, 'decision');
  assert.strictEqual(fields.title, 'Use X');
  assert.deepStrictEqual(fields.tags, ['a', 'b']);
  assert.ok(body.startsWith('Body line 1'));
}
// no frontmatter → fields null, body intact
{
  const { fields, body } = lib.parseFrontmatter('# Just a doc\n');
  assert.strictEqual(fields, null);
  assert.strictEqual(body, '# Just a doc\n');
}
// sensitive scanner catches planted secrets, passes clean text
{
  assert.ok(lib.scanSensitive('key is sk-ant-abc123def456ghi789').length >= 1);
  assert.ok(lib.scanSensitive('-----BEGIN RSA PRIVATE KEY-----').length >= 1);
  assert.ok(lib.scanSensitive('password = hunter22').length >= 1);
  assert.deepStrictEqual(lib.scanSensitive('we decided to use pipeline() here'), []);
}
// args
{
  const argv = ['node', 's.js', 'decisions/candidates/x.md', '--to', 'canon', '--approve', '--target', '/tmp/b'];
  assert.strictEqual(lib.getArg(argv, '--to'), 'canon');
  assert.ok(lib.hasFlag(argv, '--approve'));
  assert.deepStrictEqual(lib.positional(argv), ['decisions/candidates/x.md']);
  assert.ok(lib.resolveTarget(argv).endsWith('/tmp/b') || lib.resolveTarget(argv) === '/tmp/b');
}
// stamps are UTC-shaped; slugify
{
  const d = new Date('2026-07-08T14:03:00Z');
  assert.strictEqual(lib.todayStamp(d), '2026-07-08');
  assert.strictEqual(lib.timeStamp(d), '14:03');
  assert.strictEqual(lib.slugify('Use FTS5, not grep!'), 'use-fts5-not-grep');
}
console.log('brain-lib.test.js: all assertions passed');
