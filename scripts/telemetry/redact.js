#!/usr/bin/env node
/**
 * Shared redaction/hashing helpers for the telemetry hooks (log-invocation.js,
 * log-outcome.js, aggregate-usage.js).
 *
 * Hard rule (binding, see CLAUDE.md): NEVER store raw prompt or transcript text.
 * Only store: context_hash (sha256 of prompt-like text), booleans, enums, counts,
 * and repo-relative artifact paths. Any string that IS stored still gets passed
 * through redactString() as defense-in-depth against secrets leaking via a path,
 * name, or other field we didn't anticipate.
 *
 * No dependencies — Node core only (crypto, path).
 */
const crypto = require('crypto');
const path = require('path');

// ── Hashing ──────────────────────────────────────────────────────────────────
// The ONLY sanctioned way to derive a stored value from prompt/transcript text.

function sha256Hex(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── Secret-pattern scan ──────────────────────────────────────────────────────
// Common key/token shapes. Deliberately broad (false positives are cheap —
// they just redact a bit more; false negatives leak a secret).

const SECRET_PATTERNS = [
  /sk-ant-api\d{2}-[A-Za-z0-9_-]{10,}/g,      // Anthropic API keys
  /sk-[A-Za-z0-9]{20,}/g,                      // OpenAI-style API keys
  /ghp_[A-Za-z0-9]{20,}/g,                     // GitHub personal access tokens
  /github_pat_[A-Za-z0-9_]{20,}/g,             // GitHub fine-grained PATs
  /gho_[A-Za-z0-9]{20,}/g,                     // GitHub OAuth tokens
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,             // Slack tokens
  /AKIA[0-9A-Z]{16}/g,                         // AWS access key IDs
  /AIzaSy[A-Za-z0-9_-]{20,}/g,                 // Google API keys
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT-shaped
  /Bearer\s+[A-Za-z0-9._-]{15,}/gi,             // Bearer tokens
  /(?:api[_-]?key|apikey|secret|token|password|passwd)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{12,}["']?/gi,
];

function redactString(str) {
  if (typeof str !== 'string') return str;
  let out = str;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

// Recursively apply redactString to every string value in an object/array.
// Used defensively on anything we do persist (paths, names) — NOT a license
// to persist prompt/transcript text; those must go through sha256Hex instead.
function redactDeep(value) {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}

// ── Repo-relative path handling ──────────────────────────────────────────────
// Artifact paths are stored ONLY as repo-relative, forward-slash paths. Anything
// that resolves outside the repo root (or that we can't confidently place inside
// it) is dropped rather than stored — avoids leaking absolute home-dir/system paths.

function toRepoRelative(candidatePath, repoRoot) {
  if (!candidatePath || typeof candidatePath !== 'string') return null;
  if (!repoRoot) return null;
  try {
    const abs = path.isAbsolute(candidatePath)
      ? candidatePath
      : path.resolve(repoRoot, candidatePath);
    const rel = path.relative(repoRoot, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return rel.split(path.sep).join('/');
  } catch {
    return null;
  }
}

// Scan free text (e.g. a tool_response) for path-like tokens with common
// extensions and return deduped repo-relative paths. Best-effort heuristic —
// the source text itself is NEVER stored, only the extracted paths.
const PATH_TOKEN_RE = /[./A-Za-z0-9_-]+\.(?:md|json|js|ts|jsx|tsx|txt|yaml|yml|sh|py|html|css)\b/g;
const MAX_ARTIFACTS = 20;

function extractArtifactPaths(text, repoRoot) {
  if (typeof text !== 'string' || !text) return [];
  const found = new Set();
  let match;
  PATH_TOKEN_RE.lastIndex = 0;
  while ((match = PATH_TOKEN_RE.exec(text)) !== null) {
    const rel = toRepoRelative(match[0], repoRoot);
    if (rel) found.add(rel);
    if (found.size >= MAX_ARTIFACTS) break;
  }
  return [...found];
}

module.exports = {
  sha256Hex,
  redactString,
  redactDeep,
  toRepoRelative,
  extractArtifactPaths,
  SECRET_PATTERNS,
  MAX_ARTIFACTS,
};
