---
name: eve-analyst
url: https://github.com/coleam00/eve-analyst
owner: coleam00
type: [agent-pattern-source, eval-scenario-source, skill-pattern-source]
status: reference
trust_level: community
install_policy: do-not-install-directly
last_reviewed: 2026-07-16
review_owner: erick
allowed_uses: [study a production-shaped Eve agent layout, model evals-as-deploy-gate, borrow read-only-guard and deny-all-sandbox and HITL patterns]
prohibited_uses: [direct install without audit, global install without approval, auto-update without approval, bypass skill-audit, bypass agent-audit, copy code without verifying against upstream]
---

# Source Summary
A third-party (coleam00 / Cole Medin) reference implementation of a production-shaped **data-analyst
agent built on Vercel's Eve** framework. TypeScript + JavaScript, Node 24+, pnpm. It concretely
demonstrates Eve's filesystem-first layout at production shape: `agent/` (agent.ts, instructions.md,
tools/, skills/, subagents/investigator/, channels/), an `evals/` suite used as a **deploy gate**, and a
`lib/` with a read-only SQL guard and sandbox helper.

# Why It Matters
It shows what "good" looks like when the folder-as-registry pattern is taken to production — the exact
shape the future Hermes orchestrator can imitate. Notably it pairs the pattern with governance controls
this project already values: an eval gate before deploy, a read-only execution guard, and deny-all
sandbox networking.

# Reusable Patterns
- Concrete Eve folder layout for one real agent (tools/, skills/, subagents/, channels/, lib/).
- `evals/` as a hard deploy gate (mirrors this repo's SKILL-EVAL / run-manifest discipline).
- Read-only guard (`sql-guard.ts`) — blocks non-SELECT; a template for tool-level allow-listing.
- Sandbox isolation running Python with `networkPolicy: "deny-all"`.
- Human-in-the-loop approval pausing expensive operations, then durable resume.
- Subagent (`investigator/`) that runs autonomously without approval prompts.

# Candidate Skills
None to install directly. The read-only-guard and deny-all-sandbox techniques are patterns to re-implement
for Hermes, subject to scout → audit → adapt → eval.

# Candidate Agents
None to install directly. The `subagents/investigator/` shape is a reference for a Hermes specialist,
not an agent to import.

# Security / Governance Notes
Third-party repo built on **beta** Eve — treat as read-only pattern reference; verify any borrowed code
against upstream before use. Its own security controls (read-only guard, deny-all sandbox, eval gate) are
worth emulating. Never install directly.

# Adaptation Strategy
Use as the concrete companion to the `eve` methodology card when designing the Hermes layout and its
guard/sandbox/eval-gate substitutes. Feeds the same synthesis candidate at
`.project-brain/synthesis/eve-patterns/vercel-eve-fs-architecture-adoption.md`.

# Eval Ideas
- Guard scenario: a non-SELECT / disallowed operation is blocked before execution.
- Deny-all-network scenario: sandboxed code cannot reach the network.
- Deploy-gate scenario: a failing eval blocks the agent from shipping.
