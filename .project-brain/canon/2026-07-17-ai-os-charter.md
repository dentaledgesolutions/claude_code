---
type: charter
status: canon
title: "Charter — claude_code as the foundational substrate for a self-evolving AI operating system"
description: "The north-star: this project is the base layer of an AI OS that evolves by generating specialized, coordinating agent teams. Maps the existing layers to that goal, names the reality/target gap honestly, and records the load-bearing and deferred decisions and operating principles."
tags: [charter, vision, ai-os, agent-teams, governance, north-star, canon-candidate]
timestamp: 2026-07-17
sources: 
promoted_at: 2026-07-17
---

# Charter — `claude_code` as an AI-OS substrate

> **Status: candidate** (awaiting human promotion). This is a north-star, intended for `canon` via
> `brain-promote --approve --to canon`. Until promoted it is a candidate, not law.

## North-star

`claude_code` is the **foundational structure for a self-evolving AI operating system**. The system
grows by **generating teams of agents specialized in different areas** (marketing, analytics, web,
ads, …) that operate independently and **coordinate when a task spans areas**. The substrate's job is
to make new specialized capability **cheap to add, safe to run, and governed** — so scaling teams is a
matter of dropping in governed folders, not writing fragile runtime configuration.

## The layers already built toward it

The vision is the implicit telos of machinery that already exists (verified 2026-07-17):

| Layer of the OS | Implemented as |
|---|---|
| Generate specialized agents | agent pipeline: `agent-scout → agent-audit → agent-adapt → agent-eval → agent-refine` |
| Teams that coordinate | `team-eval` + `team.json` + the `repo-audit-ensemble` fixture (Dispatch-Chain Accuracy, Handoff Integrity) |
| Self-improvement / quality ratchet | `skill-guardian`, Karpathy autoresearch refine loops, telemetry `REFINE_RECOMMENDED` |
| OS-level persistent memory | the Second Brain capsule (`.project-brain/`) |
| Substrate to scale teams without fragile config | the Eve filesystem-as-registry decision (active) + the future Hermes orchestrator |
| Governed adoption of outside capability | the reference-repository library + `scout → audit → adapt → eval` |
| Mountable domain expertise for teams | the **domain-packs** subsystem (`packs/`) + the Google Analytics pilot |

## Reality vs. target (stated honestly)

**Today** this is a working **skill/agent quality pipeline + governed memory + one read-only domain
pack** — a strong foundation, not a running OS. **The target** is the self-evolving, team-spawning OS
above. The named gaps between them are the deferred decisions below. This charter is a *direction to
build toward*, not a claim of what already runs.

## Load-bearing decisions already made

- **Filesystem-as-registry (Eve pattern), pattern-only** — adopted for the future Hermes orchestrator;
  the current toolkit already embodies it (`skills/`, `.claude/agents/`, `hooks/`, `evals/`). *(active decision)*
- **Domain packs, contract-first** — knowledge + tools + guardrails, hybrid ownership (shared registry →
  per-project vendor), per-pack execution-mode tiers (read-only / HITL / staging-autonomous), multi-client
  pack/client split. Runtime deferred to Hermes. *(shipped Phase 1)*
- **Acquisition: official APIs first** — scrapers are a governed follow-on; stealth/ToS-evasion tools and
  OSINT/attack-surface tooling are excluded/out-of-scope. *(decided)*

## Deferred / open (the roadmap the gap implies)

- **Hermes** — the persistent background orchestrator that runs agents/teams and executes pack tools
  (credential vault, HITL pause/resume, staging enforcement). *Not yet started.*
- **Retrieval upgrade** — graph/FTS over a growing multi-domain KB; selection among Graphify /
  Understand-Anything / PixelRAG, deferred until *measurably* needed.
- **Central Operator Brain** — the cross-project/shared layer (domain packs and cross-project knowledge
  live here); currently the per-project capsule only. *Backlog.*
- **Next packs** — Google Ads (first HITL pack), Meta, WordPress/Bricks (staging), GTM, GoHighLevel.

## Operating principles (how the system is allowed to evolve)

1. **Governance-first:** external capability enters only through `scout → audit → adapt → eval`; never
   install directly from reference sources.
2. **Human-gated durability:** nothing reaches `canon/` or `decisions/active/` except via
   `brain-promote --approve`. Promotion is never autonomous.
3. **Filesystem-as-registry:** capability is added by dropping governed folders/files; discovery is
   dynamic; nothing is hardcoded.
4. **Memory authority ranking governs conflict:** `canon > active decision > validated lesson >
   synthesis > session note > raw source`; state conflicts before proceeding.
5. **Safety boundaries are non-negotiable:** no secrets in memory or packs; no stealth/ToS-evasion
   tooling; tiered guardrails on anything that touches live, money-spending, or client-facing systems.
6. **Measure before scaling infrastructure:** add heavier machinery (graph retrieval, new runtimes)
   only when a measurable need appears, not speculatively.

## Why record this

Every future decision should be judgeable against this north-star. Absent it, the layers read as
independent tools; with it, they are one coherent, self-evolving, governed agent OS.
