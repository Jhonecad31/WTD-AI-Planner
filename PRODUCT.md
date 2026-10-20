# PRODUCT.md — WhatToDo AI Planner

## What it is
A trip-planning web app, "powered by WhatToDo In Cancun" (whattodoincancun.com), a tour operator in Cancun & Riviera Maya. A traveler enters arrival and departure dates, stay, companions, budget and interests; the planner builds a day-by-day itinerary from WhatToDo's real catalog (via Bokun, read-only) with live prices, then emails a PDF to the traveler and an operational lead to the human sales team, who books manually.

## Who uses it
- **Travelers** (US, Canada, Mexico, Europe) planning 3–10 nights in Cancun, often families and couples, on phones as much as desktops, in English or Spanish. They want a credible plan fast and a human to book it.
- **Sales agents** (WhatToDo call center) who receive the lead email and book in Bokun.
- **Andre Palacios** (owner) who reviews leads in an admin panel.

## Product truth that must not change
- Only products that exist on whattodoincancun.com are recommended; prices come from Bokun, never invented.
- Age rules: products with minimum age or adult-only tickets are excluded when minors travel.
- Nothing is booked or charged inside the app; a specialist closes the sale.
- Bilingual EN/ES. Prices in USD.

## Brand & visual identity (established, inherited from the live site)
Nunito (300/600/700), green primary (#15803d, hover #16a34a), brand gradient #00AAFF → #192F5D, navy #192F5D for headings/accents, ink #1a1a1a, deal orange #ff6a00, lime #81bd00. Pill buttons, rounded-xl cards, generous whitespace, real tour photography. Friendly, confident, concrete; never corporate or generic. See `src/styles/tokens.css` and `src/content/brand.ts`.

## Surfaces
- `/` landing — Persuade mode.
- `/plan` six-step wizard — Operate mode; success = a traveler finishes the flow and sends the itinerary.
- `/admin` (later) — Operate mode for sales agents.

## Constraints
Next.js 16 App Router, Tailwind 4, next-intl, no HeroUI components in use (own small UI kit in `src/components/ui`). Must work at 375px with no horizontal scroll; keyboard accessible; fast on mobile data.
