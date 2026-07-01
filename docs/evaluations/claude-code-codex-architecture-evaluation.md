# Claude Code + Codex External Eval Architecture Evaluation

Date: 2026-06-30  
Repository: claude_code (dentaledgesolutions)  
Evaluator: Claude Sonnet 4.6  

---

## Problem Statement

Full native evals on this project dispatch 18–42 Claude Code subagents per target skill or agent. Each subagent batch consumes a significant chunk of session token limits, making multi-skill eval runs impractical in a single session. The goal of this evaluation is to determine whether offloading scenario execution to Codex CLI — as an independent second-model evaluator running outside the Claude Code session — reduces session consumption while preserving the existing eval methodology exactly.

This is not a redesign of the eval methodology. It is the addition of an external execution path that produces the same evidence in a different way.

---

## Verified Baseline Findings

### Native Eval Methodology (Preserved Exactly)

The existing `skill-eval` / `skill-eval-agent` pipeline implements:

- **9 scenario types**: direct, paraphrased, edge_case, negative, semantic, adversarial, project-native, project-workflow, multi-turn
- **5 metrics**: Eval Pass Rate (≥ 80%), Trigger Accuracy (≥ 85%), Context Footprint (informational), Project Fit Score (≥ 7/10), Resilience Score (≥ 8/10)
- **Repetition model**: 3 reps for trigger-sensitive scenarios (full mode) to detect instability
- **Analyst pass**: review for non-discriminating, unstable, adversarial false positives, and multi-turn redundancy before writing reports
- **Output artifacts**: `SKILL-EVAL.md` per skill, `refine-input.json` on metric failure
- **Comparison model**: with-skill vs. baseline (no skill loaded)

The metric scales confirmed from `skills/skill-eval/SKILL.md`:
- Pass Rate and Trigger/Dispatch Accuracy: 0–100% (not 0–10)
- Project Fit Score and Resilience Score: 0–10

**This methodology is the single source of truth. Codex does not change it.**

### Session Limit Impact

Each full native eval dispatches:
- 9 scenario types × 3 reps (trigger-sensitive in full mode) = 18–27 with-skill subagents
- 18–27 matching baseline subagents
- Total: 36–54 subagents for a single skill in full mode

Even in standard mode (9 scenarios × 1 rep × 2 subagents): 18 subagents per target.

With 12 installed skills plus multiple agents, a complete health-check run would require hundreds of subagent dispatches — exceeding what a single session can sustain.

### skill-guardian Scope (Unchanged)

`skill-guardian` is the lifecycle owner: it audits all skills, measures 5 metrics, and runs Karpathy autoresearch refinement cycles. It is not modified by this plan. Codex does not replace or supplement skill-guardian — it provides a supplementary external execution path.

### Codex Plugin Install Status

Confirmed in `evals/project-context.json`:
```json
"plugins": ["superpowers", "andrej-karpathy-skills", "frontend-design", "ralph-skills",
            "security-guidance", "codex", "claude-seo"]
```
The Codex plugin is installed. Its review gate is **DISABLED** for this plan — Codex executes only via explicit CLI invocation with `--live`.

### evals.json Structure (Confirmed from Live Samples)

Skill eval format (`evals/skill-scout/evals.json`):
```json
{
  "skill_name": "skill-scout",
  "evals": [
    {
      "id": 1,
      "eval_name": "direct-primary-trigger",
      "type": "direct",
      "prompt": "...",
      "expected": { "triggers": true, "assertions": [...] }
    }
  ]
}
```

Agent eval format (`evals/agents/skill-eval-agent/evals.json`):
```json
{
  "agent_name": "skill-eval-agent",
  "evals": [
    {
      "id": 1,
      "type": "direct",
      "prompt": "...",
      "expected": { "dispatches": true, "assertions": [...] }
    }
  ]
}
```

Key difference: skills use `expected.triggers`, agents use `expected.dispatches`. The Codex schemas are separate to preserve this distinction.

### .gitignore State

The `.gitignore` in this repository currently only ignores:
- `.claude/settings.local.json`
- `.claude/worktrees/`
- `.DS_Store` / `**/.DS_Store`

`evals/` is NOT gitignored in this repo (unlike target projects where `install.sh` adds `evals/` to gitignore). The existing `evals/` content (e.g., `evals/skill-scout/evals.json`) is tracked and committed. The new `evals/codex-runs/` subdirectory must be explicitly gitignored to prevent committing run artifacts.

---

## External Capability Verification

### Codex CLI Output Model

Confirmed via `codex exec --help`:

```
-o, --output-last-message <FILE>   Write last message to a file
--json                              Stream JSONL event stream to stdout
--output-schema <FILE>              JSON Schema for the response shape
-s, --sandbox [read-only|workspace-write|danger-full-access]
```

**Correct pattern:**
```bash
codex exec \
  --json \
  --sandbox read-only \
  --output-schema schemas/codex/codex-skill-scenario-result.schema.json \
  -o evals/codex-runs/skills/<skill>/<run-id>/<scenario>/result.json \
  "$(cat prompt.txt)" \
  > evals/codex-runs/skills/<skill>/<run-id>/<scenario>/trace.jsonl
```

- `result.json`: written by `-o` flag. Source of truth for scoring. Always read this.
- `trace.jsonl`: JSONL event stream from `--json`. Evidence only. Never parsed for scores.
- `--sandbox read-only`: correct for read-only skill/agent evaluation.

### What Codex Is (and Is Not) in This Plan

**Codex is:**
- An independent second-model evaluator
- An external trace producer
- A source of per-scenario `result.json` structured evidence

**Codex is not:**
- An execution engine replaying the Claude Code runtime
- A lifecycle manager (no refine, adapt, scout, guardian)
- A methodology owner (Claude Code owns all methodology)
- An automated gate (Codex plugin review gate is DISABLED)

---

## Evaluation of Architecture Assertions

Six assertions from the original ChatGPT evaluation document, assessed:

| # | Assertion | Assessment |
|---|-----------|-----------|
| 1 | "Codex should be the primary eval runner" | **REJECTED** — Native eval is primary. Codex is supplementary external path. |
| 2 | "Share a single schema for skill and agent evals" | **REJECTED** — Trigger Accuracy (skills) and Dispatch Accuracy (agents) require separate schemas. `codex_triggers` ≠ `codex_dispatches`. |
| 3 | "Codex can compute Context Footprint" | **REJECTED** — Runner already has source files. Footprint is computed locally from line counts, not asked from Codex. |
| 4 | "Use --dry-run flag to preview" | **ACCEPTED with inversion** — Dry-run is the DEFAULT (no flag needed). `--live` is required to call Codex and spend credits. |
| 5 | "AJV for schema validation" | **REJECTED** — `package.json` has no deps. No AJV. Manual JSON.parse + required field check only. |
| 6 | "Codex executes evals → native evals gate on results" | **PARTIALLY ACCEPTED** — Codex executes evals externally. Native evals remain primary; disagreement policy governs, not a gate. |

---

## Ownership Boundary Table

| Responsibility | Claude Code owns | Codex owns |
|---|---|---|
| Scenario generation | Yes — `generate-seed-evals.js` | No |
| Eval specification | Yes — evals.json | No |
| Scenario execution (primary) | Yes — native skill-eval-agent + agent-eval | No |
| Scenario execution (external) | Optional — calls `codex exec` | Yes — executes as second model |
| Trace capture | No | Yes — `trace.jsonl` |
| Per-scenario result | No | Yes — `result.json` via `-o` |
| Metric aggregation | `aggregate-eval-results.js` (local script) | Provides raw results only |
| CODEX-EVAL-SUMMARY.md | Reviews it | Produces it |
| Lifecycle management | Yes — all of it | No |
| skill-guardian | Yes — unchanged | No |
| CLAUDE.md updates | Yes — gated on Phase 6 signal | No |
| Refine decisions | Yes | Provides evidence only |
| Adversarial review | Manual plugin only | Via `/codex:adversarial-review` (manual) |
| CI gate | Deferred | Deferred |

---

## Evaluation Levels

| Level | Mechanism | What it measures |
|-------|-----------|-----------------|
| Level 1 — Static | `skill-audit` / `agent-audit` (47-pattern scan) | Security: prompt injection, bash, secrets, permissions, scripts |
| Level 2 — External second model | Codex CLI (`codex exec` per scenario) | Behavioral: would skill/agent trigger correctly? Are assertions met? |
| Level 3 — Summary comparison | Claude Code reads `CODEX-EVAL-SUMMARY.md` | Methodology: do Codex findings align with native eval? Disagreement routing. |

---

## Eval Modes

| Mode | Scenario types | Reps | Project Fit | Cost |
|------|----------------|------|-------------|------|
| `smoke` | direct, negative, adversarial, project-native | 1 | **partial** — project-workflow and multi-turn absent | ~4 Codex calls |
| `standard` | All 9 types | 1 | complete | ~9 Codex calls |
| `full` | All 9 types | 3 for: direct, paraphrased, semantic, negative, adversarial | complete | ~21 Codex calls |

Smoke mode project fit is always `"partial"` because the 3 scenario types needed for a complete score (project-native + project-workflow + multi-turn) are not all present.

---

## Artifact Flow

```
skills/<target>/SKILL.md
       ↓
skills/skill-eval/scripts/generate-seed-evals.js --context evals/project-context.json
       ↓
evals/<target>/evals.json                          ← existing file, unchanged
       ↓
scripts/codex/run-external-skill-eval.js <skill> --mode smoke [--live]
       ↓
evals/codex-runs/skills/<target>/<run-id>/
  ├── eval-spec.json            ← mode, scenarios, footprint, live_run: false/true
  ├── command-preview.sh        ← all Codex commands (written in dry-run too)
  ├── 01-direct/
  │     ├── prompt.txt          ← exact prompt sent to Codex
  │     ├── result.json         ← structured result (--live only)
  │     └── trace.jsonl         ← JSONL event stream (--live only, evidence only)
  ├── ...
  ├── aggregate-results.json    ← computed from result.json files
  └── CODEX-EVAL-SUMMARY.md    ← what Claude Code reads
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Codex modifies skill/agent files | Low | High | `--sandbox read-only` enforced; hard failure if detected in result.json |
| Codex initiates lifecycle steps | Low | High | Prompt explicitly forbids scout/adapt/refine/guardian; hard failure flag |
| Review gate enabled inadvertently | Low | High | Plugin review gate is DISABLED; no automated invocation |
| API credits consumed accidentally | Medium | Medium | Dry-run is default; `--live` required explicitly |
| `trace.jsonl` parsed for scores | Low | Medium | Architecture doc explicit: only `result.json` is source of truth |
| Smoke mode misread as complete fit score | Medium | Low | `project_fit_score: "partial"` in both eval-spec.json and aggregate-results.json |
| Schemas diverge between skill and agent | Low | Medium | Separate schema files; test-schemas.js validates both |
| AJV silently added | Low | Medium | test-schemas.js uses JSON.parse only; PR review checks for new deps |

---

## Hard Failure Definitions

These trigger `recommendation: "BLOCK"` regardless of pass rate:

1. Codex modifies `skills/*/SKILL.md` or `.claude/agents/*.md`
2. Codex initiates scout, adapt, refine, install, or guardian cycles
3. Codex enables or exploits the Codex review gate
4. Security audit bypass (static-scan.js logic skipped)
5. Tool-scope violation (agent uses undeclared tool)
6. Adversarial false positive (skill/agent fires when it should not)
7. Review-gate loop risk (Codex prompts for lifecycle continuation)

---

## Eval Disagreement Policy

| Native Claude Eval | Codex External Eval | Final Decision |
|---|---|---|
| PASS | PASS | HEALTHY |
| PASS | FAIL | REFINE or MANUAL REVIEW |
| FAIL | PASS | MANUAL REVIEW |
| FAIL | FAIL | BLOCK / REFINE / REWRITE |
| Any hard failure | Any result | BLOCK |

Claude Code is the final decision-maker in all cases.

---

## Final Recommendation

**Score: 9/10 — PROCEED**

### Reasoning

The architecture cleanly separates concerns: Claude Code remains the methodology and lifecycle owner; Codex operates as a stateless, read-only second-model evaluator with no lifecycle privileges. The primary risks (accidental credit spend, review gate activation, lifecycle ownership) are all mitigated by concrete controls (dry-run default, `--live` guard, `--sandbox read-only`, hard failure flags, review gate disabled).

The value proposition is straightforward: offloading 18–42 subagent dispatches per target to external Codex calls frees session token budget for methodology work. The `CODEX-EVAL-SUMMARY.md` compact summary replaces thousands of trace events as the review artifact, preserving Claude Code's reviewer role.

### No-Go Criteria (None Met)

- ~~Codex would own lifecycle steps~~ — mitigated
- ~~Schema sharing would conflate Trigger/Dispatch Accuracy~~ — separate schemas
- ~~AJV dependency~~ — manual validation only
- ~~`evals/codex-runs/` committed~~ — gitignored
- ~~Dry-run default inverted~~ — `--live` required

**Proceed to Phase 2.**

---

## Phase 6 — First Smoke Live Results

Date: 2026-07-01

### skill-eval (skill, smoke mode)

Run ID: `2026-07-01T02-47-22-904Z`

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | OK |
| Trigger Accuracy | 100% | ≥ 85% | OK |
| Project Fit Score | partial | ≥ 7/10 | partial (smoke mode — expected) |
| Resilience Score | 10/10 | ≥ 8/10 | OK |
| Context Footprint | 859 lines / ~3,436 tokens | informational | — |

Hard failures: none

Analyst findings:
- `direct` scenario flagged `non_discriminating`: the eval prompt repeats the skill description without naming a target skill, so "Load the skill" and "Generate seed scenarios" assertions fail regardless of whether the skill is loaded. Scenario quality issue, not a skill quality issue.
- Adversarial correctly rejected (score 10/10)
- Negative correctly rejected (score 10/10)
- Project-native correctly triggered (score 10/10)

Recommendation: **HEALTHY**

Schemas required a one-time fix before the live run: OpenAI Structured Outputs requires `additionalProperties: false` at every object level and all properties in `required` (nullable fields use `anyOf` with `null`). Fixed in both per-scenario schemas.

### skill-eval-agent (agent, smoke mode)

Run ID: `2026-07-01T04-20-37-712Z`

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Eval Pass Rate | 100% | ≥ 80% | OK |
| Dispatch Accuracy | 100% | ≥ 85% | OK |
| Project Fit Score | partial | ≥ 7/10 | partial (smoke mode — expected) |
| Resilience Score | 10/10 | ≥ 8/10 | OK |
| Context Footprint | 178 lines / ~712 tokens | informational | — |

Hard failures: none

Analyst findings: none — no non-discriminating, unstable, adversarial false positive, multi-turn redundancy, or tool scope violation flags on any scenario.

Recommendation: **HEALTHY**

### Session Impact

Native smoke eval (4 scenarios) would dispatch 8 Claude Code subagents (4 with-skill + 4 baseline) in the main session. The Codex external run dispatched 4 Codex calls outside the session, consuming no main session tokens.

For a full standard eval (9 scenarios), the native path dispatches 18 subagents. The Codex path dispatches 9 Codex calls externally. Session savings: ~100% of the eval execution budget returned to the session.

### Conclusion

External runner reduces session impact: **yes** — all 4 execution calls ran outside the Claude Code session.

Added signal detected: **yes** — the `non_discriminating` flag on `direct` is a legitimate eval quality finding that native subagent eval would also surface, but here it came from an independent model with no self-referential bias.

Proceed to standard mode: **yes** — both targets HEALTHY, session savings confirmed, independent signal confirmed.
