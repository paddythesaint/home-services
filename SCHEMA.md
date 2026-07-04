# Data model audit — multi-property replicability

Written 7/4/26 in response to: "is the schema/database structure sound for
multiple properties, or does it need rework before continuing?" Verdict:
**the document shapes are fine — properties-as-tenant-boundary with
subcollections underneath is standard, sound NoSQL design for this domain.
The gaps are specific and small, not structural.** This audits them and
splits them by whether fixing them needs a new Firestore rule published
(blocked until you're at a computer with console access) or not (fixable
and shippable right now).

## Current shape (as of 7/4/26)

```
properties/{propertyId}                    — tenant boundary
  members: [{email, name, role}]            — access control, peer-granted
  memberEmails: [email, ...]                — denormalized for array-contains queries
  anthropicApiKey                           — orphaned field, unused as of Slice 10
                                                (7/4/26 — see below)
  exteriorEstimate                          — orphaned field, unused as of Slice 10
  ...profile fields (address, tier, monthlyRate, insightsAppliedOn flags, etc.)

  /healthReport/{id}          — systems: category, detail, condition, brand,
                                 installYear, lastServiced, location, note,
                                 verifyFrequencyMonths, nextDue, verified
  /careCalendar/{id}          — month, task
  /priorityList/{id}          — title, category, reason, urgency, estCost,
                                 status, resolutionPath, bundleTag,
                                 materialsNeeded[], infoNeeded[]   (Slice 5)
  /jobHistory/{id}            — date, title, category, sub (free text),
                                 contractorId (optional FK, Slice 7), status, cost
  /photos/{id}                — systemId, dataUrl (base64), takenOn
  /activity/{id}               — systemId, type, summary, value, unit, date
  /contractors/{id}            — property-local vendor roster (Slice 3)

contractors/{id}                — TOP-LEVEL, founder-only (Slice 7)
  name, trades, phone, email, cadence, sourcing, notes
```

**Slice 10 update (7/4/26):** the Intake Assistant and Exterior
Measurements features (and the `/assistant/chat` subcollection, and
`gaps.js`) were removed. Both called the Anthropic API directly from the
browser with a key pasted into `anthropicApiKey` — the only pattern
available with no backend, and a real exposure since the key leaves the
client from JS anyone with dev-tools access to that browser can read.
Removed rather than proxied, pending a real backend design (see the
parked "AI-agent/backend" topic in BACKLOG.md). The two profile fields
above are harmless now-orphaned data, not migrated.

**Firestore rules** are already generic — `isMemberOf(data)` checks
`memberEmails` on whatever property doc is being accessed; nothing in the
rules or the client code hardcodes a specific property id. That's the part
that matters most for replicability, and it's already right.

## Gaps, ranked by what they cost you at N properties

### 1. Contractors exist in two places, reconciled by string-matching
`properties/{pid}/contractors` (Slice 3, per-property, member-readable) and
top-level `contractors/{id}` (Slice 7, founder-only, cross-property). A job
links to a contractor via free-text `sub` OR an optional `contractorId`, not
consistently either. At one property this is eyeballable. At five, "which
contractor is fastest across the portfolio" silently undercounts every job
that was never manually linked.
**Fixable now?** Partially. New jobs can be required to carry `contractorId`
going forward (pure code change, existing write permission). Fully
collapsing the two stores is a real design decision (see Open questions) —
don't do it today, just stop the bleeding on new writes.

### 2. The system `note` field is an overloaded catch-all
Provenance ("appraisal said X"), history ("serviced March 2022"), and
current-state ("condition: needs new gasket") have all been getting
appended into one free-text field across five files (Assistant,
HealthReport, ImportBundle, Walkthrough, the insight-application banners).
The activity log (Slice 1) was supposed to take history out of `note`; it
hasn't consistently. This is the item that most directly hurts "structured,
insightful data" — a note field is not a queryable fact.
**Fixable now?** Yes — this is a discipline/schema-consistency fix, not a
permissions fix. See action items below.

### 3. No provenance on facts
Nothing records *which* document/photo/chat message asserted a given fact,
or when. Already flagged in BACKLOG.md ("Facts need provenance") from the
7/2 radon story — appraisal-said-X vs. claim-said-Y only made sense because
a human remembered the source, not because the record captured it. At scale
this is the difference between "trustworthy audit trail" and "pile of
assertions."
**Fixable now?** Yes — additive field, existing write permission.

### 4. Homeowner view assumes exactly one property per user
`resolvePropertyId` picks `found.docs[0].id` — the *first* membership match
— and the homeowner-side nav (`Layout.jsx`) never offers a switcher. The
business plane (Command Center, Contractor Network) was already built
portfolio-first and handles N properties correctly. The homeowner plane
was not. If Sally, say, ever co-owned two houses under this system, she'd
only ever see one of them.
**Fixable now?** Yes — reading properties you're already a member of needs
no new permission. This is pure UI.

### 5. Property creation doesn't exist (Slice 2b)
Confirmed by grep: no `createProperty`-shaped function anywhere. Every
property today exists via the legacy owner-uid bootstrap. This is the one
real gap that needs a Firestore rule that isn't written yet — a `create`
clause on `/properties/{id}` isn't covered by the current `allow write`
(which reads `resource.data`, i.e. the *existing* doc; on create there is
no existing doc, so it denies).
**Fixable now?** No, not usably — I can write the rule and the code, but it
can't be exercised or verified until you publish the rule. Parking per your
instruction; the rule diff is drafted at the bottom of this file so it's
ready the next time you're at a computer.

## What I'd actually do today (no Firebase needed for any of these)

1. **Provenance on facts** — add a lightweight `source: {type, label, date}`
   to activity-log entries and to any fact the assistant/insights-banners
   write, so every system fact says where it came from. Small, additive,
   immediately improves auditability.
2. **Stop growing the note-field debt** — new facts captured via the
   assistant/walkthrough/import path go into structured fields or the
   activity log, not appended to `note`. Existing note contents stay as-is
   (no destructive migration) but the bleeding stops.
3. **Enforce `contractorId` on new job-history writes** where a contractor
   is identified — closes the gap incrementally without touching the two-
   store question.
4. **Property switcher in the homeowner nav** — for any user who is a
   member of more than one property, let them pick which one they're
   viewing instead of silently defaulting to the first membership match.

None of these require a rules change, a console visit, or a live multi-
property test to verify — they're all testable the same way everything
else this session was verified (mock data + browser screenshot).

## Open question for later (not urgent, needs a decision, not code)

Should the property-local contractor roster (Slice 3) be **replaced** by a
read-only, business-filtered view into the top-level network (public
fields only: name, trades, phone — never margin/notes), rather than kept
as a second live collection? That's a real architectural call — it removes
the duplication permanently but means homeowners reading contractor data
from a founder-owned collection, which needs its own scoped rule (another
Firebase step). Flagging it now so it's a conscious choice later, not
something we back into.

## Draft rule for Slice 2b (staged, not published — for later)

```
match /properties/{propertyId} {
  allow create: if request.auth != null
    && request.auth.token.email_verified == true
    && request.auth.token.email in request.resource.data.memberEmails;
  allow read: if isMemberOf(resource.data) || isLegacyOwner(propertyId);
  allow write: if isLegacyOwner(propertyId) || isMemberOf(resource.data);
  ...
}
```
