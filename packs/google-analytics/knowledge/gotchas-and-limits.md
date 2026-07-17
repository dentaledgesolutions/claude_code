---
type: knowledge
title: "GA4 Gotchas and Limits"
description: "Known GA4 data-quality pitfalls and Data API limits that reporting agents must account for."
tags: [ga4, google-analytics, limits, data-quality]
timestamp: 2026-07-17
sources: [https://developers.google.com/analytics/devguides/reporting/data/v1, https://support.google.com/analytics]
---

## Sampling and Thresholding

- **Sampling** applies when a query's underlying event volume is large relative to the
  property's data limits (more common on very high-traffic properties or long/complex date
  ranges); sampled results are estimates, not exact counts, and the API response indicates
  when sampling was applied.
- **Thresholding** is separate from sampling: GA4 withholds or aggregates rows for very
  low-count segments (often related to demographics/Google signals data) to protect user
  privacy, which can make small-audience breakdowns look artificially empty or incomplete.
- Both behaviors mean two reports pulled at different times, or with slightly different
  dimension/metric combinations, can return numbers that don't perfectly reconcile — treat
  small deltas as expected noise, not a bug, unless the gap is large.

## "(not set)" and "(other)" Rows

- **"(not set)"** appears when GA4 cannot determine a value for a dimension — e.g., missing
  UTM parameters producing "(not set)" channel, geo-lookup failures producing "(not set)"
  country, or a dimension that only applies to some hit/event types.
- **"(other)"** appears when a query would otherwise return more distinct dimension values than
  GA4's internal per-report row/combination limit allows; excess low-volume rows get collapsed
  into a single "(other)" bucket rather than each appearing individually.
- Large "(not set)" or "(other)" rows are a signal to investigate tagging quality, not
  necessarily a data-quality failure to hide from a stakeholder — surface it explicitly.

## Data Freshness and Processing Latency

- GA4 data is **not real-time in standard reports**; there is normal processing latency
  (commonly described as up to roughly a day, sometimes less) before standard reports fully
  reflect a day's events.
- The separate **Realtime reporting** surface (and the `runRealtimeReport` API method) shows
  activity from roughly the last 30 minutes but uses a different, less-complete data set than
  standard reports — do not treat realtime numbers as a preview of what the final standard
  report will show.
- Because of this latency, avoid running "today so far" comparisons against historical daily
  averages without explicitly flagging that today's number is partial and still processing.

## Cardinality Limits

- GA4 properties have caps on the number of distinct **custom dimensions and custom metrics**
  that can be registered per property (separate limits for event-scoped vs. user-scoped custom
  dimensions), which constrains how much custom parameter data can be surfaced in reports.
- Very high-cardinality dimensions (e.g., raw full-URL page paths with unique IDs, or unbounded
  user-generated strings) can trigger the "(other)" collapsing behavior described above and
  bloat report row counts — prefer normalized/bucketed dimension values where possible.

## Consent Mode Gaps

- When a user declines analytics/ad-storage consent (relevant chiefly in the EEA/UK/CH under
  Consent Mode), GA4 uses **modeling** to estimate the missing conversions and behavior rather
  than recording them directly, which introduces estimation uncertainty into totals from
  regions with lower consent rates.
- Google requires **Consent Mode v2** for properties serving EEA/UK/CH traffic; without it,
  personalized ads and some measurement features can be restricted, and reported numbers from
  those regions may undercount actual activity even after modeling is applied.
- Agents building cross-region comparisons should treat consent-heavy regions' numbers as
  directionally reliable but not exactly reconcilable to server-side or CRM truth data.

## Data API Quota Limits

- The GA4 Data API enforces **per-property and per-project quotas** on request counts, tokens,
  and concurrent requests, tracked separately for standard reporting vs. realtime methods; the
  exact numeric ceilings are published by Google and subject to change, so treat them as
  qualitative limits to design around (batching, caching, backoff) rather than fixed constants
  to hardcode.
- Requests that exceed a quota return an explicit error (typically resource-exhausted /
  quota-exceeded); a well-behaved agent should implement exponential backoff and avoid firing
  many near-duplicate report requests in a tight loop.
- Batching multiple metric/dimension combinations into fewer, wider `runReport` calls (within
  the API's compatibility rules) is generally preferable to many narrow calls, both for quota
  efficiency and for reducing "(other)"-row fragmentation across separate queries.
