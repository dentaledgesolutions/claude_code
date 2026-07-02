# Scenario s3-edge-case — With Agent Output

**Scenario type:** edge_case  
**Prompt:** `[Internal invocation from agent-refine-agent] Running mid-loop evaluation on agent-eval-agent — training set scenarios only.`  
**Dispatched:** yes  

---

## Dispatch Rationale

The prompt matches agent-eval-agent's declared trigger on two independent signals:

1. **Description match:** The frontmatter description explicitly lists "when agent-refine-agent needs a mid-loop re-evaluation" as a trigger condition.
2. **Example match:** The examples block contains an exact pattern match — `user: "[internal invocation from agent-refine-agent]"` — with the annotated expected response "Running mid-loop evaluation on training set scenarios only." The `<commentary>` label confirms this is a programmatic invocation scenario, not a user-facing one.

No ambiguity exists. Dispatch is correct.

---

## Observed Initial Steps (stopped after step 3)

**Step 1 — Agent reads its own definition:**  
Agent would read `.claude/agents/agent-eval-agent.md` in full and extract frontmatter: `name: agent-eval-agent`, `model: sonnet`, `tools: [Read, Write, Bash, Agent]`. Context footprint = 187 lines × 4 ≈ 748 estimated tokens.

**Step 2 — Project context check:**  
Agent checks for `evals/project-context.json`. File exists (non-empty, from prior pipeline runs). No extraction needed.

**Step 3 — Scenario generation / training-set restriction (KEY OBSERVATION):**  
The agent's workflow body (steps 1–12) does **not** define what "training set scenarios only" means in operational terms. It makes no distinction between training-set and held-out scenarios. The only reference to this mode is in the **frontmatter description example**, where the commentary states "agent adapts to training-set-only mode" — but no adapter logic is specified in the workflow.

Given this gap, two behaviors are plausible upon dispatch:

- **Expected (per description):** The agent skips `generate-agent-evals.js` regeneration and reuses the existing `evals/agents/agent-eval-agent/evals.json`, running only a subset of scenarios (typically scenarios 1–6, the non-project-specific ones, when the training/test split follows the 6-generic / 3-project convention).
- **Observed risk:** Without explicit workflow instructions, the agent is likely to run the full 9-scenario suite and print `EVAL_COMPLETE` anyway — satisfying the format contract but ignoring the "training set only" constraint.

**Verdict on training-set-only handling:** The agent **does not reliably restrict to training-set scenarios** because the workflow body provides no instructions for this mode. The description example implies the capability, but it is unimplemented in the procedural body. This is a Lever B gap (workflow/checklist missing a branch for mid-loop invocation mode).

---

## Summary

- **Dispatched:** yes — trigger match is unambiguous and correct.
- **Training-set restriction:** not handled — the workflow body contains no logic to limit scenario scope when invoked with "training set scenarios only." The agent would likely run the full 9-scenario suite, satisfying the dispatch contract but violating the invocation constraint.
- **Analyst flag:** WORKFLOW_GAP — Step 3 and Step 6 need a conditional branch: `if mid-loop invocation → reuse existing evals.json + run scenarios 1–6 only; skip regeneration`.
- **Recommended lever:** Lever B (add mid-loop invocation branch to workflow steps 3 and 6).
