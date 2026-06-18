#!/usr/bin/env node
// extract-project-context.js [project-root]
// Reads common project files and extracts context for project-aware skill evaluation.
// Writes evals/project-context.json and emits JSON to stdout.

const fs   = require('fs');
const path = require('path');

const projectRoot = process.argv[2] || process.cwd();

const context = {
  project_name:    path.basename(projectRoot),
  stack:           [],
  workflow_terms:  [],
  installed_skills:[],
  key_phrases:     [],
  artifact_paths:  [],
};

function readFile(...parts) {
  try { return fs.readFileSync(path.join(...parts), 'utf8'); } catch { return null; }
}

// ── package.json ─────────────────────────────────────────────────────────────
const pkg = readFile(projectRoot, 'package.json');
if (pkg) {
  try {
    const p = JSON.parse(pkg);
    if (p.name)        context.project_name = p.name;
    if (p.description) context.key_phrases.push(p.description);
    const deps = Object.keys({ ...(p.dependencies || {}), ...(p.devDependencies || {}) });
    const stackMap = {
      next:       'Next.js',   react:      'React',     vue:      'Vue',
      svelte:     'Svelte',    angular:    'Angular',   express:  'Express',
      typescript: 'TypeScript',fastapi:    'FastAPI',   django:   'Django',
      flask:      'Flask',     rails:      'Rails',     laravel:  'Laravel',
    };
    for (const [dep, name] of Object.entries(stackMap)) {
      if (deps.some(d => d.toLowerCase().includes(dep))) context.stack.push(name);
    }
  } catch {}
}

// ── pyproject.toml ───────────────────────────────────────────────────────────
const pyproject = readFile(projectRoot, 'pyproject.toml');
if (pyproject) {
  const m = pyproject.match(/^name\s*=\s*["'](.+)["']/m);
  if (m) context.project_name = m[1];
  if (pyproject.includes('fastapi')) context.stack.push('FastAPI');
  if (pyproject.includes('django'))  context.stack.push('Django');
}

// ── CLAUDE.md — workflow conventions and key terms ──────────────────────────
const claudeMd = readFile(projectRoot, 'CLAUDE.md') ||
                 readFile(projectRoot, '.claude', 'CLAUDE.md');
if (claudeMd) {
  // Capitalized acronyms/terms = project-specific vocabulary
  const caps = claudeMd.match(/\b[A-Z][A-Z_]{2,}\b/g) || [];
  context.workflow_terms.push(...[...new Set(caps)].filter(t => t.length < 20).slice(0, 15));
  // "Use X" patterns reveal preferred tooling and conventions
  for (const m of claudeMd.matchAll(/\buse\s+([A-Za-z][\w/-]+)/gi))
    context.key_phrases.push(m[1]);
  // File/directory paths mentioned
  for (const m of claudeMd.matchAll(/`([./][\w./\-]+)`/g))
    context.artifact_paths.push(m[1]);
}

// ── README.md — project description ─────────────────────────────────────────
const readme = readFile(projectRoot, 'README.md');
if (readme) {
  // First substantive line after the H1 title
  const m = readme.split('\n').slice(0, 30).join('\n').match(/^#{1,2}\s+.+\n+([^\n#]{10,})/m);
  if (m) context.key_phrases.push(m[1].trim());
}

// ── .planning/ and CONTEXT.md ─────────────────────────────────────────────
const planning = readFile(projectRoot, '.planning', 'REQUIREMENTS.md') ||
                 readFile(projectRoot, '.planning', 'intel', 'CONTEXT.md') ||
                 readFile(projectRoot, 'CONTEXT.md');
if (planning) {
  // Multi-word Title-Case phrases = domain terminology
  const terms = planning.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
  context.key_phrases.push(...[...new Set(terms)].slice(0, 8));
  for (const m of planning.matchAll(/`([./][\w./\-]+)`/g))
    context.artifact_paths.push(m[1]);
}

// ── Installed skills ─────────────────────────────────────────────────────────
const skillsDir = path.join(projectRoot, 'skills');
if (fs.existsSync(skillsDir)) {
  context.installed_skills = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

// ── Deduplicate and trim ─────────────────────────────────────────────────────
context.stack           = [...new Set(context.stack)];
context.workflow_terms  = [...new Set(context.workflow_terms)];
context.artifact_paths  = [...new Set(context.artifact_paths)].slice(0, 10);
context.key_phrases     = [...new Set(context.key_phrases.filter(Boolean))].slice(0, 10);

// ── Write output ─────────────────────────────────────────────────────────────
const outDir  = path.join(projectRoot, 'evals');
const outPath = path.join(outDir, 'project-context.json');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(context, null, 2));
console.error(`Project context written to ${outPath}`);
console.log(JSON.stringify(context, null, 2));
