# Backlog — running action items

Items parked for future sessions, roughly in priority order. Add freely;
prune when done.

## Slice 9 — contractor network as the real single entity (shipped 7/4/26)
Founder product decision (7/4/26): the business owner's contractor record
should be one entry per contractor, with structured data organized by home
and by job — not the Slice 3/7 dual-store reconciled by string-matching.
Scoped explicitly to what doesn't need a Firestore rule change (confirmed
with the founder): the homeowner-facing "your vendors" page stays exactly
as it is for now (still its own simple per-property list); this slice fixes
the business side.

- **Job History gets a founder-only contractor picker.** Founders (checked
  client-side via `isFounder`) see a "Contractor (network)" dropdown
  sourced from the master `contractors` collection when adding/editing a
  job; picking one sets a real `contractorId` at creation time and
  auto-fills the display `sub` text. Non-founder members never query the
  founder-only collection — the field simply doesn't render for them, so
  no permission error is possible. This is what makes the network
  authoritative *going forward* instead of only through retroactive
  string-matching.
- **Contractor Network page now groups each contractor's jobs by home**
  (most-worked-at property first, newest job first within each) instead of
  one flat cross-property list — "2 homes served · 3 jobs total," each
  home's jobs listed underneath. This is the "structured by home and
  job/project" request made concrete.
- **Bulk "Link all matches"** action alongside the existing per-contractor
  link button — sweeps every contractor's unlinked, name-matched jobs
  across the whole portfolio in one action.
- No Firestore rules change. Verified in-browser across a two-property mock
  (linked + unlinked jobs, correct grouping and counts).

**Known, accepted gap:** the homeowner property-local roster
(`properties/{id}/contractors`, Slice 3) is not unified with the master
entity — it's a deliberately separate, simpler list by founder decision.
Revisiting that (and the multi-property homeowner-switcher question) is
parked for the next session, since both touch the founder/permissions
model together (see SCHEMA.md's open question).

## Slice 11 — injectable data layer + test harness (shipped 7/4/26)
The old verification ritual (overwrite firestoreApi/AuthGate/useProperty
with hand mocks, screenshot, restore from backups) is gone. `vite.config.js`
now aliases those three modules to `src/mocks/` in mock/test mode — real
source files are never edited. `npm run preview:mock` serves the app on
two-property fixture data (amber banner marks mock mode); `npm test` runs
Vitest + RTL: unit tests for resolution.js, contractorMatching.js (matching
logic extracted out of BusinessContractors.jsx), facts.js, dates.js, plus a
render smoke test per page against the mock store. Red tests now block the
GitHub Pages deploy (deploy.yml runs `npm test` before build).

## Slice 23 — contractor table, profile pages, cross-linking (7/4/26)
The Contractor Network's tile cards (fine at 2 contractors, unusable at
74) became a dense sortable-by-name table: name, trades, contact,
cadence, last job, per-row "Link N jobs" action, with a "N homes · N
jobs" count under each name. Every contractor name in the app is now a
door: the table links to a new `/contractor-network/:id` profile page —
stat tiles (homes served / jobs on record / last job), contact &
sourcing card with tel:/mailto:/website links, work history grouped by
home, unlinked-match banner, and the edit/delete actions that moved off
the list page. Job History's contractor names link to profiles too
(founders only, linked jobs only), and the Ops contractor chips click
through to the network. Shared plumbing extracted: contractorShared.js
(form fields) and PortfolioJobs.jsx (cross-property job feed).

## Slice 22 — vision nameplate reading + photo visibility & audit (7/4/26)
Born from a real incident: the founder's generator photos imported fine
but were invisible behind the Health Report's unlabeled "Photos ›"
toggle, and Tesseract read nothing off the nameplate. Three fixes:
- **Vision-first nameplate reading**: PhotoSection now sends photos to
  the backend AI proxy (brand, model, serial, install year, condition
  note as one-click suggestions); Tesseract remains the offline
  fallback. First feature built on the Slice 20 backend.
- **Photo counts announce themselves**: addPhoto/removePhoto maintain a
  denormalized photoCount on the system, and the collapsed toggle reads
  "Photos (3) ›" instead of hiding everything.
- **Photo audit** (founder-only, Health Report): one click counts every
  photo by system, surfaces orphans (system deleted) with reattach or
  delete, and backfills the photoCount stamps on existing data.

## Slice 21 — Charlottesville contractor directory (shipped 7/4/26)
The founder's web research (72 providers across 10 trades — electrical,
HVAC, plumbing, landscaping, pest, exterior cleaning, roofing, tree,
septic/well, garage doors) now ships in the product as
contractorDirectory.js. The Contractor Network page gained a "Browse
directory" panel: grouped by trade, tick providers, one click adds them
as real network profiles — deduped by name against the live network so
it's re-openable without doubles, every entry sourced "verify contact
before first use." Contractor profiles also gained a website field
(form + card link). The bench for dispatching beyond the two known
vendors now exists in-product.

## Slice 20 — backend foundation: auth-verified AI proxy (shipped 7/4/26)
The un-parking of the AI layer. `functions/` holds one Cloud Functions v2
HTTPS endpoint: verifies the caller's Firebase ID token, requires founder
or property membership for AI calls, holds ANTHROPIC_API_KEY server-side
(CI writes it from a GitHub secret at deploy — never in the repo or the
browser), fixes model + token cap server-side, rate-limits per user, and
caps maxInstances at 2 as the hard cost brake (the Blaze budget only
alerts). Deploys automatically via deploy-functions.yml on any
functions/** change — owner did the one-time Blaze upgrade + two GitHub
secrets; no console visits needed for future backend changes. Client
side: backendApi.js (callBackend/callClaude carrying the ID token) and a
"Backend (AI proxy)" probe row on System status. Next up on this
foundation: document pipeline, Claude-vision nameplate OCR, and the
assistant's return.

## Slice 19 — lifespan & cost intelligence + requirement playbooks (shipped 7/4/26)
The record now predicts instead of just remembering. Three knowledge
modules, all curated domain data pattern-matched client-side (no AI API —
the backend stays parked):
- **benchmarks.js** — typical lifespan + replacement-cost ranges for 18
  system types (industry-standard figures, always labeled "typical").
  `replacementHorizon()` reads a system's installYear into age, window
  years, and a healthy/approaching/in-window/past status.
- **Health Report** — systems with a benchmark + install year carry a
  lifespan line ("Year 7 of a typical 8–12 · replacement window
  2027–2031 · ~$1,300–2,500").
- **Cost Forecast page** (new nav entry) — the 3-Year Cost Forecast from
  the original business plan: year-bucketed replacement windows + open
  priorities with estimates, totals per year, and a systems-outlook
  table with status chips. Per-unit costs (windows) display but stay
  out of totals. Missing install years are surfaced as the fix.
- **requirementSuggestions.js** — 13 playbooks mapping task patterns to
  the materials/info typically needed to close them (filter sizes,
  gutter footage, caulk color, nameplate photos…). The priority list's
  resolution section offers them as one-click "Typically needed for
  this" chips, deduped against whatever the record already tracks,
  capped at 4 so it stays useful, never auto-inserted.

## Slice 18 — Portfolio admin: delete properties (shipped 7/4/26)
Founder request after creating a typo property (891 Old Ballard): the
Command Center now has a "Portfolio admin" card listing every property
with a type-the-address-to-confirm delete. deletePropertyDeep() empties
every known subcollection first (Firestore doesn't cascade), then
removes the doc — membership write permission covers it, so no rules
change. Member add/remove stays on each property's Overview ("People
with access"), which already existed.

## Slice 17 — co-founder demo pack (shipped overnight 7/4/26)
DEMO.md: the pre-demo morning checklist (rules publish, System status,
key scrub), the pitch and two-planes story, a 15-minute click-path with
fresh screenshots (docs/screenshots/, fixture data only — no client data
in the repo), the N=20 scale story, an honest "real vs not yet" section,
and answers to the questions a sharp co-founder should ask. INTAKE.md:
the pre-visit questionnaire whose sections map 1:1 onto profile fields,
Health Report systems, Job History, the vendor roster, and the 90-day
priority list — the input side of the Slice 16 onboarding checklist.

## Slice 16 — new-property onboarding checklist (shipped overnight 7/4/26)
Every non-seed property's Overview now carries a "Getting this home
ready" card until its record is real: walk the property, build the system
list, load a prepared bundle (optional; ImportBundle now stamps
`bundleImportedOn`), log service history, invite the homeowner. Every
done-state derives from the record — nothing is hand-ticked — and the
card retires itself when the required steps are done. This is the
"how does home #2 get onboarded" answer, visible in the product.

## Slice 15 — orphaned API-key scrub (shipped 7/4/26)
The retired AI assistant (Slice 10) left the pasted Anthropic key sitting
in `profile.anthropicApiKey`. System status now has a "Data hygiene"
action that deletes the field from every property the founder can see
(idempotent — reports "None found" on re-run). **Owner action: click it
once on the live site so no usable key lingers in Firestore — and since
that key was stored and used client-side while the assistant existed,
rotating it at console.anthropic.com is the belt-and-braces follow-up.**

## Slice 14 — RUNBOOK.md: one console visit for all pending rules (7/4/26)
Every pending Firestore rules change (founder contractors from Slice 7,
property-create from Slice 13) is staged in dashboard/firestore.rules;
RUNBOOK.md is the paste-the-whole-file, two-minute console procedure plus
the System-status verification steps. Convention going forward: any PR
touching firestore.rules updates the RUNBOOK table. **Owner action still
required: perform the publish — the app can't do it, and until then the
Contractor Network may be broken in prod and "+ New property" will be.**

## Slice 13 — business-owner multi-property view (shipped 7/4/26)
The model the founder confirmed: a homeowner belongs to one property; the
business owner sees every property they're a member of. Founders now get a
"Viewing property" switcher in the nav (persisted per browser; homeowners
never see it), every Property-plane page follows the selection, and the
Command Center gained "+ New property" (creates the doc with the founder
as first member — needs the new `allow create` rule in firestore.rules
published; the UI says exactly that on permission-denied) plus a per-home
"View dashboard →" jump and a systems-good health chip. Also fixed a
multi-property data leak this exposed: the Ballard-specific starter seed
and all three document-insights banners were offered on every property —
now gated to the source home (`seedAddressHint`).

## Slice 12 — System status: production self-diagnostics (shipped 7/4/26)
Rules are published by hand in the Firebase console and can drift from the
repo's firestore.rules — a green deploy never proved the app worked. The
Command Center now has a founder-only "System status" card that runs
read-only permission probes (membership query, founder contractors
collection, every property subcollection) and reports pass/fail with the
exact fix. Alongside it, a global data-error bus: any denied subscription
surfaces as a red banner in Layout instead of a silently empty page.
Bonus: writing its tests exposed a real pre-existing Ops bug — an effect
depending on freshly-filtered arrays re-set parent state on every render
(invisible CPU burn in prod, livelock under act()); fixed by depending on
the stable subscription arrays.

## Slice 10 — pulled the client-side AI assistant (removed 7/4/26)
Founder decision (7/4/26): the Intake Assistant and Exterior Measurements
pages both called the Anthropic API directly from the browser using a key
pasted into the property's Firestore profile (`profile.anthropicApiKey`) —
the only pattern available with no backend. That means the key leaves the
device to Anthropic straight from client JS, and the browser (or anyone
with access to it) can read it via dev tools. Rather than build a
proxy/backend right now, the founder chose to remove both features
entirely until a more scalable, robust approach (a minimal serverless
proxy holding the key server-side, gated on Firebase Auth) is designed —
see SCHEMA.md and the parked "AI-agent/backend" topic.

Removed: `dashboard/src/pages/Assistant.jsx`, `ExteriorMeasurements.jsx`,
`assistantApi.js`, `gaps.js` (only consumer was the assistant), the
`/assistant` and `/exterior-measurements` routes and nav entries, the
Overview "Intake Assistant" card, and the `loadAssistantChat`/
`saveAssistantChat` Firestore helpers. Existing `anthropicApiKey` and
`exteriorEstimate` fields are left alone in Firestore (harmless, unused)
rather than migrated — no data deleted.

**Not removed:** the resolution pipeline (materials/info requirements,
resolution path) on Priority List — that's a plain CRUD feature with no AI
dependency and stays fully functional; only the chat-driven way of filling
it in is gone. Manual entry still works everywhere.

## Parked ideas to revisit
- [x] **Concept to review (7/2/26) — done 7/3/26.** The flagged X post
      (patio-shade lead-gen: scrape sold homes → vision-find unshaded
      patios → measure sun from satellite data → render the pergola into
      the owner's photo → mail a postcard with a QR heat report) is
      reviewed and folded into **INSIGHT-IDEAS.md** as ideas #14–17
      (deficiency-detection lead qualification, quantified-diagnosis +
      render-the-fix outreach, postcard→QR claim pages, and demand-gen as
      a contractor-side revenue line).

## Design
- [ ] **Design overhaul (paused 7/1/26).** Current design isn't hitting the
      mark — "we could do a lot, lot better." Dedicate a session to it:
      gather visual inspiration/references, consider a real brand identity,
      rethink layout and hierarchy from scratch rather than iterating,
      mobile-first (the walkthrough + assistant are phone workflows).

## Architecture roadmap (from 7/2/26 discussion)
Sequenced. Slice 1 shipped; the rest are ordered by dependency.
- [x] **Slice 1 — system of record primitives (shipped 7/2/26).** Per-system
      activity timeline (typed reading/action/observation/service entries with
      value+unit), recurring verifications (frequency → nextDue, "due" banner on
      Overview, "Log check" action), and priority disposition (open / scheduled
      / resolved / dismissed with resolution notes, kept not deleted). Assistant
      got log_activity / set_recurring_check / resolve_priority tools.
- [x] **Slice 2a — property membership by email (shipped 7/2/26).** Property
      docs carry `members: [{email, name, role}]` + a denormalized
      `memberEmails` array; `resolvePropertyId` matches a signed-in user to
      their property by verified email (array-contains), with a legacy fallback
      to the uid-keyed doc that self-heals. Rules grant access by membership.
      "People with access" panel lets owners invite/remove by email. This is
      the homeowner-side (household) access layer.
- [x] **Slice 2b — multi-property creation & the two planes.** Shipped
      across Slices 13/18 (7/4/26): property creation with generated ids,
      founder switcher, portfolio admin with deep delete. What remains of
      the original idea is only the Slice 4b financial layer below.
      Original framing kept for the record:
      **Two distinct planes — keep them separate (7/2/26 discussion):**
      (1) *Property membership* — who can access a given house, at what role
      (owner / co-owner / viewer / assigned technician); granted peer-to-peer by
      owners. Sally lives here. (2) *Business / platform admin* — the
      home-services company's tenant layer: customer households, subscriptions,
      billing, and operator staff with cross-property authority; this is the
      "new-user admin / signup" flow, and it *creates* a property + its first
      owner, then hands off to peer membership. The `members` primitive is
      shared by both; only *who may add whom* differs. The business plane is
      Slice 4 (below), sitting above property membership, not inside it.
- [x] **Slice 3 — contractor entities (shipped 7/2/26).** New **Contractors**
      page (Property nav): a `properties/{id}/contractors` subcollection with
      name, trades, phone, how-sourced, notes, and each vendor's on-record jobs
      (matched from job-history `sub` text). One-click **Import from jobs**
      parses distinct vendors out of job history — splitting name from phone,
      guessing trades from the job category, deduping against the roster and
      against each other — into a review list you check off before adding.
      Command Center's contractor glimpse now links here. *Still string-based:*
      jobs reference contractors by `sub` text, not a contractor id — a proper
      FK (and promoting this to a cross-property network store) pairs with the
      business plane in Slice 4b.
- [x] **Slice 4 — operator/ops + business command center (shipped 7/2/26).**
      `/ops` ("Business" in nav): membership-scoped portfolio with performance
      tiles (properties, open work, overdue checks, urgent systems, jobs
      scheduled/completed), a cross-portfolio "needs attention now" feed, per-
      property dispatch queues with disposition (Schedule/Done writing the same
      status the owner sees), and a contractor glimpse from job history.
      Non-financial for now (per 7/2 decision). Homeowner priority list =
      operator demand feed, same data different lens.
- [ ] **Slice 4b — business-only data behind a founder-only store (the
      homeowner↔business visibility split).** Decided business-only (7/2/26):
      **job margin/markup**, **client account health** (LTV, tenure, churn
      risk, internal tier), and **internal ops notes / dispatch detail**. These
      CANNOT live in the property doc or its subcollections — homeowner members
      (e.g. Sally) can read those. They need a separate top-level
      `business/{propertyId}` collection with rules that allow only *founders*
      (not property members). Open decision: how to identify founders without a
      backend — (a) hardcoded email allowlist in rules + a VITE_FOUNDER_EMAILS
      env for UI gating (simple, truly secure, adding a founder = rules+env
      edit), or (b) a `config/founders` doc (emails array) that rules `get()`
      and the client reads for gating (no redeploy to add a founder, one extra
      read per check). Recommend (a) for 3 rarely-changing founders. Financials
      themselves still deferred ("no financials yet"); this slice builds the
      *secured container* + the first non-financial business-only fields
      (client health, internal notes), and gates the Business nav to founders.
## The action gap (founder product review, 7/3/26)
The founder's own framing, and the right one: *"we're capturing lots of
unstructured data and organizing it into views — what I want to bridge is
the gap to the actions: who is performing what work, when they typically
come."* The record is the moat; the pipeline from priority → resolved work
is the revenue engine, and today it's a bare status field. Slices 5–8 below
build that bridge.

**Prioritization framework** (used to order them, and for future asks):
three questions per candidate —
1. **Resolution proximity** (corrected from "revenue proximity", 7/3/26) —
   does it move an open priority toward *closed*? The subscription's value
   is "regular maintenance you don't have to worry about": a handyman on a
   recurring cadence closes many small items (air filters, garage-door
   rubbers) with minimal labor and the right materials on the truck.
   Revenue follows resolution; the metric is items resolved per visit /
   per unit effort, not per-job revenue.
2. **Founder utility this month** — will it get used on 895 Old Ballard
   next week? Dogfooding is the only user research we have.
3. **Cost & dependency** — frontend-only ships in a session; anything
   touching security rules or needing a backend queues behind a decision.

- [x] **Slice 5 — resolution pipeline on priorities (shipped 7/3/26).** The
      organizing question per priority, in order: *what's needed to close
      it out?* then *how does it get actioned?*
      **(a) Closeout requirements:** a **`materialsNeeded[]`** list (part,
      spec/size, source, status: needed → purchased → on the truck) and an
      **`infoNeeded[]`** checklist (photo / fact / measurement asks with
      open/provided status). When both are satisfied the priority is
      **ready to action** — and the app can prompt the homeowner for
      exactly what's missing ("snap a photo of the well cap").
      **(b) Action disposition** (`resolutionPath`, chosen once
      requirements are known): **`subscription-visit`** — batch onto the
      next recurring handyman visit; the default for small maintenance
      items (air filters, garage-door rubbers, well-test kit) and the core
      of the subscription's value; **`diy`** — homeowner does it, we
      supply the materials list; **`specialist`** — dispatch a specific
      trade (HVAC, plumber); **`project-quote`** — needs estimate(s), with
      a **`bundleTag`** grouping into efficient packages (window washing +
      gutter cleaning = one truck roll).
      **(c) Visit manifest:** the next scheduled visit shows which
      priorities it closes plus a consolidated materials/shopping list.
      Resolution-proximity readout on Overview and Command Center: "8 open
      → 5 ready to action → 4 close on the next visit."
      Assistant gets set_resolution_path / add_requirement /
      provide_requirement tools. Frontend-only; highest resolution
      proximity of anything on the list.
- [x] **Slice 6 — assistant as the always-on maintenance manager (a+b
      shipped 7/3/26; c open).** (a) **Gap engine** (`src/gaps.js`): ranks
      the record's most valuable missing info — open `infoNeeded` asks and
      unsourced materials from Slice 5 first (they block action), then
      overdue recurring checks, then missing system facts worst-condition
      first. Surfaced two ways: an "Open gaps" chip row above the composer
      (click → drafts the ask) and a top-gaps section in the system prompt
      so the model pursues them unprompted. (b) **Chat history persists**
      to `properties/{id}/assistant/chat` — loaded once on mount, saved
      after each turn (images stripped, history capped at a safe
      tool-pair boundary), with a Clear chat control. (c) Still open: the
      Overview IA decision — likely demote Walkthrough to a tool the
      assistant suggests; revisit after living with the gap engine.
- [x] **Slice 7 — contractor profiles graduate to the business plane
      (shipped 7/3/26).** New top-level `contractors/{id}` collection —
      the central repository: one profile per contractor with contacts
      (phone/email), trades, how sourced, **service cadence** (free-text —
      "Annual service each spring"), notes, and **cross-property job
      history** aggregated live across every property the founder belongs
      to. New **Contractor Network** page under **Business** in the nav,
      gated to founders (`src/founders.js` allowlist + matching
      `isFounder()` in firestore.rules — this is the Slice 4b
      founder-identity decision, resolved with the simple hardcoded-email
      option as recommended, bundled in as planned). Founders get an
      **import panel** pulling each property's existing Slice-3 roster
      into the shared network (deduped by name), and a **"Link N matching
      jobs"** action per contractor that retroactively sets a real
      `contractorId` on job-history entries matched by name — the FK
      Slice 3 deferred. The homeowner's existing per-property Contractors
      page (Slice 3) is untouched — it's the lighter "your vendors" view,
      still property-scoped and visible to all members. Command Center's
      contractor glimpse now deep-links founders to the network instead
      of the property page. Frontend-only; no new indexes needed since
      cross-property job aggregation reuses the founder's existing
      property-membership reads rather than a collection-group query.
- [x] **Slice 8 — exterior vision measurements (shipped 7/3/26).** New
      **Exterior Measurements** page (Property nav): pick which system's
      photos to analyze (auto-guesses an exterior/grounds/roof system),
      sends up to 12 of its photos in one Claude vision call asking for a
      combined window count (deduped across photos in a single request,
      simpler than a per-photo breakdown and just as capable since the
      model sees all images together) and a gutter linear-footage estimate
      scaled off visible reference objects (door/window widths) — no
      stored square-footage figure existed to scale against, so this is
      the honest substitute. Each figure carries a confidence level and
      one-sentence reasoning; results save to the property profile as
      `exteriorEstimate` with date + photo-count provenance, always
      labeled "estimate — verify." **Auto-fills Slice 5:** any open
      priority's `measurement`-type info-need mentioning "window" or
      "gutter" is marked provided with the estimate. Verified in-browser:
      renders a saved estimate correctly and the error path (bad key)
      degrades gracefully without losing the prior result. Uses the
      existing browser-direct Claude call; no backend.

**Sequencing rationale:** 5 is the bridge itself and everything else feeds
it — 6 fills its info-needs conversationally, 7 gives the quotes somewhere
to go, 8 fills the measurement asks automatically. 6 before 7 because it's
frontend-only and touched daily, while 7 drags in the rules decision. 8 is
an enhancer, not a blocker — but it's also the flashiest demo, so it can
jump the queue when a pitch needs it. (Nav item from the same review —
Property = homeowner view, Business = command center — already shipped.)

- [x] **Facts need provenance (shipped 7/4/26) + shrink the overloaded note
      field (shipped 7/4/26).** Done together — same fix. New `fact` activity
      type (`src/facts.js`: `logFact`/`fieldLabel` helper) carries
      `source: {type, label}` — which automated path asserted a change, and
      a readable label ("chat", "Home Records Index", "walkthrough") —
      rendered right on the per-system History timeline ("Fact recorded ·
      via Home Records Index"). Wired into every automated write path:
      the assistant's `update_system` tool, Import Bundle's system
      updates, and Insights Banner's `systemUpdates`. **Import Bundle's
      `noteAppend` no longer appends into `note`** — that text now logs
      to the fact feed instead, which is what stops the note field from
      growing into a provenance/history dump; `note` goes back to
      "current state, one paragraph" for anything written going forward.
      No migration of existing note content (not destructive); no
      Firestore rules change needed (additive fields under existing write
      permissions) — see SCHEMA.md, done specifically as the two items
      achievable without Firebase console access.

## Product
- [ ] **Document upload pipeline with AI extraction.** The 2021 closing-docs
      review was done by hand this session; the scalable version is: upload a
      PDF → AI extracts systems/jobs/priorities → user approves. Needs a
      backend. This is also the core of the business concept ("bring us your
      closing folder" onboarding).
- [ ] **Upgrade nameplate photo OCR to Claude vision.** Tesseract works but a
      vision model reads nameplates far better. Same backend unlocks it.
- [x] **3-Year Cost Forecast** page — shipped as Slice 19 (7/4/26), built
      from system ages against lifespan benchmarks + open priorities.
- [ ] **Room profiles** (deferred from walkthrough build — "location" field
      covers most of it for now).
- [ ] **Technician share access** — a scoped way for a visiting tech to see or
      add to the record without full owner login.
- [ ] ~~Persist assistant chat history~~ — absorbed into **Slice 6** above.

## Engineering
- [ ] Proper backend (Cloud Functions or similar) — unblocks the three items
      above and removes the paste-your-own-API-key setup for the assistant.
- [ ] Code-split the main bundle (build warns at ~840KB minified).
- [ ] Clean up orphaned photos when a system is deleted.
- [ ] Dark mode (deliberately skipped in redesign; do it properly if wanted).

## Business concept notes (from closing-docs review, 7/1/26)
- Every closing folder is a ready-made Property Profile: inspection report,
  radon cert, appraisal, paint schedule, renovation estimates.
- Seller repair-credits (cash in lieu of repairs) = a built-in 90-day priority
  list of paid-for-but-never-done work at every closing — lead-gen engine.
- Standardized forms (VAR, URAR) make AI extraction genuinely scalable.
