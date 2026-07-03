# Insight ideas — inferring value from public & available data

A backlog of data-driven insight ideas (started 7/3/26). The pattern behind
all of them: **an agent scans a data source → derives a property- or
market-level insight → triggers an action** (a profile enrichment, a client
nudge, an operator dispatch, or an outreach to a prospect). Each idea lists
the use case, the data we need and where it lives, and an honest difficulty
grade.

Difficulty scale:
- **Low** — public API or static dataset, wire it to what we already have.
- **Medium** — scraping or semi-structured sources, some matching logic,
  or needs the backend we haven't built yet.
- **High** — restricted/paid data, legal care needed, or real CV/ML work.

Value type: **Client** (makes the product stickier for existing homeowners),
**Lead-gen** (finds and converts prospects), **Ops** (makes running the
business cheaper/better).

---

## Tier 1 — quick wins (low difficulty, existing data plumbing)

### 1. Storm-event triggers → proactive inspection offers
- **Use case:** NOAA logs a hail/high-wind event over a client's parcel →
  we message "Tuesday's storm crossed your area — want a roof/gutter check?"
  This is exactly the 2025 Allstate-claim story at 895 Old Ballard, but
  proactive instead of reactive, and it positions us ahead of the insurer.
- **Data:** NOAA/NWS storm events database + warnings API (free, public,
  address-resolvable via lat/long we already have from GIS).
- **Build:** scheduled job matches events to client parcels → creates a
  suggested priority + notification. Needs the backend (Cloud Function cron).
- **Value:** Client + Ops (dispatchable work). **Difficulty: Low.**

### 2. Dynamic care calendar from live weather
- **Use case:** first hard-freeze forecast → "detach hoses / winterize
  spigots this week"; drought stretch → irrigation guidance; high-pollen →
  HVAC filter reminder ahead of schedule. Turns the static zone-7a calendar
  into a living one.
- **Data:** NWS forecast API (free), our existing care calendar.
- **Build:** rules mapping forecast conditions → calendar-item nudges.
- **Value:** Client. **Difficulty: Low.**

### 3. Appliance/system recall matching
- **Use case:** we already OCR nameplates in the walkthrough. Match brand +
  model against recalls → "your water heater model has an active CPSC
  recall — manufacturer owes you the fix." Huge trust moment, near-zero cost.
- **Data:** CPSC Recall API (free, public), our nameplate captures.
- **Build:** on nameplate save (and monthly re-scan), query recall API,
  surface a flagged priority.
- **Value:** Client (wow factor). **Difficulty: Low.**

### 4. System-age vs. expected-lifespan forecasting
- **Use case:** furnace installed 2021, expected life 15–20 yrs; water
  heater 2015, life 8–12 — auto-generate the replacement horizon and the
  **3-Year Cost Forecast** page already in the backlog. "Budget ~$1,800 for
  a water heater within 24 months."
- **Data:** static lifespan reference tables (InterNACHI life-expectancy
  chart) + area cost ranges; install dates we already capture.
- **Build:** reference table + a forecast view. No external calls.
- **Value:** Client (the business plan's fourth deliverable). **Difficulty: Low.**

### 5. Well/septic & environmental risk profile
- **Use case:** large Albemarle lots (895 Old Ballard is 5 acres) are often
  well + septic — systems homeowners forget until they fail. Flag "likely
  septic: pump every 3–5 yrs, no record on file" + FEMA flood zone, radon
  zone (done), soil/drainage notes.
- **Data:** VDH well/septic permit records, FEMA flood map API (free),
  USDA soil survey, county GIS (parcel has no public sewer line).
- **Build:** one-time enrichment per property at onboarding.
- **Value:** Client + Lead-gen (a differentiated onboarding report). **Difficulty: Low–Medium.**

---

## Tier 2 — the lead-gen engine (medium difficulty, highest business value)

### 6. Property-transfer triggers → "we already built your profile" outreach
- **Use case:** weekly scan of recorded deeds in target zips above a price
  threshold → new affluent homeowner identified → we pre-build a starter
  profile from public records (like we did for 895 Old Ballard) and reach
  out: "Welcome to Charlottesville — we already assembled your home's
  records. Claim it." This is the business plan's onboarding thesis turned
  into an autopilot acquisition channel, and the closest match to the
  X-concept pattern (agent finds prospect → generates personalized asset →
  sends outreach).
- **Data:** Albemarle/Charlottesville circuit court deed transfers &
  assessor sale records (public, portal-scrape or bulk download), county
  GIS for the property facts.
- **Build:** scraper + the seed-profile generator we already have +
  outreach templating. Outreach automation needs care (CAN-SPAM, tone).
- **Value:** Lead-gen (the flagship). **Difficulty: Medium.**

### 7. Building-permit mining
The single richest public source — one dataset, four use cases:
- **(a) Profile enrichment:** permits at a client's address = verified job
  history with dates and contractors (roof 2019, HVAC 2021, generator 2021)
  — auto-fills system ages we otherwise beg documents for.
- **(b) Contractor DB seeding & vetting:** who pulls the most HVAC permits
  in Albemarle = the active contractor market, feeding the Contractors
  roster with volume/recency signals.
- **(c) Aging-system leads:** homes whose last HVAC permit is 15+ years old
  are replacement prospects; water heaters, roofs likewise.
- **(d) Street-level social proof:** "3 homes on your road re-roofed this
  year" — both a client insight and an outreach hook.
- **Data:** county/city permit portals (Albemarle uses an online system;
  scraping or FOIA'd CSV exports).
- **Build:** scraper + address matching + rules. Backend required.
- **Value:** all three. **Difficulty: Medium** (portal scraping is fiddly
  but the data is public).

### 8. Listing-history enrichment
- **Use case:** the last real-estate listing for a property (photos +
  remarks: "new roof 2019," "renovated kitchen," appliance photos) is a
  ready-made walkthrough. At onboarding, pull the old listing and let the
  AI extract systems, finishes, and ages — same pipeline as our document
  insights, different source.
- **Data:** Zillow/Redfin/Realtor listing pages (ToS-restricted scraping;
  MLS access is licensed) — or simply ask the homeowner for their listing
  link and fetch once with consent.
- **Build:** fetch + Claude vision/extraction → insights-apply flow we
  already have.
- **Value:** Client + Lead-gen (pairs with #6: transfer trigger → listing
  → pre-built profile). **Difficulty: Medium** (High if we fight ToS;
  Medium with the ask-the-owner-for-the-link shortcut).

### 9. Contractor license & standing verification
- **Use case:** every contractor in the roster gets a live "Licensed —
  Class A, exp. 03/2027" badge from state records; lapsed license = ops
  alert before we dispatch them. Vetting is a core marketplace promise —
  this makes it real and automatic.
- **Data:** Virginia DPOR license lookup (public web lookup, scrapeable);
  court records for judgments (stretch).
- **Build:** lookup-on-add + periodic re-check; store status on the
  contractor record (Slice 3 just shipped the container for this).
- **Value:** Ops + Client trust. **Difficulty: Low–Medium.**

### 10. Assessment-change signals
- **Use case:** a jump in a parcel's assessed improvement value =
  renovation happened (permit cross-check) → profile update for clients,
  outreach hook for prospects ("just renovated? protect it with a
  maintenance plan"). Also insurance-readiness: "insurers increasingly
  balk at 20-yr roofs; yours is undocumented — let's establish its age."
- **Data:** annual county assessment rolls (public bulk data).
- **Build:** year-over-year diff on parcels we track/target.
- **Value:** Lead-gen + Client. **Difficulty: Medium.**

---

## Tier 3 — strategic / harder (needs scale, imagery, or paid data)

### 11. Aerial & street imagery condition assessment
- **Use case:** run county orthoimagery / street view through Claude vision:
  roof staining, tree limbs over the house, gutter vegetation, driveway
  cracking → remote pre-inspection before we ever visit, and year-over-year
  change detection ("canopy encroaching on the roofline since 2024").
- **Data:** county GIS orthoimagery (free but dated), Google Maps Static
  API (paid, cheap), Nearmap-class imagery (paid, excellent).
- **Build:** imagery fetch + vision analysis + review UI. The vision part
  is genuinely easy now; sourcing current imagery is the cost.
- **Value:** Ops (cheap inspections) + Lead-gen (evidence-based outreach).
  **Difficulty: Medium–High.**

### 12. Energy benchmarking
- **Use case:** "homes like yours in 22901 average $X/mo; you're 30% above
  — the audit's air-sealing items pay back in ~2 years." Turns the LEAP
  audit we ingested into a comparative, motivating number.
- **Data:** EIA residential consumption survey (free), utility rate
  filings; the client's own usage via bill upload or Green Button export.
- **Build:** benchmark table + a bill-upload extraction (same AI-extraction
  pipeline as documents).
- **Value:** Client. **Difficulty: Medium.**

### 13. Route-density & neighborhood ops insights
- **Use case:** once multiple properties exist: "4 clients within 2 miles
  due for generator service — bundle a route day, offer neighbors a
  first-service discount." Our own data becomes the source.
- **Data:** internal (client addresses, due checks) + geocoding.
- **Build:** clustering on the Command Center. Depends on multi-property
  (Slice 2b) and real client density.
- **Value:** Ops. **Difficulty: Low tech, blocked on scale.**

---

## Suggested sequencing
1. **#3 recalls + #4 lifespan forecast** — days of work, no backend, big
   client-visible payoff; #4 also clears a business-plan deliverable.
2. **#1/#2 weather triggers** — first real use of the backend when we build
   it; small, high-frequency touchpoints that justify the subscription.
3. **#7 permit mining** — the richest single source; start with (a)
   profile enrichment for our own clients, then (c) leads.
4. **#6 transfer-trigger outreach** — the growth engine; build after the
   seed-profile flow is polished, since it *is* the pitch.
5. **#9 license verification** — cheap, and Slice 3's contractor records
   are sitting there waiting for it.

## Open questions
- The specific X post that seeded this
  (https://x.com/everestchris6/status/2072687270709309589) couldn't be
  retrieved (login-walled); the account's theme is autonomous agents that
  mine public data for prospecting. Paste the text/screenshot and we'll
  slot the specific concept in.
- Outreach automation (#6, #7c, #10) needs a consent/compliance pass
  (CAN-SPAM, VA telemarketing rules) before anything sends on autopilot.
- Several ideas need the proper backend (Cloud Functions) already in the
  engineering backlog — they're another reason to prioritize it.
