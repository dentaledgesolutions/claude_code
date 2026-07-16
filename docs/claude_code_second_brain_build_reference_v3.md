# Claude Code Second Brain Build Reference v3

**Target project:** `dentaledgesolutions/claude_code` — Claude Code Skill & Agent Pipeline Toolkit  
**Repository:** https://github.com/dentaledgesolutions/claude_code  
**Generated for:** Erick Sicard / Dental Edge Solutions  
**Date:** 2026-06-26  
**Version:** v3 — Hybrid Brain Kernel + Measured GBrain Intelligence + Reference Repository Library

---

## 0. Executive Decision

The Second Brain for Claude Code should not be a passive note vault and should not be a single external memory service. It should be a **governed, Git-backed, Markdown-native operating memory system** that Claude Code can use to plan, build, audit, improve, and remember across projects.

The final architecture is:

```text
brain-kernel
  = required internal runtime, source-of-truth controller, governance layer, project brain installer,
    local search, context packer, session capture, linting, promotion workflow, and fallback retrieval.

GBrain + gbrain-evals
  = optional but strongly recommended advanced retrieval and measurement layer for serious use.
    GBrain retrieves/synthesizes/cites/gap-analyzes. gbrain-evals measures whether memory works.

Reference Repository Library
  = controlled source library for methodology, skills, agents, evals, architecture patterns, and future capability building.
    GStack belongs here as a methodology and skill-pattern reference, not as a direct runtime dependency.

Claude Code Skill & Agent Pipeline Toolkit
  = installer, auditor, evaluator, adapter, refiner, and governance pipeline for all Second Brain capabilities.
```

The key design principle:

```text
The Second Brain must work as plain Markdown + Git first.
Indexes, graph tools, GBrain, RAG systems, and MCP servers are accelerators, not the canonical source of truth.
```

The corrected hierarchy is:

```text
Level 1 — Required canonical brain
- Markdown/Git source of truth
- Central Operator Brain
- Project Brain Capsule
- brain-kernel
- hooks
- skill/agent governance
- session capture
- brain-lint
- canon promotion

Level 2 — Strongly recommended intelligence layer for serious use
- GBrain
- gbrain-evals
- custom SecondBrainBench

Level 3 — Reference/methodology layer
- GStack
- Infinite Brain OS
- Karpathy LLM Wiki
- Claude Memory Compiler
- aprende-skill
- Graphify
- RAG-Anything
- LightRAG
- Second Brain Starter
- AI Second Brain Drive Template
```

---

## 1. Source Registry

This section records every major source used to design the Second Brain. Claude Code should treat this registry as the durable map of the design inputs.

### 1.1 Official Claude Code documentation

| Source | URL | Role in this build |
|---|---|---|
| Claude Code Memory | https://docs.anthropic.com/en/docs/claude-code/memory | Defines `CLAUDE.md`, auto memory, `.claude/rules`, AGENTS.md import, memory scope, and the fact that memory is context, not enforcement. |
| Claude Code Skills | https://docs.anthropic.com/en/docs/claude-code/skills | Defines skills as reusable, context-loaded workflows with `SKILL.md` and supporting files. |
| Claude Code Hooks | https://docs.anthropic.com/en/docs/claude-code/hooks-guide | Defines lifecycle enforcement through hooks such as `PreToolUse`, `PostToolUse`, `SessionStart`, `PreCompact`, and `SessionEnd`. |
| Claude Code Subagents | https://docs.anthropic.com/en/docs/claude-code/sub-agents | Defines scoped specialist agents with isolated contexts and tool permissions. |

Critical interpretation:

```text
CLAUDE.md and auto memory guide Claude.
Hooks enforce behavior.
Skills contain repeatable workflows.
Subagents isolate specialist work.
```

Therefore:

```text
Second Brain governance must not rely only on CLAUDE.md.
It must use hooks, scripts, linting, explicit write policies, and human approval gates.
```

### 1.2 Project repository

| Source | URL | Role |
|---|---|---|
| Claude Code Skill & Agent Pipeline Toolkit | https://github.com/dentaledgesolutions/claude_code | Target implementation project. Existing pipeline for project setup, project audit, skill scout/audit/adapt/eval/refine, agent scout/audit/adapt. |

Core responsibility of this repo after v3:

```text
claude_code becomes the installer, auditor, evaluator, and lifecycle manager for:
- project brain capsules
- brain-kernel
- second-brain skills
- second-brain hooks
- reference repository library
- optional GBrain/GBrain-evals adapters
- GStack pattern ingestion
```

### 1.3 Core conceptual and architecture sources

| Source | URL | Role |
|---|---|---|
| Karpathy LLM Wiki | https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f | Core philosophy: raw sources → LLM-maintained Markdown wiki → schema. Introduces `index.md`, `log.md`, ingest/query/lint cycle. |
| Infinite Brain OS | https://github.com/starmynd-org/infinite-brain-os | Governance model: Git-backed knowledge OS, canon/synthesis/support separation, session discipline, validation, human approval. |
| Claude Memory Compiler | https://github.com/coleam00/claude-memory-compiler | Session capture and compiler pattern: hooks → daily logs → compiled concepts/connections/Q&A → index/log/lint. |
| Second Brain Starter | https://github.com/coleam00/second-brain-starter | PRD/onboarding, heartbeat, security-hook concepts, proactive assistant design. |
| aprende-skill | https://github.com/Hainrixz/aprende-skill | Human-confirmed correction learning, Reflexion-style lessons, bilingual `/aprende` workflow, skill stubs, project-doc updates. |
| AI Second Brain Drive Template | https://drive.google.com/drive/folders/1rYCx3McSR5muANNhna081hCJtKAYUKN1?usp=sharing | Human-facing workflow inspiration: brain setup interview, new project setup, weekly update, strategic planning, Obsidian vault pattern. |

### 1.4 Retrieval, graph, and document-processing sources

| Source | URL | Role |
|---|---|---|
| GBrain | https://github.com/garrytan/gbrain | Optional advanced retrieval/synthesis/graph/gap-analysis/MCP layer. |
| gbrain-evals | https://github.com/garrytan/gbrain-evals | Evaluation harness and benchmark philosophy for agent memory systems. Used to design `SecondBrainBench`. |
| Graphify | https://github.com/Graphify-Labs/graphify | Project/corpus graph compiler for repos, code, docs, PDFs, images, and diagrams. |
| RAG-Anything | https://github.com/hkuds/rag-anything | Specialized multimodal document RAG layer for PDFs, Office docs, charts, tables, images, equations. |
| LightRAG | https://github.com/hkuds/lightrag | Optional graph-RAG backend, especially useful as a foundation under RAG-Anything or for corpus-level RAG experiments. |

### 1.5 Methodology and skill-pattern sources

| Source | URL | Role |
|---|---|---|
| GStack | https://github.com/garrytan/gstack | Methodology and skill-pattern reference. Provides Think → Plan → Build → Review → Test → Ship → Reflect, virtual engineering team roles, sprint-stage handoff patterns, planning/review/QA/security/release/retro patterns. |

GStack must be stored in the Second Brain as a **reference repository**, not installed directly by default.

---

## 2. Core Doctrine

### 2.1 The Second Brain is not a notes folder

The Second Brain is a **Claude Code operating memory system**.

It must support:

```text
- durable cross-project knowledge
- project-specific context
- skill/agent/hook governance
- session capture
- verified lessons
- reference repository analysis
- canon/synthesis/support separation
- local retrieval
- advanced retrieval when available
- evaluation and regression testing
- controlled capability ingestion
```

### 2.2 Source of truth

```text
The source of truth is Markdown + Git.
The brain-kernel governs it.
GBrain may index it.
Graphify may map it.
RAG-Anything may extract from documents into it.
LightRAG may index corpora related to it.
Claude Code may act on it.
But none of those tools replace the Markdown/Git brain.
```

### 2.3 Canon rule

```text
No AI process may promote content to canon without explicit human approval.
```

### 2.4 External capability rule

```text
No external skill, agent, hook, plugin, MCP server, script, or command becomes active capability until it passes:
source review → security audit → project adaptation → eval → refinement if needed → user approval.
```

### 2.5 Reference repository rule

```text
Reference repositories are allowed as source material.
They are not trusted runtime dependencies.
They may inform methodology, skill design, agent design, eval design, security design, or architecture.
They may provide candidate skills or agents, but only through the claude_code pipeline.
```

---

## 3. Final Architecture

### 3.1 Overview

```text
Central Operator Brain
  - durable cross-project knowledge, methodology, canon, references, source analysis

Project Brain Capsule
  - project-specific context, decisions, sessions, lessons, reports, references

brain-kernel
  - internal default runtime for project brain setup, search, context packing, capture, compile, lint, promote

GBrain + gbrain-evals
  - optional advanced intelligence layer and evaluation harness

Reference Repository Library
  - controlled external source library for methodology/skills/agents/patterns

Claude Code Skill & Agent Pipeline Toolkit
  - installer, auditor, evaluator, adapter, refiner, and lifecycle manager
```

### 3.2 Brain layers

| Layer | Required? | Owner | Role |
|---|---:|---|---|
| Markdown/Git Brain | Yes | Human + Claude Code | Source of truth |
| brain-kernel | Yes | `dentaledgesolutions/claude_code` | Local runtime, governance, retrieval fallback |
| Claude Code hooks | Yes | `claude_code` | Enforcement and capture |
| Claude Code skills | Yes | `claude_code` | Workflows |
| Claude Code subagents | Yes | `claude_code` | Specialist tasks |
| Reference Repository Library | Yes | Central Brain | External methodology/capability source control |
| Graphify | Optional recommended | Project/corpus | Structural graph reports |
| GBrain | Optional recommended for serious use | Enhanced memory layer | Retrieval/synthesis/graph/gap analysis |
| gbrain-evals / SecondBrainBench | Required if GBrain used seriously | Evaluation layer | Memory quality/regression testing |
| RAG-Anything | Optional/lab | Document ingestion | Multimodal source extraction |
| LightRAG | Optional/lab | RAG backend | Corpus RAG / RAG-Anything foundation |

---

## 4. Central Operator Brain

### 4.1 Purpose

The Central Operator Brain stores durable, cross-project knowledge. It is not a dump of every project file. It stores:

```text
- approved architecture
- durable decisions
- operating rules
- methodology sources
- reference repository analysis
- skill/agent patterns
- cross-project lessons
- source registry
- strategic planning
- reusable workflows
```

### 4.2 Recommended path

```text
~/DES/second-brain/
```

### 4.3 Folder structure

```text
~/DES/second-brain/
  CLAUDE.md
  AGENTS.md
  MEMORY.md
  index.md
  log.md

  _system/
    brain-routing-rules.md
    canon-promotion-rules.md
    validation-rules.md
    security-rules.md
    reference-repository-rules.md
    project-brain-template.md
    page-types.md
    frontmatter-schema.md

  canon/
    architectures/
    decisions/
    operating-rules/
    approved-tools/
    approved-skills/
    approved-agents/
    approved-workflows/

  synthesis/
    repo-reviews/
    framework-comparisons/
    architecture-options/
    session-derived/
    skill-reviews/
    agent-reviews/
    reference-repo-patterns/

  support/
    sources/
    extracted/
    citations/
    graphify/
    rag-anything/
    lightrag/

  knowledge/
    claude-code/
    second-brain/
    brain-kernel/
    gbrain/
    gbrain-evals/
    gstack/
    gsd-core/
    graphify/
    rag-anything/
    lightrag/
    dental-marketing/
    google-ads/
    wordpress-stack/
    des-ads-intelligence-os/

  entities/
    tools/
    skills/
    agents/
    hooks/
    workflows/
    repos/
    projects/
    frameworks/

  workflows/
    ingest-source.md
    query-brain.md
    close-session.md
    promote-to-canon.md
    review-skill.md
    review-agent.md
    project-brain-setup.md
    reference-repo-add.md
    reference-repo-audit.md
    weekly-review.md

  reference-repositories/
    README.md
    registry.json
    registry.md
    sources/
      gstack/
      infinite-brain-os/
      gbrain/
      gbrain-evals/
      graphify/
      rag-anything/
      lightrag/
      claude-memory-compiler/
      aprende-skill/
      second-brain-starter/
      karpathy-llm-wiki/

  sessions/
    daily/
    active/
    closed/

  reports/
    brain-health/
    skill-health/
    agent-health/
    reference-repo-health/
```

---

## 5. Project Brain Capsule

### 5.1 Purpose

The Project Brain Capsule stores project-specific context. It should not contain all central knowledge. It should contain only what matters for the current repo/project.

For `dentaledgesolutions/claude_code`, the project brain should store:

```text
- project context
- skill pipeline decisions
- agent pipeline decisions
- session logs
- skill/agent audit reports
- brain-kernel implementation decisions
- GStack pattern extraction relevant to this repo
- GBrain adapter decisions
- SecondBrainBench reports
- Graphify reports
- security decisions
- implementation roadmap
```

### 5.2 Folder structure

```text
.project-brain/
  README.md
  BRAIN.md
  MEMORY.md
  index.md
  log.md

  context/
    project-context.json
    brain-profile.json
    stack.md
    commands.md
    conventions.md
    installed-skills.md
    installed-agents.md
    reference-repositories.md

  reference-repositories/
    registry.md
    selected-sources.md
    imported-patterns/
    candidate-skills/
    candidate-agents/
    eval-scenarios/

  sessions/
    daily/
    closed/

  decisions/
    active/
    superseded/
    candidates/

  lessons/
    memories/
    anti-patterns/
    skill-stubs/

  synthesis/
    skill-reviews/
    agent-reviews/
    repo-reviews/
    graph-reports/
    gstack-patterns/
    gbrain-eval-reports/
    brain-kernel-design/

  support/
    sources/
    extracted/

  reports/
    lint/
    graphify/
    skill-evals/
    agent-audits/
    brain-evals/
    security/
```

---

## 6. brain-kernel

### 6.1 Definition

`brain-kernel` is the internal default Second Brain runtime inside `dentaledgesolutions/claude_code`.

It provides:

```text
- project brain installation
- project brain templates
- local Markdown search
- context pack generation
- session capture
- session compilation
- brain linting
- canon candidate promotion workflow
- reference repository registration
- fallback retrieval when no GBrain is configured
```

### 6.2 Non-goals

`brain-kernel` should not try to fully recreate GBrain on day one.

It should not implement:

```text
- advanced vector retrieval by default
- hosted memory services
- remote MCP server by default
- autonomous canon promotion
- unbounded graph inference
```

### 6.3 Required skills

Create:

```text
skills/brain-kernel/
skills/second-brain-setup/
skills/project-brain-bootstrap/
skills/brain-first-lookup/
skills/brain-search/
skills/brain-context-pack/
skills/brain-capture/
skills/brain-compile/
skills/brain-lint/
skills/brain-promote/
skills/graphify-project/
skills/capture-learning/
skills/reference-repo-add/
skills/reference-repo-audit/
skills/reference-repo-map/
skills/reference-repo-pattern-extract/
skills/reference-repo-skill-scout/
skills/reference-repo-agent-scout/
skills/reference-repo-to-eval-scenarios/
skills/gstack-pattern-audit/
skills/gbrain-adapter-eval/
```

Each skill must include:

```text
- frontmatter
- description
- when to use
- inputs
- outputs
- files it may edit
- files it must not edit
- safety rules
- success criteria
- failure modes
- eval scenarios
```

### 6.4 Required scripts

Create:

```text
scripts/brain/
  brain-search.js
  brain-index.js
  brain-context-pack.js
  brain-capture.js
  brain-compile.js
  brain-lint.js
  brain-promote.js
  brain-verify.js
  brain-reference-repo-add.js
  brain-reference-repo-map.js
  brain-reference-repo-audit.js
  brain-reference-repo-refresh.js
  brain-cache-fts.py              # optional later
  secondbrainbench-run.js
  secondbrainbench-report.js
```

Script requirements:

```text
- deterministic
- no external network by default
- do not read `.env`, secrets, credentials, or sensitive folders
- refuse to overwrite user content unless `--force` is passed
- write reports to `.project-brain/reports/`
- exit nonzero for security failures
- fail open for non-security optional tasks
```

### 6.5 Required hooks

Create:

```text
hooks/brain/
  session-start.sh
  pre-compact.sh
  session-end.sh
  pre-tool-use-security.sh
  post-tool-use-brain-lint.sh
  post-tool-use-learning-signals.sh
  stop-suggest-learning.sh
```

Hook behavior:

```text
SessionStart
  - load MEMORY.md
  - load .project-brain/BRAIN.md
  - load .project-brain/context/project-context.json
  - load .project-brain/context/brain-profile.json
  - optionally call GBrain adapter if enabled
  - remind Claude of routing rules

PreCompact
  - capture important context before compaction
  - append to .project-brain/sessions/daily/YYYY-MM-DD.md

SessionEnd
  - extract decisions, lessons, commands, failures, changed files, open questions
  - suggest canon candidates
  - do not promote canon

PreToolUse
  - block secret access
  - block destructive commands
  - block direct canon edits without explicit approval
  - block external skill/agent install unless audited

PostToolUse
  - run brain-lint after memory changes
  - record repeated tool failures
  - detect aprende-style learning signals

Stop
  - suggest capture-learning if mistakes, decisions, or reusable lessons appeared
```

---

## 7. Retrieval Architecture

### 7.1 Retrieval modes

```text
lightweight
  - Markdown files
  - MEMORY.md
  - index.md
  - log.md
  - brain-search.js

standard
  - lightweight +
  - session capture
  - brain-compile
  - brain-lint
  - reference repository library
  - local context packs

enhanced-with-gbrain
  - standard +
  - GBrain adapter
  - gbrain-evals / SecondBrainBench

enhanced-with-graphify
  - standard +
  - Graphify project reports

lab-multimodal
  - standard +
  - RAG-Anything / LightRAG for specific document corpora
```

Default for new projects:

```text
standard
```

Default for the central brain once stable:

```text
enhanced-with-gbrain
```

### 7.2 brain-kernel retrieval

`brain-search.js` should:

```text
- scan Markdown and JSON files in `.project-brain/`
- optionally scan central brain paths
- parse YAML frontmatter
- parse headings
- index title, path, tags, aliases, body, authority, last_reviewed
- rank results by:
  - task-intent match
  - keyword overlap
  - path/type match
  - authority level
  - recency
  - prior usefulness
  - sensitivity/scope penalties
```

Authority ranking:

```text
canon > active decision > validated lesson > synthesis > session note > raw source > inferred note
```

### 7.3 context pack

`brain-context-pack.js` should output:

```json
{
  "task_intent": "skill evaluation",
  "project": "claude_code",
  "retrieval_mode": "standard",
  "relevant_canon": [],
  "relevant_decisions": [],
  "relevant_lessons": [],
  "relevant_skills": [],
  "relevant_agents": [],
  "relevant_reports": [],
  "reference_sources": [],
  "excluded_context": [],
  "gaps": [],
  "warnings": []
}
```

### 7.4 GBrain adapter

GBrain should be enabled only when:

```text
- brain_mode includes `gbrain`
- GBrain is installed
- source paths are approved
- sensitive folders are excluded
- gbrain-evals / SecondBrainBench is configured for regression testing
```

GBrain must index the Markdown/Git brain. It must not become the source of truth.

Correct rule:

```text
brain-kernel writes and governs memory.
GBrain retrieves and synthesizes memory.
gbrain-evals proves whether retrieval is working.
```

---

## 8. gbrain-evals and SecondBrainBench

### 8.1 Purpose

The memory system should be measured.

`SecondBrainBench` is the project-specific evaluation suite inspired by gbrain-evals.

It should test:

```text
- project decision retrieval
- skill/agent relevance retrieval
- canon vs synthesis precedence
- anti-pattern lesson retrieval
- security rule retrieval
- stale decision detection
- contradiction detection
- source citation accuracy
- identity resolution
- time-aware retrieval
- reference repository pattern retrieval
- Graphify/RAG/GStack/GBrain policy retrieval
```

### 8.2 Adapters

Create:

```text
evals/brain/
  secondbrainbench/
    datasets/
    questions/
    answers/
    adapters/
      brain-kernel-adapter.js
      gbrain-adapter.js
      hybrid-adapter.js
    reports/
```

Adapters:

```text
brain-kernel-adapter
  - tests internal Markdown search and context pack

gbrain-adapter
  - tests GBrain retrieval

hybrid-adapter
  - tests brain-kernel first, GBrain second
```

### 8.3 Required metrics

```text
Recall@5
Precision@5
Citation accuracy
Canon precedence accuracy
Contradiction detection
Staleness detection
Sensitive data exclusion
Latency
Context footprint
Regression status
```

### 8.4 Pass gates

Minimum suggested gates:

```text
Recall@5 >= 90% for core project decisions
Precision@5 >= 45% for broad architecture queries
Citation accuracy >= 90%
Sensitive data leakage = 0
Canon precedence failures = 0
```

---

## 9. Reference Repository Library

### 9.1 Purpose

The Reference Repository Library stores external repositories as **source material**, not active capabilities.

It supports:

```text
- methodology extraction
- skill pattern extraction
- agent role extraction
- candidate skill scouting
- candidate agent scouting
- eval scenario generation
- implementation inspiration
- risk tracking
```

### 9.2 Central folder

```text
reference-repositories/
  README.md
  registry.json
  registry.md
  sources/
    gstack/
    gbrain/
    gbrain-evals/
    infinite-brain-os/
    karpathy-llm-wiki/
    claude-memory-compiler/
    aprende-skill/
    graphify/
    rag-anything/
    lightrag/
    second-brain-starter/
```

### 9.3 Project folder

```text
.project-brain/reference-repositories/
  registry.md
  selected-sources.md
  imported-patterns/
  candidate-skills/
  candidate-agents/
  eval-scenarios/
```

### 9.4 Reference repo source-card template

```markdown
---
name:
url:
owner:
type:
  - methodology-source
  - skill-pattern-source
  - agent-pattern-source
  - candidate-skill-source
status: reference
trust_level:
install_policy: do-not-install-directly
last_reviewed:
review_owner:
allowed_uses:
  - extract methodology
  - analyze skill design
  - analyze agent roles
  - generate eval scenarios
  - source candidate skills for audit
prohibited_uses:
  - direct install without audit
  - global install without approval
  - auto-update without approval
  - bypass skill-audit
  - bypass agent-audit
---

# Source Summary

# Why It Matters

# Reusable Patterns

# Candidate Skills

# Candidate Agents

# Security / Governance Notes

# Adaptation Strategy

# Eval Ideas
```

### 9.5 Registry schema

```json
{
  "repositories": [
    {
      "name": "gstack",
      "url": "https://github.com/garrytan/gstack",
      "status": "reference",
      "types": [
        "methodology-source",
        "skill-pattern-source",
        "agent-pattern-source",
        "candidate-skill-source"
      ],
      "install_policy": "do-not-install-directly",
      "last_reviewed": "2026-06-26",
      "preferred_use": [
        "extract sprint methodology",
        "analyze skill patterns",
        "source candidate skills through audit pipeline",
        "generate eval scenarios"
      ],
      "risk_notes": [
        "large opinionated skill bundle",
        "global install instructions",
        "team-mode auto-update behavior",
        "must not bypass claude_code audit/eval pipeline"
      ]
    }
  ]
}
```

---

## 10. GStack Integration

### 10.1 Decision

GStack should be included as:

```text
methodology-source
skill-pattern-source
agent-pattern-source
candidate-skill-source
eval-scenario-source
```

GStack should not be installed directly by default.

### 10.2 Extracted methodology

Core loop:

```text
Think → Plan → Build → Review → Test → Ship → Reflect
```

Map to Second Brain:

```text
Think
  - office-hours
  - strategic moves
  - project scoping

Plan
  - plan reviews
  - architecture review
  - implementation strategy

Build
  - GSD/Core project execution
  - Claude Code implementation sessions

Review
  - CEO, engineering, design, DevEx, staff engineer review

Test
  - QA, evals, browser tests, regression tests

Ship
  - release readiness, changelog, deployment checks

Reflect
  - retrospectives, lessons, canon candidates, brain-lint
```

### 10.3 GStack folder

```text
reference-repositories/sources/gstack/
  source-card.md
  repo-snapshot.json
  methodology-map.md
  skill-candidate-map.md
  agent-role-map.md
  install-risk-analysis.md
  adaptation-plan.md
  eval-scenarios.md

  extracted-patterns/
    think-plan-build-review-test-ship-reflect.md
    office-hours.md
    plan-ceo-review.md
    plan-eng-review.md
    plan-design-review.md
    plan-devex-review.md
    review.md
    qa.md
    ship.md
    retro.md
    cso.md
```

### 10.4 GStack influence on `claude_code`

Add to `skill-eval`:

```text
handoff scenario
  - Did this skill produce an artifact that the next skill can consume?

sprint-stage scenario
  - Did this skill behave correctly in Think, Plan, Build, Review, Test, Ship, or Reflect?

scope-control scenario
  - Did the skill challenge unnecessary scope before implementation?

review-chain scenario
  - Did a review skill inspect artifacts from planning and implementation?

retro-learning scenario
  - Did the skill convert outcomes into lessons or canon candidates?
```

Add to `agent-scout` taxonomy:

```text
strategic-review-agent
architecture-review-agent
design-review-agent
devex-review-agent
security-review-agent
qa-review-agent
release-review-agent
docs-review-agent
retro-agent
debug-investigation-agent
```

---

## 11. Learning and Improvement Loop

### 11.1 Core loop

```text
Claude Code interaction
  ↓
Session hooks capture what happened
  ↓
brain-capture writes daily log
  ↓
brain-compile extracts decisions, lessons, patterns, gaps
  ↓
capture-learning confirms durable lessons
  ↓
brain-lint checks quality
  ↓
skill-eval / agent-audit measures behavior
  ↓
skill-refine / agent-adapt improves capability
  ↓
brain-context-pack retrieves better context next time
  ↓
SecondBrainBench measures retrieval quality
```

### 11.2 Captured item types

```text
fact
decision
lesson
anti-pattern
workflow
skill improvement
agent improvement
tool configuration
security rule
source summary
reference repository pattern
contradiction
open question
canon candidate
```

### 11.3 Quality score

```text
Knowledge Quality Score =
  25% source support
+ 20% actionability
+ 15% specificity
+ 15% recency / last validated date
+ 10% reuse frequency
+ 10% contradiction status
+ 5% security/sensitivity cleanliness
```

### 11.4 Lifecycle states

```text
scratch
candidate
validated
canon_candidate
canon
retired
superseded
```

---

## 12. Security Policy

### 12.1 Non-negotiable exclusions

Never store in the brain:

```text
.env
.env.*
API keys
OAuth tokens
SSH keys
private keys
passwords
patient data
client-private data
bank documents
legal strategy
insurance details
PHI
PII unless explicitly approved
```

### 12.2 Sensitive paths

Default sensitive paths:

```text
.env
.env.*
secrets/
credentials/
private/
legal-sensitive/
client-sensitive/
patient/
financial/
*.key
*.pem
*token*
*api-key*
```

### 12.3 Hook enforcement

`pre-tool-use-security.sh` must block:

```text
- reading sensitive paths
- writing secrets into memory
- direct canon edits
- destructive shell commands
- external sending/posting without approval
- installing skills/agents/plugins from reference repos without audit
```

### 12.4 Canon protection

Only `brain-promote` can write to canon locations, and only after explicit user approval.

---

## 13. Graphify Policy

Graphify is a project/corpus graph compiler.

Use for:

```text
- repo structure understanding
- codebase mapping
- docs/corpus relationships
- Graph reports for Claude Code orientation
```

Do not use for:

```text
- secrets
- patient data
- legal/financial/client-sensitive folders
- direct canon writing
```

Store output:

```text
.project-brain/reports/graphify/
.project-brain/synthesis/graph-reports/
```

---

## 14. RAG-Anything / LightRAG Policy

RAG-Anything and LightRAG are lab/specialized systems, not default Second Brain runtime.

Use RAG-Anything for:

```text
- PDFs
- Office documents
- screenshots
- tables
- charts
- equations
- visual reports
```

Use LightRAG for:

```text
- controlled graph-RAG experiments
- large corpus RAG
- RAG-Anything backend
```

Do not process sensitive documents without redaction and approval.

---

## 15. Claude Code Implementation Plan

### Phase 1 — Add templates

Create:

```text
templates/second-brain/
  CLAUDE.second-brain.md
  AGENTS.second-brain.md
  MEMORY.md
  BRAIN.md
  README.md
  project-context.schema.json
  brain-profile.schema.json
  reference-repo.schema.json
  settings.second-brain.json

  project-brain/
    index.md
    log.md
    context/
      stack.md
      commands.md
      conventions.md
      installed-skills.md
      installed-agents.md
      reference-repositories.md
    sessions/
      daily/.gitkeep
      closed/.gitkeep
    decisions/
      active/.gitkeep
      superseded/.gitkeep
      candidates/.gitkeep
    lessons/
      memories/.gitkeep
      anti-patterns/.gitkeep
      skill-stubs/.gitkeep
    synthesis/
      skill-reviews/.gitkeep
      agent-reviews/.gitkeep
      repo-reviews/.gitkeep
      graph-reports/.gitkeep
      gstack-patterns/.gitkeep
      gbrain-eval-reports/.gitkeep
      brain-kernel-design/.gitkeep
    support/
      sources/.gitkeep
      extracted/.gitkeep
    reference-repositories/
      registry.md
      selected-sources.md
      imported-patterns/.gitkeep
      candidate-skills/.gitkeep
      candidate-agents/.gitkeep
      eval-scenarios/.gitkeep
    reports/
      lint/.gitkeep
      graphify/.gitkeep
      skill-evals/.gitkeep
      agent-audits/.gitkeep
      brain-evals/.gitkeep
      security/.gitkeep
```

### Phase 2 — Add brain-kernel skills

Create all skills listed in Section 6.3.

### Phase 3 — Add brain scripts

Create all scripts listed in Section 6.4.

### Phase 4 — Add hooks

Create all hooks listed in Section 6.5.

### Phase 5 — Extend install.sh

Add support:

```bash
./install.sh --with-second-brain
./install.sh --target /path/to/project --with-second-brain
./install.sh --target /path/to/project --with-second-brain --brain-mode standard
./install.sh --target /path/to/project --with-second-brain --brain-mode enhanced-with-gbrain
./install.sh --target /path/to/project --with-second-brain --with-reference-repos
./install.sh --target /path/to/project --with-second-brain --reference-repo https://github.com/garrytan/gstack
```

When `--with-second-brain` is used:

```text
- install existing skills
- install existing agents
- create .project-brain/
- append Second Brain Protocol to CLAUDE.md
- append compatible section to AGENTS.md
- create MEMORY.md if missing
- merge hook settings into .claude/settings.json
- create project-context.json
- create brain-profile.json
- create reference repository registry
- run brain-verify.js
```

### Phase 6 — Extend project-setup

`project-setup` must ask:

```text
Should this project use a Second Brain?
- none
- lightweight
- standard
- enhanced-with-gbrain
- enhanced-with-graphify
- lab-multimodal
```

Default:

```text
standard
```

It must also ask:

```text
Should this project use reference repositories?
If yes, which sources?
Default suggestions:
- GStack for methodology/skill patterns
- Infinite Brain OS for governance
- Claude Memory Compiler for session memory
- aprende-skill for correction learning
```

### Phase 7 — Add evals

Create evals for:

```text
brain-first lookup
brain-search
brain-context-pack
brain-lint
brain-promote
reference-repo-add
reference-repo-audit
gstack-pattern-audit
gbrain-adapter-eval
```

Scenarios:

```text
direct invocation
paraphrased invocation
negative test
adversarial canon write
missing project-context.json
missing brain-profile.json
reference repo direct-install attempt
GStack candidate skill bypass attempt
sensitive path retrieval attempt
brain-kernel vs GBrain retrieval comparison
```

### Phase 8 — Add docs

Create:

```text
docs/SECOND_BRAIN.md
docs/SECOND_BRAIN_PIPELINE.md
docs/PROJECT_BRAIN_TEMPLATE.md
docs/SECOND_BRAIN_SECURITY.md
docs/BRAIN_KERNEL.md
docs/GBRAIN_OPTIONAL_ADAPTER.md
docs/SECOND_BRAIN_EVALS.md
docs/REFERENCE_REPOSITORY_LIBRARY.md
docs/GSTACK_INTEGRATION.md
```

Update `README.md`.

---

## 16. Exact CLAUDE.md Section

Append to project `CLAUDE.md`:

```markdown
## Second Brain Protocol

This project uses a project-local Second Brain capsule at `.project-brain/`.

Before making architecture, workflow, skill, agent, hook, or project-governance decisions:

1. Read `.project-brain/BRAIN.md`.
2. Read `.project-brain/MEMORY.md`.
3. Check `.project-brain/index.md`.
4. Check `.project-brain/context/project-context.json`.
5. Check `.project-brain/context/brain-profile.json`.
6. Use `brain-context-pack` for relevant context.
7. Use GBrain only if `brain-profile.json` enables it.
8. Prefer existing decisions over new assumptions.
9. If memory conflicts with the task, state the conflict before proceeding.

### Memory routing

- Durable project knowledge goes in `.project-brain/`.
- Cross-project knowledge belongs in the Central Operator Brain.
- Current task context stays in the active session.
- Repeated corrections become lessons through `capture-learning`.
- Canon requires explicit user approval.
- Reference repositories are source material, not runtime capability.

### Hard rules

- Do not write to `canon/` or approved operating rules without explicit approval.
- Do not store secrets, credentials, tokens, client-private data, patient data, or legal-sensitive content in memory.
- Do not install external skills or agents unless they pass scout → audit → adapt → eval → refine.
- Do not install directly from reference repositories.
- Do not run Graphify, RAG-Anything, or LightRAG on sensitive folders unless explicitly approved.
```

---

## 17. brain-profile.json

```json
{
  "project_name": "",
  "project_slug": "",
  "central_brain_path": "~/DES/second-brain",
  "project_brain_path": ".project-brain",
  "brain_mode": "standard",
  "brain_kernel_enabled": true,
  "gbrain_enabled": false,
  "gbrain_evals_enabled": false,
  "graphify_enabled": false,
  "rag_anything_enabled": false,
  "lightrag_enabled": false,
  "reference_repositories_enabled": true,
  "canon_requires_approval": true,
  "sensitive_paths": [
    ".env",
    ".env.*",
    "secrets/",
    "credentials/",
    "private/",
    "legal-sensitive/",
    "client-sensitive/",
    "patient/",
    "financial/"
  ],
  "reference_repository_policy": {
    "allow_direct_install": false,
    "require_audit_before_use": true,
    "require_adaptation_before_project_install": true,
    "require_eval_before_activation": true,
    "store_patterns_as_synthesis": true,
    "canon_requires_human_approval": true
  },
  "memory_routing": {
    "project_knowledge": ".project-brain/",
    "cross_project_knowledge": "central_operator_brain",
    "operational_rules": "CLAUDE.md and MEMORY.md",
    "current_task": "session_context"
  },
  "required_hooks": [
    "SessionStart",
    "PreCompact",
    "SessionEnd",
    "PreToolUse",
    "PostToolUse",
    "Stop"
  ],
  "created_at": "",
  "last_brain_lint": "",
  "last_graphify_run": "",
  "last_memory_compile": "",
  "last_brain_eval": ""
}
```

---

## 18. Implementation Prompt for Claude Code

Paste into Claude Code inside `dentaledgesolutions/claude_code`:

```text
You are working in the dentaledgesolutions/claude_code repository.

Goal:
Implement Second Brain Build Reference v3.

Core decision:
brain-kernel is required and internal.
GBrain is optional enhanced retrieval and synthesis.
gbrain-evals inspires and optionally powers SecondBrainBench.
Reference Repository Library is required.
GStack is a reference repository, not a direct install.

Do not replace the existing skill/agent pipeline.
Extend it.

Implement phases:

1. Add templates/second-brain/
2. Add brain-kernel skills
3. Add brain scripts
4. Add brain hooks
5. Extend install.sh
6. Extend project-setup
7. Add reference repository library
8. Add GStack pattern audit
9. Add optional GBrain adapter and SecondBrainBench
10. Add docs
11. Add evals
12. Run verification

Hard rules:
- Do not store secrets.
- Do not directly install from reference repositories.
- Do not promote canon without approval.
- Do not let GBrain become source of truth.
- Keep Markdown/Git brain canonical.
- Every external skill/agent must pass scout → audit → adapt → eval → refine → approve.

Output:
- files created/modified
- tests/evals run
- security findings
- unresolved risks
- next commit message
```

---

## 19. Final Build Order

```text
1. Implement project brain templates.
2. Implement brain-profile.json and project-context.json.
3. Implement brain-search and brain-context-pack.
4. Implement hooks for capture/security.
5. Implement brain-lint.
6. Implement brain-promote.
7. Add reference repository library.
8. Add GStack as first reference repository.
9. Add gstack-pattern-audit.
10. Add SecondBrainBench minimal harness.
11. Add optional GBrain adapter.
12. Add Graphify policy and skill.
13. Add RAG-Anything / LightRAG lab policy.
14. Extend install.sh.
15. Extend project-setup.
16. Add docs and evals.
17. Run end-to-end install into claude_code itself.
18. Run install into a dummy project.
19. Fix issues.
20. Promote stable decisions to canon after approval.
```

---

## 20. Final Recommendation

The final Second Brain for Claude Code should be:

```text
brain-kernel-first
GBrain-measured-when-needed
GStack-informed
reference-repository-driven
Claude-Code-native
Markdown/Git-governed
skill/agent-pipeline-controlled
```

The single most important architectural rule:

```text
The Second Brain owns memory and governance.
Reference repositories provide patterns.
The claude_code pipeline decides what becomes active capability.
GBrain retrieves and synthesizes only after the brain exists.
gbrain-evals proves whether retrieval can be trusted.
```

This is the version Claude Code should implement.
