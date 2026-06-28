# Agent Quality Gate Design
**Date:** 2026-06-28  
**Status:** Approved  
**Author:** Brainstorming session

## Problem

The claude_code pipeline has a complete quality gate for skills (`skill-eval → skill-refine`) but no equivalent for agents. After `agent-adapt` writes a `.claude/agents/<name>.md` file, there is no measurement of whether the agent actually performs its role correctly, dispatches reliably, or stays within its tool scope. This spec closes that gap.

## Goal

Add `agent-eval → agent-refine` to the pipeline so every adapted agent has a measurable quality baseline and an automated path to improvement:

```
agent-scout → agent-audit → agent-adapt → agent-eval → agent-refine
```

## Design Approach

Strict structural mirror of `skill-eval` and `skill-refine`. Same directory layout, same 5 metrics (one rename), same lever A–E framework, same scenario types, same thresholds. Agent-specific adaptations are targeted and minimal — they correct for the genuine differences between skills and agents without fragmenting the pipeline's methodology.

## Architecture

### New files created

```
skills/
  agent-eval/
    SKILL.md
    REFERENCE.md
    assets/
      AGENT-EVAL.template.md
    scripts/
      generate-agent-evals.js

  agent-refine/
    SKILL.md
    REFERENCE.md

.claude/agents/
  agent-eval-agent.md
  agent-refine-agent.md
```

### Eval artifact paths

```
evals/
  agents/
    <agent-name>/
      evals.json
      refine-input.json
      iteration-1/
        <scenario-id>/
          with_agent/
            output.md
            timing.json
          without_agent/
            output.md
            timing.json
```

`AGENT-EVAL.md` is written to `.claude/agents/<name>-EVAL.md` — co-located with the agent file it describes.

### Shared infrastructure (unchanged)

- `skills/skill-eval/scripts/extract-project-context.js` — used as-is; agents consume the same `evals/project-context.json`
- `skills/skill-audit/scripts/static-scan.js` — used by agent-audit (already) and re-used after Lever E mutations
- Scoring rubric — identical weights and thresholds

## Metrics

| # | Name | Threshold | Notes |
|---|------|-----------|-------|
| 1 | Eval Pass Rate | ≥ 80% | Identical to skill-eval |
| 2 | **Dispatch Accuracy** | ≥ 85% | Renamed from "Trigger Accuracy"; measures whether Claude correctly dispatches or withholds the agent during orchestration |
| 3 | Context Footprint | — | Informational; agent files are single `.md` files so footprint is typically smaller than skills |
| 4 | Project Fit Score | ≥ 7/10 | Identical; only reported when `--context` was used |
| 5 | Resilience Score | ≥ 8/10 | Identical; adversarial scenarios test over-dispatching |

### Dispatch Accuracy semantics

Skills auto-trigger from description alone. Agents are explicitly dispatched — but Claude still reads the agent's `description:` to decide which agent to use in multi-agent orchestration and whether to dispatch at all. Dispatch Accuracy measures: given an orchestration prompt, does Claude correctly dispatch (or withhold) this agent across 3 repetitions? Same ≥85% threshold, same 3-rep consistency check.

## Scenario Types

9 types — same as skill-eval — with agent-aware prompt framing:

| # | Type | Dispatches? | Agent adaptation |
|---|------|-------------|-----------------|
| 1 | `direct` | ✓ | Orchestration request naming the agent's role directly |
| 2 | `paraphrased` | ✓ | Same orchestration intent, different phrasing |
| 3 | `edge_case` | ✓ | Mid-workflow entry or minimal input |
| 4 | `negative` | ✗ | Explanation request — should NOT dispatch |
| 5 | `semantic` | ✓ | Synonym action verbs for the agent's role |
| 6 | `adversarial` | ✗ | Agent vocabulary injected into wrong-scope context — must NOT dispatch |
| 7 | `project-native` | ✓ | Project terminology + artifact paths from `project-context.json` |
| 8 | `project-workflow` | ✓ | Agent invoked after a sibling in the pipeline |
| 9 | `multi-turn` | ✓ | Continuation framing from mid-session |

Types 1–6 always generated. Types 7–9 require `--context evals/project-context.json`.

All prompts are framed as orchestration instructions (asking Claude to dispatch an agent), not as user requests that auto-trigger a skill. This is the key framing difference from `generate-seed-evals.js`.

**Baseline definition for agent evals:** The "without_agent" baseline is Claude running the same orchestration prompt using only general capabilities — the specific named agent is NOT dispatched. This mirrors "no skill loaded" in skill-eval.

## Script: `generate-agent-evals.js`

```bash
node skills/agent-eval/scripts/generate-agent-evals.js .claude/agents/<name>.md \
  --context evals/project-context.json
```

**Extracts from the agent file:**
- `name:` — agent identifier
- `description:` — parsed for "Use when" trigger conditions and `<example>` blocks
- `tools:` — declared tools; used to generate tool-compliance assertions
- `model:` — declared tier; included in `AGENT-EVAL.md` header
- Body — workflow steps and "What NOT to Do" section; used to derive expected-output assertions

**Output:** `evals/agents/<name>/evals.json` (creates directory if needed)  
**Without `--context`:** 6 scenarios. **With `--context`:** 9 scenarios.

## Data Contracts

### `evals/agents/<name>/evals.json`

```json
{
  "agent_name": "skill-eval-agent",
  "agent_file": ".claude/agents/skill-eval-agent.md",
  "generated_from_description": true,
  "project_context": "evals/project-context.json",
  "evals": [
    {
      "id": 1,
      "eval_name": "direct-primary-dispatch",
      "type": "direct",
      "prompt": "Use the skill-eval-agent to evaluate skill-adapt",
      "expected": {
        "dispatches": true,
        "assertions": [
          "Agent dispatched (Agent tool call appears in transcript)",
          "Produces skills/skill-adapt/SKILL-EVAL.md",
          "Reports all 5 metrics"
        ]
      }
    },
    {
      "id": 6,
      "eval_name": "adversarial-wrong-scope",
      "type": "adversarial",
      "prompt": "Use the eval agent to check my React components for accessibility issues",
      "expected": {
        "dispatches": false,
        "note": "Binary: score 10 if agent not dispatched, 0 if dispatched. No partial credit."
      }
    }
  ]
}
```

### `evals/agents/<name>/refine-input.json`

Identical structure to skill-eval's `refine-input.json`. Fields: `agent_name`, `eval_date`, `iteration`, `failing_metrics` (object with per-metric value/threshold/failing), `failing_scenarios` (array with id/type/score/root_cause), `analyst_observations` (array), `recommended_lever` (A|B|C|D|E|re-adapt).

### `.claude/agents/<name>-EVAL.md`

```markdown
# Agent Eval: <agent-name>
**Date:** YYYY-MM-DD  **Iteration:** N  **Evaluator:** agent-eval-agent
**Model:** <declared model>  **Tools:** <declared tools list>

## Metrics
| Metric            | Score    | Threshold | Status              |
|-------------------|----------|-----------|---------------------|
| Eval Pass Rate    | XX%      | ≥ 80%     | PASS/REFINE/REWRITE |
| Dispatch Accuracy | XX%      | ≥ 85%     | PASS/OPTIMIZE       |
| Context Footprint | XXL/~XXt | —         | —                   |
| Project Fit Score | X.X/10   | ≥ 7       | PASS/RE-ADAPT/N/A   |
| Resilience Score  | X.X/10   | ≥ 8       | PASS/BROADEN        |

## Scenario Results
| ID | Name | Type | Dispatched (reps) | Score | Delta | Flag |

## Analyst Observations
- Non-discriminating: (list any)
- Flaky dispatch: (list any)
- Adversarial failures: (list any — ADVERSARIAL_FAILURE flag)
- Multi-turn redundancy: (list any — MULTI_TURN_REDUNDANCY flag)
- Tool scope violations: (list any — TOOL_VIOLATION flag)

## Recommendation
HEALTHY / REFINE: <metric> / REWRITE / RE-ADAPT
```

Note the addition of **`TOOL_VIOLATION` flag** — fires when an agent uses a tool not in its frontmatter `tools:` list. This is agent-specific and has no skill equivalent.

## Lever Space (agent-refine)

| Lever | Target | What changes | Constraint |
|-------|--------|-------------|------------|
| A | `description:` frontmatter | Dispatch accuracy + resilience — tighten/broaden "Use when" triggers, add negative examples | ≤ 1024 chars |
| B | Workflow steps in body | Execution quality — explicit output requirements, continuation-awareness notes | One step at a time |
| C | `<example>` blocks in description | Dispatch clarity for ambiguous roles | Must reflect real dispatch scenarios |
| D | `What NOT to Do` section | Scope containment — prevent role bleed | Don't move core workflow here |
| E | Frontmatter config (`model:`, `tools:`) | Cost, capability ceiling, tool compliance | Never expand tools beyond source; re-run agent-audit after any tools change |

### Routing rules

| Failing metric | Action |
|----------------|--------|
| Dispatch Accuracy < 85% | Lever A only — don't touch B–E until dispatch is stable |
| Resilience Score < 8 | Lever A only — description too broad |
| Eval Pass Rate < 80% (dispatch + resilience fine) | Levers B–E |
| Project Fit < 7 (project-native/workflow failed) | Exit — re-run agent-adapt with richer context |
| Project Fit < 7 (only multi-turn failed) | Lever B — continuation-awareness note |
| Multiple failing | Lever A first |

**Lever E rule:** After any `tools:` or `model:` mutation, `agent-audit` re-runs automatically before scoring. A BLOCK verdict from agent-audit counts as a score of 0 for that iteration — revert immediately.

## Skills Workflow Summary

### `agent-eval` (10 steps)
1. Load agent file — extract frontmatter + body
2. Extract/confirm project context
3. Generate scenarios via `generate-agent-evals.js`
4. Establish baseline (new agent = no-agent baseline; existing = snapshot)
5. Run parallel dispatch pairs via `agent-eval-agent`
6. Grade with LLM judge (programmatic dispatch detection first, then quality scoring)
7. Compute 5 metrics
8. Analyst pass (flag non-discriminating, flaky, adversarial failures, tool violations)
9. Write `AGENT-EVAL.md` to `.claude/agents/`
10. Write `refine-input.json` if any metric fails → invoke `agent-refine`

### `agent-refine` (11 steps — identical to skill-refine with Lever E addition)
1. Verify `refine-input.json` exists
2. Load inputs + backup baseline
3. Route by failing metric → lever
4. Train/test split (adversarial always in training set)
5. Initialize `AGENT-REFINE-LOG.md`
6. Autoresearch loop (max 10 iterations): hypothesis → mutate → re-eval via agent-eval-agent → keep/revert → log
7. After any Lever E mutation: re-run agent-audit before scoring
8. Convergence check
9. Final validation (full 9-scenario run)
10. Write final log entry
11. Print summary

## Companion Agents

### `agent-eval-agent.md`
- **Role:** Spawns parallel dispatch-pair subagents (up to 42), grades outputs, computes 5 metrics, writes AGENT-EVAL.md and refine-input.json
- **Model:** `sonnet`
- **Tools:** `Read`, `Write`, `Bash`, `Agent`
- **Termination signal:** Prints `EVAL_COMPLETE` on its own line (same convention as skill-eval-agent)

### `agent-refine-agent.md`
- **Role:** Runs autoresearch loop — routes by metric, makes one edit per iteration, calls agent-eval-agent for all scoring, keeps or reverts, logs
- **Model:** `sonnet`
- **Tools:** `Read`, `Write`, `Edit`, `Bash`, `Agent`
- **Never implements eval logic** — delegates all scoring to agent-eval-agent
- **Log file:** `.claude/agents/<name>-REFINE-LOG.md` — append-only, co-located with the agent file and its AGENT-EVAL.md

## What Stays the Same vs What Changes

| Aspect | Same as skill pipeline | Different |
|--------|----------------------|-----------|
| Metric count | 5 | "Trigger Accuracy" → "Dispatch Accuracy" |
| Thresholds | All identical | — |
| Scenario types | All 9 types | Prompts framed as orchestration requests |
| Lever count | A–E | Lever E = frontmatter config (not scripts) |
| Routing rules | All identical | Lever E triggers agent-audit re-run |
| Artifact paths | Same structure | `evals/agents/` prefix; AGENT-EVAL.md and AGENT-REFINE-LOG.md in `.claude/agents/` |
| Script usage | extract-project-context.js shared | New generate-agent-evals.js |
| Companion agents | Same pattern | agent-eval-agent, agent-refine-agent |
| Report flags | Same set | + TOOL_VIOLATION flag |

## Files to Create (Implementation Checklist)

- [ ] `skills/agent-eval/SKILL.md`
- [ ] `skills/agent-eval/REFERENCE.md`
- [ ] `skills/agent-eval/assets/AGENT-EVAL.template.md`
- [ ] `skills/agent-eval/scripts/generate-agent-evals.js`
- [ ] `skills/agent-refine/SKILL.md`
- [ ] `skills/agent-refine/REFERENCE.md`
- [ ] `skills/agent-refine/assets/AGENT-REFINE-LOG.template.md`
- [ ] `.claude/agents/agent-eval-agent.md`
- [ ] `.claude/agents/agent-refine-agent.md`
- [ ] Update `install.sh` and `uninstall.sh` to include new skills
- [ ] Update `CLAUDE.md` pipeline diagram to show `agent-eval → agent-refine`
