#!/usr/bin/env node
// scripts/brain/brain-capture.js — append one entry to today's session log.
// Usage: node brain-capture.js --message "text" [--type note|decision|lesson]
//        [--title "t"] [--target <dir>]     (reads stdin when --message absent)
// Append-only: never overwrites. Exit 0 ok · 1 usage/structure · 3 sensitive refusal.
'use strict';
const fs = require('fs');
const path = require('path');
const { getArg, resolveTarget, todayStamp, timeStamp, scanSensitive } = require('./brain-lib');

const target = resolveTarget(process.argv);
const type = getArg(process.argv, '--type', 'note');
if (!['note', 'decision', 'lesson'].includes(type)) {
  console.error(`brain-capture: unknown --type '${type}' (note|decision|lesson)`);
  process.exit(1);
}
let message = getArg(process.argv, '--message');
if (message === null) {
  try { message = fs.readFileSync(0, 'utf8'); } catch { message = ''; }
}
if (!message || !message.trim()) {
  console.error('brain-capture: empty message (use --message or pipe stdin)');
  process.exit(1);
}
// Title is a one-line heading by definition — flatten ALL whitespace (including
// embedded newlines) to single spaces before scanning or interpolation, or a
// newline in --title could smuggle an unescaped entry-shaped line into the log.
const title = getArg(process.argv, '--title', '').replace(/\s+/g, ' ').trim();
// Scan title + message together — a sensitive secret in --title must refuse the
// same as one in the message body; scanning message alone let --title bypass it.
const hits = scanSensitive(`${title}\n${message}`);
if (hits.length) {
  console.error(`brain-capture: REFUSED — sensitive content detected (${hits.join(', ')})`);
  process.exit(3);
}
const dailyDir = path.join(target, 'sessions', 'daily');
if (!fs.existsSync(dailyDir)) {
  console.error(`brain-capture: not a project brain capsule (missing sessions/daily under ${target}) — run brain-verify`);
  process.exit(1);
}
const file = path.join(dailyDir, `${todayStamp()}.md`);
const header = fs.existsSync(file) ? '' : `# Session log — ${todayStamp()}\n`;
// Escape any body line that itself looks like a compile entry heading
// (`## HH:MM [note|decision|lesson]`) — body lines must never match compile's
// `^##` anchor or its `\n## ` body-boundary search, or pasted transcripts/markdown
// could inject a fake decision/lesson candidate one --approve away from canon.
const safeMessage = message.trim().split('\n')
  .map(line => /^## \d{2}:\d{2} \[(note|decision|lesson)\]/.test(line) ? `\\${line}` : line)
  .join('\n');
const entry = `\n## ${timeStamp()} [${type}]${title ? ` ${title}` : ''}\n\n${safeMessage}\n`;
fs.appendFileSync(file, header + entry);
console.log(`brain-capture: appended [${type}] entry to ${path.relative(process.cwd(), file)}`);
