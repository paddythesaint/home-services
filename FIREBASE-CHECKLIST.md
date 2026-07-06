# Firebase console checklist — running log

The living list of console actions only the owner can perform. Claude adds
items here whenever a slice needs one; the owner batches them in a single
console visit and moves them to "Done" with the date. Everything else in
the product deploys itself.

Console: [console.firebase.google.com](https://console.firebase.google.com)
→ select the project.

---

## Outstanding (as of 7/5/26 evening)

### 1. Republish the Firestore rules (~2 min)
The repo's rules have moved ahead of production again — the new
founder-only `ideas` collection (Slice 36) isn't live, so the Ideas
board can't read or write in production yet.

- GitHub → `dashboard/firestore.rules` on **main** → copy the whole file
  (copy icon, top right of the file view).
- Console → **Build → Firestore Database → Rules** tab → select all →
  delete → paste → **Publish**.

**Verify:** app → Command Center → System status → Run checks →
**"Idea board (founder-only)"** row goes green (all other rows should
already be green).

### 2. Enable Firebase Storage (~2 min)
Prerequisite for Slice 37b (document uploads through the assistant —
manuals, invoices, closing packages). Nothing in the app uses it until
37b ships, so this is pure pre-work.

- Console → **Build → Storage** → **Get started**.
- Choose **production mode** (we'll publish proper rules with 37b).
- Location: pick **us-central1** if offered (matches the backend
  functions region).

**Verify:** the Storage page shows an empty bucket (`<project>.appspot.com`
or `.firebasestorage.app`). Tell Claude it's enabled — 37b starts there.

---

## Coming soon (no action yet)

- **Storage rules publish** — will be added here when Slice 37b ships
  (a `storage.rules` file will appear in the repo, same copy-paste-publish
  drill as Firestore rules, on the Storage → Rules tab).

---

## Done

- 7/5 — Rules republish #3: Mike as founder (`isFounder`) + Sally's real
  staff email. Created 1505 Brook Hill Ln + added Mike to People with
  access.
- 7/5 — Rules republish #2: Sally's staff access (superseded same day by
  republish #3).
- 7/5 — Rules republish #1: `clients/{propertyId}` store + `isStaff()`
  (Slice 34).
- 7/4 — Cloud Billing API enabled; IAM roles on the service account
  (Editor, Service Account User, Cloud Functions Admin, Cloud Run Admin);
  Blaze upgrade; GitHub secrets (FIREBASE_SERVICE_ACCOUNT,
  ANTHROPIC_API_KEY); $25 budget alert.
