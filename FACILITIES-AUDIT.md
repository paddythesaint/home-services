# The Facilities Audit — three hostile readers walk the repo

*Written 7/24/26. Personas: a Class-A facilities director (20 years of PM
programs, unimpressed by consumer apps), the time-poor affluent homeowner
(pays for outcomes, does zero data entry), and a product strategist whose
only question is "what does this beat that a good handyman's number and a
Drive folder don't?" Scope: the core engine and the single pilot home only.
No business model, no scaling economics.*

---

## The thirty seconds

**This is a real system of record with a genuinely strong work-order and
intake spine — and a maintenance program that still runs on the owner's
attention.** The record answers questions excellently but initiates almost
nothing: every lifecycle today begins with a human noticing something, which
is precisely the job a facilities manager exists to eliminate. The highest-
value work is not another intelligence module — it is a push channel, a
capital-event trigger, and a one-page emergency runbook, in that order.

---

# Phase 1 — Audit findings

## 1.1 Actually built vs. scaffolding vs. wishful naming

**Genuinely working (tested, wired end-to-end):**

- **Work-order lifecycle** — lanes triage → quote → in-progress → done with
  quote comparison, choose-winner, and stall detection
  (`dashboard/src/workOrders.js` — `withQuote`, `chooseQuotePatch`,
  `lowestQuoteId`; `dashboard/src/attentionInbox.js` — `STALL_DAYS
  {triage:3, quote:7, "in-progress":14}` surfaced on the Command Center,
  `dashboard/src/pages/Ops.jsx`). This is the strongest artifact in the
  repo and would pass a facilities director's smell test as a real WO
  system, not a to-do list.
- **Outbound quote machinery** — trade-matched contractor suggestion,
  combined multi-order packs, photo attachments, printable pack, outbound
  log (`dashboard/src/quoteRequest.js` — `orderTrade`,
  `suggestedContractors`, `combinedQuoteEmail`, `packHtml`).
- **Inbound email pipeline, live as of 7/23** — a scheduled Gmail poller
  routes forwarded mail to the property, parses it into proposed records,
  and lands them in a confirmation queue (`functions/index.js`
  `emailPoller`, `functions/gmail.js`, verified against the real mailbox
  with a real forwarded email). This is the system's first near-zero-effort
  ingestion channel and the single most important freshness asset it owns.
- **The assistant with a governed write path** — full-record context with a
  scope guard, confirm-then-write chips, one shared apply function for
  every intake surface (`dashboard/src/assistant.js`,
  `dashboard/src/assistantActions.js`), plus a record-quality gatekeeper
  and retrospective sweep (`dashboard/src/recordAudit.js`, shipped 7/24:
  duplicate/conflict/supersession detection with archived-not-deleted
  facts).
- **Asset knowledge layer** — 18 system-type benchmarks with life ranges
  and replacement-cost ranges (`dashboard/src/benchmarks.js`), a 3-year
  replacement forecast (`dashboard/src/forecast.js`,
  `pages/Forecast.jsx`), warranty ledger with expiry alerts
  (`dashboard/src/warranties.js`), annual spend rollup
  (`dashboard/src/spendInsights.js`, `pages/HomeReport.jsx`).
- **Issue intelligence** — deterministic keyword playbooks that cluster
  related priorities into bundled work orders (`dashboard/src/issuePlaybook.js`,
  seven playbooks: combustion safety, ventilation, water management, roof
  envelope, electrical safety, water/air quality, HVAC efficiency).

**Scaffolding (present, shaped right, not yet a program):**

- **The care calendar** is `{month, task}` strings with a done-flag
  (fixtures at `dashboard/src/mocks/fixtures.js` lines 116–120;
  completion loop from Slice 43). No owner, no trigger, no escalation —
  see Phase 2, scenario 4.
- **Verification cadence** on systems (`verifyFrequencyMonths` / `nextDue`,
  `dashboard/src/pages/HealthReport.jsx`) — a real condition-monitoring
  primitive, applied to a handful of systems, chased by nobody.
- **Seasonal playbook by climate region** (`dashboard/src/climate.js` ZIP →
  region, `dashboard/src/maintenanceIntelligence.js` `SEASONAL_PLAYBOOK`)
  — correct suggestions that appear on a page the owner must visit.

**Wishful naming (the costume, honestly labeled):**

- "Recurrence detection" (`maintenanceIntelligence.js` `recurrenceInsights`)
  infers rhythm only from jobs already logged — it can never see a rhythm
  the record never captured. It is a mirror, not a sensor.
- "Condition monitoring" does not exist anywhere in the repo. No telemetry,
  no sensor ingestion (the owner's Airthings integration was explicitly
  deferred 7/22), no inspection routes. The facilities director's verdict:
  *what you call monitoring is remembering.*

## 1.2 The data layer

There **is** a true asset registry, not a document pile: `healthReport`
docs carry category, brand/model detail, install year, condition, location,
verified flag, and service cadence (`SCHEMA.md` current-shape block;
per-system dossiers at `dashboard/src/pages/SystemProfile.jsx`), joined to
benchmarks for life/cost. That is more than most consumer products ever
build, and the strategist concedes the Drive-folder comparison dies right
here — a folder cannot compute "water heater #2 exits its life window in
2027 at $1,300–2,500."

The honest debits, all previously self-admitted in `SCHEMA.md`:

- **The `note` field is an overloaded catch-all** — provenance, history,
  and current state appended as free text across five write paths
  (`SCHEMA.md` gap #2). A note is not a queryable fact.
- **Provenance is partial** — the activity log (`dashboard/src/facts.js`
  `logFact`) records source for structured changes, but plenty of facts
  still say nothing about *how we know* (`SCHEMA.md` gap #3).
- **Serial numbers are accidental** — captured when a nameplate photo
  happened to be read (e.g. the Zilmet tank's serial lives in a saved
  fact), not as a registry field. Make/model: usually. Serial/warranty
  linkage per asset: inconsistent.
- **Duplication risk is now actively managed** rather than absent: the
  7/24 gatekeeper + sweep (`recordAudit.js`) catches duplicates and
  supersessions at intake and retrospectively. Contradiction handling
  exists precisely because contradictions occurred (the well-tank
  "not yet completed" vs. "installed" pair — a real July case).

One structural caveat for honesty: the repo carries code + fixture data;
the pilot home's live record is in Firestore. This audit assesses the
machine and its demonstrated behavior on the real home (per `DEMO.md`,
`INSIGHT-IDEAS.md`, and the July email-intake verification), not a dump of
the production database.

## 1.3 The freshness problem — source by source

| Source | How it updates | Verdict |
|---|---|---|
| Work orders / quotes | Workflow-driven; email replies now parse in | **Self-refreshing** — the healthiest data in the system |
| Conversations / documents | Created by use | Self-refreshing |
| Email intake | Owner forwards (2 taps) → auto-parse (`functions/gmail.js`) | **Near-zero effort; the model to extend** |
| Asset registry (installYear, condition, brand) | Owner tells the assistant, or a walkthrough | **Decaying asset.** Condition data ages the moment it's written |
| Care calendar completion | Owner marks done | **Decaying**, and silently: an unmarked task looks identical to an undone one |
| Warranties | Manual/parsed entry; expiry alerts computed | Semi-fresh (expiry math is automatic; registration is not) |
| Contractor roster | Founder-curated + dedupe tooling | Fresh enough at this scale |
| Benchmarks / playbooks / climate | Shipped as code | Static by design, fine |

The pattern the homeowner persona cares about: **everything that flows
through the mail pipeline stays fresh; everything that requires him to
open the app decays.** That is the design compass for every Phase 4 item.

## 1.4 The contractor database: directory or vendor management?

- **The directory is real and researched**: 72 Charlottesville-area vendors
  with trades, contact, sourcing notes, service details
  (`dashboard/src/contractorDirectory.js`, 790 lines) — plus fuzzy
  match-before-add, founder-confirmed merges preserving multiple trades,
  and "not a duplicate" memory (`dashboard/src/contractorMatching.js`).
- **Usage linkage is partial**: jobs *can* carry `contractorId` but history
  written as free-text `sub` predates the link (`SCHEMA.md` gap #1);
  quote requests and received bids are logged per work order
  (`pages/WorkOrders.jsx` outbound log; `workOrders.js` quotes array).
- **What a facilities director would fail it on**: no response-time record,
  no pricing history rollup per vendor, no performance grade, and — most
  telling — no designation of *the* vendor per trade with a fallback. The
  system knows 72 names; it does not yet hold an opinion. **A directory is
  a commodity; the opinion is the product.** The raw material to form
  opinions (quote log timestamps, job outcomes, bid amounts) is already
  being captured, which is why this lands in Tier 3 rather than fantasy.

---

# Phase 2 — Scenario scorecards

Scoring each stage: **✓** works today · **~** partial/passive · **✗** absent.

## Scenario 1 — The predictable capital event (two aging water heaters)

| Detect | Diagnose | Decide | Dispatch | Document |
|---|---|---|---|---|
| ~ | ✓ | ~ | ✓ | ✓ |

The record knows install years; `benchmarks.js` says tank heaters run 8–12
years at $1,300–2,500; `forecast.js` computes the 3-year window and the
Forecast page displays it. But the forecast is a **page, not an event** —
nothing converts "entering the failure window" into a staged work order,
and nothing tells the owner. Once a work order exists, Decide→Dispatch is
genuinely strong (trade-matched suggestions, photo pack, combined quotes,
comparison, choose). Documentation is automatic.
**Weakest link: Detect never initiates.** Today the trigger is a cold
shower or the owner happening to open the Forecast page — the exact failure
mode the product exists to prevent.

## Scenario 2 — The Saturday morning failure (dryer won't start)

| Detect | Diagnose | Decide | Dispatch | Document |
|---|---|---|---|---|
| ✗ | ~ | ✗ | ✓ | ✓ |

Detect is the owner (acceptable — even commercial FM doesn't sensor
dryers). In the first ten minutes the assistant offers whatever the record
holds and a trade-matched contractor with a ready quote request. But:
`benchmarks.js` has **no appliance entries at all** (18 entries, majors
only — no washer/dryer/refrigerator), so there is no repair-vs-replace
math; `issuePlaybook.js` has no appliance playbook; and if the dryer's
make/model was never captured, the assistant contributes a phone number
and sympathy.
**Weakest link: the appliance class is outside the knowledge layer
entirely** — the owner reconstructs model, age, and the $200-repair-vs-
$900-replace decision from scratch, on a Saturday.

## Scenario 3 — The invisible slow failure (underperforming bath fan → mold)

| Detect | Diagnose | Decide | Dispatch | Document |
|---|---|---|---|---|
| ✗ | ✓ | ✓ | ✓ | ✓ |

Once a symptom is reported, the system is actually excellent — the
ventilation playbook exists precisely because this happened
(`issuePlaybook.js` "Moisture ventilation"), and bundling turned the fan
cluster into a work order in real life. But **nothing in the repo could
have caught it pre-symptom**: no humidity/runtime data (Airthings owned
but unintegrated), no periodic inspection route that includes ventilation
performance, and `verifyFrequencyMonths` was never going to be set on a
fan nobody was thinking about.
**Weakest link: Detect is structurally absent for this class.** The
facilities director's framing: this is why commercial programs walk routes
with checklists — condition data does not volunteer itself.

## Scenario 4 — The recurring rhythm (generator, HVAC, gutters, well/septic)

| Detect | Diagnose | Decide | Dispatch | Document |
|---|---|---|---|---|
| ~ | ✓ | ✓ | ~ | ✓ |

The pieces exist: a calendar (`careCalendar`), per-system cadence
(`verifyFrequencyMonths`/`nextDue` with overdue highlighting,
`HealthReport.jsx`), a climate-keyed seasonal playbook
(`maintenanceIntelligence.js`), and a completion loop that writes job
history (Slice 43). What does not exist: **any channel that brings a due
task to the owner** — no email, no notification, nothing on a phone. A PM
schedule nobody is chased by is a list of good intentions. Generator
exercise cycles specifically: the record can hold "serviced by Fitch," but
no one ingests the generator's own weekly self-test result.
**Weakest link: no push channel.** The calendar is judged by the
facilities standard — *did the work happen on time without a human
remembering?* — and today the honest answer is no.

## Scenario 5 — The knowledge-transfer test (spouse / house sitter, one month)

| Detect | Diagnose | Decide | Dispatch | Document |
|---|---|---|---|---|
| ~ | ✓ | ~ | ✓ | ✓ |

This is where the corpus shines relative to any notebook: a spouse gets
the Health Report with dossiers, the assistant answering only from the
record (`assistant.js` scope guard), the System Map
(`pages/Schematic.jsx`), work orders with full context, and member access
already modeled (multi-owner membership, Slice 35-era). A month of routine
operation is plausible.
What fails is the **bad night**: there is no emergency layer. No water
shutoff location, no generator-failure procedure, no "propane smell —
who/what/where," no leak protocol. Grep confirms the only "emergency"
strings in the repo are vendor marketing notes in
`contractorDirectory.js`. The tacit hierarchy — *which* of the 72 vendors
you actually call first — lives in the founder's head.
**Weakest link: no emergency runbook written for the least-informed
household member.** Cheapest gap in the entire audit to close, and the one
with the worst downside if left open.

---

# Phase 3 — The gap map

Ranked by **felt customer pain**, not architectural completeness.

| # | Reference element | State | Evidence | How hard the customer feels the gap |
|---|---|---|---|---|
| 1 | **Emergency runbooks** | **Absent** | no artifact in repo; only vendor notes mention "emergency" | **Extreme when felt, zero until then** — and it's felt by the least-equipped person at the worst moment. Highest pain-per-effort in the audit |
| 2 | **PM schedule with triggers** | Partial | `careCalendar` + `verifyFrequencyMonths` + `SEASONAL_PLAYBOOK`, no push | **High and chronic** — every missed rhythm quietly becomes a Scenario-3 slow failure. This gap is the difference between a record and a program |
| 3 | **Condition monitoring** | Absent | no telemetry/inspection routes; Airthings deferred | **High but hardest** — the class of failure (mold, silent generator, slow leaks) with the biggest repair bills. Partial proxy exists via verification cadence |
| 4 | **Capital plan (10-yr + reserves)** | Partial | `forecast.js` is 3-yr, no reserve math, no smoothing, page-only | **Medium-high** — this owner's tolerance for surprise five-figure events is the product's reason to exist |
| 5 | **Vendor management (opinions)** | Partial | 72-vendor directory + quote/job links; no performance record, no "the vendor" per trade | **Medium** — felt at every dispatch as a small hesitation; the raw data to fix it is already accumulating |
| 6 | **Work-order lifecycle** | **Exists** | `workOrders.js`, `attentionInbox.js`, quote loop, email intake | Already the system's spine; pain would be severe if absent — it isn't |
| 7 | **Asset registry** | Exists (partial completeness) | `healthReport` + `benchmarks.js` + dossiers | Felt only via #2/#4 — the registry itself is ahead of the felt need |
| 8 | **Warranty & document vault** | Exists | `warranties.js`, documents, delete-locked transcripts | Low residual pain; registration completeness is the remaining gap |

*Flag (not a workstream): nothing here blocks a second home — `SCHEMA.md`
confirms the tenant boundary is sound, and email routing already supports
per-home tags (`functions/gmail.js` `routeMessage`). The one thing to
protect while building the items below: keep every new trigger/runbook
artifact keyed to `propertyId`, never global.*

---

# Phase 4 — The tiered roadmap

Every item traces to a scenario failure; every item states its freshness
mechanism, because data entry is where competing products die.

## Tier 1 — Close the loop (build now; boring and foundational)

**1. The Emergency Card** *(fixes Scenario 5's weakest link; touches #1 gap)*
One page per home, written for the least-informed reader: water shutoff
(photo + location), power/generator failure steps, propane emergency, leak
protocol, the call-first vendor per emergency class with phone numbers.
- **Data**: one 30-minute assistant-guided walkthrough (photos + questions
  — the intake machinery already does exactly this), plus designations
  drawn from the existing directory.
- **Freshness**: near-static by nature; each entry links to its system
  dossier so a changed vendor or replaced system flags the card for
  review. Printable, and pinned for every member including a house-sitter
  role.

**2. The weekly brief — a push channel at last** *(fixes Scenario 4's
weakest link and Scenario 1's Detect; converts gap #2 from list to
program)*
One short email per week, generated from data that already exists: care
tasks due this month, systems past `nextDue`, warranty expiries
(`warranties.js` already computes them), Attention-Inbox stalls
(`attentionInbox.js` already finds them), forecast events entering their
window. Nothing new is computed — it is a delivery mechanism for
intelligence currently trapped behind a login.
- **Data**: zero new. **Freshness**: generated, never authored.
- Transport note: the Gmail identity exists; sending needs a scope/app-
  password step — one RUNBOOK section, same shape as the 7/23 connector
  setup.

**3. Capital events become work orders** *(fixes Scenario 1 end-to-end)*
When an asset crosses its benchmark life window, the system auto-stages a
triage work order — "Water heater #2 enters its failure-probability window;
typical replacement $1,300–2,500; suggested vendors attached" — using the
existing `workOrderFromBundle`-style creation and the existing quote-pack
machinery. The owner's first contact with the event is a pre-staged
decision, not a cold shower.
- **Data**: `installYear` + `benchmarks.js`, both present.
- **Freshness**: age advances by itself — the one data source that never
  decays.

## Tier 2 — The proactive layer (the system starts initiating)

**4. Machine-generated email as telemetry** *(attacks Scenario 4's
generator case and gap #3 at near-zero cost)*
The Gmail pipeline currently parses human mail. Generac/Kohler status
mails, HVAC service confirmations, pest-control receipts, and utility
alerts are machine-generated, rigidly formatted, and can be auto-forwarded
by a mailbox rule — no owner action ever. A missing expected email is
itself signal: "no successful generator exercise report in 6 weeks" is
exactly the sentence the facilities director asked for, and it falls out
of an expectation table plus the existing `emailIngest` machinery.

**5. Sensor ingestion, starting with the one the owner already owns**
*(the only real answer to Scenario 3)*
Airthings humidity/radon (API key in hand, integration deferred 7/22) →
a `readings` collection → threshold rules → priorities. Bathroom humidity
that stays high after showers *is* the underperforming-fan detector. Keep
scope surgical: one sensor family, threshold alerts only, no dashboards —
alerts ride the weekly brief / interrupt channel from Tier 1.

**6. The annual walkthrough as a product, not a chore** *(refreshes the
decaying registry; feeds #4 gap)*
Once a year, the assistant runs a guided condition pass (the Walkthrough
wizard already exists — `pages/Walkthrough.jsx`, resume-where-incomplete)
framed as producing the annual State-of-the-Home report
(`pages/HomeReport.jsx` already exists to receive it). Condition data
decays; this is the scheduled recharge, disguised as a deliverable the
owner actually wants.

## Tier 3 — The judgment layer (what an estate manager knows)

**7. "The vendor" per trade, with receipts** *(closes gap #5)*
Promote the directory to opinions: designated primary + fallback per
trade, justified by accumulated evidence — response time (quote-log
timestamps to reply timestamps via email intake), bid history, job
outcomes. The UI is one field and one sentence of rationale; the trust is
the accumulated record underneath it.

**8. Repair-vs-replace doctrine by asset class** *(fixes Scenario 2's
decision vacuum)*
Encode the estate manager's arithmetic: the 50%-of-replacement rule,
remaining-life weighting from `benchmarks.js`, and appliance-class entries
added to the benchmark table (the dryer gets a row). When a repair quote
arrives by email, the parsed amount meets the doctrine and the reply-ready
recommendation is pre-staged: "repair at $240 — sensible; unit has ~5
expected years left."

**9. Spend-smoothing across the capital plan** *(upgrades gap #4)*
Extend the 3-year forecast to a 10-year horizon with a monthly reserve
figure, and let the plan *pull work forward*: "the well pump and pressure
tank both exit their windows within 18 months — bundling them with one
contractor visit saves a mobilization." The combined-quote machinery
(`quoteRequest.js` `combinedQuoteEmail`) already exists; this gives it a
long-range brain.

---

# Three reframings (not features)

**R1 — The record is an asset that transfers with the house.**
Everything in the repo assumes the record serves the current owner's
operations. Reframe: a complete, provenance-carrying maintenance record —
every system, every service, every warranty, every vendor — is *equity*.
It is the house's CARFAX at sale, the underwriting dossier that argues
with an insurance adjuster ("the record shows annual combustion service"),
the document that shortens inspection contingencies. Operating decisions
stay the daily product; the *transferable dossier* is the compounding one.
Nothing in the current corpus treats the record as something the house
keeps when the people change.

**R2 — The app is the back office; the product is a channel.**
The homeowner persona's stated ideal — never think about the water heater
until the moment he must — is incompatible with any product whose surface
is a dashboard. Reframe the deliverable as two channels: a weekly brief he
skims in 40 seconds, and an interrupt he trusts precisely because it is
rare. The dashboard's real audience is the *auditor* — spouse, successor,
house sitter, future buyer. Success metric inverts: not sessions per week
but **days between necessary logins**. Half of Tier 1 is this reframing
wearing work clothes.

**R3 — Standing authority: the system acts inside pre-agreed rules.**
Today every action funnels through owner confirmation — correct for
trust-building, but the ceiling on "white glove" is that the owner is
still the dispatcher. Reframe: an explicit *rules-of-engagement* document,
agreed once — "PM under $500 with a designated vendor: schedule it and
tell me; repairs $500–2,000: stage the decision; over $2,000 or any
capital event: my call." The confirm-then-write machinery doesn't
disappear — thresholds decide *which* things auto-confirm. This is the
difference between a brilliant assistant and an actual facilities manager,
and it is the only version of this product where the owner's cognitive
load goes to zero rather than merely down.

---

*Consensus note: the facilities director signs off contingent on Tier 1
items 1–3 being treated as one program, not a menu — a PM system without a
push channel remains a filing cabinet. The homeowner signs off on anything
that never asks him to type. The strategist's closing line: the handyman's
phone number and the Drive folder were beaten some time ago; the remaining
competitor is the owner's own memory, and Tier 1 is how you retire it.*
