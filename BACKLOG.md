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

**Known, accepted gap (closed by Slice 28, 7/4/26):** the homeowner
property-local roster is now unified with the master entity — network
is truth, rosters are synced projections plus homeowner-private
entries. See the Slice 28 entry.

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

## Slice 48 — collapsible trade sections on Health Report (7/7/26)
Owner: "collapse each of the systems down and expand to see the tiles."
- Each trade section header is now a toggle (▸/▾), hiding/showing its
  system tiles. Collapsed state is sticky per device (localStorage
  `healthCollapsed`); default all-expanded so nobody loses systems.
- Anchor links from Systems-at-a-glance auto-expand a collapsed trade
  before scrolling to it.

## Slice 47 — work-order detail drawer + AI briefing (7/7/26)
Owner: the board handled workflow but there was no way to read a ticket —
"I am unable to see any more details other than the headline."
- **Detail drawer**: clicking a card opens a slide-over (bottom sheet on
  mobile) — the card headline becomes the whole ticket.
- **The client's own words**: the verbatim request (already stored in
  `notes` by the Request button and assistant, never surfaced) shown as a
  quote, with who filed it and via which channel.
- **Timeline**: opened date + how long it's been open (`ageSummary` /
  `daysOpen`), or how long it took to close.
- **AI briefing**: on-demand, reads THAT property's record (systems,
  history, open priorities) and returns a staff-facing read — what the
  client wants, what we know about the system, likely causes / what to
  check, and the right trade. Cached on the order (`aiSummary` +
  `aiSummaryOn`) with Regenerate. Reuses the assistant's context builder
  via workOrderBriefing.js; new `fetchItems` one-shot read pulls the
  property's collections from the portfolio-wide board.
- **Workflow at a glance** + the same advance/edit/delete actions.
- Contractor link moved from the card into the drawer (a nested link in a
  now-clickable card is invalid HTML).

## Slice 46 — native chat UI for the Assistant (7/7/26)
Owner: "renders clunky/compressed on mobile — make it feel native to AI
chat interfaces (Claude/ChatGPT)."
- **Chat shell**: fixed-height column (dvh-based) — the thread scrolls,
  the composer stays pinned; full-bleed on mobile (no card chrome),
  card-framed on desktop. Auto-scrolls to the newest message.
- **Bubbles**: user right-aligned in brand green with a tail-corner,
  assistant left in soft plane gray; "Thinking…" renders as a pulsing
  assistant bubble.
- **Composer**: single-line auto-growing textarea (caps at 8 lines,
  resets after send), compact icon-only 📷/📎 buttons, circular ↑ send
  button (disabled state greyed), pending attachments as removable
  chips above the input, iOS safe-area padding, 16px input font so iOS
  doesn't zoom on focus.
- Header collapses to one line on mobile — the thread is the page.

## Slice 45 — 2026 service-records wave from Gmail (7/7/26)
Owner: "search to populate all my service records… 1/1/2026 onwards…
check all labels." Full-mailbox sweep via the Gmail connector, shipped
as the fourth one-click InsightsBanner wave (serviceRecordsInsights.js,
flag serviceRecords2026AppliedOn).
- **9 jobs with real amounts**: Monticello Air Apr 22 upstairs repair
  ($327.15, reversing-valve wire + short) and Jun 12 ACC visit #2
  ($285.21 incl. R-410a); Dodson Feb 20 + Apr 24; Bartlett spring tree
  treatment; Jimmie Mills spring cleanup & mulch ($650) + May mow
  ($100); Fitch Services Apr estimate + Jun 15 service call.
- **4 new systems**: upstairs Carrier HVAC (attic, 2016), mini-split,
  Ting fire monitor (serial 48D496817, $49/yr), Airthings monitor.
- **Facts/priorities**: Generac coverage lapsed 11/04/2023 (priority);
  Fitch receipts scope unknown (records priority); roof-docs priority
  updated (requested from Insured Roofs 7/2, Franco's email was hacked
  in Feb — verify by phone); ACC plan note on the main HVAC record;
  Jimmie Mills as the landscaping vendor of record.
- Dedupe honored: generator 6/15, Dodson 6/19, and the roof claim were
  already on the record and are not re-added.

## Slice 44 — hotfix: transcript persist crash on log_job (7/7/26)
Owner hit it live (generator service upload): the writes landed (job,
calendar, facts — chips confirmed), but persisting the transcript threw
"addDoc() called with invalid data: undefined". transcriptMessage was
writing undefined for fields an action doesn't carry (log_job has no
`fact`); production Firestore rejects undefined, the mock tolerated it —
so 177 tests never saw it.
- transcriptMessage now OMITS absent fields instead of writing undefined.
- The mock's addItem/updateItem now throw on undefined (deeply), exactly
  like Firestore — this bug class can't pass tests again. Full suite
  stayed green after hardening: no other latent writers.

## Slice 43 — care-task completion loop (7/7/26)
Owner found the gap doing it for real: "I pressure washed this weekend —
how do I enter that to complete the action in the care calendar?"
- **Done-for-the-year state**: care tasks gain doneOn/doneYear. "mark
  done" on the calendar stamps the year; the row shows ✓ + date; every
  January the schedule resets itself (the stamp names the year, no
  cleanup needed). What's Next drops done tasks.
- **Mark done → offer the job log**: one prefilled modal (when, who,
  cost) writes the matching completed Job History entry; "Skip — just
  check it off" for pure checkoffs.
- **Assistant flow-through** (new log_job action): reporting finished
  work ("I flushed the water heater this weekend") gets a "Log job"
  confirm chip; one tap writes the job history entry AND checks off the
  matching care-calendar task (the model copies the exact task text
  from context). Context now marks done tasks so the assistant doesn't
  nag about them. Confirm-then-write, as ever.

## Slice 42 — intent-shaped nav: hubs, What's Next, naming pass (7/7/26)
UX assessment recs #3 + #4 + #5, owner-approved. Routes unchanged —
every old URL still works; this is wayfinding, not plumbing.
- **Two hubs**: the ten-item property nav collapses to four — Home,
  Assistant, Property Record, The Plan. The record pages (Systems &
  Health, Job History, Contractors) and the plan pages (What's Next,
  Care Calendar, 90-Day Priorities, Cost Forecast) become tabs
  (HubTabs.jsx); the hub stays lit for every route it contains
  (navActive match lists). Role trims moved from nav keys to tab keys
  (technicians: no vendors; staff: no money).
- **What's Next** (/whats-next): the merged timeline — in-flight work
  orders, this month's care tasks + overdue recurring checks +
  scheduled jobs, and the 90-day queue — every row linked to the page
  or dossier that explains it. It's The Plan's landing tab.
- **Tools section**: Walkthrough + Import Records live under a
  staff/founder-only Tools heading; homeowners see exactly four items.
- **Naming pass**: Overview → "Home", Import Bundle → "Import
  Records", page title aligned to "90-Day Priorities".

## Slice 41 — numbers as doors (7/7/26)
UX assessment rec #1 + #2, owner-approved: every figure drills down;
the system entity is the hub.
- **StatTile links**: Overview's four tiles click through (health
  report, priorities, job history, calendar). Hover ring signals it.
- **SystemsGlance** extracted as the one shared summary — Overview and
  Health Report render the identical trade rollup; every row lands on
  its trade section via /health-report#trade-… (hash-scroll effect on
  the report).
- **Dossier/trade links everywhere**: due-checks banner names →
  /system/:id; Forecast outlook rows → dossier; priority, job, and
  care-calendar categories/tasks → their trade section; Overview's
  recent-activity titles → job history.
- Guard preserved: contractor names still never link into the
  founder-only network for non-founders (test re-aimed at exactly that).

## Slice 40 — full-record context, scope guard, transcript delete lock (7/7/26)
Owner direction: all home-related info in context; keep it strictly
per-home; the scope rule pre-wired (not homeowner-editable); homeowners
can't delete transcripts (business owners can).
- **Context expansion** (assistant.js): visit notes (last 3), documents
  index (titles + dates — "we have that on file"), per-system
  replacement windows + typical costs from benchmarks.js, membership
  tier, and a WHAT HPS DOES services blurb. Per-home isolation
  unchanged: context still assembles only from the signed-in member's
  property; backend membership check still gates every call.
- **Scope guard** in the system prompt (server-assembled, invisible to
  the member): only this home, its record, and HPS services — one
  friendly decline for anything else; billing questions route to the
  team without quoting numbers; replacement figures framed as typical,
  not quotes. Mock backend mirrors the decline for preview/tests.
- **Transcript delete lock** (firestore.rules): conversations are
  founder-delete-only; members/staff keep read/create/update. Needs a
  rules republish — FIREBASE-CHECKLIST item 2.
- **Server cap**: MAX_TOKENS 16000 → 4096 (sized to the largest
  legitimate reply; 60/hr per-user rate limit already in place).

## Slice 39 — Health Report trade sections + assistant record gaps (7/7/26)
Owner feedback: "the systems don't seem consolidated enough" on the
Health Report, and "I prompted the Assistant to see what information it
needs from me and it says nothing."
- **Health Report consolidation**: the inventory itself now renders as
  trade sections (Plumbing, Water & Septic, HVAC, …) with a rollup line
  per section (count, urgent/attention, unverified), topped by a
  "Systems at a glance" summary card — one row per trade, anchor-linked
  to its section. Systems stay separate records (a well and a water
  heater age and fail independently); the trade is just how they're
  read.
- **recordGaps() in assistant.js**: the assistant now knows what a
  *complete* record looks like — make/model, install year, serial,
  location, a nameplate photo, an in-person verification per system,
  plus unanswered info-asks on open priorities. Gaps ride into the
  context as a RECORD GAPS section, and the prompt tells the model to
  answer "what do you need from me?" with the 2-4 most useful concrete
  asks and offer save_fact chips as answers come in.

## Slice 38 — system dossiers + trade grouping (7/6/26)
Owner insight: "grouping by systems may help consolidate — easier to
stay on top of lots of individual items."
- **trades.js**: canonical trade taxonomy (Plumbing, Water & Septic,
  HVAC, Electrical, Appliances, Roof & Exterior, Landscaping,
  Safety & Air) with fuzzy matching from free-text categories/titles —
  order-aware so "Water Heater" lands in Plumbing, not HVAC.
- **System dossier** (/system/:id): every Health Report card title is
  now a door to the full story of that system — the record (brand,
  install year, serial, lifespan window), photos, learned facts from
  the assistant, trade-related open priorities + work orders, care
  calendar tasks, complete job history, and documents.
- **Group-by-system lens** on 90-Day Priorities and Job History:
  a toggle (sticky per device) swaps the ranked/date view for trade
  sections — ranked stays the default; resolution proximity still runs
  the show.

## Slice 37b — assistant uploads: documents via Firebase Storage (7/6/26)
The internal document pipeline, arriving through the assistant's front
door. 📎 in the chat accepts a PDF (≤10MB): the file uploads to Cloud
Storage under properties/{pid}/documents (member-gated by the new
dashboard/storage.rules — cross-service check against the property's
memberEmails, same allowlists as Firestore), its metadata lands in the
property's `documents` collection ("Documents" card on the Assistant
page with open links), and the content goes to the model in the same
message — summary + up to five proposed save_fact chips
(confirm-then-write, as ever). storageApi.js real + mock (vite alias);
FIREBASE-CHECKLIST gained the one-time storage.rules publish.

## Slice 37a — the assistant returns: one home's concierge, 24/7 (7/5/26)
The owner's three objectives, phase one:
- **Knows one home, nothing else**: context assembled per conversation
  from the member's own property (profile, systems, plan, calendar,
  history, work in motion) plus a growing per-property **facts**
  collection. Isolation is structural — the client only ever holds its
  own home's data and the backend's membership check gates the call.
- **Confirm-then-write learning**: the model proposes
  <action> tags; the UI renders Save/Send chips; writes happen
  client-side only after the member confirms. New powers (e.g. future
  rescheduling) extend ACTION_TYPES + prompt, not the architecture.
- **Two powers live**: answer from the record; file service requests →
  work orders in Triage (source homeowner, via assistant). General
  repair advice is deflected to "want the team to look?" by prompt.
- **Full transcripts** stored per property (conversations collection,
  photos stored as a flag not base64), listed under Past conversations
  — disclosed in the intro line. Photo attach rides the vision path.
- Mock backendApi alias gives deterministic scripted replies for tests
  and preview. Nav "Assistant" for every role; calm home links to it.
- Agentic outreach (objective 3) stays schema-only for now: facts,
  transcripts, touches all dated and queryable.

## Slice 36 — founders' Ideas board (7/5/26)
Owner request: a place in the Business nav to capture ideas the moment
they occur, visible only to the two owners. New founder-only top-level
`ideas` collection (rules block + System status probe + RUNBOOK row —
needs the usual one-publish); /ideas page with quick add (title + a
line of context), attribution + date, done/reopen with a folded done
list, edit and delete. Deliberately lighter than a project tracker.

## Slice 35 — first-login guided tour (7/5/26)
Built for Mike's arrival: a lightweight spotlight tour on first sign-in
(no library — dimmed overlay, white ring on the real UI, a small card
with Next/Skip and progress dots). Role-aware scripts (tourSteps.js):
founders get five stops (welcome → the home's record → View-as → the
business side → start with your own home); homeowners get three calm
ones (welcome → Request → your team) — so it also greets every future
client. Once per device (localStorage), replayable via "App tour" in
the sidebar; steps anchor to data-tour attributes and fall back to
centered cards on mobile.

## Slice 34 — the relationship layer + staff rules (7/5/26)
CRM findings #2 and #6. The business now has a memory of the household,
not just the house:
- **Client relationship card** (founder Overview, "private to HPS"):
  preferences, access & household notes, key dates — stored in a new
  founder-only top-level collection (clients/{propertyId}) that members
  can never read, plus a **touch log** (call/text/email/visit, one line
  each).
- **Relationship health on the Command Center**: each property shows
  "last touch <date>" — or "no touches logged", because the silence is
  the signal.
- **Staff rules** (firestore.rules isStaff()): the relationship and
  technician seats get property-plane access WITHOUT being co-owners
  of a client's home — no membership, no "People with access" entry.
  Placeholder emails; swap alongside roles.js when hiring.
- System status gains a "Client relationship store" probe; RUNBOOK
  updated — **one console publish of dashboard/firestore.rules
  activates both** (card shows a red pointer until then).

## Slice 33 — the receipt of value (7/5/26)
CRM finding #5: clients cancel things that feel dormant. The calm home
gains "Your membership, the last 12 months" — tasks completed, work
handled by trusted pros, issues closed out, and dollars of work
coordinated, all computed straight from the record (valueRecap.js,
trailing-365-day window). Renders only once there's anything to show.

## Slice 32 — visit notes: silent excellence made visible (7/5/26)
CRM finding #3. Job History (founders) gains a "Visit note" composer:
one click drafts a warm, client-ready note from the record — completed
work in the last three weeks (fallback: last few jobs) and what's
coming up from work orders — editable, then Copy / Open in email
(addressed to the non-staff members) / Save. Saved notes land in the
property's visitNotes collection and the latest one greets the
homeowner on their calm home screen as "A note from your team."

## Slice 31 — the bell to ring: Request button + calm homeowner home (7/5/26)
CRM assessment finding #1: the product had no way for a client to ask
for anything. Homeowners now land on a calm home screen instead of the
operational overview:
- **"Need anything?" → Request service**: one tap, a sentence, done.
  Lands as a work order in Triage tagged `source: homeowner` (Client
  request chip on the founder board), and shows the homeowner
  "Received — we're arranging it" under Happening now from the moment
  they send it — no request ever disappears into a void.
- **Is my home okay?** — one status line derived from the systems
  record ("Your home is in good shape" / "N items on our watch list" /
  "We're on it — N urgent items being handled").
- **Your team** card (team.js — swap in Sally's real contact details),
  Recent care (last completed jobs), Happening now.
- Staff and founders keep the full overview; a founder previewing via
  View-as sees the real calm screen.

## Slice 29 — tech debt: code-split + orphan-proof deletes (7/4/26)
- **Code-split**: every page is a lazy chunk behind a Suspense boundary
  in Layout (the chrome never blinks); Firebase and React live in
  their own long-cached vendor chunks. The app's own main chunk went
  from ~1,014KB to ~71KB — first paint ships the shell + Overview,
  everything else loads on first visit, and future deploys only
  invalidate the small app chunk.
- **Orphan-proof deletes**: deleting a Health Report system now takes
  its photos with it (deleteSystemDeep, real + mock), with the confirm
  dialog stating the photo count. The audit tool remains for legacy
  orphans only.

## Slice 28 — roster unification: network is truth (7/4/26)
Closes the last deliberate double-bookkeeping. The Contractor Network
is now the single source of truth for shared vendors; each property
roster entry that matches a network profile is stamped with its
`networkId` and has name/trades/phone kept in sync from it. The
privacy planes survive intact:
- **No rules changes**: founders are members of every property, so the
  sync is ordinary member writes; homeowners still can't read the
  business collection.
- **Homeowner-private vendors stay private**: unlinked entries are
  never touched and never pushed into the business database — the
  founder imports them deliberately (import now auto-links after).
- **"Unify rosters"** on the network page runs the link + sync and
  reports the outcome; editing a network profile re-syncs rosters
  automatically, so a phone-number change lands on every home.
- Roster page: linked entries carry an "HPS vendor" chip and are
  read-only for members ("Contact details managed by your service
  team"); their own entries stay fully editable.

## Slice 27 — work-order pipeline (7/4/26)
The owner's named gap: "the workflow to take an issue, work needing to
be done, who does it, how we get a quote and status of the work." The
work order is now the object that carries all of that:
- **Board** (`/work-orders`, founders): every order across the
  portfolio in lanes — Triage → Quote → Scheduled → In progress →
  Done — each card carrying property, assignment (our visit or a
  network contractor, linked to their profile), quote trail
  (needed/requested/received $X/approved), and dates.
- **Raised from a priority in one click** ("Raise work order" on the
  90-Day list, founders), linked both ways.
- **Completion is the handshake**: marks the lane done, writes the
  Job History entry (contractor + cost from the quote), and resolves
  the linked priority. Nothing bookkept twice.
- **Homeowners see calm, not machinery**: Overview gains a "Happening
  now" card listing only scheduled/in-progress work ("Gutter guards —
  scheduled for July 12"). Triage and quoting stay internal. First
  concrete piece of Sally's calm-homeowner direction.
Zero rules changes (property subcollection under the member wildcard);
workOrders added to the status-panel probes and deep-delete list.

## Slice 26 — design foundations (7/4/26)
First pass of the design overhaul ("modern, easy to use, pretty —
between Google for buttons and Squarespace for pretty"). All through
the shared token sheet + components, so it lands app-wide at once:
- **Typography**: Fraunces (variable, self-hosted) for display —
  page titles, stat figures, wordmark, modal titles — over Inter for
  UI text. The warm-serif/clean-sans pairing.
- **Buttons**: Material-quality pills — filled primary with soft
  elevation, tonal subtle, ghost, tonal danger; focus rings, press
  scale, disabled states.
- **Surfaces**: white cards on a warm paper plane, rounded-2xl, quiet
  two-layer shadows; blur-backdrop modals; friendlier inputs with
  brand focus rings.
- **Hero**: the owner's aerial drone shot as the Overview header for
  the flagship home — address set in Fraunces over a green scrim
  (bundled asset, 358KB optimized; per-property photos later).
Still open for later passes: per-property hero photos, page-level
layout rethinks, brand wordmark/logo, dark mode.

## Slice 25 — founder "View as" switcher (7/4/26)
Owner's idea, same day as Slice 24: a top-ribbon "View as" picker so a
founder can borrow any role's lens — homeowner, relationship,
technician — without signing in as them. Persists (localStorage)
across pages, property switches, and reloads until changed; defaults
to the full founder view. An amber "Previewing as…" banner with a
one-click reset makes the borrowed lens unmistakable. Faithful at the
page level too: every founder gate (Command Center, Contractor
Network, profile pages, photo audit, job-history links, onboarding
checklist) now reads the effective view, so previewing homeowner shows
the real refusal cards, not just a trimmed nav. Presentation only —
it never grants anything, only hides, and non-founders are unaffected.

## Slice 24 — role-based views, phase 1 (7/4/26)
Answer to "when someone else logs in, they see everything and it might
be overwhelming." roles.js resolves a viewing role from the signed-in
email: founder (everything), relationship (Sally: property plane +
intake tools, no business plane, no forecast, no billing), technician
(the visit set: systems, calendar, priorities, walkthrough, history),
homeowner (the default for any member not on the staff map: their
record, clean — no intake tools, no internal onboarding checklist,
billing visible because it's their invoice). Nav is filtered per role,
the billing header is gated, and the Command Center now refuses
non-founders outright instead of hiding founder tools piecemeal.
Phase 1 is presentation, not security — business pages were already
rules-enforced; staff access without co-ownership (real technician
logins) is the phase-2 rules work. Swap the placeholder staff emails
in roles.js for real ones as the team becomes real.

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
      Assets banked: `docs/design-assets/895-old-ballard-aerial-front.jpg`
      (drone shot of the front elevation, 4000×2250, Oct 2021) — owner
      earmarked it as a property-header image for the redesign (7/4/26).

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
- [x] Code-split the main bundle (Slice 29: lazy pages + vendor chunks; app chunk ~71KB).
- [x] Clean up orphaned photos when a system is deleted (Slice 29: deleteSystemDeep).
- [ ] Dark mode (deliberately skipped in redesign; do it properly if wanted).

## Business concept notes (from closing-docs review, 7/1/26)
- Every closing folder is a ready-made Property Profile: inspection report,
  radon cert, appraisal, paint schedule, renovation estimates.
- Seller repair-credits (cash in lieu of repairs) = a built-in 90-day priority
  list of paid-for-but-never-done work at every closing — lead-gen engine.
- Standardized forms (VAR, URAR) make AI extraction genuinely scalable.
