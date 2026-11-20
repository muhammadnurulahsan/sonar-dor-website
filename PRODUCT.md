# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS (user's choice). No build step; deploys to any static host or cPanel. No backend.

## Users

Everyone in Bangladesh who follows gold prices: families buying jewellery for weddings and Eid, people saving in gold, small investors and traders, and jewellery shop owners checking the day's rate. Mostly on phones, often in daylight, in Bengali.

## Product Purpose

Show, in one place and in Bengali, (1) the international spot price refreshed every 5 minutes, (2) the official BAJUS price in Bangladesh, (3) what the international market implies the local price should be now, and (4) a plain-language signal on whether prices are leaning up or down. Success: a visitor knows today's bhori price and the likely direction within 10 seconds.

## Positioning

Most local sites only repost the BAJUS announcement. This one ties the BAJUS rate to the live international market, so it can say how far the official price has drifted and which way BAJUS is likely to adjust next.

## Operating Context

BAJUS (Bangladesh Jewellers Association) announces prices irregularly, sometimes several times a week; there is no BAJUS API, so the owner updates `assets/js/config.js` by hand. International data comes from free keyless APIs (gold-api.com, fawazahmed0 currency-api, open.er-api.com). Units: bhori (11.664 g), ana (1/16 bhori), rati (1/6 ana), gram. BAJUS prices include VAT; making charge (min 6%) is extra.

## Capabilities and Constraints

- Auto-refresh every 5 minutes; manual refresh with loading state.
- Forecast is a technical-indicator signal (moving averages, momentum, RSI, intraday drift) and must always be labelled as a signal, not financial advice.
- Works offline-degraded: shows last known price and a clear error with recovery.
- Bengali UI and Bengali numerals throughout.

## Evidence on Hand

Real BAJUS rates for November 2026 (in config.js). No testimonials, user counts, or press; do not invent them.

## Product Principles

1. Today's price first, everything else second.
2. Honest about uncertainty: every estimate says it is an estimate.
3. Plain Bengali a first-time buyer understands; no trader jargon without an explanation.
4. One-hand phone use: large targets, no hover-only information.
