---
type: knowledge
title: "GA4 Key Metrics and Dimensions"
description: "Core GA4 metrics and dimensions with one-line definitions and their GA4 Data API names."
tags: [ga4, google-analytics, metrics, dimensions, data-api]
timestamp: 2026-07-17
sources: [https://developers.google.com/analytics/devguides/reporting/data/v1, https://support.google.com/analytics]
---

## Core Metrics

Each metric below is listed with its plain-English definition and its API name as used in
`runReport` / `runRealtimeReport` requests to the GA4 Data API (`metrics: [{ name: "..." }]`).

- **Sessions** — `sessions`: the count of sessions, where a session is a period of user
  engagement started by a `session_start` event and closed after ~30 minutes of inactivity
  (default) or at midnight.
- **Active Users** — `activeUsers`: the number of distinct users who had an engaged session or
  logged an `engagement_time_msec` greater than zero during the reporting period.
- **Engaged Sessions** — `engagedSessions`: sessions that lasted 10+ seconds (default threshold),
  had a conversion event, or had 2+ page/screen views.
- **Engagement Rate** — `engagementRate`: engaged sessions divided by total sessions, expressed
  as a ratio; GA4's replacement for (and inverse-flavored analog of) UA's bounce rate.
- **Conversions** — `conversions`: the count of events marked as key events/conversions in the
  property, summed across all conversion-tagged event types (or filterable to a specific
  `eventName`).
- **Total Revenue** — `totalRevenue`: the sum of all revenue from purchase, in-app-purchase, and
  subscription events, combining `purchaseRevenue`, `refundAmount`-adjusted figures, and related
  revenue streams into one aggregate.

## Core Dimensions

- **Date** — `date`: the calendar date (`YYYYMMDD` format in raw form) the event was logged, in
  the property's configured reporting time zone.
- **Session Default Channel Group** — `sessionDefaultChannelGroup`: GA4's rule-based marketing
  channel classification for the session (e.g., Organic Search, Paid Search, Direct, Referral,
  Organic Social, Email), derived from source/medium and campaign parameters.
- **Page Path** — `pagePath`: the URL path (excluding host and query string by default, though
  a `pagePathPlusQueryString` variant exists) of the page where an event occurred.
- **Country** — `country`: the country inferred from the user's IP address (rows can appear as
  "(not set)" when geo lookup fails or IP data is unavailable).
- **Device Category** — `deviceCategory`: the type of device used in the session — `desktop`,
  `mobile`, or `tablet` — derived from user-agent parsing.

## Notes on API Usage

- Metric and dimension **API names are case-sensitive** and use camelCase (e.g.,
  `activeUsers`, not `active_users` or `ActiveUsers`).
- A single `runReport` request can combine multiple dimensions and metrics, but GA4 enforces
  compatibility rules — not every metric can be paired with every dimension in one request; the
  API returns an error listing incompatible combinations when this happens.
- Custom dimensions/metrics (defined per-property from event or user parameters) use the prefix
  `customEvent:` or `customUser:` in the API rather than the built-in names above.
