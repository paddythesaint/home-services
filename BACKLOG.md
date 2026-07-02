# Backlog — running action items

Items parked for future sessions, roughly in priority order. Add freely;
prune when done.

## Parked ideas to revisit
- [ ] **Concept to review (7/2/26)** — interesting concept the founder flagged
      to explore later:
      https://x.com/everestchris6/status/2072687270709309589
      (not yet reviewed — open the link together and assess fit for the
      product when we pick this up).

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
- [ ] **Slice 3 — contractor entities.** We've captured Monticello Air,
      Charlottesville Generators, Dodson, Young & Rannigan, Insured Roofs, Four
      Seasons as strings inside jobs. Promote to a top-level contractors
      collection (name, phone, trades, jobs performed, how sourced) — this is
      literally the business plan's contractor DB, pre-seeded by your house.
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
- [ ] **Persist assistant chat history** to Firestore so a session survives a
      page refresh / continues across devices.

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
