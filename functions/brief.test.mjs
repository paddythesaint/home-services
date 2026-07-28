// Unit tests for the redesigned weekly-brief composer. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { buildBrief, skyLine, normalizeForecast, rfc822 } = require("./brief.js")

const NOW = new Date("2026-07-26T12:00:00Z")

const day = (date, over = {}) => ({ date, max: 85, min: 65, rainProb: 10, gust: 10, ...over })

test("skyLine: freeze outranks everything and carries the well note", () => {
  const days = [day("2026-11-03", { max: 96 }), day("2026-11-04", { min: 28 })]
  const line = skyLine(days, "November", { hasWell: true })
  assert.match(line, /Freeze ahead — Wednesday night dips to 28°/)
  assert.match(line, /On a well, a long power cut also means no water/)
})

test("skyLine: heat stretch, wind, wet run, then the seasonal beat", () => {
  assert.match(
    skyLine([day("2026-07-27", { max: 99 }), day("2026-07-28", { max: 101 })], "July", {}),
    /A hot stretch: 2 days at 95°\+ ahead \(peak 101°\)/
  )
  assert.match(skyLine([day("2026-07-27", { gust: 52 })], "July", {}), /Strong winds Monday/)
  assert.match(
    skyLine(
      [day("2026-07-27", { rainProb: 80 }), day("2026-07-28", { rainProb: 70 }), day("2026-07-29", { rainProb: 65 })],
      "July",
      { hasWell: true }
    ),
    /A wet run[\s\S]*sump gets its workout/
  )
  assert.match(skyLine([], "October", {}), /Leaf season/)
})

test("normalizeForecast flattens Open-Meteo daily arrays", () => {
  const rows = normalizeForecast({
    daily: {
      time: ["2026-07-27", "2026-07-28"],
      temperature_2m_max: [98, 101],
      temperature_2m_min: [72, 74],
      precipitation_probability_max: [20, 60],
      wind_gusts_10m_max: [18, 33],
    },
  })
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[1], { date: "2026-07-28", max: 101, min: 74, rainProb: 60, gust: 33 })
  assert.deepEqual(normalizeForecast(null), [])
})

const RECORD = {
  profile: { address: "895 Old Ballard Road" },
  jobs: [
    { title: "Capacitor replacement", sub: "Monticello Air", date: "July 24, 2026", status: "completed" },
    { title: "Old job", date: "March 12, 2026", status: "completed" },
  ],
  workOrders: [
    { title: "Fence repair", lane: "quote", quotes: [{ contractor: "A", amount: "$800" }, { contractor: "B", amount: "$1,650" }] },
    { title: "Gutter guards", lane: "quote", quoteStatus: "requested", contractorName: "Blue Ridge" },
    { title: "Deck wash", lane: "in-progress", contractorName: "Fitch" },
    { title: "Exhaust fans", lane: "parked", revisitOn: "2026-07-01", waitingOn: "bathroom remodel" },
    { title: "Attic fan", lane: "parked", revisitOn: "2026-08-10" },
  ],
  calendar: [
    { task: "Flush water heater", month: "July" },
    { task: "Done already", month: "July", doneYear: 2026 },
  ],
  systems: [
    { category: "Well pump", detail: "private well" },
    { category: "Radon Mitigation", nextDue: "2026-06-15" },
    { category: "HVAC", nextDue: "2026-08-20" },
  ],
  now: NOW,
}

test("proactive brief: owner-tagged actions with dollars, 30-day look, decision headline", () => {
  const b = buildBrief({ ...RECORD, style: "proactive" })
  assert.equal(b.subject, "Your home this week — 895 Old Ballard Road")
  assert.match(b.text, /2 decisions are waiting on you this week/)
  assert.match(b.text, /THIS WEEK'S SKY/)
  assert.match(b.text, /DONE THIS WEEK[\s\S]*Capacitor replacement — Monticello Air/)
  // YOU leads, with dollars; the revisit-due parked item is YOURS too.
  assert.match(b.text, /YOU · Pick a quote for "Fence repair" \(\$800 and \$1,650 in\)/)
  assert.match(b.text, /YOU · "Exhaust fans" — you asked us to check back \(was waiting on bathroom remodel\)/)
  assert.match(b.text, /US · "Deck wash" is underway — Fitch/)
  assert.match(b.text, /VENDOR · Awaiting Blue Ridge's quote on "Gutter guards"/)
  // Coming 30 days: this month's care, overdue + upcoming checks, parked revisit inside window.
  assert.match(b.text, /COMING NEXT 30 DAYS[\s\S]*Flush water heater — on this month's care plan/)
  assert.doesNotMatch(b.text, /Done already/)
  assert.match(b.text, /Radon Mitigation — recurring check overdue/)
  assert.match(b.text, /HVAC — recurring check due 2026-08-20/)
  assert.match(b.text, /"Attic fan" — we check back with you 2026-08-10/)
})

test("passive brief: sky + done + reassurance — no dollars, no action list", () => {
  const b = buildBrief({ ...RECORD, style: "passive" })
  assert.match(b.text, /THIS WEEK'S SKY/)
  assert.match(b.text, /Capacitor replacement/)
  assert.doesNotMatch(b.text, /\$800/)
  assert.doesNotMatch(b.text, /WHAT'S NEXT/)
  assert.doesNotMatch(b.text, /COMING NEXT 30 DAYS/)
})

test("a quiet week still sends, led by all-quiet reassurance", () => {
  const b = buildBrief({
    profile: { address: "42 Ridgeview Rd" },
    jobs: [],
    workOrders: [],
    calendar: [],
    systems: [],
    forecast: [],
    style: "proactive",
    now: NOW,
  })
  assert.ok(b)
  assert.match(b.text, /All quiet — nothing needed from you this week/)
  assert.match(b.text, /A quiet week — no work closed out/)
  assert.match(b.text, /High summer/) // July's seasonal beat fills the sky
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
  assert.match(decoded, /MIME-Version: 1.0\r\n/)
  assert.match(decoded, /To: alton@example.com, sally@example.com\r\n/)
  assert.match(decoded, /Subject: Your home this week\r\n/)
  const body = decoded.split("\r\n\r\n")[1]
  assert.equal(Buffer.from(body, "base64").toString("utf8"), "Hello.")
})

test("non-ASCII subjects are RFC 2047-encoded — no more mojibake em-dashes", () => {
  const raw = rfc822({
    from: "HPS <hps@example.com>",
    to: ["a@example.com"],
    subject: "Your home this week — 895 Old Ballard Road",
    text: "Hi — all quiet.",
  })
  const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  const subject = decoded.match(/Subject: (.+)\r\n/)[1]
  assert.match(subject, /^=\?UTF-8\?B\?/)
  assert.equal(
    Buffer.from(subject.slice(10, -2), "base64").toString("utf8"),
    "Your home this week — 895 Old Ballard Road"
  )
})
