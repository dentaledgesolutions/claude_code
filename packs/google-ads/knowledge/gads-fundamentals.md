---
type: knowledge
title: "Google Ads Fundamentals"
description: "Introduces Google Ads, its account hierarchy, campaign types, and how the ad auction works."
tags: [google-ads, ppc, fundamentals, advertising]
timestamp: 2026-07-17
sources: [https://developers.google.com/google-ads/api/docs/start, https://support.google.com/google-ads]
---

# Google Ads Fundamentals

Google Ads is Google's online advertising platform. Advertisers pay to show ads across Google
Search, the Search partner network, Display Network sites/apps, YouTube, Gmail, and Google
Shopping surfaces. Most spend is auction-based: advertisers set targeting and bids, and Google
selects and ranks eligible ads for each opportunity (an "impression").

## Account Hierarchy

Google Ads is organized in a strict four-level hierarchy:

1. **Account** — the top-level container, tied to billing, users, and access. A Manager account
   (MCC) can oversee many client accounts.
2. **Campaign** — sets the campaign type, budget, geographic and language targeting, network
   settings, and bid strategy. Budgets and campaign type live at this level.
3. **Ad group** — groups closely related keywords (or, for some campaign types, asset groups)
   and the ads that serve for them. Ad group-level bids can override campaign-level bidding in
   manual strategies.
4. **Ad / Keyword** — the actual creative (headlines, descriptions, images, video) and, for
   keyword-based campaigns, the keywords and match types that trigger it.

Changes cascade downward: pausing a campaign pauses every ad group and ad beneath it; pausing an
ad group pauses its ads and keywords, but the campaign and its budget continue running for other
ad groups.

## Campaign Types

- **Search** — text ads on Google Search results, triggered by keywords the advertiser chooses.
- **Performance Max (PMax)** — a single goal-based campaign that serves automatically across
  Search, Display, YouTube, Gmail, Maps, and Shopping using asset groups instead of ad groups;
  targeting and placement decisions are largely automated.
- **Display** — image/responsive ads shown on the Google Display Network (partner sites and
  apps), typically for awareness or remarketing.
- **Video** — ads served on YouTube and video partners (skippable in-stream, non-skippable,
  bumper, and other formats).
- **Shopping** — product listing ads driven by a Merchant Center product feed rather than
  keywords; shows product image, price, and store name.
- **Demand Gen** — visually rich ads across YouTube, Discover, Gmail, and Display surfaces,
  aimed at driving demand/consideration outside of active search intent.

## How Bidding and the Auction Work (High Level)

Every time a person's query or context matches an advertiser's targeting, eligible ads enter an
auction. Google computes an **Ad Rank** for each eligible ad using: the bid amount, the expected
quality of the ad and landing page (see Quality Score), the expected impact of ad formats/assets,
and the competitiveness of the auction context. Higher Ad Rank wins better positions; the actual
price paid is typically driven by the Ad Rank needed to beat the next-highest competitor, not
simply the advertiser's max bid — so a higher Quality Score can lower the price paid for the same
position. Automated bid strategies (see `campaign-structure-and-budgets.md`) let Google set
bids per auction in real time based on signals such as device, location, time, and audience,
rather than the advertiser setting a static bid.
