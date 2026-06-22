# Claude Code Skill & Agent Pipeline Toolkit

Infrastructure for finding, vetting, customizing, and evaluating Claude Code skills and agents. Run `/project-setup` once to configure your project, then use the pipeline to source and install capabilities from the ecosystem rather than building from scratch.

## Pipeline Overview

```
project-setup → project-audit
                     │
                     ├── Skill pipeline ──────────────────────────────────────────────────┐
                     │   skill-scout → skill-audit → skill-adapt → skill-eval → skill-refine │
                     │                                    │                                   │
                     │                    (missing agent dependency detected)                 │
                     │                                    ↓                                  │
                     └── Agent pipeline ──────────────────────────────────────────────────── ┘
                         agent-scout → agent-audit → agent-adapt
```

`project-setup` feeds both pipelines via `evals/project-context.json` (9 fields: project name, stack, workflow terms, installed skills, key phrases, artifact paths, hooks, MCP servers, plugins) and optionally seeds them with signals from up to 3 GitHub reference repos.

`project-audit` runs a security scan of the `.claude/` configuration before any skill or agent is sourced or installed.

---

## Skills

### `project-setup`

Guided interview that produces `CLAUDE.md` and `evals/project-context.json`. Scans existing config files (`.claude/settings.json`, `.mcp.json`, `~/.claude/settings.json`) to auto-detect active hooks, MCP servers, and installed plugins before the interview begins. Optionally fetches conventions, stack, commands, rules, directories, and skill/agent names from up to 3 GitHub reference repos. The output powers the rest of the pipeline.

**Triggers:** "set up my project for Claude Code", "my project-context.json is empty", "help me configure CLAUDE.md"

---

### `project-audit`

Security scan of the Claude Code project configuration using [ecc-agentshield](https://www.npmjs.com/package/ecc-agentshield). Runs 102 rules across 5 categories — Secrets, Permissions, Hooks, MCP Servers, Agents — and returns an A–F grade. Offers auto-fix for the 8 most common safe issues. Advisory by default; surfaces critical findings before any skill installation proceeds.

**Triggers:** "audit my project security", "check my Claude Code setup for secrets", "scan before installing new skills"

---

### Skill Pipeline

#### `skill-scout`
Searches GitHub and known registries for existing skills that match a capability. Reads `evals/project-context.json` as a pre-flight check — if rich context is present (non-empty `stack` and `key_phrases`), it pre-fills search parameters without asking redundant questions. Returns a ranked shortlist scored on trigger precision, instruction clarity, context footprint, project fit, provenance, and conflict risk.

**Triggers:** "find a skill for X", "is there a skill that can Y", "source a skill"

#### `skill-audit`
Security gate for sourced skill files and agent definitions. Scans SKILL.md content, agent `.md` files, and `settings.json` for prompt injection, hardcoded secrets (Anthropic/GitHub/AWS keys), overly permissive allow rules, and malicious scripts using a 47-pattern static scanner across 5 categories. Returns PASS / FLAG / BLOCK before anything is installed. Complements `project-audit` (which runs AgentShield's 102-rule scan; this is self-contained with no external dependencies).

**Triggers:** "audit this skill", "check skill security", "scan this skill from GitHub"

#### `skill-adapt`
Rewrites a PASS-audited skill to match the project's terminology, workflow gates, and installed skill ecosystem. Reads all 9 fields from `evals/project-context.json`: uses `hooks` to avoid adding redundant workflow steps already covered by PostToolUse automation, `mcp_servers` to add prerequisite notes when a required integration is missing, and `plugins` to catch capability conflicts. Detects agent dependencies in the adapted skill and warns if any are missing from `.claude/agents/`.

**Triggers:** "adapt this skill", "customize this skill for my project", "install this skill"

#### `skill-eval`
Measures an adapted skill's effectiveness using structured test scenarios and LLM-judge scoring. Generates 9 scenario types when project context is available (6 without):

| # | Type | Triggers? | Tests |
|---|------|-----------|-------|
| 1 | `direct` | ✓ | Cold-start primary trigger |
| 2 | `paraphrased` | ✓ | Same intent, different words |
| 3 | `edge_case` | ✓ | Mid-workflow entry |
| 4 | `negative` | ✗ | Explain without invoking |
| 5 | `semantic` | ✓ | Synonym verb variations |
| 6 | `adversarial` | ✗ | Skill vocabulary in wrong scope — must not fire |
| 7 | `project-native` | ✓ | Project terminology injected |
| 8 | `project-workflow` | ✓ | After a sibling skill |
| 9 | `multi-turn` | ✓ | Mid-session continuation framing |

Produces **5 metrics**: eval pass rate (≥ 80%), trigger accuracy (≥ 85%), context footprint, project fit score (≥ 7/10), and resilience score (≥ 8/10 — adversarial correct non-trigger rate).

**Triggers:** "evaluate this skill", "run skill tests", "measure skill effectiveness"

#### `skill-refine`
Applies Karpathy's autoresearch loop to improve a skill that fails eval metrics. Routes by failing metric to one of 5 levers (description, checklist, examples, reference docs, scripts), mutates one lever per iteration, re-scores with `skill-eval-agent`, keeps or reverts. Low resilience score routes to Lever A (tighten trigger conditions). Runs up to 10 iterations autonomously.

**Triggers:** "refine this skill", "improve this skill", "run autoresearch on this skill"

---

### Agent Pipeline

#### `agent-scout`
Searches GitHub for Claude Code agent definitions (`.claude/agents/*.md`) matching a capability. Uses `ref_agents` from `evals/project-context.json` as a warm-start shortlist. Returns a ranked shortlist scored on role clarity, tool minimalism, model appropriateness, project fit, and provenance.

**Triggers:** "find an agent for X", "is there an agent that can Y", "source an agent"

#### `agent-audit`
Security gate for agent definitions. Checks tool escalation (agent requests more tools than its role warrants), unbounded recursion, prompt injection in the description/body, persona override patterns, and model override risks. Returns PASS / FLAG / BLOCK.

**Triggers:** "audit this agent", "check agent security", "scan this agent"

#### `agent-adapt`
Rewrites a PASS-audited agent definition to match the project's model tier preferences, tool scope, domain terminology, and color conventions. Writes the adapted agent to `.claude/agents/<name>.md` with a provenance metadata block.

**Triggers:** "adapt this agent", "customize this agent for my project", "install this agent"

---

## Agents

Runtime sub-agents that implement parallelizable or autonomous parts of the pipeline:

| Agent | Model | Role | Invoked by |
|---|---|---|---|
| `skill-scout-agent` | sonnet | Parallel registry + GitHub search | `skill-scout` |
| `skill-eval-agent` | sonnet | Parallel test scenario execution (up to 42 subagents) | `skill-eval`, `skill-refine` |
| `skill-refine-agent` | sonnet | Autoresearch loop orchestration | user / autoresearch loop |
| `skill-synthesizer-agent` | opus | Multi-candidate synthesis before adaptation | user (2+ PASS candidates) |
| `skill-needs-analysis-agent` | haiku | Gap analysis: maps stack + workflow_terms + mcp_servers to skill categories | user (after project-setup) |
| `skill-guardian` | sonnet | Full pipeline orchestration: context refresh → project-audit → 5-metric eval cycle → refinement | user (periodic health check) |

---

## `evals/project-context.json`

The shared data contract that connects every pipeline stage. Generated by `project-setup` (interview + auto-detection) or `node skills/skill-eval/scripts/extract-project-context.js` (script only).

| Field | Source | Used by |
|---|---|---|
| `project_name` | package.json / dir name | all stages |
| `stack` | package.json deps, pyproject.toml, manifests | skill-scout, skill-adapt, skill-needs-analysis |
| `workflow_terms` | CLAUDE.md (all-caps tokens) | skill-adapt, skill-eval (scenario 7) |
| `installed_skills` | `skills/` directory listing | skill-scout (conflict check), skill-needs-analysis |
| `key_phrases` | README.md, package.json description | skill-eval (scenario 7) |
| `artifact_paths` | CLAUDE.md, planning docs | skill-adapt |
| `hooks` | `.claude/settings.json` + `~/.claude/settings.json` | skill-adapt (avoid redundant steps) |
| `mcp_servers` | `.mcp.json` | skill-adapt, skill-needs-analysis |
| `plugins` | `~/.claude/settings.json:enabledPlugins` | skill-scout (conflict check), skill-needs-analysis |

---

## Directory Structure

```
skills/
  project-setup/     — project initialization (CLAUDE.md + project-context.json)
  project-audit/     — project-level security scan (ecc-agentshield wrapper)
  skill-scout/       — skill discovery
  skill-audit/       — skill content security gate
  skill-adapt/       — skill customization
  skill-eval/        — skill measurement (9 scenario types, 5 metrics)
  skill-refine/      — skill autoresearch loop
  agent-scout/       — agent discovery
  agent-audit/       — agent security gate
  agent-adapt/       — agent customization
.claude/agents/      — installed runtime sub-agents
evals/               — project context and eval artifacts (generated, gitignored)
docs/                — design specs and implementation plans
```

## Installation

```bash
./install.sh /path/to/target-project
```

## Removal

```bash
./uninstall.sh /path/to/target-project
```
