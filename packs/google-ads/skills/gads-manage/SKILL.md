---
name: gads-manage
description: "Use when someone asks to report on or change Google Ads — 'how are the campaigns doing', 'raise the budget on campaign X', 'pause the underperformers', 'set up a new search campaign for client Y'. Reads freely; every budget/status/creation change is PROPOSED then paused for explicit human approval. Not for: Google Analytics (google-analytics pack), Meta ads, or changes outside Google Ads."
compatibility: "Claude Code. Part of the google-ads domain pack. execution_mode: hitl, risk_tier: critical (money-spending). Requires a per-client customer binding under clients/<client>/. Write actions are approval-gated; live execution runs on the future Hermes runtime (declarative in this phase)."
risk_tier: critical
---

# Google Ads Manage (HITL)

Report on Google Ads, and make changes **only through an explicit human-approval gate** — this pack spends real money.

## When to use
- The user wants a Google Ads performance report/analysis, or wants to change a budget, pause/enable a campaign, or create a campaign for a given client.

## Workflow
1. Resolve the client's `customer_ref` from `clients/<client>/` (a handle — never a raw credential or developer token).
2. **Read first:** use `gads_run_report` / `gads_get_campaign` to ground any recommendation in current data.
3. **For any change (budget, status, create):** present the exact proposed mutation (what, from→to, expected spend impact) and **pause for explicit approval** — do not execute a write tool until the human approves.
4. On approval, the runtime executes the write tool (`requires_approval: true`), enforcing the client's budget cap and creating new campaigns PAUSED by default.

## Guardrails
- Never execute a budget/status/create action without a recorded human approval.
- Never exceed the client's `max_daily_budget` cap; re-prompt if a request would.
- No credentials in output or logs; operate on the resolved `customer_ref` only.

## Success criteria
- Correct, sourced reporting; every mutation approved by a human, within the client's budget cap; nothing spent without consent.
