# Second Brain — Execution Roadmap

**Repo:** dentaledgesolutions/claude_code | **Created:** 2026-07-08
**Spec:** `docs/superpowers/specs/2026-07-08-second-brain-capture-first-design.md`
**Mode:** AUTO — all seven phases run continuously; implementation subagents on Sonnet 5;
the orchestrating session verifies acceptance and commits. Stops only on unresolvable
acceptance failure, the `brain-promote --approve` human gate, or shared-file conflicts.

## Current status

> **Phase 1 — Capture Core: COMPLETE** (27047ff..bd08f0a, 2026-07-09) — 5/5 acceptance criteria pass, 6/6 test suites green, whole-branch security review findings fixed and re-verified.
> **Phase 2 — Capture Hooks + Self-install: COMPLETE** (5153200..cfadbbb, 2026-07-09) — repo is remembering things: 4 hooks + self-install live, security guard hardened past 2 review-found bypasses, live smoke green, 16/16 suites.
> **Phase 3 — Capture Skills (6): SKILLS SHIPPED, eval gate DEFERRED** (41e3ab6, 2026-07-10) — 6 SKILL.md built/deployed/committed, seed evals generated. Formal skill-eval-agent metric gate NOT met this session (session limits killed the eval agents; auto-scenarios miscalibrated to skill-scout). Follow-up: retarget scenarios + re-run eval/refine after limits reset. Skills usable now; thresholds unmeasured.
> **Phase 4 — Retrieval: COMPLETE** (7bab7ab..b6028be, 2026-07-10) — authority-ranked search, §7.3 context packs, SessionStart brain-load (~347 tokens). 10/10 suites green; guard false-positive on canon reads fixed.
> **Phase 5 — install.sh Integration: in progress** (updated 2026-07-10)

## Phase sequence

| # | Phase | Plan doc | Entry condition | Exit gate | Done |
|---|-------|----------|-----------------|-----------|------|
| 1 | Capture Core | [phase1-capture-core](2026-07-08-second-brain-phase1-capture-core.md) | Spec + plans committed (done) | 5 acceptance criteria: verify=0 on fresh template; capture appends never overwrites; promote without `--approve` exits nonzero and writes nothing; profile validates against schema; lint flags planted token | [ ] |
| 2 | Capture Hooks + Self-install | [phase2-capture-hooks](2026-07-08-second-brain-phase2-capture-hooks.md) | Phase 1 green | Self-install clean + verify; real session writes dated daily log; guard blocks canon write, allows normal edits; pre-existing hooks still fire. **Repo is remembering things** | [ ] |
| 3 | Capture Skills (6) | [phase3-capture-skills](2026-07-08-second-brain-phase3-capture-skills.md) | Phase 2 green | All six skills at threshold (pass ≥80%, trigger ≥85%, resilience ≥8, fit ≥7; brain-promote critical: 95%/9/8); deployed to `~/.claude/skills/` | [ ] |
| 4 | Retrieval | [phase4-retrieval](2026-07-08-second-brain-phase4-retrieval.md) | Phase 3 green | Canon outranks session note on same keyword; context pack validates; SessionStart adds <2k tokens | [ ] |
| 5 | install.sh Integration | [phase5-install-integration](2026-07-08-second-brain-phase5-install-integration.md) | Phase 4 green; no parallel eval work in flight; **one sitting** | Dry-run previews 8 steps; fresh install passes verify; re-run idempotent; uninstall preserves capsule; `run-all-tests.js` still green | [ ] |
| 6 | Reference Repository Library | [phase6-reference-repos](2026-07-08-second-brain-phase6-reference-repos.md) | Phase 5 green | Registry validates; gstack-pattern-audit writes synthesis; direct-install from `sources/` blocked | [ ] |
| 7 | SecondBrainBench + Docs | [phase7-bench-and-docs](2026-07-08-second-brain-phase7-bench-and-docs.md) | Phase 6 green | Smoke bench exits 0 with report to `.project-brain/reports/brain-evals/`; 4 consolidated docs; CLAUDE.md documents brain commands | [ ] |

## Execution conventions

- **Driver:** `superpowers:subagent-driven-development` per phase plan header; task-by-task
  via the plans' `- [ ]` checkboxes; implementation subagents dispatched with `model: "sonnet"`.
- **Preflight:** Phases 2–7 open with a preflight section — run it before Task 1; reconcile
  drift before building.
- **TDD:** sibling `*.test.js` per script (plain `assert` + `spawnSync`, zero dependencies,
  standalone: `node scripts/brain/<name>.test.js`).
- **Commits:** one per completed task. Never commit `evals/`.
- **No-touch list (Phases 1–4, 6–7):** `skills/skill-eval/`, `skills/agent-eval/`,
  `scripts/codex/`, `schemas/codex/`, `scripts/run-all-tests.js`, calibration scripts,
  `scripts/telemetry/`, `install.sh`, `uninstall.sh`, `CLAUDE.md`. All shared-file edits are
  concentrated in Phase 5.
- **Phase gate ritual:** acceptance checklist → commit → update the Current-status line above →
  proceed to the next phase.

## Whole-system proofs

1. Phase 2 live smoke test — a real session produces a dated `sessions/daily/` entry.
2. Phase 7 smoke bench — sealed-answer SecondBrainBench exits 0 with all hard gates met
   (Recall@5 ≥90%, Precision@5 ≥45%, citation ≥90%, sensitive leakage = 0,
   canon-precedence failures = 0).
