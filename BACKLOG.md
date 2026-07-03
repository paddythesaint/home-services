# Backlog — running action items

Items parked for future sessions, roughly in priority order. Add freely;
prune when done.

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
- [ ] **Slice 2b — multi-property creation & the two planes.** Membership
      exists; still to build is *creating* new properties with generated ids
      (rather than the legacy uid-as-id) when onboarding a new household.
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
1. **Revenue proximity** — does it move an open priority toward quoted or
   booked work? The marketplace loop *is* the business.
2. **Founder utility this month** — will it get used on 895 Old Ballard
   next week? Dogfooding is the only user research we have.
3. **Cost & dependency** — frontend-only ships in a session; anything
   touching security rules or needing a backend queues behind a decision.

- [ ] **Slice 5 — resolution pipeline on priorities (BUILD NEXT).** Encode
      the founder's three "action ways" as a `resolutionPath` on each
      priority: **`diy-product`** (buy + install, possibly recurring — air
      filters), **`service-visit`** (someone comes out with a kit/parts —
      garage-door rubbers, well-test kit), **`project-quote`** (work that
      needs quoting, alone or bundled). Add an **`infoNeeded[]` checklist**
      per priority — each entry an ask (photo / fact / measurement) with
      open/provided status — so the app can say "2 of 3 things needed for an
      accurate quote" and prompt the homeowner to close the gap. Add a
      **`bundleTag`** so quotable work groups into efficient packages
      (window washing + gutter cleaning = one exterior visit, not two
      truck rolls). Priority List UI: path selector, quote-readiness meter,
      bundle grouping. Assistant gets set_resolution_path /
      add_info_need / provide_info tools. Frontend-only; highest revenue
      proximity of anything on the list.
- [ ] **Slice 6 — assistant as the always-on maintenance manager.** The
      assistant stops being a page you visit and becomes the persistent
      interface across the property lifecycle — "your maintenance manager
      on call." (a) **Gap engine**: compute the record's highest-value
      missing info (unverified systems, missing brands/ages/last-serviced,
      open `infoNeeded` items from Slice 5) and have the assistant open
      with the top gaps instead of a generic greeting; it keeps prompting
      as the record evolves. (b) **Persist chat history** to Firestore
      (absorbs the existing Product item) so the relationship is
      continuous across devices/sessions. (c) IA decision, deferred until
      (a) proves out: Overview currently pitches both Walkthrough and
      Assistant up front — likely demote Walkthrough to a tool the
      assistant suggests rather than a co-equal entry point. Frontend-only.
- [ ] **Slice 7 — contractor profiles graduate to the business plane.**
      Move Contractors from the Property section to **Business** in the nav
      and promote it to a top-level `contractors/{id}` collection — the
      central repository: one profile per contractor with points of
      contact + details, trades, how sourced, **work history across all
      properties (past and scheduled future)**, and **service cadence**
      ("Dodson bi-monthly", "generator service every June") — which is
      exactly the who-does-what-and-when data the action gap needs. Jobs
      get a real `contractorId` FK, retiring Slice 3's string-matching
      debt. The homeowner keeps a lighter per-property "your vendors" view
      derived from their own jobs. This forces the Slice 4b founder-
      identity decision (cross-property collection ⇒ founder-scoped rules)
      — bundle the two.
- [ ] **Slice 8 — exterior vision measurements (quote-readiness data).**
      Run the uploaded exterior photos through Claude vision to estimate
      **window count** (per-facade counts → deduped total, with confidence)
      and **gutter linear footage** (roofline segments scaled against the
      known footprint). Store as property facts flagged *estimated — verify*,
      with provenance, and auto-fill Slice 5's `infoNeeded` measurement
      asks. Honest feasibility: per-photo window counting is reliable;
      cross-facade dedup needs care; gutter footage will be ±20–30% — fine
      for ballpark quotes if labeled as an estimate. Uses the existing
      browser-direct Claude call; no backend.

**Sequencing rationale:** 5 is the bridge itself and everything else feeds
it — 6 fills its info-needs conversationally, 7 gives the quotes somewhere
to go, 8 fills the measurement asks automatically. 6 before 7 because it's
frontend-only and touched daily, while 7 drags in the rules decision. 8 is
an enhancer, not a blocker — but it's also the flashiest demo, so it can
jump the queue when a pitch needs it. (Nav item from the same review —
Property = homeowner view, Business = command center — already shipped.)

- [ ] **Facts need provenance.** Add a lightweight `source` to facts (which
      document/photo/chat asserted it, and when) so the record is auditable —
      the roof story only made sense because we knew appraisal-said-X vs
      claim-said-Y. Pairs with documents-as-records below.
- [ ] **Shrink the overloaded note field.** With the activity log now carrying
      history, the system `note` should return to "current state, one
      paragraph" — provenance and history moved out.

## Product
- [ ] **Document upload pipeline with AI extraction.** The 2021 closing-docs
      review was done by hand this session; the scalable version is: upload a
      PDF → AI extracts systems/jobs/priorities → user approves. Needs a
      backend. This is also the core of the business concept ("bring us your
      closing folder" onboarding).
- [ ] **Upgrade nameplate photo OCR to Claude vision.** Tesseract works but a
      vision model reads nameplates far better. Same backend unlocks it.
- [ ] **3-Year Cost Forecast** page (fourth deliverable from the business
      plan) — generate from system ages + area service costs.
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
