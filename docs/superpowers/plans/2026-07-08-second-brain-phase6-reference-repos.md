# Second Brain Phase 6 — Reference Repository Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the governed external-source library: registry + schema, GStack as first source card, the 16 evaluated sources as entries, four registry scripts, and four skills (trimmed from v3's eleven).

**Architecture:** `reference-repositories/` at repo root holds `registry.json` (machine-readable, schema-validated), `registry.md` (generated, human table), and `sources/<name>/` source cards. A shared `reference-lib.js` owns registry load/save/render. Everything is source *material* — `install_policy: do-not-install-directly` on every entry; the Phase 2 security guard already blocks direct installs from `sources/`.

**Tech Stack:** Node ≥ 18 CommonJS, zero dependencies, `brain-lib.js` reuse.

## Global Constraints

- Phases 1–5 complete
- Every registry entry: `install_policy: "do-not-install-directly"`; skill adoption from any source goes through scout → audit → adapt → eval
- `sources/<name>/` directories contain **documentation only** — the audit script flags any executable (`.sh`, `.js`, `.py`) inside them
- GStack source card content stubbed from spec/v3 §10.3 — live repo analysis happens via the `gstack-pattern-audit` skill, not during this build
- Same script contract as Phase 1; do NOT touch eval-team files; do NOT commit `evals/`

## Preflight — re-verify before executing

- [ ] Phases 1–5 tests green; live capsule verifies
- [ ] The 16 source URLs below still resolve (spot-check 3; a dead URL gets `status: unreachable` in its entry, not silence)
- [ ] `hooks/brain/brain-security-guard.sh` present (its direct-install block is asserted in Task 5)

---

### Task 1: reference-repo schema + registry seed + GStack source card

**Files:**
- Create: `schemas/brain/reference-repo.schema.json`, `reference-repositories/README.md`, `reference-repositories/registry.json`, `reference-repositories/sources/gstack/source-card.md`
- Generated in Task 2: `reference-repositories/registry.md`

**Interfaces:**
- Produces: `registry.json` shape `{ "repositories": [ { name, url, status, types[], install_policy, last_reviewed, preferred_use[], risk_notes[] } ] }` — consumed by all Task 2 scripts.

- [ ] **Step 1: Write `schemas/brain/reference-repo.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "reference-repo-registry",
  "description": "Registry of external repositories usable as source material only",
  "type": "object",
  "required": ["repositories"],
  "properties": {
    "repositories": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "url", "status", "types", "install_policy", "last_reviewed"],
        "properties": {
          "name": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
          "url": { "type": "string" },
          "status": { "type": "string", "enum": ["reference", "unreachable", "retired"] },
          "types": { "type": "array", "minItems": 1, "items": { "type": "string", "enum": [
            "methodology-source", "skill-pattern-source", "agent-pattern-source",
            "candidate-skill-source", "eval-scenario-source", "governance-source",
            "retrieval-source", "research-source", "human-workflow-source" ] } },
          "install_policy": { "type": "string", "const": "do-not-install-directly" },
          "last_reviewed": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
          "preferred_use": { "type": "array", "items": { "type": "string" } },
          "risk_notes": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write `reference-repositories/registry.json`** — seeded with the 16 sources evaluated in the design spec §3 (all `install_policy: "do-not-install-directly"`, `last_reviewed: "2026-07-08"`, `status: "reference"`):

| name | url | types |
|---|---|---|
| gstack | https://github.com/garrytan/gstack | methodology-source, skill-pattern-source, agent-pattern-source, candidate-skill-source, eval-scenario-source |
| infinite-brain-os | https://github.com/starmynd-org/infinite-brain-os | governance-source, methodology-source |
| claude-memory-compiler | https://github.com/coleam00/claude-memory-compiler | methodology-source, skill-pattern-source |
| second-brain-starter | https://github.com/coleam00/second-brain-starter | methodology-source, human-workflow-source |
| karpathy-llm-wiki | https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f | methodology-source, governance-source |
| aprende-skill | https://github.com/Hainrixz/aprende-skill | skill-pattern-source, candidate-skill-source |
| gbrain | https://github.com/garrytan/gbrain | retrieval-source |
| gbrain-evals | https://github.com/garrytan/gbrain-evals | eval-scenario-source, methodology-source |
| lightrag | https://github.com/HKUDS/LightRAG | retrieval-source (risk_notes: "RAG-Anything merged upstream 2026-05 — one lab entry") |
| graphify | https://github.com/safishamsi/graphify | retrieval-source, candidate-skill-source |
| understand-anything | https://github.com/Egonex-AI/Understand-Anything | retrieval-source, candidate-skill-source |
| letta-code | https://github.com/letta-ai/letta-code | methodology-source (risk_notes: "self-editing memory blocks rejected for canon paths") |
| notebooklm-py | https://github.com/teng-lin/notebooklm-py | research-source, candidate-skill-source |
| pleaseprompto-notebooklm-skill | https://github.com/PleasePrompto/notebooklm-skill | research-source, candidate-skill-source |
| deep-research-notebooklm | https://github.com/davila7/claude-code-templates | research-source, skill-pattern-source |
| kj-os-template | local: user-provided Drive export | human-workflow-source (risk_notes: "bundles vendored .env.local — never copy plugin dirs") |

Write each row as a full JSON entry with `preferred_use` distilled from the design spec §3 verdict for that source (one call per source, e.g. gstack: `["extract sprint methodology", "analyze skill patterns", "source candidate skills through audit pipeline", "generate eval scenarios"]`).

- [ ] **Step 3: Write `reference-repositories/README.md`**

```markdown
# Reference Repository Library

External repositories registered as **source material** — methodology, patterns,
candidate skills — never as runtime dependencies.

Rules (enforced by brain-security-guard + reference-repo-audit):
- `install_policy: do-not-install-directly` on every entry, no exceptions.
- Skill/agent adoption from a source goes through scout → audit → adapt → eval.
- `sources/<name>/` holds documentation only (source cards, maps) — no executables.
- Extracted patterns land in `.project-brain/synthesis/` as synthesis-authority content.

Files: `registry.json` (source of truth, schema-validated) · `registry.md`
(generated — run brain-reference-repo-add/refresh to regenerate, don't hand-edit)
· `sources/<name>/source-card.md` per entry.
```

- [ ] **Step 4: Write `reference-repositories/sources/gstack/source-card.md`** — the spec §9.4 template filled with §10.3 content:

```markdown
---
name: gstack
url: https://github.com/garrytan/gstack
owner: garrytan
type: [methodology-source, skill-pattern-source, agent-pattern-source, candidate-skill-source]
status: reference
trust_level: high-profile-community
install_policy: do-not-install-directly
last_reviewed: 2026-07-08
review_owner: erick
allowed_uses: [extract methodology, analyze skill design, analyze agent roles, generate eval scenarios, source candidate skills for audit]
prohibited_uses: [direct install without audit, global install without approval, auto-update without approval, bypass skill-audit, bypass agent-audit]
---

# Source Summary
23 opinionated Claude Code tools forming a virtual engineering team (CEO, Designer,
Eng Manager, Release Manager, Doc Engineer, QA) run as a sprint process.

# Why It Matters
The sprint loop — Think → Plan → Build → Review → Test → Ship → Reflect — with
artifact handoffs between stages ("/office-hours writes a design doc that
/plan-ceo-review reads") is the strongest available model for chained skill design.

# Reusable Patterns
- Stage-gated sprint loop with explicit artifact handoffs between skills
- Role-scoped review skills (CEO / eng / design / DevEx reviews of the same plan)
- QA and release-readiness as first-class pipeline stages

# Candidate Skills
Review-chain skills (plan-ceo-review, plan-eng-review, qa, ship, retro) — each
would require full scout → audit → adapt → eval before any use.

# Candidate Agents
strategic-review, architecture-review, qa-review, release-review, retro agents
(taxonomy already noted in agent-scout's design inputs).

# Security / Governance Notes
Large opinionated bundle; global install instructions; team-mode auto-update
behavior. Must never bypass the claude_code audit/eval pipeline.

# Adaptation Strategy
Extract patterns into .project-brain/synthesis/gstack-patterns/ via the
gstack-pattern-audit skill; adopt individual skills only through the pipeline.

# Eval Ideas
Handoff scenario (artifact consumed by next skill?) · sprint-stage scenario ·
scope-control scenario · review-chain scenario · retro-learning scenario.
```

- [ ] **Step 5: Validate + commit**

```bash
node -e "
const s = require('./schemas/brain/reference-repo.schema.json');
const r = require('./reference-repositories/registry.json');
if (!Array.isArray(r.repositories) || r.repositories.length !== 16) throw new Error('expected 16 entries');
for (const e of r.repositories) {
  for (const f of ['name','url','status','types','install_policy','last_reviewed']) if (!(f in e)) throw new Error(e.name + ' missing ' + f);
  if (e.install_policy !== 'do-not-install-directly') throw new Error(e.name + ': bad install_policy');
}
console.log('registry: 16 entries, all governed');
"
git add schemas/brain/reference-repo.schema.json reference-repositories
git commit -m "feat(brain): reference repository library — schema, 16-entry registry, GStack source card"
```

---

### Task 2: reference-lib.js + four registry scripts

**Files:**
- Create: `scripts/brain/reference-lib.js`, `scripts/brain/brain-reference-repo-add.js`, `brain-reference-repo-audit.js`, `brain-reference-repo-map.js`, `brain-reference-repo-refresh.js`
- Test: `scripts/brain/brain-reference-repo.test.js` (one file covering all four + lib)

**Interfaces:**
- `reference-lib.js` exports: `loadRegistry(root) → {file, data}` · `saveRegistry(reg)` (writes json + regenerates registry.md) · `renderRegistryMd(data) → string` · `REQUIRED_ENTRY_FIELDS`
- `brain-reference-repo-add.js --name <n> --url <u> --types a,b [--use "..."] [--risk "..."] [--force] [--root <dir>]` — validates fields vs schema enums, dedupes by name (exit 1 unless `--force`), scaffolds `sources/<n>/source-card.md` from the §9.4 template if absent, regenerates registry.md. Exit 0/1.
- `brain-reference-repo-audit.js --name <n> [--root <dir>]` — checks: entry exists · install_policy correct · source card has frontmatter with non-empty `prohibited_uses` · **no executable files** under `sources/<n>/` · no sensitive content (scanSensitive) · last_reviewed ≤ 180 days old. Security violations (executables, sensitive content, wrong policy) → exit 3; quality issues → warnings, exit 0. Report appended to `.project-brain/reports/security/` when a capsule exists (fail open otherwise).
- `brain-reference-repo-map.js --name <n> [--json]` — parses the source card's `# Reusable Patterns`, `# Candidate Skills`, `# Candidate Agents` sections into `{ patterns[], candidate_skills[], candidate_agents[] }` for skill-scout handoff.
- `brain-reference-repo-refresh.js --name <n>` — sets `last_reviewed` to today in registry entry + source-card frontmatter; regenerates registry.md.

- [ ] **Step 1: Write the failing test** — cover, minimum: add creates entry + card + registry.md row; duplicate add exits 1, `--force` overwrites; add with unknown type exits 1; audit passes on the seeded gstack entry; audit exits 3 when a planted `evil.sh` exists under `sources/gstack/` (remove after); audit exits 3 on planted `sk-ant-…` in a card; map returns the three GStack pattern buckets non-empty; refresh bumps both dates and registry.md regenerates. Use the Phase 1 test pattern (spawnSync, temp `--root` pointing at a copied fixture of `reference-repositories/`).

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement lib + four scripts.** Key shapes:

```js
// reference-lib.js (core)
'use strict';
const fs = require('fs');
const path = require('path');
const REQUIRED_ENTRY_FIELDS = ['name', 'url', 'status', 'types', 'install_policy', 'last_reviewed'];
function loadRegistry(root) {
  const file = path.join(root, 'reference-repositories', 'registry.json');
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}
function renderRegistryMd(data) {
  const rows = data.repositories.map(e =>
    `| ${e.name} | ${e.status} | ${e.types.join(', ')} | ${e.install_policy} | ${e.last_reviewed} |`);
  return `# Reference Repository Registry\n\n_Generated from registry.json — do not hand-edit._\n\n| name | status | types | install_policy | last_reviewed |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
}
function saveRegistry(root, data) {
  const file = path.join(root, 'reference-repositories', 'registry.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'reference-repositories', 'registry.md'), renderRegistryMd(data));
}
module.exports = { loadRegistry, saveRegistry, renderRegistryMd, REQUIRED_ENTRY_FIELDS };
```

The four scripts follow Phase 1 conventions (arg parsing via brain-lib, exit codes per Global Constraints). The audit's executable check:

```js
const execHits = [];
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(sh|js|py|rb|ps1)$/.test(e.name)) execHits.push(path.relative(root, p));
  }
})(path.join(root, 'reference-repositories', 'sources', name));
if (execHits.length) { /* SECURITY finding → exit 3 */ }
```

- [ ] **Step 4: Run tests to pass; run audit against all 16 live entries** (`for` loop; expect gstack full pass, card-less entries warn-only).

- [ ] **Step 5: Commit** — `git add scripts/brain/reference-lib.js scripts/brain/brain-reference-repo-*.js scripts/brain/brain-reference-repo.test.js reference-repositories/registry.md && git commit -m "feat(brain): reference-repo scripts — add/audit/map/refresh with docs-only enforcement"`

---

### Task 3: Four reference-repo skills

Follow Phase 3's 8-step workflow for each. SKILL.md essentials (same section structure as Phase 3 skills — When to use / Workflow / Files it may edit / Hard rules / Success criteria):

- [ ] **`skills/reference-repo-add/SKILL.md`** — trigger: "register X as a reference repo", "add this repo to the library". Workflow: confirm name/url/types with the user → run `brain-reference-repo-add.js` → open the scaffolded source card and fill Source Summary / Why It Matters with the user (or from a quick WebFetch of the repo README) → run `brain-reference-repo-audit.js` → report. Hard rule: never clone or install the repo; registration is metadata + card only.
- [ ] **`skills/reference-repo-audit/SKILL.md`** — trigger: "audit the reference library", "is <source> safe to use". Workflow: run audit script for one/all entries → present security findings vs warnings separately → for stale `last_reviewed`, offer refresh after a human glance at the upstream repo. Hard rule: exit-3 findings block any pattern-extraction work on that source until resolved.
- [ ] **`skills/gstack-pattern-audit/SKILL.md`** — trigger: "analyze gstack", "extract gstack patterns". Workflow: WebFetch the live GStack README + skill list → compare against `sources/gstack/source-card.md` → write findings to `.project-brain/synthesis/gstack-patterns/<topic>.md` (frontmatter type: synthesis, status: validated? No — `status: candidate`; synthesis is promoted like everything else) → update card's Reusable Patterns section → `brain-reference-repo-refresh.js --name gstack`. Hard rule: extraction output is synthesis authority — never canon, never a direct skill install.
- [ ] **`skills/reference-repo-pattern-extract/SKILL.md`** — the generic version of gstack-pattern-audit for any registry entry: trigger "extract patterns from <source>". Same flow parameterized by `brain-reference-repo-map.js` output; requires a clean audit (exit 0) first.

- [ ] Execute Steps A–H per skill; commit each.

---

### Task 4: NotebookLM research lane note

- [ ] Append to `.project-brain/BRAIN.md` under Memory Routing (via Edit — it's a protocol clarification, not canon):

```markdown
- NotebookLM/deep-research output → `support/sources/` at raw-source authority,
  then compile → promote like any other content. Research tooling (notebooklm-py,
  notebooklm-skill, deep-research-notebooklm) is registered in the reference
  library — adopt skills from them only through scout → audit → adapt → eval.
```

- [ ] Mirror the same note into `templates/second-brain/BRAIN.md` so new installs carry it.
- [ ] Commit both.

---

### Task 5: Phase acceptance

- [ ] Registry validates (Task 1 Step 5 check) and `registry.md` matches (regenerate + `git diff --exit-code reference-repositories/registry.md`)
- [ ] `brain-reference-repo.test.js` green; all scripts follow exit-code convention
- [ ] **Spec criterion:** `gstack-pattern-audit` produces synthesis output in `.project-brain/synthesis/gstack-patterns/` — run the skill live once
- [ ] **Spec criterion:** direct-install attempt blocked — in a live session, ask Claude to `cp -R reference-repositories/sources/gstack ~/.claude/skills/gstack`; expect `brain-security-guard.sh`… **gap check:** the Phase 2 guard blocks canon writes and capsule deletion but not `sources/` installs — extend `brain-security-guard.sh` with:

```js
if (tool === "Bash") {
  // ...existing checks...
  if (/reference-repositories\/sources\//.test(cmd) && /(cp|mv|ln|rsync)\b/.test(cmd) && /\.claude\/skills|~\/\.claude/.test(cmd))
    deny("Direct install from reference-repositories/sources/ is forbidden — route through skill-scout → skill-audit → skill-adapt");
}
```

  Add the corresponding assertion to `brain-hooks.test.js`, re-run, commit.
- [ ] All four skills pass eval thresholds
- [ ] Capture: `node scripts/brain/brain-capture.js --type decision --title "Phase 6 complete" --message "Reference library live: 16 governed entries, docs-only enforcement, GStack synthesis lane open."`

## Deferred

The seven trimmed v3 skills (`reference-repo-skill-scout`, `-agent-scout`, `-to-eval-scenarios`, `graphify-project`, `gbrain-adapter-eval`, …) — backlog until a use case pulls them in · live source cards for the other 15 entries (add via reference-repo-add as each is first used).
