---
name: সোনার দর
description: A clean, conventional Bengali price website. White pages with generous space, near-black text, hairline tables and cards, one quiet brand colour. Looks like a well-made news or finance site, not a showpiece.
colors:
  bg: "#FFFFFF"
  bg-alt: "#F8F9FA"
  text: "#1A1D21"
  text-2: "#3D434A"
  muted: "#6A7178"
  line: "#E6E8EB"
  line-2: "#D5D9DD"
  brand: "#9A6A12"
  brand-dark: "#7C540C"
  brand-soft: "#FBF6EC"
  up: "#137A3E"
  down: "#C22B2B"
  up-bg: "#EEF8F1"
  down-bg: "#FDF0F0"
  focus: "#1F5FD1"
  selection: "#F3E3BF"
  logo-gold: "#D9A93C"
  logo-gold-light: "#E9C46A"
typography:
  family: "Noto Sans Bengali (self-hosted, wght 400–600)"
  body: { size: 16.5px, line-height: 1.7 }
  sizes: { h1: 40px, h2: 30px, main-price: 56px, market-price: 40px, small: 13.5–15.5px }
  mobile: { h1: 30px, h2: 25px, main-price: 42px }
  weights: { regular: 400, medium: 500, semibold: 600 }
  numerals: "Bengali digits via Intl bn-BD, tabular-nums"
radius: { control: 8px, card: 12px }
shadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06) — cards only"
spacing: { section: "96px desktop / 64px mobile", hero: "72px top", container: "1140px max, 24px gutter" }
motion: "150ms colour transitions; spot price flashes green/red for 1.2s when it changes"
---

# Overview
Light only. Sections alternate white and `bg-alt`, separated by a hairline. Content sits in a 1140px container with wide margins; every section has a plain heading, one line of explanation and its content. No dark bands, no decorative gradients.

## Structure
Ticker strip (live world price, dollar, 22K) → sticky header with text nav → hero (today's date, 22K price with change badge, estimate line, three other karats, two actions; market card on the right) → karat table → signal (summary card + indicator table) → chart with high/low/change → BAJUS history table → calculator → FAQ + share → footer.

## Components
- **Buttons:** 44px, 8px radius. Primary is near-black fill; secondary is white with `line-2` border. One primary per view.
- **Cards:** white, `line` border, 12px radius, the single shadow token.
- **Tables:** `line` border, header row in `bg-alt`, 18px × 24px cells, first column sticky on phones.
- **Badges:** 6px radius, `up-bg` / `down-bg` with matching text and a small triangle.
- **Tabs:** joined button group, selected = near-black fill.
- **Inputs:** 48px, `line-2` border, blue focus ring.

## Do not
Pills, gradient meters, glow, glass, emoji, outline chips, dark hero bands, eyebrow labels, display fonts.
