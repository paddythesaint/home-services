# Firebase console checklist — running log

The living list of console actions only the owner can perform. Claude adds
items here whenever a slice needs one; the owner batches them in a single
console visit and moves them to "Done" with the date. Everything else in
the product deploys itself.

Console: [console.firebase.google.com](https://console.firebase.google.com)
→ select the project.

---

## Outstanding (as of 7/6/26)

### 1. Publish the Storage rules (~2 min)
Slice 37b shipped document uploads through the assistant. Files are
member-gated by `dashboard/storage.rules` — until it's published,
production uploads will be denied (the chat shows the error politely,
but uploads won't stick).

- GitHub → `dashboard/storage.rules` on **main** → copy the whole file.
- Console → **Build → Storage → Rules** tab → select all → delete →
  paste → **Publish**.

**Verify:** in the live app, Assistant → 📎 → attach any small PDF →
send. The "Documents" card on the Assistant page should list it with an
"open" link that works.

---

## Coming soon (no action yet)

- (nothing queued)

---

## Done

- 7/5 — Rules republish #4: founder-only `ideas` collection (Slice 36 —
  Ideas board live). Enabled Firebase Storage (production mode).
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
