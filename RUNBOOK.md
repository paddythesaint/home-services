# RUNBOOK — one console visit to bring production in line with the repo

The app is a static site; the only piece of it that deploys **manually** is
the Firestore security rules. Everything pending is already staged in
`dashboard/firestore.rules`, so a single publish covers it all. Total time:
about two minutes.

## What's pending and what each piece unblocks

| Rules clause | Added by | What it unblocks in production |
|---|---|---|
| `match /contractors/{contractorId}` (founder-only) | Slice 7 (7/4/26) | Contractor Network page, Job History contractor picker. **If this was never published, both are silently broken in prod today.** |
| `allow create` on `/properties/{propertyId}` | Slice 13 (7/4/26) | The Command Center "+ New property" onboarding flow. |
| Membership rules (`isMemberOf`, `isLegacyOwner`) | earlier, believed live | Everything else — if these were missing you couldn't sign in usefully at all. |

Publishing the whole file is idempotent: clauses that are already live are
simply re-published unchanged. There is nothing to diff by hand.

## Steps

1. Open [console.firebase.google.com](https://console.firebase.google.com)
   and select the project this app uses.
2. In the left nav: **Build → Firestore Database**, then the **Rules** tab.
3. Select **all** the text in the editor and delete it.
4. Paste the **entire contents** of
   [`dashboard/firestore.rules`](dashboard/firestore.rules) from the repo's
   current `main` branch.
5. Click **Publish**.

## Verify (about 30 seconds)

1. Open the deployed app, signed in as the founder account.
2. Go to **Command Center** → scroll to the **System status** card → **Run
   checks**.
3. Expected: **all checks pass**, including "Contractor network
   (founder-only collection)".
4. Optional deeper check: Command Center → **+ New property** → create a
   test property. It should succeed and switch you to its empty dashboard.
   (You can delete it later, or keep it as the template for the next real
   client. If it fails with a permission error, the publish in step 5
   didn't take — re-check the Rules tab shows the create clause.)

## If a check still fails after publishing

- The failing row in System status names the exact capability and Firestore
  error code. `permission-denied` after a publish usually means the publish
  went to a different Firebase project than the one the app's env vars
  point at — check the project name in the console header against
  `VITE_FIREBASE_PROJECT_ID` in the GitHub Pages deploy secrets.
- Rules propagate in seconds-to-a-minute; re-run checks once before digging
  further.

## The backend (Cloud Functions) — deployed by CI, not by hand

Since Slice 20 the repo carries a backend (`functions/`): one HTTPS
function that verifies the caller's Firebase sign-in, checks property
membership, and proxies AI requests with the Anthropic key held
server-side. It deploys automatically via GitHub Actions
(`deploy-functions.yml`) whenever `functions/**` changes on main — no
console visit, no local CLI. It depends on three GitHub repo secrets:
`FIREBASE_SERVICE_ACCOUNT`, `ANTHROPIC_API_KEY`, and the existing
`VITE_FIREBASE_PROJECT_ID`.

**Verify:** Command Center → System status → Run checks → the
"Backend (AI proxy)" row should be green ("reachable · key configured").

**If the first deploy fails**, open the run under GitHub → Actions →
"Deploy backend functions" and read the last red lines:
- *"…API has not been used in project… before or it is disabled"* — the
  deploy needs Cloud APIs enabled once. Open the URL in the error message
  (or console.cloud.google.com → APIs & Services), enable Cloud
  Functions, Cloud Build, Cloud Run, and Artifact Registry, then re-run
  the workflow (Actions → the workflow → Run workflow).
- *"Permission denied" / "does not have permission"* — the service
  account needs deploy roles once: console.cloud.google.com → IAM →
  find the `firebase-adminsdk-…` account → Edit → add roles
  **Cloud Functions Admin**, **Cloud Run Admin**, and
  **Service Account User**, then re-run the workflow.

## Keeping this true in the future

Any PR that edits `dashboard/firestore.rules` must add a row to the table
above (or state that no publish is needed). The System status panel is the
source of truth for what's actually live — when in doubt, run it.
