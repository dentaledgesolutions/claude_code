---
type: knowledge
title: "Key Google Ads Reporting Metrics"
description: "Defines the core Google Ads reporting metrics and notes that they are queried via GAQL."
tags: [google-ads, ppc, metrics, reporting, gaql]
timestamp: 2026-07-17
sources: [https://developers.google.com/google-ads/api/docs/start, https://support.google.com/google-ads]
---

# Key Google Ads Reporting Metrics

Google Ads performance data is retrieved programmatically via **GAQL** (Google Ads Query
Language), a SQL-like query language used with the Google Ads API to select resources (e.g.
`campaign`, `ad_group`, `keyword_view`) and request specific metric and segment fields over a
date range. Every metric below corresponds to a `metrics.*` field in GAQL (e.g.
`metrics.clicks`, `metrics.cost_micros`).

## Core Metrics

- **Impressions** — the number of times an ad was shown.
- **Clicks** — the number of times an ad was clicked (or otherwise interacted with, depending
  on ad format).
- **CTR (click-through rate)** — clicks divided by impressions; the proportion of viewers who
  clicked.
- **Avg. CPC (average cost-per-click)** — total cost divided by total clicks; the average price
  paid per click.
- **Cost** — total amount spent, typically stored in the API as micros (millionths of the
  account currency unit) and converted to standard currency for reporting.
- **Conversions** — the count of tracked conversion actions (e.g. purchases, sign-ups, calls)
  attributed to ad interactions, based on the account's conversion tracking and attribution
  settings.
- **Conversion value** — the total value assigned to those conversions, used for
  revenue-oriented reporting and value-based bidding.
- **Cost per conversion** — total cost divided by total conversions; the average price paid to
  generate one conversion.
- **ROAS (return on ad spend)** — conversion value divided by cost; expresses revenue generated
  per unit of spend.
- **Impression share** — the impressions an ad actually received divided by the estimated number
  of impressions it was eligible to receive; indicates how much available opportunity is being
  captured versus lost to budget or rank.
- **Quality Score** — a diagnostic 1–10 rating (available at the keyword level) reflecting
  Google's estimate of ad relevance, expected CTR, and landing page experience relative to other
  advertisers; it is a diagnostic signal, not a directly-queryable single metric guaranteed
  across every report type, and it informs Ad Rank in the auction.

## Working with GAQL

Reports combine resources, metrics, and segments, e.g. selecting `campaign.name`,
`metrics.impressions`, `metrics.clicks`, and `metrics.cost_micros` `FROM campaign` filtered by a
date range with a `WHERE segments.date DURING ...` clause. Metrics are always read-only outputs
of the account's actual serving history — they cannot be edited directly, only influenced by
changing campaign settings, bids, budgets, targeting, or creative.
