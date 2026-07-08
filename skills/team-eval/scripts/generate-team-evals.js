#!/usr/bin/env node
/**
 * generate-team-evals.js — team-eval scenario generator (eval-hardening design Part 2).
 *
 * Input: a team manifest (team.json) describing an orchestration — orchestrator
 * (skill or agent) plus the member agents it dispatches. Output: 6 structured
 * scenarios at evals/teams/<team_name>/evals.json that evaluate the team AS A
 * UNIT: member selection, handoffs, degradation, and non-dispatch discipline.
 *
 * Evidence reuses the exact conventions of generate-agent-evals.js so
 * skills/skill-eval/scripts/harvest-evidence.js consumes the output unchanged:
 * one Agent(<member>) dispatch-token tool_call marker per member (present or
 * absent per scenario type), plus artifact checks from expected_artifacts.
 * Note: dispatch-chain accuracy is graded from evidence.json's FULL
 * transcript_markers array — never from the single agent_dispatched boolean,
 * which only reflects the first marker.
 *
 * Usage:
 *   node skills/team-eval/scripts/generate-team-evals.js <team.json> [--context evals/project-context.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node generate-team-evals.js <team.json> [--context <project-context.json>]');
  process.exit(args.length === 0 ? 1 : 0);
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

// ── Load + validate the manifest ──────────────────────────────────────────────

const teamFile = args[0];
if (!fs.existsSync(teamFile)) fail(`${teamFile} not found.`);

let team;
try { team = JSON.parse(fs.readFileSync(teamFile, 'utf8')); }
catch (e) { fail(`${teamFile} is not valid JSON: ${e.message}`); }

for (const field of ['team_name', 'orchestrator', 'members', 'handoff_contract', 'example_target']) {
  if (!team[field]) fail(`${teamFile}: missing required field "${field}".`);
}
if (!Array.isArray(team.members) || team.members.length === 0) {
  fail(`${teamFile}: "members" must be a non-empty array of { agent, role }.`);
}
if (!team.orchestrator.type || !team.orchestrator.name) {
  fail(`${teamFile}: orchestrator must have "type" (skill|agent) and "name".`);
}

const orchestratorPath = team.orchestrator.type === 'skill'
  ? path.join('skills', team.orchestrator.name, 'SKILL.md')
  : path.join('.claude', 'agents', `${team.orchestrator.name}.md`);
if (!fs.existsSync(orchestratorPath)) {
  fail(`orchestrator definition not found at ${orchestratorPath}.`);
}

const memberNames = [];
for (const m of team.members) {
  if (!m.agent || !m.role) fail(`${teamFile}: every member needs "agent" and "role".`);
  const p = path.join('.claude', 'agents', `${m.agent}.md`);
  if (!fs.existsSync(p)) fail(`member agent "${m.agent}" not found at ${p}.`);
  memberNames.push(m.agent);
}

const contextFile = flagValue('--context');
if (contextFile && !fs.existsSync(contextFile)) fail(`${contextFile} not found.`);

// ── Evidence helpers (conventions shared with generate-agent-evals.js) ────────

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Same invocation-token convention as agentDispatchedMarker — narrative mentions
// of a member's name must never count as a dispatch.
function memberDispatchMarker(name, expectPresent) {
  return { kind: 'tool_call', pattern: `Agent\\(\\s*["'\`]?${escapeRegExp(name)}["'\`]?\\s*\\)`, expect: expectPresent ? 'present' : 'absent' };
}

function markersFor(presentMembers) {
  const present = new Set(presentMembers);
  return memberNames.map(m => memberDispatchMarker(m, present.has(m)));
}

const artifacts = (team.expected_artifacts || []).map(p => ({ path: p, must_exist: true }));

// ── Scenarios ─────────────────────────────────────────────────────────────────

const target = team.example_target;
const teamLabel = team.team_name;
let id = 1;
const scenarios = [];

// 1. full-run — every member dispatched, final artifact produced.
scenarios.push({
  id: id++,
  eval_name: 'team-full-run',
  type: 'full-run',
  prompt: `Run a complete ${teamLabel} pass over ${target} — every layer analyst, then the combined report.`,
  target,
  expected: {
    dispatches: true,
    workflow_executed: true,
    evidence: { artifacts, transcript_markers: markersFor(memberNames), workflow_steps: [] },
    judgment: [
      `Dispatches every member of ${teamLabel} exactly once (an Agent tool call per member appears in the transcript)`,
      'Produces the combined final artifact from member outputs rather than stopping after individual layers',
      `Handoff contract respected: ${team.handoff_contract}`,
    ],
  },
});

// 2. partial-team — a strict subset of members, the rest must stay idle.
const subset = team.members.slice(0, Math.max(1, Math.floor(team.members.length / 2))).map(m => m.agent);
scenarios.push({
  id: id++,
  eval_name: 'team-partial-scope',
  type: 'partial-team',
  prompt: `Using ${teamLabel}, analyze ONLY these layers of ${target}: ${subset.join(', ')}. Do not run any other analyst.`,
  target,
  expected: {
    dispatches: true,
    evidence: { artifacts: [], transcript_markers: markersFor(subset), workflow_steps: [] },
    judgment: [
      `Dispatches only the requested members (${subset.join(', ')}) and none of the others`,
      'Scopes the combined output to the requested layers without fabricating the skipped ones',
    ],
  },
});

// 3. member-failure — one member unavailable; orchestrator must degrade gracefully.
const excluded = memberNames[memberNames.length - 1];
scenarios.push({
  id: id++,
  eval_name: 'team-member-failure',
  type: 'member-failure',
  prompt: `Run a full ${teamLabel} pass over ${target}. Constraint: the ${excluded} agent is unavailable in this session — proceed without it.`,
  target,
  expected: {
    dispatches: true,
    evidence: { artifacts: [], transcript_markers: markersFor(memberNames.filter(m => m !== excluded)), workflow_steps: [] },
    judgment: [
      `Dispatches every member except ${excluded}`,
      `Reports the ${excluded} layer as a gap in the final output — degrades gracefully, never fabricates the missing layer's findings`,
    ],
  },
});

// 4. handoff-integrity — member outputs must be consumed, not re-derived.
scenarios.push({
  id: id++,
  eval_name: 'team-handoff-integrity',
  type: 'handoff-integrity',
  prompt: `Run a complete ${teamLabel} pass over ${target} and build the combined report strictly from each analyst's returned output.`,
  target,
  expected: {
    dispatches: true,
    workflow_executed: true,
    evidence: { artifacts, transcript_markers: markersFor(memberNames), workflow_steps: [] },
    judgment: [
      'Every layer section of the final output is traceable to that member\'s returned handoff object — the orchestrator consumes member outputs rather than re-deriving layers itself',
      `Handoff contract respected end-to-end: ${team.handoff_contract}`,
    ],
  },
});

// 5. negative — describe, don't dispatch.
scenarios.push({
  id: id++,
  eval_name: 'team-negative-explain',
  type: 'negative',
  prompt: `I'm not asking you to run anything. Just explain what the ${teamLabel} team does, which agents it involves, and what each one contributes.`,
  target: null,
  expected: {
    dispatches: false,
    evidence: { artifacts: [], transcript_markers: markersFor([]), workflow_steps: [] },
    judgment: [
      'Explains the team\'s members and handoff flow without dispatching any member agent',
      'Gives a useful description instead of executing',
    ],
  },
});

// 6. adversarial — team vocabulary in the wrong scope; must not dispatch.
scenarios.push({
  id: id++,
  eval_name: 'team-adversarial-wrong-scope',
  type: 'adversarial',
  prompt: `Do a deep multi-layer audit of this spreadsheet of quarterly sales numbers — break it down layer by layer the way your analyst team would.`,
  target: null,
  expected: {
    dispatches: false,
    evidence: { artifacts: [], transcript_markers: markersFor([]), workflow_steps: [] },
    judgment: [
      `Recognizes the request is outside ${teamLabel}'s scope (${team.orchestrator.name} analyzes ${team.orchestrator.type === 'skill' ? 'repositories' : 'its documented domain'}, not spreadsheets) and does not dispatch any member`,
      'Redirects to an appropriate approach for the actual request',
    ],
  },
});

// ── Write output ──────────────────────────────────────────────────────────────

const out = {
  team_name: team.team_name,
  team_file: teamFile,
  orchestrator: team.orchestrator,
  members: memberNames,
  project_context: contextFile || null,
  evals: scenarios,
};

const outDir = path.join('evals', 'teams', team.team_name);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'evals.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`Wrote ${scenarios.length} team scenarios -> ${outPath}`);
console.log(`Members: ${memberNames.join(', ')}`);
console.log(`Dispatch evidence: one Agent(<member>) token marker per member per scenario.`);
