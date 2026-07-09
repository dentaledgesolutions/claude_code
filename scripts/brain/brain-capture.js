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
const hits = scanSensitive(message);
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
const title = getArg(process.argv, '--title', '');
const header = fs.existsSync(file) ? '' : `# Session log — ${todayStamp()}\n`;
const entry = `\n## ${timeStamp()} [${type}]${title ? ` ${title}` : ''}\n\n${message.trim()}\n`;
fs.appendFileSync(file, header + entry);
console.log(`brain-capture: appended [${type}] entry to ${path.relative(process.cwd(), file)}`);
