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
