#!/usr/bin/env node
// score-candidates.js <candidates.json>
// Scores skill candidates against project needs.
// Input: path to a JSON file containing an array of candidate objects.
// Output: sorted JSON array with scores and STRONG/GOOD/MARGINAL/SKIP recommendation.

// Candidate schema:
// {
//   name: string,
//   source_url: string,
//   commit_hash: string,
//   description: string,
//   skill_md_content?: string,           // full SKILL.md text — used for body matching
//   skill_md_lines: number,
//   has_scripts: boolean,
//   has_reference: boolean,
//   repo_age_days: number,
//   repo_stars: number,
//   trigger_keywords: string[],          // user-supplied: words describing the needed capability
//   installed_skill_descriptions: string[] // descriptions of currently installed skills
// }

const fs = require('fs');

const filePath = process.argv[2];
if (filePath === '--help' || filePath === '-h') {
  console.log(`Usage: node score-candidates.js <candidates.json>

Score and rank skill candidates against project needs.

Arguments:
  candidates.json   Path to JSON array of candidate objects (see schema below)

Output:
  Sorted JSON array written to stdout. Each entry adds: total_score,
  recommendation (STRONG|GOOD|MARGINAL|SKIP), and per-dimension scores.

Candidate schema:
  name, source_url, commit_hash, description, skill_md_content?,
  skill_md_lines, has_scripts, has_reference, repo_age_days, repo_stars,
  trigger_keywords[], installed_skill_descriptions[]

Examples:
  node skills/skill-scout/scripts/score-candidates.js /tmp/candidates.json
  node skills/skill-scout/scripts/score-candidates.js candidates.json | jq '.[0]'`);
  process.exit(0);
}
if (!filePath) {
  console.error('Usage: node score-candidates.js <candidates.json>');
  process.exit(1);
}

let candidates;
try {
  candidates = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (e) {
  console.error(`Failed to parse input: ${e.message}`);
  process.exit(1);
}

// Orgs with established track records in the Claude Code skills ecosystem.
// Tier 1 — Canonical: maintained by Anthropic or official tooling partners
const TRUSTED_ORGS_T1 = new Set([
  'anthropics', 'anthropic',        // Anthropic official (github.com/anthropics)
  'vercel-labs', 'vercel',          // Vercel skills registry
]);

// Tier 2 — Ecosystem builders: registries, frameworks, and high-quality skill collections
const TRUSTED_ORGS_T2 = new Set([
  'multica-ai',                     // Karpathy-style skills registry
  'composiohq',                     // awesome-claude-skills registry
  'evol-ai',                        // SkillCompass registry
  'affaan-m',                       // ECC ecosystem (AgentShield, security guides)
  'mattpocock',                     // Grilling skill; TypeScript educator, quality patterns
  'chriswiles',                     // claude-code-showcase; comprehensive CC reference
  'thedotmack',                     // claude-mem plugin; CC memory ecosystem
  'mksglu',                         // context-mode plugin
]);

// Tier 3 — Known good: project-owner org; skills here should always be trusted
const TRUSTED_ORGS_T3 = new Set([
  'dentaledgesolutions',
  'microsoft', 'google',            // large platform orgs; rarely publish CC skills but trusted
]);

// Union used for scoring — all tiers treated equally in the binary trusted/untrusted check.
// Callers that need tier-aware scoring can inspect the individual sets directly.
const TRUSTED_ORGS = new Set([
  ...TRUSTED_ORGS_T1,
  ...TRUSTED_ORGS_T2,
  ...TRUSTED_ORGS_T3,
]);

function scoreTriggerPrecision(desc) {
  if (!desc) return 0;
  let score = 0;
  if (/use when/i.test(desc)) score += 5;
  if (desc.split(/[,;]/).length >= 2) score += 3;
  if (/when (user|asked|request)/i.test(desc)) score += 2;
  return Math.min(score, 10);
}

// Scripts presence is neutral — they add power but also attack surface.
// has_reference is the primary structural quality signal.
function scoreClarity(candidate) {
  let score = 0;
  if (candidate.has_reference) score += 4;
  if (candidate.skill_md_lines >= 20) score += 3;
  if (candidate.skill_md_lines >= 40) score += 3;
  return Math.min(score, 10);
}

function scoreContextFootprint(lines) {
  if (lines <= 50)  return 10;
  if (lines <= 100) return 7;
  if (lines <= 150) return 5;
  if (lines <= 200) return 3;
  return 1;
}

// Match against both the description field and the full SKILL.md body when available.
function scoreProjectFit(candidate) {
  if (!candidate.trigger_keywords || candidate.trigger_keywords.length === 0) return 5;
  const searchText = [
    candidate.description || '',
    candidate.skill_md_content || '',
  ].join(' ').toLowerCase();
  const hits = candidate.trigger_keywords.filter(kw => searchText.includes(kw.toLowerCase()));
  return Math.round((hits.length / candidate.trigger_keywords.length) * 10);
}

// Repo age and stars as a combined maturity signal.
function scoreProvenance(candidate) {
  let score = 5;
  const stars = candidate.repo_stars || 0;
  const age   = candidate.repo_age_days || 0;
  if (stars >= 1000)     score += 3;
  else if (stars >= 100) score += 2;
  else if (stars >= 10)  score += 1;
  if (age < 7)           score -= 4;
  else if (age < 30)     score -= 2;
  else if (age >= 180)   score += 2;
  return Math.max(0, Math.min(score, 10));
}

// Source org trust level derived from URL.
function scoreSourceReputation(candidate) {
  if (!candidate.source_url) return 5;
  const match = candidate.source_url.match(/github\.com\/([^/]+)\//i);
  const org = match ? match[1].toLowerCase() : '';
  if (TRUSTED_ORGS.has(org))                                                return 10;
  if ((candidate.repo_stars || 0) >= 500)                                   return 7;
  if ((candidate.repo_stars || 0) >= 100)                                   return 5;
  if ((candidate.repo_stars || 0) === 0 && (candidate.repo_age_days || 0) < 30) return 1;
  return 4;
}

function scoreConflictRisk(candidate) {
  if (!candidate.installed_skill_descriptions?.length) return 10;
  const words = (candidate.description || '').toLowerCase().split(/\W+/).filter(w => w.length > 4);
  let maxOverlap = 0;
  for (const installed of candidate.installed_skill_descriptions) {
    const iWords = installed.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const overlap = words.filter(w => iWords.includes(w)).length;
    maxOverlap = Math.max(maxOverlap, overlap / Math.max(words.length, 1));
  }
  return Math.round((1 - maxOverlap) * 10);
}

const WEIGHTS = {
  trigger_precision:  0.25,
  clarity:            0.20,
  context_footprint:  0.15,
  project_fit:        0.15,
  provenance:         0.10,
  source_reputation:  0.10,
  conflict_risk:      0.05,
};

const scored = candidates.map(c => {
  const trigger_precision  = scoreTriggerPrecision(c.description);
  const clarity            = scoreClarity(c);
  const context_footprint  = scoreContextFootprint(c.skill_md_lines || 0);
  const project_fit        = scoreProjectFit(c);
  const provenance         = scoreProvenance(c);
  const source_reputation  = scoreSourceReputation(c);
  const conflict_risk      = scoreConflictRisk(c);

  const total = Math.round(
    trigger_precision  * WEIGHTS.trigger_precision  +
    clarity            * WEIGHTS.clarity            +
    context_footprint  * WEIGHTS.context_footprint  +
    project_fit        * WEIGHTS.project_fit        +
    provenance         * WEIGHTS.provenance         +
    source_reputation  * WEIGHTS.source_reputation  +
    conflict_risk      * WEIGHTS.conflict_risk,
  );

  return {
    name:          c.name,
    source_url:    c.source_url,
    commit_hash:   c.commit_hash,
    total_score:   total,
    breakdown:     { trigger_precision, clarity, context_footprint, project_fit, provenance, source_reputation, conflict_risk },
    recommendation: total >= 8 ? 'STRONG' : total >= 6 ? 'GOOD' : total >= 4 ? 'MARGINAL' : 'SKIP',
  };
});

scored.sort((a, b) => b.total_score - a.total_score);
console.log(JSON.stringify(scored, null, 2));
