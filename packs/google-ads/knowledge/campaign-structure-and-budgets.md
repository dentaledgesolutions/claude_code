---
type: knowledge
title: "Campaign Structure, Budgets, and Bid Strategies"
description: "Explains campaign settings, daily and shared budgets, the overspend rule, monthly spend limits, and core bid strategies."
tags: [google-ads, ppc, budgets, bidding]
timestamp: 2026-07-17
sources: [https://developers.google.com/google-ads/api/docs/start, https://support.google.com/google-ads]
---

# Campaign Structure, Budgets, and Bid Strategies

## Campaign Settings

Each campaign defines: campaign type, geographic and language targeting, network settings (e.g.
whether Search partners or Display expansion are included), ad scheduling (day-parting), device
targeting/adjustments, start/end dates, and the bid strategy. These settings apply to every ad
group and ad within that campaign — there is no per-ad-group override for most of them.

## Budgets

- **Daily budget** — the average amount an advertiser is willing to spend per day for a single
  campaign. Google Ads treats this as an *average*: actual daily spend can vary day to day to
  capture more conversion opportunity, as long as the campaign does not exceed roughly the
  monthly cap described below.
- **Shared budget** — a single budget pool assigned across two or more campaigns, useful when
  campaigns should compete for the same overall spend cap instead of each having an isolated
  daily budget.
- **The ~2x daily overspend rule** — Google Ads may spend up to about **2x** a campaign's daily
  budget on any given day when it detects higher opportunity (e.g. more traffic or conversion
  potential). This is qualitative headroom, not a hard per-day cap on its own — the real
  ceiling is the monthly limit below.
- **Monthly spend limit** — over a full calendar month, a campaign's total spend is capped at
  roughly the daily budget multiplied by the average number of days in a month (so short-term
  overspend days are offset by lower-spend days elsewhere in the month). Advertisers should
  budget by monthly cash flow, not by naively multiplying daily budget × days.

## Bid Strategies

- **Maximize Conversions** — an automated strategy that sets bids to get the most conversions
  possible within the campaign's budget, without targeting a specific cost-per-acquisition.
- **Maximize Conversion Value** — the value-based counterpart: bids are set to maximize total
  conversion value (revenue) within budget, useful when conversions carry different values.
- **Target CPA (tCPA)** — an automated strategy that sets bids aiming for an average cost per
  conversion at or near the advertiser's target; actual CPA will fluctuate around the target.
- **Target ROAS (tROAS)** — sets bids aiming for a target return on ad spend (conversion value
  ÷ cost); requires reliable conversion value data to work well.
- **Manual CPC** — the advertiser sets the max cost-per-click bid directly per keyword or ad
  group, with no automated bid adjustment from Google (optional Enhanced CPC can nudge bids up
  or down based on conversion likelihood).

## How Changes Ripple

- Editing a **shared budget** affects every campaign attached to it simultaneously.
- Raising or lowering a **budget significantly**, or **switching bid strategies**, can reset the
  automated bidding system's "learning phase" — a period of a few days where performance may be
  unstable while the algorithm recalibrates on the new constraints.
- **Pausing or removing** a campaign, ad group, or ad immediately stops it from entering
  auctions; budget allocated to it becomes available to sibling campaigns only if it is on a
  shared budget.
- Changes to **targeting or bid strategy** at the campaign level immediately change which
  auctions every ad group beneath it is eligible to enter — there is no gradual rollout.
