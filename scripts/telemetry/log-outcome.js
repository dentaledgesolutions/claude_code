#!/usr/bin/env node
/**
 * UserPromptSubmit / Stop / SessionEnd hook — records outcome and session
 * close-out telemetry events. Reads a single JSON event from stdin:
 *   UserPromptSubmit: { session_id, transcript_path, cwd, hook_event_name, prompt }
 *   Stop/SessionEnd:  { session_id, transcript_path, cwd, hook_event_name }
 *
 * Mode is selected by a --mode <correction|session-end> CLI flag (set per the
 * hook command in .claude/settings.json), with a fallback to hook_event_name
 * from stdin if the flag is missing or wrong — defensive, not load-bearing.
 *
 * correction mode (UserPromptSubmit): heuristic — if the latest invocation
 * event in this session produced artifacts, and the new prompt (a) mentions
 * one of those artifacts by basename and (b) uses revision language
 * (fix/change/redo/wrong/instead/actually/"no,"), append an outcome event
 * { followed_by_correction: true, user_disposition: "revised", confidence }.
 * The raw prompt text is used only in-memory for this check — never stored;
 * only its sha256 (context_hash) is written.
 *
 * session-end mode (Stop/SessionEnd): appends one session_end event per batch
 * of not-yet-closed invocation_ids in this session, recording a final
 * artifact census (path + still-exists boolean) for each artifact those
 * invocations produced.
 *
 * Fails open: any error results in a silent exit 0 — a logging failure must
 * never block the hook it observed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { sha256Hex } = require('./redact');

const HARD_TIMEOUT_MS = 2000;
setTimeout(() => { try { process.exit(0); } catch { /* noop */ } }, HARD_TIMEOUT_MS + 1000).unref();

// Revision-language heuristic. \b before "no," avoids matching inside words
// like "casino," (no word boundary between 'i' and 'n').
const REVISION_RE = /\b(fix|fixed|fixing|redo|wrong|instead|actually|change|changed)\b|\bno,/i;

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

function monthFileName(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `events-${y}-${m}.jsonl`;
}

function monthFilePath(repoRoot, d) {
  return path.join(repoRoot, 'evals', 'telemetry', monthFileName(d));
}

function readMonthEvents(repoRoot, d) {
  const file = monthFilePath(repoRoot, d);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { /* skip corrupt line */ }
  }
  return events;
}

function appendEvent(repoRoot, record) {
  const dir = path.join(repoRoot, 'evals', 'telemetry');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, monthFileName(new Date(record.ts)));
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}

function detectMode(args, event) {
  const modeIdx = args.indexOf('--mode');
  const modeArg = modeIdx >= 0 ? args[modeIdx + 1] : null;
  if (modeArg === 'session-end') return 'session-end';
  if (modeArg === 'correction') return 'correction';
  const hen = event && event.hook_event_name;
  if (hen === 'Stop' || hen === 'SessionEnd') return 'session-end';
  return 'correction';
}

function handleCorrection(repoRoot, event) {
  const sessionId = typeof event.session_id === 'string' ? event.session_id : null;
  const prompt = typeof event.prompt === 'string' ? event.prompt : '';
  if (!sessionId || !prompt) return;

  const now = new Date();
  const events = readMonthEvents(repoRoot, now).filter(e => e && e.session_id === sessionId);

  const invocations = events
    .filter(e => e.event === 'invocation' && Array.isArray(e.artifacts) && e.artifacts.length)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (!invocations.length) return;

  const latest = invocations[0];

  // Don't double-record an outcome for the same invocation.
  const alreadyOutcome = events.some(e => e.event === 'outcome' && e.invocation_id === latest.invocation_id);
  if (alreadyOutcome) return;

  if (!REVISION_RE.test(prompt)) return;

  const lowerPrompt = prompt.toLowerCase();
  const matchedArtifacts = latest.artifacts.filter(a => {
    const base = path.basename(a).toLowerCase();
    return base && lowerPrompt.includes(base);
  });
  if (!matchedArtifacts.length) return;

  // Confidence: "medium" when the matched basename has a meaningful stem
  // (>3 chars before the extension); "low" for short/generic stems that are
  // more likely to match by coincidence.
  const hasStrongMatch = matchedArtifacts.some(a => {
    const stem = path.basename(a).replace(/\.[^.]+$/, '');
    return stem.length > 3;
  });
  const confidence = hasStrongMatch ? 'medium' : 'low';

  const record = {
    ts: now.toISOString(),
    session_id: sessionId,
    invocation_id: latest.invocation_id,
    name: latest.name,
    kind: latest.kind,
    event: 'outcome',
    context_hash: sha256Hex(prompt),
    outcome: {
      followed_by_correction: true,
      user_disposition: 'revised',
      confidence,
    },
  };
  appendEvent(repoRoot, record);
}

function handleSessionEnd(repoRoot, event) {
  const sessionId = typeof event.session_id === 'string' ? event.session_id : null;
  if (!sessionId) return;

  const now = new Date();
  const events = readMonthEvents(repoRoot, now).filter(e => e && e.session_id === sessionId);

  const invocations = events.filter(e => e.event === 'invocation' && e.invocation_id);
  if (!invocations.length) return;

  const alreadyClosed = new Set(
    events
      .filter(e => e.event === 'session_end' && Array.isArray(e.invocation_ids))
      .flatMap(e => e.invocation_ids)
  );
  const pending = invocations.filter(e => !alreadyClosed.has(e.invocation_id));
  if (!pending.length) return;

  const censusMap = new Map();
  for (const inv of pending) {
    for (const artifact of (inv.artifacts || [])) {
      if (censusMap.has(artifact)) continue;
      const abs = path.join(repoRoot, artifact);
      censusMap.set(artifact, fs.existsSync(abs));
    }
  }

  const record = {
    ts: now.toISOString(),
    session_id: sessionId,
    event: 'session_end',
    invocation_ids: pending.map(e => e.invocation_id),
    artifact_census: [...censusMap.entries()].map(([p, exists]) => ({ path: p, exists })),
  };
  appendEvent(repoRoot, record);
}

async function main() {
  const args = process.argv.slice(2);
  const raw = await readStdin(HARD_TIMEOUT_MS);
  if (!raw) return;

  let event;
  try { event = JSON.parse(raw); } catch { return; }
  if (!event || typeof event !== 'object') return;

  const repoRoot = process.env.CLAUDE_PROJECT_DIR
    || (typeof event.cwd === 'string' && event.cwd)
    || process.cwd();

  const mode = detectMode(args, event);
  if (mode === 'session-end') handleSessionEnd(repoRoot, event);
  else handleCorrection(repoRoot, event);
}

main()
  .catch(() => { /* fail open */ })
  .finally(() => { try { process.exit(0); } catch { /* noop */ } });
