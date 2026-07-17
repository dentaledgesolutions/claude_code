---
type: knowledge
title: "GA4 Common Reports and Playbooks"
description: "Practical GA4 Data API reporting recipes framed as question, metrics/dimensions, and date range."
tags: [ga4, google-analytics, reporting, playbooks]
timestamp: 2026-07-17
sources: [https://developers.google.com/analytics/devguides/reporting/data/v1, https://support.google.com/analytics]
---

Each recipe below is a reusable pattern for a `runReport` call against the GA4 Data API. Adjust
the date range to the stakeholder's actual question; the ranges shown are sensible defaults.

## 1. Traffic by Channel

**Question:** Where is our traffic coming from, and how does each channel perform?

- **Metrics:** `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, `conversions`
- **Dimensions:** `sessionDefaultChannelGroup`
- **Date range:** last 28 days (or last full calendar month for reporting cadence)
- **Notes:** Sort by `sessions` descending. Watch for a large "Unassigned" or "(not set)" row —
  it signals missing or broken UTM tagging on inbound links.

## 2. Landing Page Performance

**Question:** Which entry pages drive the most engaged traffic and conversions?

- **Metrics:** `sessions`, `engagedSessions`, `engagementRate`, `conversions`
- **Dimensions:** `landingPage` (or `pagePath` filtered to session-start events if
  `landingPage` is unavailable in the account's API access)
- **Date range:** last 30 days
- **Notes:** Pair with `sessionDefaultChannelGroup` as a secondary dimension to see which
  channels feed which landing pages. High sessions with low `engagementRate` flags a
  page/message mismatch worth a UX review.

## 3. Conversion by Source

**Question:** Which acquisition sources actually produce conversions and revenue, not just
traffic?

- **Metrics:** `sessions`, `conversions`, `totalRevenue`
- **Dimensions:** `sessionSource`, `sessionMedium` (or `sessionSourceMedium` combined)
- **Date range:** last 90 days (longer window smooths out low-volume sources and seasonal noise)
- **Notes:** Compute conversion rate as `conversions / sessions` client-side — GA4 does not
  return a ready-made per-source conversion-rate metric. Cross-check against
  `sessionDefaultChannelGroup` to sanity-check channel classification.

## 4. Week-over-Week Trend

**Question:** Is traffic and engagement trending up or down versus last week?

- **Metrics:** `sessions`, `activeUsers`, `engagementRate`, `conversions`
- **Dimensions:** `date` (or `week` for a coarser rollup)
- **Date range:** two consecutive 7-day ranges (current week + prior week), or a single
  `dateRanges` array with both periods passed to `runReport` for a native comparison
- **Notes:** Compare day-of-week to day-of-week, not raw totals, to avoid weekday/weekend
  seasonality skewing the read. Flag any date showing a sudden `(other)` or `(not set)` spike
  in channel/page dimensions — it often means a tagging or tracking regression, not a real
  traffic swing.

## General Playbook Guidance

- Always request `activeUsers` alongside `sessions` — a session count spike without a
  corresponding user spike can indicate bot traffic or session-count-inflating bugs.
- Prefer relative date ranges (`NdaysAgo`, `today`) over hardcoded dates so a report stays valid
  when re-run on a schedule.
- When a report will be re-run automatically, request a stable dimension order and always sort
  explicitly — the API does not guarantee row order without an `orderBys` clause.
