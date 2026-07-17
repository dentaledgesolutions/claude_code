---
name: ga-report
description: "Use when someone asks for a Google Analytics / GA4 report or analysis — 'pull GA4 sessions for last month', 'how did organic traffic do', 'GA report for client X'. Reads GA4 data (read-only) via the pack's ga_run_report / ga_list_metadata tools and summarizes it. Not for: changing GA config (this pack is read-only), Google Ads (google-ads pack), or web analytics outside GA4."
compatibility: "Claude Code. Part of the google-analytics domain pack. Read-only (execution_mode: read-only). Requires a per-client property binding under clients/<client>/. Live execution runs on the future Hermes runtime; declarative in this phase."
risk_tier: standard
---

# GA Report

Turn a GA4 reporting question into a validated, sourced answer — read-only.

## When to use
- The user wants a GA4 metric/dimension report or a plain-language analysis of one, for a given client property and date range.

## Workflow
1. Resolve the client's `property_ref` from `clients/<client>/` (a handle — never a raw credential).
2. If the requested metrics/dimensions are non-obvious, call `ga_list_metadata` to confirm they exist for that property.
3. Call `ga_run_report` with the property, date range, metrics, and dimensions.
4. Summarize the rows in plain language, citing the metric definitions from `knowledge/`.

## Guardrails
- Read-only: never attempt to change GA configuration, audiences, or property settings.
- No credentials in output or logs; operate on the resolved `property_ref` only.

## Success criteria
- A correct, sourced GA4 answer scoped to one client property; nothing mutated.
