# Design: Domain Packs — governed, mountable knowledge + tools + guardrails

**Date:** 2026-07-17 · **Status:** implemented (Phase 1, contract-first) · **Pilot:** `packs/google-analytics/`

## Context

The project's north-star is a foundational substrate for a self-evolving AI OS whose agent teams
specialize by area. Those teams need mountable **domain expertise**: GoHighLevel, WordPress/Bricks,
Google Ads, GTM, Google Analytics, Meta Ads, and more. This spec defines the **domain-pack** subsystem
that carries that expertise, and delivers a working pilot.

### Settled constraints (from brainstorming)
- **Unit** = a domain pack = *knowledge + tools + guardrails*, a filesystem-as-registry folder
  (mounting a pack = mounting its folder; consistent with the adopted Eve pattern).
- **Ownership** = *hybrid*: authored/versioned/governed once in a shared registry, referenced/vendored
  per project — mirroring `reference-repositories/`.
- **Guardrails** = per-pack *execution_mode* tier: `read-only` · `hitl` · `staging-autonomous` · `mixed`
  (GA read-only; Google Ads/Meta HITL; WordPress staging).
- **Tenancy** = pack/client split, multi-client-ready from day one: pack = shared capability;
  `clients/<client>/` = per-tenant binding (context, budget caps, credential *references* — never secrets).

### Scope decision: contract-first (Approach 1)
Define the pack contract + shared-registry governance + one pilot. **Defer the execution runtime**
(tool invocation, credential vault, HITL pause/resume, staging enforcement, multi-pack composition,
graph retrieval) to the future Hermes orchestrator. Tool-defs are **declarative** in this phase.

## Architecture (as built)

### Pack anatomy
```
packs/<domain>/
├── pack.json               # manifest (schema: schemas/packs/pack-manifest.schema.json)
├── knowledge/*.md          # governed KB; brain-lint frontmatter (type/title/description/tags/timestamp/sources)
├── skills/<name>/SKILL.md  # domain skills — reuse the existing skill format
├── tools/*.tool.json       # DECLARATIVE tool specs (schema: schemas/packs/tool-def.schema.json)
├── guardrails/policy.json  # execution_mode + allow/deny effects + approval + budget caps + staging target
└── clients/                # per-tenant bindings (secret-free; credential references only)
```

### Governance (clones the reference-repo model)
- `packs/registry.json` + `packs/registry.md` (generated) — one row per pack.
- `scripts/packs/packs-lib.js` — paths, constants, registry load/save/render (mirrors `reference-lib.js`).
- `scripts/packs/pack-audit.js` — the gate. **Exit 3** on: `install_policy` ≠ `do-not-install-directly`,
  invalid/missing `execution_mode`, any executable/source file inside a pack (docs-only + declarative),
  committed secrets (reuses `brain-lib` `scanSensitive`), missing/mismatched `guardrails/policy.json`, or a
  `write`-effect tool inside a `read-only` pack. **Warnings (exit 0)**: stale `last_reviewed` (per-pack
  `review_cadence_days`), missing `review_owner`, knowledge docs missing frontmatter, registry/manifest drift.
  Appends a report to `.project-brain/reports/security/` when a capsule exists (fail-open).
- `scripts/packs/pack-audit.test.js` — clean-pass + one fixture per violation; auto-discovered by
  `scripts/run-all-tests.js`.

### Retrieval & sourcing
- Knowledge is governed Markdown, retrieved now via `brain-search`-style authority-ranked search. Multi-domain
  KB growth is the *measurable trigger* for the deferred retrieval upgrade (Graphify / Understand-Anything /
  PixelRAG) — noted, not built.
- **Acquisition principle (decided):** official APIs first (GA4 Data API, Google Ads API, Meta Marketing,
  Google Places, WordPress REST, GoHighLevel); `firecrawl` + sitemap/`llms.txt` for docs; NotebookLM/deep-research
  → `support/sources/` → compile → promote. Vetted scraper candidates (Crawl4AI, ScrapeGraphAI, agent-browser,
  claude-video, Agent-Reach clean lanes) are a governed **follow-on** via `reference-repo-add → audit`.
  **Excluded by default:** stealth/anti-bot tools (Camoufox) and ToS-violating scrapers (Google Maps) — use
  official APIs. **Out of scope:** OSINT/attack-surface tools (SpiderFoot/BBOT) — different domain, higher risk.

## Pilot: `google-analytics` (read-only)
Full pack: manifest, `guardrails/policy.json` (read-only), two declarative read tools
(`ga_run_report`, `ga_list_metadata`), a `ga-report` skill, `clients/`, a GA4 knowledge base, and a registry
entry. Proves the whole contract without touching money or production. `ga_run_report` operates on a
per-client `property_ref` handle resolved from `clients/<client>/` — never a raw credential.

## Deferred to Hermes (explicitly not built)
Tool execution runtime · credential vault + per-client runtime binding · HITL pause/resume wiring ·
WordPress staging enforcement · multi-pack composition + graph retrieval at team runtime.

## Verification
1. `node scripts/packs/pack-audit.js --name google-analytics` → exit 0.
2. `node scripts/packs/pack-audit.test.js` → clean pack passes; each violation (bad policy, secret,
   executable, write-in-read-only, missing/mismatched guardrails) exits 3.
3. Knowledge frontmatter conforms to the brain schema.
4. `node scripts/run-all-tests.js` stays green (new suite auto-included).

## Follow-on (separate tracks)
- Register + audit the vetted acquisition tools via the reference-repo pipeline.
- Draft the AI-OS **charter** candidate (this subsystem is one of its layers).
- When Hermes exists: build the deferred runtime; add the next packs (Google Ads = first HITL pack).
