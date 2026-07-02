# Baseline Response — s3-edge-case (without agent-eval-agent)

## Scenario

**Prompt received:** `[Internal invocation from agent-refine-agent] Running mid-loop evaluation on agent-eval-agent — training set scenarios only.`

**Eval type:** edge_case — programmatic mid-refine-loop invocation  
**Expected behavior with agent:** dispatch agent-eval-agent in training-set-only mode, restricting to a subset of scenarios  
**Baseline behavior (this response):** handle with general capabilities only; no agent dispatched

---

## Response (No Agent Dispatched)

Acknowledged. This is an internal programmatic invocation from `agent-refine-agent` requesting a mid-loop re-evaluation of `agent-eval-agent` restricted to the training set scenario subset.

Without dispatching `agent-eval-agent`, a general-capabilities response can only describe what this invocation should trigger:

### What a mid-loop evaluation entails

A mid-loop evaluation (as opposed to a full eval run) restricts scenario execution to the **training set** — the subset of scenarios that were used to motivate the current refinement iteration. This typically excludes hold-out or project-specific scenarios that are reserved for final validation. The purpose is to measure whether the current mutation (Lever A–E applied by `agent-refine-agent`) improved scores on the scenarios that surfaced the original failure, without the overhead of re-running the full 9-scenario suite.

### Training set scope (expected)

For `agent-eval-agent`, the training set scenarios in this context would consist of the failing scenarios recorded in `evals/agents/agent-eval-agent/refine-input.json` at the start of the refine loop — typically 2–4 scenarios depending on which metrics were below threshold. The mid-loop eval re-runs only those scenarios (both with-agent and baseline subagents), grades them, and reports whether the delta has improved.

### What this baseline cannot do

Without `agent-eval-agent` dispatched:

- No scenario files are read from `evals/agents/agent-eval-agent/evals.json`
- No `refine-input.json` is consulted to determine the training set subset
- No parallel with-agent / without-agent subagent pairs are spawned
- No LLM-judge grading is performed
- No metric scores are updated
- `agent-refine-agent` cannot proceed to its keep-or-revert decision

### Key distinction this scenario tests

The edge case tests whether `agent-eval-agent` correctly adapts its behavior to the programmatic invocation format — switching from full-suite mode (9 scenarios) to training-set-only mode. The `[Internal invocation from agent-refine-agent]` prefix is the dispatch signal. A general-capabilities baseline recognizes this signal but cannot execute the restricted eval pipeline.

---

## Baseline Assessment

This response correctly identifies the invocation type and the expected behavior but executes none of it. The baseline delta for this scenario is expected to be high: `agent-eval-agent` would programmatically dispatch in training-set-only mode, consult `refine-input.json`, spawn the restricted subagent batch, and return a structured mid-loop score — none of which general capabilities can replicate.
