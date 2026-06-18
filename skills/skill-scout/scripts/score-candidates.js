#!/usr/bin/env node
// score-candidates.js
// Scores skill candidates against project needs.
// Input (stdin or file): JSON array of candidates
// Output: sorted JSON array with scores

// Candidate schema:
// {
//   name: string,
//   source_url: string,
//   commit_hash: string,
//   description: string,
//   skill_md_lines: number,
//   has_scripts: boolean,
//   has_reference: boolean,
//   repo_age_days: number,
//   repo_stars: number,
//   trigger_keywords: string[],    // user-supplied: words describing what they need
//   installed_skill_descriptions: string[]  // descriptions of currently installed skills
// }

const input = process.argv[2] ? require('fs').readFileSync(process.argv[2], 'utf8') : '';
let candidates;
try {
  candidates = JSON.parse(input);
} catch {
  console.error('Pass a JSON file path as argument. File must contain an array of candidate objects.');
  process.exit(1);
}

function scoreTriggerPrecision(desc) {
  if (!desc) return 0;
  const hasUseWhen = /use when/i.test(desc);
  const hasSpecificTriggers = desc.split(/[,;]/).length >= 2;
  const hasTriggerWords = /when (user|asked|request)/i.test(desc);
  let score = 0;
  if (hasUseWhen) score += 5;
  if (hasSpecificTriggers) score += 3;
  if (hasTriggerWords) score += 2;
  return Math.min(score, 10);
}

function scoreClarity(candidate) {
  let score = 0;
  if (candidate.has_reference) score += 3;
  if (candidate.has_scripts) score += 2;
  // Estimate from line count — more lines usually means more detail (up to a point)
  if (candidate.skill_md_lines >= 20) score += 3;
  if (candidate.skill_md_lines >= 40) score += 2;
  return Math.min(score, 10);
}

function scoreContextFootprint(lines) {
  if (lines <= 50) return 10;
  if (lines <= 100) return 7;
  if (lines <= 150) return 5;
  if (lines <= 200) return 3;
  return 1;
}

function scoreProjectFit(candidate) {
  if (!candidate.trigger_keywords || candidate.trigger_keywords.length === 0) return 5;
  const desc = (candidate.description || '').toLowerCase();
  const hits = candidate.trigger_keywords.filter(kw => desc.includes(kw.toLowerCase()));
  return Math.round((hits.length / candidate.trigger_keywords.length) * 10);
}

function scoreConflictRisk(candidate) {
  if (!candidate.installed_skill_descriptions || candidate.installed_skill_descriptions.length === 0) return 10;
  const desc = (candidate.description || '').toLowerCase();
  const words = desc.split(/\W+/).filter(w => w.length > 4);
  let maxOverlap = 0;
  for (const installed of candidate.installed_skill_descriptions) {
    const installedWords = installed.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const overlap = words.filter(w => installedWords.includes(w)).length;
    const ratio = overlap / Math.max(words.length, 1);
    maxOverlap = Math.max(maxOverlap, ratio);
  }
  // High overlap = low score
  return Math.round((1 - maxOverlap) * 10);
}

const WEIGHTS = {
  trigger_precision: 0.30,
  clarity: 0.25,
  context_footprint: 0.20,
  project_fit: 0.15,
  conflict_risk: 0.10,
};

const scored = candidates.map(c => {
  const trigger_precision = scoreTriggerPrecision(c.description);
  const clarity = scoreClarity(c);
  const context_footprint = scoreContextFootprint(c.skill_md_lines || 0);
  const project_fit = scoreProjectFit(c);
  const conflict_risk = scoreConflictRisk(c);

  const total = Math.round(
    trigger_precision * WEIGHTS.trigger_precision +
    clarity * WEIGHTS.clarity +
    context_footprint * WEIGHTS.context_footprint +
    project_fit * WEIGHTS.project_fit +
    conflict_risk * WEIGHTS.conflict_risk
  );

  return {
    name: c.name,
    source_url: c.source_url,
    commit_hash: c.commit_hash,
    total_score: total,
    breakdown: { trigger_precision, clarity, context_footprint, project_fit, conflict_risk },
    recommendation: total >= 8 ? 'STRONG' : total >= 6 ? 'GOOD' : total >= 4 ? 'MARGINAL' : 'SKIP',
  };
});

scored.sort((a, b) => b.total_score - a.total_score);
console.log(JSON.stringify(scored, null, 2));
