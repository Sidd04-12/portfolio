# Portfolio — Ops Console

My portfolio, built as a systems monitoring console rather than a conventional project list.
Each project is a "service" with a status, live-updating sparkline, and a drill-down panel
showing its architecture and runtime details.

**Live:** deployed on Vercel (link in the repo's About section)

## Why this shape

I build backend distributed systems — Kafka, Postgres, Redis, containers. A dashboard is the
interface I'd actually use to look at them, so the site's form says something about the work
rather than just describing it. Drilling into a service card *is* reading the project
description, so the concept doesn't sit in front of the content as a toll gate.

## Design notes

- **Palette:** instrument-panel amber (`#F2994A`) on deep blue-black, rather than the usual
  terminal-green-on-pure-black. Semantic colours (healthy / degraded / critical) are separate
  from the accent, so status reads independently of branding.
- **Type:** IBM Plex Sans and IBM Plex Mono — one superfamily, designed for technical systems.
- **Themes:** full light and dark palettes, driven by CSS custom properties. Respects the OS
  setting and offers an explicit toggle that overrides it in both directions.
- **Motion:** sparklines drift, an event log streams, and a clock ticks — all disabled under
  `prefers-reduced-motion`. An archived project's chart deliberately doesn't animate, because
  an archived project isn't serving traffic.

## Honesty constraints

Deliberate decisions, since a portfolio that overstates is worse than one that doesn't:

- No fabricated metrics. Where something hasn't been measured, it renders as `—` rather than a
  number that sounds good.
- The `VERIFIED` findings on the job scheduler are results that were actually observed from
  running it, not estimates.
- Projects that aren't published show as such instead of linking somewhere dead.

## Stack

A single static `index.html`. No framework, no build step, no dependencies beyond a Google
Fonts stylesheet — which keeps it fast and means there's nothing to rot.

## Local development

```bash
python -m http.server 8085
# open http://localhost:8085
```
