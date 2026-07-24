# The Grounded Roadmap — census, one backlog, build waves, surface verdicts

*Written 7/24/26. Corrects FACILITIES-AUDIT.md's three flaws: grounds
scoring on the live record (via the census instrument), merges every
backlog into one ranked list, and walks the product as a customer on a
phone. Scope: core engine + the pilot home. Zero-data-entry compass
governs throughout.*

## The five sentences (phone version)

The live-record census now exists as a founder page (Tools → Record
Census) — open it once and tap **Copy census summary** to replace this
document's provisional readiness scores with production truth. Provisional
evidence says the registry is strong on this month's crisis systems (well
pump, pressure tank — serials, photos, dates) and near-empty on appliances
and verification dates, exactly the audit's blind spot. One backlog now
exists: 24 candidates scored on value, downside, data-readiness,
freshness, and effort — Wave 1 is Emergency Card, weekly brief, the
census fill session, and a two-line fix that makes photo-only reporting
work. Ecobee is dead on arrival (developer program closed), Govee's
official API is unreliable for leak sensors but its *alert emails* ride
our existing pipeline for free, and Airthings is the only true API
integration worth building. The customer surface review found the product
already mobile-honest except for three things: typing is still required to
send a photo, the calendar expects authorship instead of defaults, and
the founder's one-time import banners still squat on the daily home
screen.

---

# Part 1 — The census

## 1.1 The credential wall, stated plainly

This build environment holds no production credentials: Firestore rules
are member-locked (`dashboard/firestore.rules`), the service account
exists only as a write-only GitHub secret
(`.github/workflows/deploy-functions.yml`), and the backend proxy
verifies a signed-in user's token (`functions/index.js`). Rather than
fake a census from fixtures, **Phase 0 shipped as an instrument**: the
founder-only **Record Census** page (`dashboard/src/pages/Census.jsx`,
engine `dashboard/src/recordCensus.js`, PR #103) computes the full census
from the live record in the founder's authenticated browser.

**The binding step (3 minutes, Patrick):** open Tools → Record Census on
895, tap **Copy census summary**, paste it back. Every ★-marked
data-readiness score below is provisional until that paste.

## 1.2 What the census measures

- **Per-asset completeness 0–100**, weighted by what features consume:
  make/model 20 · install year 20 · verified condition 15 · location 10 ·
  serial 10 (found in the detail field *or* linked facts) · warranty link
  10 · service history 10 · photo 5 (`recordCensus.js`
  `assetCompleteness`).
- **Missing-systems diff** against a 20-entry template of what a ~5-acre
  well/septic/propane/generator/workshop property with a full appliance
  suite should register (`EXPECTED_RURAL_HOME`), each gap tagged with its
  cheapest zero-typing capture path.
- **Feature-fuel table** (`featureFuel`): per roadmap candidate, is the
  trigger data in the tank?

## 1.3 Provisional census (documented live evidence, pending the paste)

From this month's real interactions and the applied insight waves
(BACKLOG.md Slices 45/70–74 entries; DEMO.md):

- **Strong**: well pressure tank (Zilmet Hydro-Plus ZHP, serial
  900906331977, installed 7/26 by Sunwave), water pump (Grundfos MQ3-45,
  nameplate photos, warranty fact), standby generator (22kW, install
  2021 per records-index wave), furnace (replaced 2021 per closing-docs
  wave), radon mitigation (known unserviced, 5.7 pCi/L), propane
  (ownership + service plan resolved through the dedupe work).
- **Weak**: verified-condition dates (the `verified` flag exists on the
  Health Report but most verifications predate any cadence), warranty
  links outside the pump, location fields.
- **Almost certainly absent**: the entire appliance suite (washer, dryer,
  refrigerator, dishwasher, range) — consistent with `benchmarks.js`
  having no appliance entries; bath extractor fans exist as *work orders*
  (Slice 70's quote pack), not registry assets; workshop/outbuilding
  systems; electrical panel as a first-class asset.

## 1.4 The fill plan (zero typing)

One guided session closes every expected gap: on fixture data the
template computes ~11 nameplate photos + ~5 walkthrough questions; the
live number comes from the census page. Capture paths per gap are already
assigned (`EXPECTED_RURAL_HOME[].capture`); the existing machinery — the
assistant's photo→`log_system` flow (`pages/Assistant.jsx`,
`assistantActions.js`) and the resumable Walkthrough
(`pages/Walkthrough.jsx`) — carries all of it. **This session is a Wave 1
item because four Wave 2 features burn its output as fuel.**

---

# Part 2 — One backlog, ranked

## 2.1 Sources merged (nothing lives outside this list)

FACILITIES-AUDIT.md items 1–9 + reframings R1–R3 · BACKLOG.md open items
(design overhaul pause, Slice 4b founder store, document-AI extraction,
OCR upgrade, room profiles, technician share, dark mode) ·
INSIGHT-IDEAS.md Tier 1 (storm triggers, weather calendar, recall
matching; lead-gen ideas excluded by scope) · founder additions (Emergency
Card, weekly brief, simple vendor designation, photo-from-failure-site,
tiered sensors) · offers on the table (work-order drawer tabs, System Map
role layer, homeowner Assistant Log access) · parked tasks #67–69
(business scope — out).

## 2.2 Sensor tiering (ruthless, as ordered)

| Source | API reality | Tier | Verdict |
|---|---|---|---|
| **Airthings** | Public consumer API, key in hand | **A** | Build (Wave 3): humidity → bath-fan class, radon trend |
| **Ecobee** | Developer program closed to new signups since 2024 ([HA issue #131789](https://github.com/home-assistant/core/issues/131789), [ecobee developers](https://www.ecobee.com/en-us/developers/)) | **C** | **Discard.** HVAC anomalies stay human-detected |
| **Govee leak sensors** | Official API unreliable for the leak class ([govee2mqtt #378](https://github.com/wez/govee2mqtt/issues/378), [homebridge-govee #733](https://github.com/homebridge-plugins/homebridge-govee/issues/733)) | C as API / **A as email** | Don't integrate; its app's **alert emails** forward to the intake address — covered by machine-email telemetry below |
| **KitchenAid / appliance apps** | No public APIs | **C** | Discard. Humans with phones are the appliance sensor |

## 2.3 The ranked backlog

Scores 1–5. **Composite = 2·Value + Downside + Readiness + Freshness −
Effort.** ★ = provisional readiness pending the census paste. Rule
honored: readiness < 3 ⇒ nothing above Wave 2 without an attached fill
plan.

| # | Item | V | D | R | F | E | Σ | Wave |
|---|---|---|---|---|---|---|---|---|
| 1 | **Photo-only capture fix** — allow photo-without-text send (`Assistant.jsx:134` blocks it); store email image attachments as documents (`functions/gmail.js` `extractBody` drops them) | 5 | 4 | 5 | 5 | 1 | **23** | **1** |
| 2 | **Emergency Card** — per-home page for the worst night; built by ~30-min guided walkthrough; entries linked to dossiers so changes flag review | 5 | 5 | 2→5 after its own walkthrough | 5 | 2 | **22** | **1** |
| 3 | **Weekly email brief** — due tasks, overdue verifications, warranty expiries (`warranties.js`), stalls (`attentionInbox.js`), forecast windows (`forecast.js`); Gmail identity live, needs send capability | 5 | 4 | 4★ | 5 | 3 | **20** | **1** |
| 4 | **Census fill session** — one guided pass closing the registry gaps (`recordCensus.js` fill plan) | 4 | 4 | 5 | 4 | 2 | **19** | **1** |
| 5 | **Designated vendor per trade (simple)** — primary + fallback + one-line rationale on the network (`contractorDirectory.js`, `quoteRequest.js` `suggestedContractors` consumes it) | 4 | 3 | 5 | 4 | 2 | **18** | **2** |
| 6 | **Capital-event triggers** — benchmark window crossing auto-stages a work order (`benchmarks.js` + `forecast.js` + `workOrders.js`) | 5 | 5 | 2★ *(fill plan: item 4)* | 5 | 3 | **19** | **2** (after 4) |
| 7 | **Machine-email telemetry** — expectation table over the live poller (`functions/index.js` `emailPoller`): Generac/Govee/service-confirmation emails auto-forwarded by mailbox rule; a missing expected email is itself an alert | 4 | 4 | 4 | 5 | 3 | **18** | **2** |
| 8 | **Recall matching** — CPSC API against brand+model (INSIGHT-IDEAS #3) | 3 | 4 | 2★ *(fill plan: item 4)* | 5 | 2 | **15** | **2** |
| 9 | **Weather-driven calendar nudges** — NWS forecast → freeze/storm nudges riding the brief (INSIGHT-IDEAS #1–2) | 3 | 3 | 4 | 5 | 3 | **15** | **2** |
| 10 | **Airthings ingestion** — humidity/radon thresholds → priorities; alerts ride the brief | 4 | 4 | 3 (API key in hand, no code) | 5 | 4 | **16** | **3** |
| 11 | **Repair-vs-replace doctrine** — appliance rows in `benchmarks.js` + 50%-rule verdict pre-staged on parsed quotes | 4 | 3 | 2★ *(fill plan: item 4)* | 4 | 3 | **14** | **3** |
| 12 | **Standing authority (R3)** — thresholds under which routine PM auto-schedules with designated vendors; *hard dependency: items 3, 5, 6 live first* | 5 | 3 | 1 today | 5 | 4 | **15** | **3** |
| 13 | **10-year capital plan + spend smoothing** — extends `forecast.js`; bundling via `combinedQuoteEmail` | 3 | 3 | 3★ | 5 | 3 | **14** | **3** |
| 14 | **Annual walkthrough → State-of-the-Home** — yearly condition recharge producing `HomeReport.jsx`'s report | 3 | 3 | 5 | 3 (yearly founder-run ritual) | 2 | **15** | **3** |
| 15 | **Transferable dossier export (R1)** — the record as sale/insurance artifact | 3 | 2 | 4 | 4 | 3 | **13** | **3** |
| 16 | **Technician share access** (BACKLOG) — scoped visit access; feeds vendor accountability | 2 | 2 | 3 | 4 | 4 | **9** | 3 |

## 2.4 The cut list

- **Ecobee, KitchenAid integrations** — Tier C APIs (see 2.2).
- **Govee official-API integration** — replaced by its email alerts via item 7.
- **Dark mode, room profiles** (BACKLOG) — zero effect on notice/remember/decide/coordinate.
- **Market dossier, lead-gen research** (tasks #67, #69; INSIGHT-IDEAS Tiers 2–3) — business scope, excluded by the brief.
- **"Upgrade nameplate OCR to Claude vision"** (BACKLOG) — stale: the assistant has done Claude-vision nameplates since Slice 22; strike it.
- **"Document upload pipeline with AI extraction"** (BACKLOG) — absorbed: assistant doc-upload + email intake are that pipeline; residual value folds into item 4.
- **"Design overhaul (paused 7/1)"** (BACKLOG) — superseded by Part 3's targeted verdicts; a general overhaul serves the builder, not the customer.
- **Slice 4b founder-only data store** (BACKLOG) — no current pain; revisit only if a homeowner ever sees founder data (none found).
- **Homeowner access to Assistant Log** — expands the surface the homeowner must attend; fails the compass.
- **System Map role-visibility layer** — audience is co-founders; current map suffices.

*Flag, per the one allowed exception: nothing in Waves 1–3 blocks a second
home — every new artifact (Emergency Card, designations, census) is keyed
to `propertyId`, and the brief/poller already route per-property
(`functions/gmail.js` `routeMessage`). Keep it that way.*

---

# Part 3 — The customer surface review

## 3.1 Screen inventory and verdicts

21 routes (`dashboard/src/App.jsx`). Audience: **O**=owner day-to-day,
**S**=spouse/household, **F**=founder-operator, **A**=auditor/successor.

| Screen | Audience | Real frequency | Verdict |
|---|---|---|---|
| Home (`Overview.jsx`) | O/S | daily-ish | **Keep — but demote the founder import banners** (closing-docs/records-index "Apply insights" cards still sit above the fold on mobile for one-time operations long since available; move to Import Records) |
| Assistant (`Assistant.jsx`) | O/S | the primary surface | **Keep; fix photo-only send** (line 134) |
| Property Record hub (Health/History/Coverage/Contractors) | A, then O | weekly at most | Keep — this is the auditor product |
| System dossiers (`SystemProfile.jsx`) | O/A | on-demand | Keep |
| The Plan: What's Next | O | weekly | Keep — **becomes the tap-target of the weekly brief** |
| The Plan: Care Calendar | O | monthly | **Demote** — once the brief pushes due tasks, the page is the archive, not the surface |
| The Plan: Priorities | O/F | weekly | Keep |
| The Plan: Forecast (`Forecast.jsx`) | O | quarterly | **Merge into Home Report** — two money pages is one too many |
| The Plan: Home Report (`HomeReport.jsx`) | O/A | quarterly | Keep (absorbs Forecast) |
| Walkthrough / Import Records | F | rare | Keep, already demoted under Tools |
| Assistant Log / Record Census | F | ops | Keep, founder-only |
| System Map (`Schematic.jsx`) | F (co-founders) | rare | Keep, demoted |
| Business plane (Ops, Work Orders, Network, Profiles, Ideas) | F | daily (founder) | Keep — this **is** the operator mode the audit asked for; it already hides from every other role (`roles.js` `business`) |

**Kill: nothing.** The audit's fear of builder-screens was mostly
pre-answered by the role system — the homeowner view is already four nav
items (`roles.js` NAV.homeowner). The residue is the three demotions
above.

## 3.2 Configuration burden audit

| Setting | Today | Verdict |
|---|---|---|
| `verifyFrequencyMonths` per system (`HealthReport.jsx`) | founder types a number per system | **Default from `benchmarks.js` by category**; override only on exception |
| Care-calendar authoring | founder writes month+task rows | **Seed from `SEASONAL_PLAYBOOK`** (`maintenanceIntelligence.js`) at onboarding; owner authors nothing |
| `emailTag` (`Overview.jsx`) | one-time, one word | Fine — set at onboarding, never touched |
| Warranty entries | manual or parsed | Migrate to email-parse-first (registration confirmations → intake) |
| Vendor designations (item 5) | new | One guided founder pass, then event-driven |
| Stall thresholds (`attentionInbox.js` STALL_DAYS) | code constants | Correct — never expose as settings |
| View-as, tier/rate fields | founder-only, one-time | Fine |

Net: after the two defaults ship, the *ongoing* settings surface for the
owner is **zero** — which is the white-glove bar.

## 3.3 The three journeys, walked on mobile (390px, mock build)

**(a) "Something just broke and I'm standing in front of it."**
Hamburger → Assistant (2 taps) → camera icon → shoot → **blocked: the
send button is disabled until text is typed** (`Assistant.jsx:402`
`disabled={sending || !input.trim()}`). Today's journey: 3 taps + forced
typing = **fail by the stated rule (typing is a defect)**. The email
alternative — photo to the intake address — currently *loses the photo*
(`gmail.js` reads text parts only). Fix is item 1, a channel fix, not a
screen fix: photo-only send with an implied "what's this?" prompt, and
attachment persistence in the poller.

**(b) "The brief said something is due — I tap."**
Cannot be walked: the brief doesn't exist yet (item 3). The landing
surface does — What's Next and the work-order drawer are mobile-clean —
so the journey is one deep link per brief line. Channel gap, not screen
gap.

**(c) "My spouse opens this for the first time during an emergency."**
Sign-in (member access already modeled) → homeowner view: four nav items,
calm home screen, Request button (Slice 31), assistant that answers only
from the record (`assistant.js` scope guard). For *routine* operation:
passes, genuinely. For the emergency itself: **dead end — no screen in
the app contains "where is the water shutoff."** First-login also plays
the guided tour (`tourSteps.js`) — correct for onboarding, an obstacle at
2am; the Emergency Card must be reachable pre-tour, pre-search, and
printable. Fix is item 2, and it is the top of Wave 1 for exactly this
journey.

## 3.4 Top 5 UX changes (same scoring compass)

1. **Photo-only send + attachment-preserving intake** (journey a; item 1).
2. **Weekly brief as the primary surface, app demoted to tap-target**
   (journey b; item 3).
3. **Emergency Card pinned above the tour, printable** (journey c; item 2).
4. **Kill authored configuration**: benchmark-default cadences +
   playbook-seeded calendar (3.2).
5. **Demote the founder import banners off Home; merge Forecast into Home
   Report** (3.1).

---

## What happens next

1. Patrick: open **Tools → Record Census** (live after this deploy), tap
   **Copy census summary**, paste it back — the ★ scores update and Wave
   2's order finalizes.
2. Build proceeds: item 1 (hours, not days), then Emergency Card, then
   the brief, then the fill session — each a normal slice with tests.
