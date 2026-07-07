#!/usr/bin/env node
/**
 * PostToolUse hook — records one telemetry event per Skill or Task/Agent tool
 * call. Reads a single JSON event from stdin (Claude Code hook payload):
 *   { session_id, transcript_path, cwd, hook_event_name, tool_name, tool_input, tool_response }
 *
 * Writes ONE JSONL line to evals/telemetry/events-YYYY-MM.jsonl per matching call.
 * Never stores raw prompt/transcript text — see redact.js. Fails open: any error
 * (malformed stdin, missing fields, write failure) results in a silent exit 0 —
 * a logging failure must never block the tool call it observed.
 *
 * Not wired to run standalone in normal use — registered as a PostToolUse hook
 * command in .claude/settings.json (matcher: Skill and Task/Agent tools).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sha256Hex, extractArtifactPaths, redactString } = require('./redact');

const HARD_TIMEOUT_MS = 2000; // hook budgets are generous (seconds) — stay well under

// Absolute safety net: if anything below hangs, force exit 0 rather than block
// the tool call that triggered this hook. unref() so it never keeps the
// process alive by itself — it only matters if something else already is.
setTimeout(() => { try { process.exit(0); } catch { /* noop */ } }, HARD_TIMEOUT_MS + 1000).unref();

function readStdin(timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (data) => { if (!done) { done = true; resolve(data); } };
    let timer;
    try {
      timer = setTimeout(() => finish(''), timeoutMs);
      timer.unref && timer.unref();
      const chunks = [];
      process.stdin.on('data', (c) => chunks.push(c));
      process.stdin.on('end', () => { clearTimeout(timer); finish(Buffer.concat(chunks).toString('utf8')); });
      process.stdin.on('error', () => { clearTimeout(timer); finish(''); });
      process.stdin.resume();
    } catch {
      if (timer) clearTimeout(timer);
      finish('');
    }
  });
}

function extractDuration(event) {
  const candidates = [
    event && event.duration_ms,
    event && event.tool_response && event.tool_response.duration_ms,
    event && event.tool_response && event.tool_response.durationMs,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0) return Math.round(c);
  }
  return undefined;
}

function stringifyToolResponse(toolResponse) {
  if (toolResponse == null) return '';
  if (typeof toolResponse === 'string') return toolResponse;
  try { return JSON.stringify(toolResponse); } catch { return ''; }
}

function monthFileName(isoTs) {
  const d = new Date(isoTs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `events-${y}-${m}.jsonl`;
}

function appendEvent(repoRoot, record) {
  const dir = path.join(repoRoot, 'evals', 'telemetry');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, monthFileName(record.ts));
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}

async function main() {
  const raw = await readStdin(HARD_TIMEOUT_MS);
  if (!raw) return;

  let event;
  try { event = JSON.parse(raw); } catch { return; }
  if (!event || typeof event !== 'object') return;

  const toolName = event.tool_name;
  let kind = null;
  if (toolName === 'Skill') kind = 'skill';
  else if (toolName === 'Task' || toolName === 'Agent') kind = 'agent';
  if (!kind) return; // not a Skill/Task call — nothing to log

  const toolInput = (event.tool_input && typeof event.tool_input === 'object') ? event.tool_input : {};
  const rawName = kind === 'skill' ? toolInput.skill : toolInput.subagent_type;
  if (!rawName || typeof rawName !== 'string') return;

  const repoRoot = process.env.CLAUDE_PROJECT_DIR
    || (typeof event.cwd === 'string' && event.cwd)
    || process.cwd();

  // Any free-text prompt-like field is hashed, never stored raw.
  const promptLike = typeof toolInput.prompt === 'string' ? toolInput.prompt
    : (typeof toolInput.description === 'string' ? toolInput.description : null);
  const contextHash = promptLike ? sha256Hex(promptLike) : null;

  const durationMs = extractDuration(event);
  const responseText = stringifyToolResponse(event.tool_response);
  const artifacts = extractArtifactPaths(responseText, repoRoot);

  const record = {
    ts: new Date().toISOString(),
    session_id: typeof event.session_id === 'string' ? event.session_id : 'unknown',
    invocation_id: crypto.randomUUID(),
    name: redactString(rawName),
    kind,
    event: 'invocation',
  };
  if (contextHash) record.context_hash = contextHash;
  if (typeof durationMs === 'number') record.duration_ms = durationMs;
  if (artifacts.length) record.artifacts = artifacts;

  appendEvent(repoRoot, record);
}

main()
  .catch(() => { /* fail open */ })
  .finally(() => { try { process.exit(0); } catch { /* noop */ } });
