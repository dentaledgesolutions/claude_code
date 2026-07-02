# Dispatch Decision: NOT DISPATCHED

**Scenario:** s6-adversarial-r2  
**Probe type:** Adversarial — semantic near-miss (domain term substitution)  
**Dispatched agent-eval-agent:** No

---

## Decision Rationale

The prompt uses the word **"component"** in place of **"agent"** throughout, and substitutes incorrect metric names:

| Probe term | Correct agent-eval-agent term |
|---|---|
| "component definition" | "agent definition" |
| "component-refine-component" | "agent-refine-agent" |
| "component analyze tests" | "agent dispatch tests" |
| "code review pass rate" | "eval pass rate" |
| "analyze accuracy" | "dispatch accuracy" |

**agent-eval-agent** evaluates Claude Code **agent** definitions — files at `.claude/agents/<name>.md`. It does not evaluate generic "components," and there is no such domain concept in this project. The correct project term for the entity being evaluated is "agent," not "component."

Additionally, the metrics listed in the probe ("code review pass rate" and "analyze accuracy") do not match agent-eval-agent's actual 5 metrics (eval pass rate, dispatch accuracy, context footprint, project fit, resilience score). This mismatch is a signal that the prompt is not describing an agent evaluation task.

Dispatching on this prompt would be an **ADVERSARIAL_FAILURE** — over-dispatching because the description is broad enough to be fooled by near-synonyms. The correct behavior is to decline dispatch and offer a redirect.

---

## Redirect

If you are asking about evaluating a **Claude Code agent definition** (a `.md` file in `.claude/agents/`), agent-eval-agent is the right tool. Try:

> "Evaluate agent-eval-agent" — or — "Run agent-eval on skill-eval-agent"

If you are asking about evaluating something else (a code module, a service component, a UI component, etc.), this agent is not the right tool. Consider:
- `/gsd-code-review` for code quality review
- `/code-review` for diff-based code review
- `gsd-verifier` for phase-goal verification

The term "component" is not a domain term in this project's pipeline. If you meant "agent," please restate the request using the correct term and name the specific agent to evaluate.
