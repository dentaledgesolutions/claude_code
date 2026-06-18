#!/usr/bin/env node
// static-scan.js <skill-dir>
// Deterministic security scanner for Claude Code skill directories.
// Outputs JSON: { verdict, findings, scanned }

const fs = require('fs');
const path = require('path');

const skillDir = process.argv[2];
if (!skillDir) {
  console.error('Usage: node static-scan.js <skill-dir>');
  process.exit(1);
}

if (!fs.existsSync(skillDir)) {
  console.error(`Directory not found: ${skillDir}`);
  process.exit(1);
}

const findings = [];

function flag(file, check, severity, detail) {
  findings.push({ file: path.relative(skillDir, file), check, severity, detail });
}

// --- Markdown threat patterns ---
const MD_PATTERNS = [
  { re: /ignore\s+(previous|prior|all)\s+instructions/i, name: 'instruction-override', sev: 'BLOCK' },
  { re: /disregard\s+(previous|prior|all|your)/i, name: 'instruction-disregard', sev: 'BLOCK' },
  { re: /\byou are now\b/i, name: 'persona-override', sev: 'FLAG' },
  { re: /forget\s+everything/i, name: 'memory-wipe', sev: 'BLOCK' },
  { re: /from now on you (must|will|shall)/i, name: 'behavior-override', sev: 'FLAG' },
  { re: /[​‌‍﻿‮]/, name: 'hidden-unicode', sev: 'BLOCK' },
  { re: /[A-Za-z0-9+/]{80,}={0,2}(?:\s|$)/, name: 'base64-blob', sev: 'FLAG' },
  { re: /<!--[\s\S]{20,}?-->/, name: 'html-comment-block', sev: 'FLAG' },
  { re: /\bact as\b.{0,30}\b(assistant|ai|agent|claude)\b/i, name: 'act-as-override', sev: 'FLAG' },
  { re: /system\s*prompt/i, name: 'system-prompt-reference', sev: 'FLAG' },
];

// Bash danger patterns (in markdown instructions)
const BASH_PATTERNS = [
  { re: /\brm\s+-[rf]{1,2}\s+[/~]/, name: 'rm-rf-root', sev: 'BLOCK' },
  { re: /curl\s+.+\|\s*(bash|sh|zsh)\b/, name: 'curl-pipe-shell', sev: 'BLOCK' },
  { re: /wget\s+.+\|\s*(bash|sh|zsh)\b/, name: 'wget-pipe-shell', sev: 'BLOCK' },
  { re: /\bsudo\s+/, name: 'sudo', sev: 'FLAG' },
  { re: /chmod\s+[0-7]{3}\s/, name: 'chmod', sev: 'FLAG' },
  { re: /~\/.claude\/settings/, name: 'settings-write', sev: 'FLAG' },
  { re: /~\/.ssh\//, name: 'ssh-dir-access', sev: 'BLOCK' },
];

// --- Script threat patterns ---
const SCRIPT_PATTERNS = [
  { re: /\beval\s*\(/, name: 'dynamic-eval', sev: 'BLOCK' },
  { re: /new\s+Function\s*\(/, name: 'dynamic-function', sev: 'BLOCK' },
  { re: /require\s*\(\s*['"]child_process['"]/, name: 'child-process', sev: 'BLOCK' },
  { re: /\bexec\s*\(/, name: 'exec-call', sev: 'BLOCK' },
  { re: /\bspawn\s*\(/, name: 'spawn-call', sev: 'BLOCK' },
  { re: /\bfetch\s*\(/, name: 'network-fetch', sev: 'FLAG' },
  { re: /require\s*\(\s*['"]https?['"]/, name: 'network-http-require', sev: 'FLAG' },
  { re: /\bprocess\.env\b/, name: 'env-access', sev: 'FLAG' },
  { re: /fs\.(writeFile|appendFile|unlink|rmdir|rm)\s*\(/, name: 'fs-write', sev: 'FLAG' },
  { re: /\bWebSocket\b/, name: 'websocket', sev: 'FLAG' },
  { re: /\bxmlhttprequest\b/i, name: 'xhr', sev: 'FLAG' },
  { re: /process\.exit\s*\(\s*[^01]\s*\)/, name: 'abnormal-exit', sev: 'FLAG' },
];

function stripCodeBlocks(text) {
  // Remove fenced code blocks (``` ... ```) — these are examples/documentation, not live instructions
  let stripped = text.replace(/```[\s\S]*?```/g, '[CODE_BLOCK_REMOVED]');
  // Remove inline code (`...`)
  stripped = stripped.replace(/`[^`\n]+`/g, '[INLINE_CODE]');
  return stripped;
}

function scanMarkdown(filePath, content) {
  const scanContent = stripCodeBlocks(content);
  for (const { re, name, sev } of MD_PATTERNS) {
    if (re.test(scanContent)) {
      const match = scanContent.match(re);
      flag(filePath, name, sev, `Matched: "${match[0].slice(0, 80).replace(/\n/g, '\\n')}"`);
    }
  }
  for (const { re, name, sev } of BASH_PATTERNS) {
    if (re.test(scanContent)) {
      const match = scanContent.match(re);
      flag(filePath, name, sev, `Bash danger: "${match[0].slice(0, 80)}"`);
    }
  }
}

function scanScript(filePath, content) {
  for (const { re, name, sev } of SCRIPT_PATTERNS) {
    if (re.test(content)) {
      const match = content.match(re);
      flag(filePath, name, sev, `Script danger: "${match[0].slice(0, 80)}"`);
    }
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      let content;
      try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }

      if (['.md', '.txt'].includes(ext)) {
        scanMarkdown(full, content);
      } else if (['.js', '.mjs', '.cjs', '.ts', '.sh', '.py', '.rb'].includes(ext)) {
        scanScript(full, content);
      }
    }
  }
}

walkDir(skillDir);

// Determine overall verdict
let verdict = 'PASS';
if (findings.some(f => f.severity === 'BLOCK')) verdict = 'BLOCK';
else if (findings.some(f => f.severity === 'FLAG')) verdict = 'FLAG';

const output = {
  verdict,
  scanned: path.resolve(skillDir),
  timestamp: new Date().toISOString(),
  summary: {
    total: findings.length,
    BLOCK: findings.filter(f => f.severity === 'BLOCK').length,
    FLAG: findings.filter(f => f.severity === 'FLAG').length,
  },
  findings,
};

console.log(JSON.stringify(output, null, 2));
process.exit(verdict === 'BLOCK' ? 2 : verdict === 'FLAG' ? 1 : 0);
