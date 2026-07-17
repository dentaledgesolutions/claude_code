---
type: knowledge
title: "Google Ads Best Practices and Money-Risk Pitfalls"
description: "Covers practical account-management guidance and common pitfalls that put ad spend at risk, and flags which changes need human approval."
tags: [google-ads, ppc, best-practices, risk-management]
timestamp: 2026-07-17
sources: [https://developers.google.com/google-ads/api/docs/start, https://support.google.com/google-ads]
---

# Google Ads Best Practices and Pitfalls

## Practical Guidance

- Maintain a negative keyword list at the campaign or shared level and review search terms
  reports regularly — this is the primary defense against irrelevant traffic on broad match.
- Give automated bid strategies (Target CPA, Target ROAS, Maximize Conversions/Value) enough
  conversion volume and a stable measurement window before judging performance; frequent
  target or budget changes prevent the algorithm from converging.
- Keep conversion actions clearly defined and deduplicated so reported conversions reflect real
  business outcomes, not inflated counts.
- Segment campaigns by meaningfully different goals, geographies, or asset sets rather than
  fragmenting budget across many near-duplicate campaigns.
- Review Performance Max asset group and placement reports periodically, since PMax's automated
  targeting can overlap with other campaigns in ways that are not obvious from the campaign
  list alone.

## Money-Risk Pitfalls

- **Broad match without negatives** — broad match keywords can match a very wide range of
  queries; without a negative keyword strategy, spend can go to irrelevant searches quickly.
- **Unbounded Target CPA / Target ROAS** — setting an unrealistic target (too aggressive or too
  loose) can cause the algorithm to either starve the campaign of impressions or spend
  inefficiently chasing an unreachable goal.
- **Budget changes resetting the learning phase** — large or frequent budget or bid-strategy
  changes can restart the automated system's calibration period, causing temporary performance
  volatility right when stability was needed.
- **Duplicate conversion tracking** — the same user action counted by more than one conversion
  tag (e.g. both a global site tag and a third-party pixel feeding the same action into Google
  Ads) inflates conversion counts and misleads bid strategies that optimize toward conversions.
- **Geo and schedule mistakes** — misconfigured location targeting (e.g. "People in your
  targeted locations" vs. broader presence/interest settings) or ad scheduling can serve ads
  outside the intended market or hours, wasting budget on unreachable audiences.
- **Performance Max cannibalization** — PMax can compete with an advertiser's own Search or
  Shopping campaigns for the same auctions, obscuring which campaign is actually driving a
  given conversion and complicating budget allocation decisions.

## Human Approval Required

**Budget changes and status changes (pausing/enabling/removing campaigns, ad groups, ads, or
keywords) directly control how much money is spent and whether spend happens at all.** These
actions should never be applied automatically without explicit human review and approval —
always surface the proposed change, its expected spend impact, and the reasoning, and wait for
confirmation before executing it.
