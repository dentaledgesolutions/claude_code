---
name: eve
url: https://github.com/vercel/eve
owner: vercel
type: [methodology-source, agent-pattern-source, skill-pattern-source]
status: reference
trust_level: high-profile-vendor
install_policy: do-not-install-directly
last_reviewed: 2026-07-16
review_owner: erick
allowed_uses: [extract filesystem-as-registry pattern, analyze agent/tool/skill folder conventions, model evals-as-deploy-gate, inform the future Hermes orchestrator layout]
prohibited_uses: [direct install without audit, global install without approval, auto-update without approval, bypass skill-audit, bypass agent-audit, adopt the Eve runtime without a fresh audit]
---

# Source Summary
Vercel's open-source, filesystem-first framework for building durable AI agents (TypeScript/Node,
Claude-configurable, currently **beta**). Its governing principle is that a file's location determines
its function — adding a file under a conventional folder automatically registers a capability, so the
directory layout *is* the agent/tool/skill registry with no separate config.

# Why It Matters
It is the cleanest external validation of this project's own doctrine (skills as `skills/<name>/SKILL.md`
dirs, agents as `.claude/agents/*.md`, hooks, `evals/` gate, filesystem-native memory). It gives a named
vocabulary and folder convention to formalize for the planned **Hermes** orchestrator layer, so the
directory tree becomes the registry and teams scale without fragile runtime configuration.

# Reusable Patterns
- Filesystem-as-registry: conventional folders (`agent/{instructions.md, tools/, skills/, subagents/,
  channels/, hooks/, sandbox/, schedules/, connections/}`) auto-register capabilities; path → name.
- Convention over configuration: no imperative registration code; a discovery loader walks the tree.
- Evals-as-deploy-gate (seen in eve-analyst): an agent cannot ship on a red eval gate.
- Durable sessions (pause/resume incl. human approval) via the open-source Workflow SDK.
- Human-in-the-loop: pause-for-approval-then-resume as a first-class session state.
- Sandboxed execution with deny-all networking; subagents as team hierarchies.

# Candidate Skills
None to install directly. The *pattern* (a filesystem discovery loader for Hermes) is the reusable
artifact; any concrete skill would still require scout → audit → adapt → eval.

# Candidate Agents
None to install directly. `subagents/` as a folder-per-specialist convention is the reusable idea for
Hermes teams — a pattern, not an agent to import.

# Security / Governance Notes
BETA — API churn risk; poor footing for a long-lived orchestrator unless pinned/vendored. Runtime is
Vercel-ecosystem (Vercel Sandbox for code execution and managed durable execution are hosted services) —
self-hosting on a Hostinger VPS means substituting Docker/gVisor/Firecracker for the sandbox and a
Redis/SQLite-backed queue for durability. **Pattern-only adoption is the recorded decision; never adopt
the Eve runtime without a fresh audit; never install directly.**

# Adaptation Strategy
Extract the folder-convention + discovery-loader pattern into
`.project-brain/synthesis/eve-patterns/` (candidate) and apply it to the future Hermes layer; keep
Hermes as the orchestrator. See the synthesis candidate
`.project-brain/synthesis/eve-patterns/vercel-eve-fs-architecture-adoption.md`.

# Eval Ideas
- Discovery-loader scenario: dropping a new folder registers a tool with zero config changes.
- Deploy-gate scenario: a red `evals/` result blocks an agent deploy.
- HITL scenario: a tool pauses for approval and correctly resumes on grant / aborts on deny.
