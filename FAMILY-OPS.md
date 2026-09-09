# Family-ops integration — one codebase, three touchpoints

Patrick's personal assistant (the family-ops repo) integrates with the
home platform through **data, not code** — no fork, no second Firebase
project. Three touchpoints, from zero-setup to one-secret:

## 1. Read: the home-summary endpoint

`GET https://us-central1-<PROJECT_ID>.cloudfunctions.net/homeSummary`
with header `Authorization: Bearer <HOME_SUMMARY_TOKEN>`.

Returns one JSON snapshot of Patrick's home (resolved by his membership —
the same source of truth as the app):

| Field | What it holds |
|---|---|
| `address`, `profile` | The home's identity and vitals |
| `openWorkOrders` | Live work with lane, contractor, scheduled date |
| `highPriorities` | Open high-urgency priority titles |
| `careThisMonth` | This month's care tasks not yet done this year |
| `checksDue` | Recurring checks due within ~30 days, `overdue` flagged |
| `filters` | The consumables ledger: item, takes/on-hand, `low` flag, next change date |
| `recentJobs` | Completed work from the last 30 days |

Read-only, GET-only, single home, no CORS (server-to-server). With the
token secret unset the endpoint answers 404 — it is off by default.

### One-time setup (Patrick)

1. Generate a long random token, e.g. `openssl rand -hex 32`.
2. In THIS repo: GitHub → Settings → Secrets and variables → Actions →
   new secret **`HOME_SUMMARY_TOKEN`** with that value.
3. Re-run the "Deploy backend functions" workflow (Actions tab), or merge
   any functions change.
4. Find the endpoint URL: Firebase console → Build → Functions → the
   `homeSummary` row shows its trigger URL.
5. Store the same token + URL wherever family-ops keeps secrets.

## 2. Write: the intake mailbox

Anything emailed to **cvillehomeservicestest@gmail.com** *from Patrick's
address* auto-files to his home within ~10 minutes (sender routing) —
receipts, inspection reports, photos, or plain sentences ("water heater
serviced today by Sunwave, $240"). This is the write path: family-ops
never needs database credentials; it just sends mail as Patrick.

## 3. Passive reads: the emails already flowing

- **Monday weekly brief** — the home's week: done, next, coming, supplies.
- **Daily founder digest** (7:30am ET) — activity across all homes.

A Gmail-connected assistant can read both without any setup here.

## Paste-ready block for family-ops' CLAUDE.md

```markdown
## Home record (Charlottesville Home & Property Services platform)

Our house has a living record on the HPS platform. Integrate via:

- **Read**: `GET <HOMESUMMARY_URL>` with header
  `Authorization: Bearer <HOME_SUMMARY_TOKEN>` (both in secrets).
  JSON snapshot: open work orders, high priorities, this month's care
  tasks, checks due (overdue flagged), filter inventory with low-stock
  flags, recent completed jobs. Fold relevant items into morning briefs
  and to-do views; a `low: true` filter or `overdue: true` check is
  worth surfacing.
- **Write**: email cvillehomeservicestest@gmail.com FROM Patrick's
  address. Facts, receipts, photos, and documents auto-file to the
  home's record within ~10 minutes. Use this to log home maintenance
  Patrick mentions ("flag that we replaced the sump pump").
- Patrick also receives a Monday weekly brief and a daily 7:30am ET
  digest from the platform by email — treat those as readable context,
  and never double-report items already covered by them.

Never call the endpoint more than a few times a day (it's a snapshot,
not a stream), and never forward its contents outside the family.
```
