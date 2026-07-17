---
type: knowledge
title: "GA4 Fundamentals"
description: "What Google Analytics 4 is and how its event-based data model, properties, and data streams work."
tags: [ga4, google-analytics, data-model, analytics]
timestamp: 2026-07-17
sources: [https://developers.google.com/analytics/devguides/reporting/data/v1, https://support.google.com/analytics]
---

## What GA4 Is

Google Analytics 4 (GA4) is Google's current web/app analytics platform, built around a single
unified, event-based data model that spans websites and mobile apps. It replaced Universal
Analytics (UA), which Google fully sunset (standard UA processing stopped July 2023; UA 360
followed in 2024). GA4 is the only Google Analytics platform now receiving new data.

## Core Data Model

- **Events are the atomic unit of data.** Everything a user does — a page view, a click, a
  purchase, an app screen view — is recorded as an event. There is no separate "hit type"
  hierarchy like UA's sessions/pageviews/events/transactions; GA4 has only events.
- **Parameters** are key-value pairs attached to an event that describe it (e.g., a `page_view`
  event carries `page_location` and `page_title` parameters; a `purchase` event carries `value`
  and `currency`). Parameters can be automatically collected, enhanced-measurement-based, or
  custom.
- **User properties** describe the user or device (e.g., a custom `user_type` or `plan_tier`)
  and persist across events and sessions, unlike event parameters which are per-event.
- **Sessions** are derived, not directly logged: GA4 constructs a session from a
  `session_start` event plus a `session_id`/`ga_session_id` parameter attached to subsequent
  events. A session ends after 30 minutes of inactivity by default (configurable) or at
  midnight, and there is no fixed cap on session length like UA's utm-based session resets.
- **Users** are counted via `active users` — users with an engaged session or an
  `engagement_time_msec` > 0 — rather than UA's broader, less-precise "users" metric. GA4 can
  identify users via User-ID, Google signals, or device ID, with configurable reporting identity
  methods (blended, observed, device-based).

## Properties vs. Data Streams

- A **property** is the analytics container that collects and processes data, holds
  configuration (conversions, audiences, custom definitions), and is what you report against.
- A **data stream** is a specific source feeding a property — a web stream, an iOS app stream,
  or an Android app stream. One GA4 property can have multiple data streams (e.g., web + iOS +
  Android for the same product), enabling cross-platform reporting in a single property, which
  was not possible in UA (which required separate web and app properties/views).
- Each web data stream has its own Measurement ID (`G-XXXXXXX`) used by the gtag.js/Google Tag
  snippet or Google Tag Manager to send events into that stream.

## GA4 vs. Universal Analytics — Key Differences

| Aspect | Universal Analytics | GA4 |
|---|---|---|
| Data model | Sessions, hits (pageview/event/transaction/social) | Events + parameters only |
| Cross-platform | Separate web/app properties | Single property, multiple streams |
| Bounce rate | Single-pageview sessions | Inverse of engagement rate (engaged sessions) |
| Default retention | Not applicable | User-level data retention configurable (2 or 14 months) |
| Sampling | Common at high volumes in UI reports | Native reports use thresholding/sampling differently; BigQuery export avoids UI sampling |
| Machine learning | Limited | Built-in predictive metrics (e.g., purchase probability, churn probability) |
| Access to raw data | Limited without 360 | BigQuery export available even on free tier |

## Why This Matters for Reporting Agents

Because everything is an event, any report an agent builds is really a query over event data
aggregated into metrics and sliced by dimensions via the GA4 Data API — there are no separate
"pageview reports" vs. "event reports" as distinct data sources the way UA had.
