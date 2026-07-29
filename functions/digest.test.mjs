// Unit tests for the founder digest + empty-record reminder.
// Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { dailyDigest, emptyRecordReminder } = require("./digest.js")

const NOW = new Date("2026-07-28T11:30:00Z")
const HOUR = 3_600_000
const DAY = 86_400_000

test("dailyDigest: only fresh items, only active homes, plain-text sections", () => {
  const digest = dailyDigest(
    [
      {
        profile: { address: "42 Ridgeview Rd" },
        collections: {
          facts: [
            { text: "Radon 1.1 pCi/L (Airthings week 30)", order: NOW.getTime() - 2 * HOUR },
            { text: "Old fact", order: NOW.getTime() - 3 * DAY },
          ],
          workOrders: [{ title: "Disposal is jammed", order: NOW.getTime() - HOUR }],
          jobHistory: [],
          conversations: [],
          photos: [{ order: NOW.getTime() - HOUR }], // untitled → still counted
          healthReport: [],
        },
      },
      {
        profile: { address: "895 Old Ballard Road" },
        collections: { facts: [{ text: "old", order: NOW.getTime() - 5 * DAY }] },
      },
    ],
    { now: NOW }
  )
  assert.match(digest.subject, /Portfolio digest — 1 home with activity/)
  assert.match(digest.text, /42 Ridgeview Rd/)
  assert.match(digest.text, /Facts filed \(1\):[\s\S]*Radon 1.1/)
  assert.doesNotMatch(digest.text, /Old fact/)
  assert.match(digest.text, /Work orders \(1\):[\s\S]*Disposal is jammed/)
  // The quiet home stays out entirely.
  assert.doesNotMatch(digest.text, /895 Old Ballard/)
})

test("dailyDigest: a fully quiet portfolio sends nothing", () => {
  assert.equal(
    dailyDigest([{ profile: { address: "A" }, collections: { facts: [] } }], { now: NOW }),
    null
  )
})

test("emptyRecordReminder: fires only for old, empty, un-nagged homes — to non-founders", () => {
  const base = {
    profile: {
      address: "12 Pilot Ln",
      createdOnMs: NOW.getTime() - 6 * DAY,
      memberEmails: ["paddythesaint@gmail.com", "pilot@example.com"],
    },
    systems: [],
    jobs: [],
    founderEmails: ["paddythesaint@gmail.com"],
  }
  const r = emptyRecordReminder(base, { now: NOW })
  assert.deepEqual(r.to, ["pilot@example.com"])
  assert.match(r.subject, /Your home record is ready when you are/)
  assert.match(r.text, /start the Walkthrough/)

  // Too young → no nag.
  assert.equal(
    emptyRecordReminder(
      { ...base, profile: { ...base.profile, createdOnMs: NOW.getTime() - 2 * DAY } },
      { now: NOW }
    ),
    null
  )
  // Record no longer empty → no nag.
  assert.equal(emptyRecordReminder({ ...base, systems: [{ category: "HVAC" }] }, { now: NOW }), null)
  // Nagged three days ago → cooldown holds.
  assert.equal(
    emptyRecordReminder(
      { ...base, profile: { ...base.profile, reminderSentMs: NOW.getTime() - 3 * DAY } },
      { now: NOW }
    ),
    null
  )
  // No stamp at all (established home) → never nagged.
  assert.equal(
    emptyRecordReminder(
      { ...base, profile: { ...base.profile, createdOnMs: undefined } },
      { now: NOW }
    ),
    null
  )
})
