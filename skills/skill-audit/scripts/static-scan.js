#!/usr/bin/env node
// static-scan.js <skill-dir>
// Deterministic security scanner for Claude Code skill directories.
// Pattern set aligned with Anthropic's security-guidance plugin (25 patterns)
// plus skill-specific prompt-injection checks.
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

function stripCodeBlocks(text) {
  let s = text.replace(/```[\s\S]*?```/g, '[CODE_BLOCK_REMOVED]');
  s = s.replace(/`[^`\n]+`/g, '[INLINE_CODE]');
  return s;
}

function stripRegexLiterals(text) {
  // Strip JS regex literals (e.g. /pattern/flags) so that pattern definitions
  // inside scanner source files don't self-trigger during scanning.
  return text.replace(/(?<=[=\[,(:!])\s*\/(?:[^/\\\n]|\\.)+\/[gimsuy]*/g, ' [REGEX]');
}

// ─── Markdown: Prompt Injection ────────────────────────────────────────────
const MD_INJECTION = [
  { re: /ignore\s+(previous|prior|all)\s+instructions/i,              name: 'instruction-override',  sev: 'BLOCK' },
  { re: /disregard\s+(previous|prior|all|your)/i,                     name: 'instruction-disregard', sev: 'BLOCK' },
  { re: /\byou are now\b/i,                                           name: 'persona-override',      sev: 'FLAG'  },
  { re: /forget\s+everything/i,                                       name: 'memory-wipe',           sev: 'BLOCK' },
  { re: /from now on you (must|will|shall)/i,                         name: 'behavior-override',     sev: 'FLAG'  },
  { re: /[​‌‍﻿‮]/u,                                                    name: 'hidden-unicode',        sev: 'BLOCK' },
  { re: /[A-Za-z0-9+/]{80,}={0,2}(?:\s|$)/,                          name: 'base64-blob',           sev: 'FLAG'  },
  { re: /<!--[\s\S]{20,}?-->/,                                        name: 'html-comment-block',    sev: 'FLAG'  },
  { re: /\bact as\b.{0,30}\b(assistant|ai|agent|claude)\b/i,         name: 'act-as-override',       sev: 'FLAG'  },
  { re: /system\s*prompt/i,                                           name: 'system-prompt-ref',     sev: 'FLAG'  },
];

// ─── Markdown: Dangerous Bash in instructions ──────────────────────────────
const MD_BASH = [
  { re: /\brm\s+-[rf]{1,2}\s+[/~]/,      name: 'rm-rf-root',       sev: 'BLOCK' },
  { re: /curl\s+.+\|\s*(bash|sh|zsh)\b/, name: 'curl-pipe-shell',  sev: 'BLOCK' },
  { re: /wget\s+.+\|\s*(bash|sh|zsh)\b/, name: 'wget-pipe-shell',  sev: 'BLOCK' },
  { re: /\bsudo\s+/,                      name: 'sudo',             sev: 'FLAG'  },
  { re: /chmod\s+[0-7]{3}\s/,            name: 'chmod',            sev: 'FLAG'  },
  { re: /~\/.ssh\//,                      name: 'ssh-dir-access',   sev: 'BLOCK' },
  { re: /~\/.claude\/settings/,          name: 'settings-write',   sev: 'FLAG'  },
];

// ─── Markdown: Hardcoded secrets ───────────────────────────────────────────
const MD_SECRETS = [
  { re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}/i, name: 'hardcoded-api-key', sev: 'FLAG'  },
  { re: /(?:password|passwd|secret|token)\s*[:=]\s*['"][^'"]{8,}/i, name: 'hardcoded-secret',  sev: 'FLAG'  },
  { re: /sk-[A-Za-z0-9]{32,}/,                                       name: 'hardcoded-llm-key', sev: 'BLOCK' },
  { re: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/,                         name: 'hardcoded-token',   sev: 'BLOCK' },
];

// ─── JS/TS patterns (Anthropic security-guidance rules 2–4, 6–7, 13, 15) ──
const JS_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx']);
const JS_PATTERNS = [
  { re: /\beval\s*\(/,                                         name: 'eval-injection',         sev: 'BLOCK' },
  { re: /new\s+Function\s*\(/,                                 name: 'new-function-injection', sev: 'BLOCK' },
  { re: /require\s*\(\s*['"]child_process['"]/,                name: 'child-process-require',  sev: 'BLOCK' },
  { re: /(?<![a-zA-Z0-9_.])exec\s*\(/,                        name: 'child-process-exec',     sev: 'BLOCK' },
  { re: /\bspawn\s*\(/,                                        name: 'spawn-call',             sev: 'FLAG'  },
  { re: /\bfetch\s*\(/,                                        name: 'network-fetch',          sev: 'FLAG'  },
  { re: /require\s*\(\s*['"]https?['"]/,                       name: 'http-require',           sev: 'FLAG'  },
  { re: /\bprocess\.env\b/,                                    name: 'env-access',             sev: 'FLAG'  },
  { re: /fs\.(writeFile|appendFile|unlink|rmdir|rm)\s*\(/,     name: 'fs-write',               sev: 'FLAG'  },
  { re: /\.innerHTML\s*=/,                                     name: 'innerhtml-xss',          sev: 'FLAG'  },
  { re: /dangerouslySetInnerHTML/,                             name: 'react-xss',              sev: 'FLAG'  },
  { re: /crypto\.(createCipher|createDecipher)\b/,             name: 'node-cipher-no-iv',      sev: 'FLAG'  },
  { re: /rejectUnauthorized\s*:\s*false/,                      name: 'tls-reject-disabled',    sev: 'FLAG'  },
  { re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/,           name: 'tls-env-disabled',       sev: 'FLAG'  },
];

// ─── Python patterns (Anthropic security-guidance rules 8–10, 12, 15–19, 24–25)
const PY_EXTS = new Set(['.py', '.pyi']);
const PY_PATTERNS = [
  // Deserialization RCE
  { re: /\bpickle\.(loads?|Unpickler)\b/,                                name: 'pickle-deserialization',  sev: 'BLOCK' },
  { re: /\b(cPickle|cloudpickle|dill)\.(load|loads)\s*\(/,               name: 'pickle-variant-load',     sev: 'BLOCK' },
  { re: /\bmarshal\.loads?\s*\(/,                                         name: 'marshal-deserialization', sev: 'BLOCK' },
  { re: /\bshelve\.open\s*\(/,                                            name: 'shelve-open',             sev: 'FLAG'  },
  { re: /\bjoblib\.load\s*\(|\b(?:pd|pandas)\.read_pickle\s*\(/,         name: 'pickle-wrapper-load',     sev: 'BLOCK' },
  { re: /\bnumpy\.load\s*\([^)\n]{0,200}allow_pickle\s*=\s*True/,        name: 'numpy-allow-pickle',      sev: 'BLOCK' },
  // Command injection
  { re: /\bos\.system\s*\(/,                                              name: 'os-system-injection',     sev: 'BLOCK' },
  { re: /subprocess\.(?:run|call|Popen|check_output|check_call)\([^)]*shell\s*=\s*True/, name: 'subprocess-shell-true', sev: 'BLOCK' },
  // Unsafe parsing
  { re: /\byaml\.(?:unsafe_)?load\s*\((?![^)\n]{0,80}Loader\s*=\s*yaml\.SafeLoader)/, name: 'yaml-unsafe-load', sev: 'FLAG' },
  { re: /\b(?:xml\.etree\.ElementTree|ET)\.(parse|fromstring)\s*\(/,     name: 'xml-unsafe-parse',        sev: 'FLAG'  },
  // TLS disabled
  { re: /verify\s*=\s*False\b/,                                           name: 'tls-verify-disabled',     sev: 'FLAG'  },
  { re: /ssl\._create_unverified_context/,                                name: 'tls-unverified-context',  sev: 'FLAG'  },
  { re: /check_hostname\s*=\s*False/,                                     name: 'tls-no-hostname-check',   sev: 'FLAG'  },
  // Hardcoded secrets
  { re: /(?:api[_-]?key|token|password|secret)\s*=\s*['"][A-Za-z0-9_\-]{16,}/i, name: 'hardcoded-secret', sev: 'FLAG' },
];

// ─── Shell script patterns ─────────────────────────────────────────────────
const SH_EXTS = new Set(['.sh', '.bash']);
const SH_PATTERNS = [
  { re: /eval\s+["'$]/,                   name: 'shell-eval',        sev: 'BLOCK' },
  { re: /curl\s+.*\|\s*(bash|sh)\b/,      name: 'curl-pipe-shell',   sev: 'BLOCK' },
  { re: /wget\s+.*\|\s*(bash|sh)\b/,      name: 'wget-pipe-shell',   sev: 'BLOCK' },
  { re: /--break-system-packages/,        name: 'pip-break-system',  sev: 'FLAG'  },
];

function scanMarkdown(filePath, content) {
  const s = stripCodeBlocks(content);
  for (const { re, name, sev } of [...MD_INJECTION, ...MD_BASH, ...MD_SECRETS]) {
    if (re.test(s)) {
      const m = s.match(re);
      flag(filePath, name, sev, `"${m[0].slice(0, 80).replace(/\n/g, '\\n')}"`);
    }
  }
}

function scanScript(filePath, content, ext) {
  let patterns = [];
  let scanContent = content;
  if (JS_EXTS.has(ext)) { patterns = JS_PATTERNS; scanContent = stripRegexLiterals(content); }
  if (PY_EXTS.has(ext)) patterns = PY_PATTERNS;
  if (SH_EXTS.has(ext)) patterns = SH_PATTERNS;
  if (patterns.length === 0) return;

  for (const { re, name, sev } of patterns) {
    if (re.test(scanContent)) {
      const m = scanContent.match(re);
      flag(filePath, name, sev, `"${m[0].slice(0, 80)}"`);
    }
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walkDir(full); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    let content;
    try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
    if (['.md', '.txt'].includes(ext)) scanMarkdown(full, content);
    else scanScript(full, content, ext);
  }
}

walkDir(skillDir);

let verdict = 'PASS';
if (findings.some(f => f.severity === 'BLOCK')) verdict = 'BLOCK';
else if (findings.some(f => f.severity === 'FLAG'))  verdict = 'FLAG';

console.log(JSON.stringify({
  verdict,
  scanned: path.resolve(skillDir),
  timestamp: new Date().toISOString(),
  summary: {
    total:  findings.length,
    BLOCK:  findings.filter(f => f.severity === 'BLOCK').length,
    FLAG:   findings.filter(f => f.severity === 'FLAG').length,
  },
  findings,
}, null, 2));

process.exit(verdict === 'BLOCK' ? 2 : verdict === 'FLAG' ? 1 : 0);
