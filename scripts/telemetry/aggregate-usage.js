#!/usr/bin/env node
/**
 * Aggregates evals/telemetry/events-YYYY-MM.jsonl into evals/telemetry/usage-summary.json:
 * per skill/agent invocation_count, correction_rate, rejection_rate,
 * artifact_production_rate, and a trailing-30-day window of the same.
 *
 * Refine-trigger policy (ADVISORY — this script never invokes anything):
 * flags REFINE_RECOMMENDED when a target has >=10 invocations in the trailing
 * 30 days AND (correction_rate_30d > 0.3 OR rejection_rate_30d > 0.2). For
 * each flagged target, merges a `real_usage` block into
 * evals/<name>/refine-input.json (skills) or evals/agents/<name>/refine-input.json
 * (agents) — create-or-merge, preserving any existing content.
 *
 * Also prunes monthly JSONL files beyond the most recent 6 (rotation lives
 * here, not in the hooks, per design).
 *
 * Usage:
 *   node scripts/telemetry/aggregate-usage.js [--repo-root <path>] [--now <ISO-8601>]
 *
 * --repo-root defaults to process.cwd(). --now overrides "current time" for the
 * trailing-30-day window and flagged_at timestamps — test-only convenience,
 * never needed in normal use.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KEEP_MONTHS = 6;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_INVOCATIONS_30D = 10;
const CORRECTION_THRESHOLD = 0.3;
const REJECTION_THRESHOLD = 0.2;

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), now: new Date() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo-root' && argv[i + 1]) { args.repoRoot = argv[++i]; }
    else if (argv[i] === '--now' && argv[i + 1]) { args.now = new Date(argv[++i]); }
  }
  return args;
}

// ── JSONL loading ────────────────────────────────────────────────────────────

function telemetryDir(repoRoot) {
  return path.join(repoRoot, 'evals', 'telemetry');
}

function listMonthFiles(repoRoot) {
  const dir = telemetryDir(repoRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /^events-\d{4}-\d{2}\.jsonl$/.test(f))
    .sort(); // lexical sort == chronological for YYYY-MM
}

function pruneOldMonths(repoRoot, monthFiles) {
  if (monthFiles.length <= KEEP_MONTHS) return { kept: monthFiles, pruned: [] };
  const sorted = [...monthFiles].sort();
  const pruned = sorted.slice(0, sorted.length - KEEP_MONTHS);
  const kept = sorted.slice(sorted.length - KEEP_MONTHS);
  for (const f of pruned) {
    try { fs.unlinkSync(path.join(telemetryDir(repoRoot), f)); } catch { /* best-effort */ }
  }
  return { kept, pruned };
}

function loadEvents(repoRoot, monthFiles) {
  const events = [];
  for (const f of monthFiles) {
    const full = path.join(telemetryDir(repoRoot), f);
    let content;
    try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch { /* skip corrupt line */ }
    }
  }
  return events;
}

// ── Per-target aggregation ───────────────────────────────────────────────────

function targetKey(kind, name) { return `${kind}::${name}`; }

function computeStats(invocationEvents, outcomeEvents, sessionEndEvents) {
  const total = invocationEvents.length;
  if (total === 0) {
    return {
      invocation_count: 0,
      correction_rate: 0,
      rejection_rate: 0,
      artifact_production_rate: 0,
    };
  }

  const outcomeByInvocation = new Map();
  for (const o of outcomeEvents) {
    if (o.invocation_id) outcomeByInvocation.set(o.invocation_id, o);
  }

  // Map invocation_id -> set of artifact paths marked exists:false in any
  // session_end batch that covers it.
  const rejectedArtifactsByInvocation = new Map();
  for (const se of sessionEndEvents) {
    if (!Array.isArray(se.invocation_ids) || !Array.isArray(se.artifact_census)) continue;
    const missing = new Set(se.artifact_census.filter(c => c && c.exists === false).map(c => c.path));
    if (!missing.size) continue;
    for (const invId of se.invocation_ids) {
      if (!rejectedArtifactsByInvocation.has(invId)) rejectedArtifactsByInvocation.set(invId, new Set());
      const set = rejectedArtifactsByInvocation.get(invId);
      for (const p of missing) set.add(p);
    }
  }

  let corrected = 0;
  let rejected = 0;
  let withArtifacts = 0;

  for (const inv of invocationEvents) {
    const hasArtifacts = Array.isArray(inv.artifacts) && inv.artifacts.length > 0;
    if (hasArtifacts) withArtifacts++;

    const outcome = outcomeByInvocation.get(inv.invocation_id);
    if (outcome && outcome.outcome && outcome.outcome.followed_by_correction) {
      corrected++;
      continue; // a correction takes precedence over a rejection signal
    }

    const missingArtifacts = rejectedArtifactsByInvocation.get(inv.invocation_id);
    if (hasArtifacts && missingArtifacts && inv.artifacts.some(a => missingArtifacts.has(a))) {
      rejected++;
    }
  }

  return {
    invocation_count: total,
    correction_rate: round(corrected / total),
    rejection_rate: round(rejected / total),
    artifact_production_rate: round(withArtifacts / total),
  };
}

function round(n) { return Math.round(n * 1000) / 1000; }

// ── Main aggregation ─────────────────────────────────────────────────────────

function aggregate(events, now) {
  const invocationsByTarget = new Map();
  const outcomesByTarget = new Map();
  const sessionEndsByTarget = new Map(); // keyed per-target via invocation lookup below

  const invocationById = new Map();
  for (const e of events) {
    if (e && e.event === 'invocation' && e.kind && e.name && e.invocation_id) {
      invocationById.set(e.invocation_id, e);
      const key = targetKey(e.kind, e.name);
      if (!invocationsByTarget.has(key)) invocationsByTarget.set(key, []);
      invocationsByTarget.get(key).push(e);
    }
  }
  for (const e of events) {
    if (e && e.event === 'outcome' && e.invocation_id) {
      const inv = invocationById.get(e.invocation_id);
      const key = inv ? targetKey(inv.kind, inv.name) : (e.kind && e.name ? targetKey(e.kind, e.name) : null);
      if (!key) continue;
      if (!outcomesByTarget.has(key)) outcomesByTarget.set(key, []);
      outcomesByTarget.get(key).push(e);
    }
  }
  // session_end events cover a batch of invocation_ids possibly spanning
  // multiple targets — bucket the relevant slice per target.
  for (const e of events) {
    if (e && e.event === 'session_end' && Array.isArray(e.invocation_ids)) {
      const byTarget = new Map();
      for (const invId of e.invocation_ids) {
        const inv = invocationById.get(invId);
        if (!inv) continue;
        const key = targetKey(inv.kind, inv.name);
        if (!byTarget.has(key)) byTarget.set(key, []);
        byTarget.get(key).push(invId);
      }
      for (const [key, invIds] of byTarget) {
        if (!sessionEndsByTarget.has(key)) sessionEndsByTarget.set(key, []);
        sessionEndsByTarget.get(key).push({ ...e, invocation_ids: invIds });
      }
    }
  }

  const cutoff = new Date(now.getTime() - THIRTY_DAYS_MS);
  const targets = new Set([...invocationsByTarget.keys()]);
  const summary = {};

  for (const key of targets) {
    const [kind, name] = key.split('::');
    const allInv = invocationsByTarget.get(key) || [];
    const allOut = outcomesByTarget.get(key) || [];
    const allSe = sessionEndsByTarget.get(key) || [];

    const inv30 = allInv.filter(e => new Date(e.ts) >= cutoff);
    const inv30Ids = new Set(inv30.map(e => e.invocation_id));
    const out30 = allOut.filter(e => inv30Ids.has(e.invocation_id));
    const se30 = allSe.filter(e => new Date(e.ts) >= cutoff);

    const overall = computeStats(allInv, allOut, allSe);
    const trailing30d = computeStats(inv30, out30, se30);

    const refineRecommended =
      trailing30d.invocation_count >= MIN_INVOCATIONS_30D &&
      (trailing30d.correction_rate > CORRECTION_THRESHOLD || trailing30d.rejection_rate > REJECTION_THRESHOLD);

    summary[key] = {
      name,
      kind,
      overall,
      trailing_30d: trailing30d,
      refine_recommended: refineRecommended,
    };
  }

  return summary;
}

// ── refine-input.json merge ──────────────────────────────────────────────────

function refineInputPath(repoRoot, kind, name) {
  return kind === 'agent'
    ? path.join(repoRoot, 'evals', 'agents', name, 'refine-input.json')
    : path.join(repoRoot, 'evals', name, 'refine-input.json');
}

function mergeRealUsage(repoRoot, kind, name, stats, flaggedAt) {
  const filePath = refineInputPath(repoRoot, kind, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let existing = {};
  if (fs.existsSync(filePath)) {
    try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { existing = {}; }
  }

  existing.real_usage = {
    source: 'telemetry',
    flagged_at: flaggedAt,
    invocation_count_30d: stats.trailing_30d.invocation_count,
    correction_rate_30d: stats.trailing_30d.correction_rate,
    rejection_rate_30d: stats.trailing_30d.rejection_rate,
    artifact_production_rate_30d: stats.trailing_30d.artifact_production_rate,
    recommendation: 'REFINE_RECOMMENDED',
  };

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return filePath;
}

// ── Entry point ───────────────────────────────────────────────────────────────

function main() {
  const { repoRoot, now } = parseArgs(process.argv.slice(2));

  const monthFiles = listMonthFiles(repoRoot);
  const { kept, pruned } = pruneOldMonths(repoRoot, monthFiles);
  if (pruned.length) console.log(`Pruned ${pruned.length} month file(s): ${pruned.join(', ')}`);

  const events = loadEvents(repoRoot, kept);
  const summary = aggregate(events, now);

  const flaggedAt = now.toISOString();
  const mergedFiles = [];
  for (const [, stats] of Object.entries(summary)) {
    if (stats.refine_recommended) {
      const filePath = mergeRealUsage(repoRoot, stats.kind, stats.name, stats, flaggedAt);
      mergedFiles.push(filePath);
    }
  }

  const output = {
    generated_at: flaggedAt,
    months_included: kept,
    months_pruned: pruned,
    targets: summary,
  };

  const outDir = telemetryDir(repoRoot);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'usage-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`Targets: ${Object.keys(summary).length}`);
  if (mergedFiles.length) {
    console.log(`REFINE_RECOMMENDED flagged for: ${mergedFiles.join(', ')}`);
  }
}

if (require.main === module) main();

module.exports = { aggregate, computeStats, mergeRealUsage, listMonthFiles, pruneOldMonths, loadEvents };
