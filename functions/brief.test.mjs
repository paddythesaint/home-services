// Unit tests for the weekly-brief composer. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { buildBrief, rfc822 } = require("./brief.js")

const NOW = new Date("2026-07-26T12:00:00Z")

test("buildBrief composes all four sections from the record", () => {
  const brief = buildBrief({
    profile: { address: "895 Old Ballard Farm Ln" },
    jobs: [
      { title: "Capacitor replacement", sub: "Monticello Air", date: "July 24, 2026", status: "completed" },
      { title: "Old job", date: "March 12, 2026", status: "completed" }, // outside the week
      { title: "Scheduled thing", date: "July 25, 2026", status: "scheduled" }, // not completed
    ],
    workOrders: [
      { title: "Gutter cleaning", lane: "scheduled", contractorName: "Blue Ridge", scheduledFor: "July 30, 2026" },
      { title: "Fence repair", lane: "quote", quoteStatus: "received", quoteAmount: "$800" },
      { title: "Exhaust fans", lane: "parked", revisitOn: "2026-07-01", waitingOn: "bathroom remodel" },
      { title: "Future parked", lane: "parked", revisitOn: "2028-03-01" },
      { title: "Done quote", lane: "done", quoteStatus: "received" }, // closed → not "needs your eye"
    ],
    calendar: [
      { task: "Flush water heater", month: "July" },
      { task: "Already handled", month: "July", doneYear: 2026 },
      { task: "Wrong month", month: "December" },
    ],
    systems: [
      { category: "Radon Mitigation", nextDue: "2026-06-15" },
      { category: "HVAC", nextDue: "2027-01-01" },
    ],
    now: NOW,
  })

  assert.equal(brief.subject, "Your home this week — 895 Old Ballard Farm Ln")
  assert.match(brief.text, /HANDLED THIS WEEK[\s\S]*Capacitor replacement — Monticello Air/)
  assert.doesNotMatch(brief.text, /Old job/)
  assert.match(brief.text, /COMING UP[\s\S]*Gutter cleaning — Blue Ridge \(July 30, 2026\)/)
  assert.match(brief.text, /Flush water heater — on this month's care plan/)
  assert.doesNotMatch(brief.text, /Already handled/)
  assert.match(brief.text, /NEEDS YOUR EYE[\s\S]*Quote in for "Fence repair" — \$800/)
  assert.doesNotMatch(brief.text, /Done quote/)
  assert.match(brief.text, /Radon Mitigation — recurring check due/)
  assert.match(brief.text, /PARKED — READY TO REVISIT\?[\s\S]*"Exhaust fans"[\s\S]*bathroom remodel/)
  assert.doesNotMatch(brief.text, /Future parked/)
})

test("a quiet week composes nothing", () => {
  const brief = buildBrief({
    profile: { address: "42 Ridgeview Rd" },
    jobs: [{ title: "Old job", date: "January 2, 2026", status: "completed" }],
    workOrders: [{ title: "Future parked", lane: "parked", revisitOn: "2028-01-01" }],
    calendar: [{ task: "Winter task", month: "December" }],
    systems: [{ category: "HVAC", nextDue: "2027-01-01" }],
    now: NOW,
  })
  assert.equal(brief, null)
})

test("rfc822 produces a base64url message with headers and body", () => {
  const raw = rfc822({
    from: "HPS <hps@example.com>",
    to: ["alton@example.com", "sally@example.com"],
    subject: "Your home this week",
    text: "Hello.",
  })
  assert.doesNotMatch(raw, /[+/=]/)
  const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  assert.match(decoded, /From: HPS <hps@example.com>\r\n/)
  assert.match(decoded, /To: alton@example.com, sally@example.com\r\n/)
  assert.match(decoded, /Subject: Your home this week\r\n/)
  assert.match(decoded, /\r\n\r\nHello\./)
})
