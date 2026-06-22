# claude_code — Skill & Agent Pipeline Toolkit

A self-contained pipeline for sourcing, vetting, adapting, measuring, and auto-improving Claude Code skills and agents. Install it into any target project with `./install.sh`.

## Quick Facts

- **Stack**: Node.js ≥ 18 (scripts only — no runtime framework)
- **Test**: `node skills/skill-eval/scripts/generate-seed-evals.js skills/<name>/SKILL.md --context evals/project-context.json`
- **Lint**: `node --check skills/skill-eval/scripts/extract-project-context.js` (syntax check)
- **Install**: `./install.sh /path/to/target-project`
- **Uninstall**: `./uninstall.sh /path/to/target-project`

## Key Directories

- `skills/` — source of truth for all pipeline skills; installed to target projects and `~/.claude/skills/`
- `.claude/agents/` — runtime sub-agents; installed to target projects only (project-scoped)
- `evals/` — generated artifacts (gitignored): `project-context.json`, eval runs, refine logs
- `docs/superpowers/specs/` — design specs for features under development

## Pipeline

```
project-setup → project-audit → skill-scout → skill-audit → skill-adapt → skill-eval → skill-refine
                                                               ↕
                                              agent-scout → agent-audit → agent-adapt
```

- `project-setup` — generates `CLAUDE.md` + `evals/project-context.json` for the target project
- `project-audit` — wraps `npx ecc-agentshield` to scan `.claude/` config for security issues
- `skill-scout` / `agent-scout` — searches GitHub registries; scores candidates on 7 dimensions
- `skill-audit` / `agent-audit` — static scanner (47-pattern set across 5 categories: prompt injection, bash, secrets, permissions, scripts); accepts skill dirs, agent .md files, or settings.json
- `skill-adapt` / `agent-adapt` — rewrites sourced skill/agent to match target project context
- `skill-eval` — 9-scenario test suite; 5 metrics (pass rate, trigger accuracy, footprint, fit, resilience)
- `skill-refine` — Karpathy autoresearch loop; max 10 iterations; routes by failing metric to lever A–E

## Domain Terms

- **SKILL.md** — the skill definition file every skill must have; carries frontmatter + workflow
- **project-context.json** — 9-field shared data contract: `project_name`, `stack`, `workflow_terms`, `installed_skills`, `key_phrases`, `artifact_paths`, `hooks`, `mcp_servers`, `plugins`
- **evals.json** — structured test scenarios for a skill; 9 types when `--context` is provided
- **refine-input.json** — handoff from skill-eval to skill-refine; lists failing scenarios + root causes
- **SKILL-EVAL.md** — per-skill eval report with 5-metric table and analyst observations
- **SKILL-REFINE-LOG.md** — append-only iteration log produced by skill-refine / skill-refine-agent
- **Lever A–E** — mutation targets in the autoresearch loop (A=description, B=checklist, C=examples, D=reference, E=scripts)
- **Resilience Score** — metric measuring adversarial non-trigger rate; ≥ 8/10 required
- **Project Fit Score** — metric averaging project-native + project-workflow + multi-turn scenario scores; ≥ 7/10 required

## Claude's Rules

### Always

- Run `extract-project-context.js` before evaluating any skill — stale context degrades adapt and eval quality
- Pass `--context evals/project-context.json` to `generate-seed-evals.js` — without it you get 6 scenarios instead of 9 and miss resilience and fit metrics
- Discover skills and agents dynamically (`find skills/ -mindepth 1 -maxdepth 1 -type d`) — never hardcode skill names in scripts
- Keep `install.sh` and `uninstall.sh` in sync — every step in install must have a mirror in uninstall
- Deploy to `~/.claude/skills/` after editing any skill so changes take effect immediately in Claude Code

### Never

- Hardcode a skill count anywhere — the number of skills changes as the pipeline evolves
- Commit anything under `evals/` — it is gitignored; all eval artifacts are generated, not versioned
- Run `npx ecc-agentshield --opus` automatically — it makes API calls and may incur cost; only on explicit user request
- Edit `SKILL.md.baseline` once created — it is the immutable reference point for a refine session
- Skip the analyst pass in skill-eval — non-discriminating and flaky scenarios are silent failures without it
