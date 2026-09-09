// Unit tests for the home-summary composer. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { homeSummary } = require("./summary.js")

const NOW = new Date("2026-09-09T12:00:00Z")

test("composes the live picture: open work, this month's care, due checks, filters, recent jobs", () => {
  const s = homeSummary(
    {
      profile: { address: "895 Old Ballard Farm Ln", areaLabel: "Charlottesville, VA 22901", yearBuilt: "1994" },
      workOrders: [
        { title: "Deck wash", lane: "in-progress", contractorName: "Fitch" },
        { title: "Done thing", lane: "done" },
        { title: "Parked idea", lane: "parked" },
      ],
      priorities: [
        { title: "Replace water heater", urgency: "high", status: "open" },
        { title: "Low urgency", urgency: "low", status: "open" },
        { title: "Resolved high", urgency: "high", status: "resolved" },
      ],
      calendar: [
        { month: "September", task: "Gutter check", doneYear: 2025 },
        { month: "September", task: "Already handled", doneYear: 2026 },
        { month: "October", task: "Next month" },
      ],
      systems: [
        { category: "Radon Mitigation", nextDue: "2026-09-01" }, // overdue
        { category: "HVAC", nextDue: "2026-10-01" }, // inside 30 days
        { category: "Roof", nextDue: "2027-01-01" }, // far out — excluded
      ],
      supplies: [
        { kind: "air", size: "20x25x1", count: 4, stock: 1, intervalMonths: 3, lastReplacedMs: NOW.getTime() - 10 * 86_400_000 },
      ],
      jobs: [
        { title: "Filter change", date: "September 1, 2026", sub: "Owner (DIY)", status: "completed" },
        { title: "Old job", date: "March 2, 2026", status: "completed" },
        { title: "Scheduled", date: "September 5, 2026", status: "scheduled" },
      ],
    },
    NOW
  )
  assert.equal(s.address, "895 Old Ballard Farm Ln")
  assert.deepEqual(s.openWorkOrders, [
    { title: "Deck wash", lane: "in-progress", contractor: "Fitch", scheduledFor: "" },
  ])
  assert.deepEqual(s.highPriorities, ["Replace water heater"])
  assert.deepEqual(s.careThisMonth, ["Gutter check"])
  assert.deepEqual(
    s.checksDue.map((c) => [c.system, c.overdue]),
    [["Radon Mitigation", true], ["HVAC", false]]
  )
  assert.equal(s.filters[0].item, "20x25x1 air filter")
  assert.equal(s.filters[0].low, true)
  assert.match(s.filters[0].nextDue, /^2026-11/) // replaced Aug 30 + 3 months
  assert.deepEqual(s.recentJobs.map((j) => j.title), ["Filter change"])
})

test("an empty record composes cleanly — no throws, empty lists", () => {
  const s = homeSummary({}, NOW)
  assert.equal(s.address, "")
  assert.deepEqual(s.openWorkOrders, [])
  assert.deepEqual(s.filters, [])
  assert.equal(s.generatedAt, NOW.toISOString())
})
