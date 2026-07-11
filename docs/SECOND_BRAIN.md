# Second Brain

A governed, Git-backed, Markdown-native operating memory for a project. It stops
sessions from losing hard-won knowledge: decisions, lessons, and canon travel with
the repo in a `.project-brain/` capsule, and every write to authoritative memory
passes an explicit human approval gate.

## Memory tiers (most ephemeral → most durable)

| Tier | Store | Scope | Governance |
|---|---|---|---|
| Session context | the conversation | current task | none — stays in session |
| Native auto-memory | `~/.claude/projects/<project>/memory/` | machine-local, personal | Claude-managed scratchpad |
| **Project Brain Capsule** | `.project-brain/` (git) | travels with the repo, shared | brain-kernel scripts + hooks + approval gates |
| Central Operator Brain | `~/DES/second-brain/` | cross-project | **deferred** (v1 backlog) |

The capsule and native auto-memory do not overlap: auto-memory is Claude's private
scratchpad; the capsule is the versioned record the team and future sessions rely on.

## Authority ranking

`canon > active decision > validated lesson > synthesis > session note > raw source`

Retrieval ranks by this authority first, then keyword overlap and recency. A session
note is a hint; canon is law. When memory conflicts with a task, the conflict is
stated before proceeding (the Second Brain Protocol, carried in each capsule's `BRAIN.md`).

## Lifecycle

`scratch → candidate → validated → canon_candidate → canon → retired/superseded`

Content is captured as scratch session notes, compiled into candidates, and only
promoted to `decisions/active/` or `canon/` through `brain-promote --approve`.

## The loop

```
capture ──▶ compile ──▶ (human review) ──▶ promote ──▶ retrieve
  │            │              │                │           │
sessions/   decisions/     brain-promote   decisions/   brain-search
daily/      candidates/    --approve       active/,     brain-context-pack
            lessons/       (the ONLY       canon/       SessionStart brain-load
            memories/      canon writer)
```

## What lives where (`.project-brain/`)

- `BRAIN.md` — status page + Second Brain Protocol (`@import`ed into CLAUDE.md)
- `MEMORY.md` — memory-routing rules · `index.md` — entry points · `log.md` — promotion log
- `context/` — stack/commands/conventions stubs + `brain-profile.json` (config)
- `sessions/daily/` — raw session logs (scratch; git-ignored by default)
- `decisions/{active,candidates,superseded}/` · `lessons/{memories,anti-patterns,skill-stubs}/`
- `canon/` — approved knowledge (written only by brain-promote --approve)
- `synthesis/` — extracted patterns · `support/` — raw sources · `reports/` — script output
- `reference-repositories/` — link to the governed external-source library

## Phase history

Built in seven gated phases (plans in `docs/superpowers/plans/2026-07-08-second-brain-phase1..7-*.md`,
sequencing in `…-ROADMAP.md`, design in `…/specs/2026-07-08-second-brain-capture-first-design.md`):

| Phase | Delivered |
|---|---|
| 1 Capture Core | template skeleton + 5 governance scripts (capture, compile, lint, promote, verify) |
| 2 Capture Hooks | 4 lifecycle hooks + self-install — the repo starts remembering |
| 3 Capture Skills | 6 natural-language skills over the capture loop |
| 4 Retrieval | authority-ranked search, context packs, SessionStart brain-load |
| 5 Installer | `install.sh --with-second-brain`, uninstall mirror, project-setup Q7 |
| 6 Reference Library | 16-entry governed source registry + audit/map/refresh tooling |
| 7 Bench + Docs | SecondBrainBench (five hard gates) + these docs |

## More

- Operator reference (every script/hook/skill): `docs/BRAIN_KERNEL.md`
- Security model: `docs/SECOND_BRAIN_SECURITY.md`
- Reference source governance: `docs/REFERENCE_REPOSITORY_LIBRARY.md`
- Install into a project: `./install.sh <target> --with-second-brain [--brain-mode <mode>]`
