# Handoff: Homeowner Dashboard redesign

## Overview
A visual and structural redesign of the Charlottesville Home &amp; Property Services
dashboard (`paddythesaint/home-services`, `dashboard/`). The existing app is
React 19 + Vite + Tailwind 4 + Firebase; nothing about the data layer, routes,
or Firestore schema changes. What changes is the design layer: the dark-green
admin sidebar, white floating cards, native selects, and modal-driven requests
are replaced by a warm-paper surface with hairline-ruled sections, an editorial
serif voice, and a single **Simple / Detailed** switch that serves the two
audiences from one surface.

Two audiences, one codebase:
- **Simple** — the homeowner's view. No dollar figures anywhere. Figures count
  care given (tasks handled, systems on record, pros on call, next visit).
- **Detailed** — the operator's view. Costs, quotes, margins, work-order lanes,
  contractor response times. Labelled "Operator view — not shown to the
  homeowner" wherever it sits on a shared page.

A separate **Viewing as: Founder / Homeowner** toggle sits above the app (it
already exists in the codebase as the "View as" select) and decides which whole
surface renders; Simple/Detailed is the depth control *within* a surface.

## About the design files
`Homeowner Overview.dc.html` in this bundle is a **design reference written in
HTML** — a prototype of intended look and behavior, not production code to copy.
Recreate it inside the existing `dashboard/` React app using its established
patterns (React Router pages, `useItems`/`firestoreApi` data hooks, Tailwind 4
`@theme` tokens). Do not port the HTML file into the app.

Open it in a browser: a top bar toggles Founder / Homeowner, and each mock has
its own Simple / Detailed control.

## Fidelity
**High-fidelity.** Colors, type sizes, rule weights, and spacing are final and
listed below. Recreate pixel-for-pixel with Tailwind classes bound to the tokens
in `index.css`. The dummy content (property names, dates, amounts) is plausible
fill — keep the real Firestore data.

## Screens

### 1. Homeowner Overview — "Simple" (option 2a, approved)
Replaces `dashboard/src/HomeownerHome.jsx`.

**Purpose:** answer three questions — is my home okay, what's happening, how do
I reach you — with no operational machinery visible.

**Layout:** one surface panel (`--color-surface`, 1px `--color-line-2` border,
18px radius, `--shadow-card`). Header strip 16px/32px with the address eyebrow
left, Simple/Detailed segmented control + avatar right, 1px `--color-line`
bottom border. Body padding 40px 44px 36px, in this order:

1. **Headline** — `font-display` 44px/1.1, `-0.01em`. Two clauses: "Your home is
   in good shape." in `--color-ink` + " One item sits on our watch list." in
   `--color-ink-4`. Driven by system conditions (urgent → "We're on it — N items
   being handled with priority").
2. **Lede** — 14.5px/1.65 `--color-ink-2`, max-width 620px, `text-wrap: pretty`.
   Latest visit note, one sentence, plus the open item.
3. **Condition meter** — 8px tall, 2px gaps, `flex: count` segments in status
   colors, `border-radius: 999px`; legend row below at 12.5px with 7px dots.
   Max-width 620px.
4. **Figure row** — 4 columns, 28px gap, 36px above. Each figure: top rule
   (first one `--color-rule` 1px, the rest `--color-line-2`), value
   `font-display` 32px/1 `white-space: nowrap`, label 12px `--color-ink-3`.
   Values: `12 tasks handled for you`, `9 systems on record`,
   `4 trusted pros on call`, `Aug 12 next visit · Monticello Air`.
   **No currency on this surface.**
5. **Two-column body** — `1.55fr 1fr`, 40px gap, 44px above.
   Left: "In motion" and "Recent care" as hairline row lists (row = 14px/0
   padding 14px 0, top border `--color-line`, last row also bottom border;
   title 14.5px/500 ink, meta 12.5px ink-3, right-hand status word 12.5px —
   `--color-status-warn` for Attention, `--color-ink-2` for Scheduled/Waiting).
   Right: "Your team" as a `--color-sunk` block (20px padding, 14px radius,
   names 14px/500, roles 12.5px ink-3, hairline divider then a 12.5px note) and
   a "Membership" pair of lines — plan and "Nothing due — next statement Aug 1".
6. **Operator band** — `<Detail>`-gated. `--color-sunk` variant `#F3F1E9`,
   26px/28px padding, 14px radius. Eyebrow reads "Operator view · not shown to
   the homeowner", mono count right. Two CSS-grid tables: work orders
   (`1.5fr 1fr .8fr .7fr .7fr` — order, pro, quote, margin, lane) and systems
   (`1.6fr 1fr 1fr .8fr` — system, installed, last serviced, state with dot).
   Header cells 10.5px uppercase `#9A9C8E`; body cells 12.5px, 9px vertical
   padding, 1px `#E4E0D4` top border.
7. **Ask bar** — always open, 40px above. White field, 1px `--color-line-2`,
   16px radius, 8px padding with 20px left inset; green dot, placeholder
   "Something need attention? Tell Sally — she reads these directly.", 12px-radius
   `--color-brand-700` Send button (11px/20px, 13.5px/500). Beneath, a 12px
   `--color-ink-4` line naming the team and the phone fallback.
   **This replaces the "Request service" modal entirely.**

**Mobile (390px):** single column, 22px gutters. Headline 29px, figures 2×2,
"In motion" rows keep the two-line form, team collapses to two 14px lines. The
ask bar becomes a footer strip (`--color-sunk-2`, 1px top rule) with a 44px-min
Send button. Bottom tab bar is optional (see 1b) — if used, 56px min height.

### 2. Command — "Detailed" / founder (option 3a)
Replaces `pages/Ops.jsx` + `pages/WorkOrders.jsx` landing.

**Layout:** 1320px panel; 214px left rail (`--color-sunk`, 1px
`--color-line-2` right border) + fluid main column.

- **Rail:** wordmark in `font-display` 16px/1.25 `--color-brand-700`; nav group
  "Run the business" with 13.5px items, active item on white with
  `--shadow-pill` and a mono count right (attention counts in
  `--color-status-warn`); "Viewing as" block — outlined 13px control + 11.5px
  explainer; footer identity 12px/11.5px.
- **Top strip:** search affordance (`--color-sunk` 10px radius, 7px/12px, 13px
  placeholder), date, invoicing date, "New work order" button
  (`--color-brand-700`, 10px radius).
- **Attention inbox:** `font-display` 27px headline "Four things need you
  today." + mono "sorted by age". Rows are a
  `12px 1.9fr 1fr 82px 96px` grid — dot, title 14px/500, property 12.5px,
  age in mono colored by severity, action word right-aligned.
- **Business figures:** 5 columns — `$1,046 recurring monthly`,
  `$12.4k work coordinated, MTD`, `21% blended margin`, `12 open orders`,
  `2.4d median time to schedule`. Same figure treatment at 28px.
- **Pipeline:** 5 equal columns (Triage / Quoting / Scheduled / In progress /
  To invoice). Each column is a headed hairline list — 12.5px/500 lane name +
  mono count, then entries of 12.5px title and a 10.5px mono meta line
  (`$ · margin · date`, or a severity color for blocked/aging). **No card
  chrome** — bottom hairlines only.
- **Bottom split** `1.5fr 1fr`, 34px gap: portfolio table
  (`1.7fr 1fr .85fr .7fr .85fr` — property, member, plan, open, health-with-dot),
  then "Today" (58px mono time column + title/meta) and "Bench · by response
  time" (`1.5fr .8fr .6fr`, response time colored by SLA).

### 3. Health of the house (option 4a)
Replaces `pages/HealthReport.jsx`. Headline "Eight systems are behaving." +
clause. Lede names the evidence (own eyes, closing package, energy audit).
Condition meter, then "Every system" as a `12px 1fr 118px` grid: dot (8px,
6px top offset), body (name 15px/500 + 13.5px/1.55 sentence), right column a
mono 11.5px last-serviced date — `--color-status-warn` when "never serviced".
Detailed adds a wrap of mono 10.5px chips on `--color-sunk` variant
`#F0EDE4`, 6px radius, 4px/8px padding: install year, warranty, source
document, cost estimate. Closes with an outline pill "Show the other three
systems".

**Rule:** every system reads as a plain sentence. No spec tables in Simple.

### 4. The year of care (option 4b)
Replaces `pages/CareCalendar.jsx`. Headline "Twenty-two visits a year," +
clause. Four season blocks in a `132px 1fr` grid, 26px apart: season name
`font-display` 20px + mono 10.5px range (current season appends "· NOW").
Rows are hairline pairs — label 14px left, mono 11px date right. Completed rows
are `--color-ink-4` with `line-through` and a `--color-status-good` "DONE
JUN 2"; upcoming rows are 500-weight ink with a muted date. Detailed appends a
sunk block of four figures: visits planned, annual pass-through, in-house vs
subbed, heaviest month.

**Rule:** no month grid. Seasons carry the rhythm; a homeowner never counts cells.

### 5. What's next (option 4c)
Replaces `pages/PriorityList.jsx` — renamed from "90-Day Priority List".
Headline "Two things this week." + "Nothing else is urgent." Lede states
explicitly that no decision is required. Three equal columns — This week /
Next 30 days / On our radar — each headed by a rule (first `--color-rule`,
rest `--color-line-2`), 13px/500 label + mono count. Items: dot + 14px/500
title on one line, then a 13px/1.55 sentence indented 15px. Detailed adds a
mono 10.5px line under each (cost, margin, WO id, reserve).

### 6. Everything we've done (option 4d)
Replaces `pages/JobHistory.jsx` — renamed from "Job History". Headline
"Twelve jobs since you joined." + "None of them twice." Category pills top
right (active = 1px `--color-line-2` outline pill). Entries grouped under a
year eyebrow in a `78px 1fr 168px 92px` grid: mono date, 14px description,
13px `--color-ink-3` who did it, and a `<Detail>`-only right column of mono
`$185 · 24%`. Detailed closes with a sunk summary strip: total coordinated,
blended margin, pros used.

**Rule:** the cost column does not exist in Simple — it is not blanked or
zeroed, the grid column is dropped.

## Interactions & behavior
- **Simple / Detailed** — `ViewModeProvider` + `useViewMode()` in
  `components.jsx`. Persist per user (localStorage key `viewMode`, or the
  member's profile doc). Homeowner accounts never get the control; founder and
  staff do.
- **Viewing as Founder / Homeowner** — keeps the existing "View as" behavior
  (still signed in as yourself, only changes what's shown) but rendered as a
  segmented pill: active = `--color-brand-700` fill, `#F5F3ED` text; inactive =
  transparent, `--color-ink-2`. 120ms `background`/`color` transition.
- **Ask bar** — Enter or Send writes a `workOrders` doc exactly as
  `HomeownerHome.sendRequest` does today (`lane: "triage"`,
  `source: "homeowner"`). On success the field clears and the item appears in
  "In motion" as "received — we're arranging it". No modal, no page change.
- **Rows** — whole row is the link target when it has a detail page; hover
  `bg-ink/[0.02]` only. Status is dot + word, never color alone.
- **Modals** — reserved for destructive confirmation. Everything a homeowner
  starts is inline.
- **Responsive** — below 900px: rail becomes a drawer, figure rows go 2-up,
  two-column bodies stack, tables become the two-line row form. Hit targets
  ≥44px.

## State
| State | Where | Notes |
| --- | --- | --- |
| `viewMode` | `ViewModeProvider` (app root) | `"simple" \| "detailed"`, persisted |
| `viewAs` | existing `Layout` | unchanged behavior, new control |
| `askText` | Overview page | controlled input for the ask bar |
| `sent` | Overview page | inline confirmation line, no toast |
| Firestore | `useItems(uid, …)` | `healthReport`, `workOrders`, `jobHistory`, `visitNotes`, `priorityList` — unchanged |

## Design tokens
All in `index.css` (drop-in replacement for `dashboard/src/index.css`).

Surfaces `--color-plane #EAE7DE` · `--color-surface #FCFBF7` ·
`--color-sunk #F2F0E7` · `--color-sunk-2 #F7F5EE` · `--color-field #FFFFFF`
Ink `#1C1E18` / `#5A5E50` / `#8D9081` / `#A8A79A`
Rules `--color-line #EFEBE0` (rows) · `--color-line-2 #E0DCD0` (panels, tables) ·
`--color-rule #1C1E18` (lead figure)
Brand `#1A291F` / `#24382B` / `#3F6B4A` / `#E9EDE4`
Status good `#4A7A55` · warn `#A8701F` · critical `#9E3B2C` · idle `#C9C6B8`
Type — display **Newsreader** (400, opsz 32, -0.01em) at 44/32/29/27/26px;
UI **Instrument Sans** at 14.5/14/13.5/12.5/12/11px (500 is the only weight above
regular); data **JetBrains Mono** at 11.5/11/10.5px, tabular.
Eyebrows: 11px, uppercase, 0.14em tracking, `--color-ink-3`.
Radii 18px panel · 14px block · 12px control · 999px pill.
Shadows `--shadow-card`, `--shadow-raised`, `--shadow-pill` (see `index.css`).
Spacing rhythm: 40/44px section gaps, 28px figure gaps, 14px row padding.

**Rules of the system:** two rule weights only; headlines are never bold;
uppercase only in eyebrows; currency and margin never appear in Simple; color
never carries meaning without a dot and a word.

## Assets
- `docs/design-assets/895-old-ballard-aerial-front.jpg` (already in the repo,
  4000×2250) — used as the masthead in option 1c only. 2a/3a are photo-free.
- No icon set required; status is dots, nav uses dots. Existing
  `public/icons.svg` can be dropped if you adopt 2a/3a as-is.

## Files
- `Homeowner Overview.dc.html` — the design reference. A Founder/Homeowner
  toggle sits at the top. Turn 4 = the four remaining homeowner pages
  (4a Health, 4b Year of care, 4c What's next, 4d Everything we've done) with a
  shared Depth switch; turn 3 = 3a Command (operator); turn 2 = 2a approved
  homeowner Overview; turn 1 = earlier explorations 1a/1b/1c, kept for context.
- `index.css` — drop-in replacement for `dashboard/src/index.css`.
- `components.jsx` — drop-in replacement for `dashboard/src/components.jsx`.
  Same export names as today (`Card`, `Button`, `Modal`, `StatTile`,
  `ConditionMeter`, badges, `PageHeader`, `DynamicForm`) so existing pages keep
  compiling, plus the new primitives pages should migrate to: `Section`, `Row`,
  `Figure`, `FigureRow`, `Segmented`, `Detail`, `AskBar`, `ViewModeProvider`,
  `useViewMode`.

### Suggested order of work
1. Swap `index.css` + install the three font packages.
2. Swap `components.jsx`, wrap the app in `ViewModeProvider`, put `Segmented`
   in `Layout`'s top bar next to the existing View-as control.
3. Rebuild `HomeownerHome.jsx` as 2a using `Section` / `Row` / `Figure` /
   `AskBar`, and move its "Request service" modal to the inline ask bar.
4. Rebuild `pages/Ops.jsx` as 3a.
5. Rebuild the four homeowner pages as 4a–4d, in that order. They share the
   same primitives; no new ones are needed.
6. Sweep anything left: replace `<Card>` grids with `<Section>` + `<Row>`, and
   wrap every cost/margin/contractor-economics block in `<Detail>`.

### Copy changes to confirm
- "90-Day Priority List" → **What's next**
- "Job History" → **Everything we've done**
- "Care Calendar" → **The year of care**
- "Health Report" → **Health of the house**
Route paths can stay as they are; only the labels and page titles change.
