# Claude Code Skill & Agent Pipeline Toolkit

Infrastructure for finding, vetting, customizing, and evaluating Claude Code skills and agents. Run `/project-setup` once to configure your project, then use the pipeline to source and install capabilities from the ecosystem rather than building from scratch.

## Pipeline Overview

```
project-setup
     │
     ├── Skill pipeline ──────────────────────────────────────────────────────┐
     │   skill-scout → skill-audit → skill-adapt → skill-eval → skill-refine  │
     │                                    │                                    │
     │                    (missing agent dependency detected)                  │
     │                                    ↓                                   │
     └── Agent pipeline ────────────────────────────────────────────────────── ┘
         agent-scout → agent-audit → agent-adapt
```

`project-setup` feeds both pipelines via `evals/project-context.json` and optionally seeds them with signals from up to 3 GitHub reference repos.

---

## Skills

### `project-setup`
Guided interview that produces `CLAUDE.md` and `evals/project-context.json`. Optionally fetches conventions, stack, commands, rules, directories, and skill/agent names from up to 3 GitHub reference repos before the interview begins. The output powers the rest of the pipeline.

**Triggers:** "set up my project for Claude Code", "my project-context.json is empty", "help me configure CLAUDE.md"

---

### Skill Pipeline

#### `skill-scout`
Searches GitHub and known registries for existing skills that match a capability. Returns a ranked shortlist scored on trigger precision, instruction clarity, context footprint, project fit, provenance, and conflict risk. Hands off to `skill-audit`.

**Triggers:** "find a skill for X", "is there a skill that can Y", "source a skill"

#### `skill-audit`
Security gate. Scans a sourced skill for prompt injection, malicious scripts, permission escalation, and supply chain risks. Returns PASS / FLAG / BLOCK before anything is installed.

**Triggers:** "audit this skill", "check skill security", "scan this skill from GitHub"

#### `skill-adapt`
Rewrites a PASS-audited skill to match the project's terminology, workflow gates, and installed skill ecosystem. Detects agent dependencies in the adapted skill and warns if any are missing from `.claude/agents/` — the handoff point into the agent pipeline.

**Triggers:** "adapt this skill", "customize this skill for my project", "install this skill"

#### `skill-eval`
Measures an adapted skill's effectiveness using structured test scenarios and LLM-judge scoring. Produces four metrics: eval pass rate, trigger accuracy, context footprint, and project fit score.

**Triggers:** "evaluate this skill", "run skill tests", "measure skill effectiveness"

#### `skill-refine`
Applies Karpathy's autoresearch loop to improve a skill that fails eval metrics. Routes by failing metric, mutates one lever per iteration, re-scores with `skill-eval-agent`, keeps or reverts. Runs up to 10 iterations autonomously.

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

Runtime sub-agents that implement parallelizable parts of the skill pipeline:

| Agent | Role | Invoked by |
|---|---|---|
| `skill-scout-agent` | Parallel registry and GitHub search | `skill-scout` |
| `skill-eval-agent` | Parallel test scenario execution (up to 42 subagents) | `skill-eval`, `skill-refine` |
| `skill-refine-agent` | Autoresearch loop orchestration | user / autoresearch loop |
| `skill-synthesizer-agent` | Multi-candidate synthesis before adaptation | user (2+ PASS candidates) |
| `skill-needs-analysis-agent` | Gap analysis; produces prioritized skill shortlist | user (after project-setup) |
| `skill-guardian` | Project-wide skill health audit and repair | user (periodic) |

---

## Directory Structure

```
skills/
  project-setup/     — project initialization (CLAUDE.md + project-context.json)
  skill-scout/       — skill discovery
  skill-audit/       — skill security gate
  skill-adapt/       — skill customization
  skill-eval/        — skill measurement
  skill-refine/      — skill autoresearch loop
  agent-scout/       — agent discovery
  agent-audit/       — agent security gate
  agent-adapt/       — agent customization
.claude/agents/      — installed runtime sub-agents
evals/               — project context and eval artifacts (generated)
docs/                — design specs and implementation plans
```

## Installation

```bash
./install.sh
```

## Removal

```bash
./uninstall.sh
```
