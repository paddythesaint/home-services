// Unit tests for the trade-triage assessor. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { TRADE_CHECKLISTS, tradeFor, triageSystemPrompt, parseTriage, runTriage } =
  require("./tradeTriage.js")

test("tradeFor classifies by the request's own words", () => {
  assert.equal(tradeFor({ title: "Outlet sparking in the garage" }), "electrical")
  assert.equal(tradeFor({ title: "Leak under the kitchen sink" }), "plumbing")
  assert.equal(tradeFor({ notes: "AC not cooling upstairs" }), "hvac")
  assert.equal(tradeFor({ title: "Gutter guards on rear roofline" }), "exterior")
  assert.equal(tradeFor({ title: "Dishwasher won't drain" }), "plumbing") // drain wins — correct call
  assert.equal(tradeFor({ title: "Refrigerator making noise" }), "appliance")
  assert.equal(tradeFor({ title: "Weird smell in hallway" }), "general")
})

test("every checklist opens with safety", () => {
  for (const [trade, text] of Object.entries(TRADE_CHECKLISTS)) {
    assert.match(text, /Safety first/, `${trade} checklist must lead with safety`)
  }
})

test("the prompt carries the right checklist and the home's record", () => {
  const p = triageSystemPrompt({
    order: { title: "Breaker keeps tripping", notes: "Happens when the dryer runs", category: "" },
    systems: [{ category: "Electrical Panel", detail: "200A Square D", installYear: "1992" }],
    facts: [{ text: "Panel photo captured July 2026." }],
  })
  assert.match(p, /TRADE TRIAGE/)
  assert.match(p, /electrical triage specialist/)
  assert.match(p, /Federal Pacific/) // the electrical checklist rode along
  assert.match(p, /200A Square D \(installed 1992\)/)
  assert.match(p, /Panel photo captured July 2026/)
  assert.match(p, /Breaker keeps tripping/)
  // No answers yet → no answers block.
  assert.doesNotMatch(p, /ANSWERS FROM THE HOMEOWNER/)
})

test("homeowner answers ride the re-read as ground truth", () => {
  const p = triageSystemPrompt({
    order: {
      title: "Repair broken sash cord — master bedroom window",
      notes: "Window won't stay up",
      category: "",
      triageAnswers: [
        {
          question: "Is the master bedroom window on the first or second floor?",
          answer: "Second floor — but the sash tilts in.",
          by: "paddythesaint@gmail.com",
        },
      ],
    },
  })
  assert.match(p, /ANSWERS FROM THE HOMEOWNER/)
  assert.match(p, /treat as ground truth, never re-ask/)
  assert.match(p, /Second floor — but the sash tilts in/)
})

test("parseTriage reads the fixed shape and normalizes urgency", () => {
  const t = parseTriage(
    `TRADE: electrical
URGENCY: urgent — repeated breaker trips can indicate an overloaded or failing circuit
GAPS: no panel photo on record; unclear if trips are immediate or under load
ASK: Does it trip the moment the dryer starts, or minutes in? | Any warmth or smell at the panel?
NOTES: If the panel is Federal Pacific, replacement supersedes the repair. Permit required for circuit work.`
  )
  assert.equal(t.trade, "electrical")
  assert.equal(t.urgency, "urgent")
  assert.match(t.urgencyReason, /repeated breaker trips/)
  assert.match(t.gaps, /no panel photo/)
  assert.equal(t.questions.split(" | ").length, 2)
  assert.match(t.notes, /Federal Pacific/)
  // Tolerates a partial reply.
  assert.equal(parseTriage("TRADE: hvac").urgency, "")
})

test("runTriage joins text blocks and surfaces upstream errors", async () => {
  const ok = { ok: true, json: async () => ({ content: [{ type: "text", text: "TRADE: hvac\n" }, { type: "text", text: "URGENCY: routine — maintenance item" }] }) }
  const text = await runTriage({ apiKey: "k", model: "m", maxTokens: 10, system: "s", fetchImpl: async () => ok })
  assert.match(text, /TRADE: hvac[\s\S]*URGENCY: routine/)
  await assert.rejects(
    () => runTriage({ apiKey: "k", model: "m", maxTokens: 10, system: "s", fetchImpl: async () => ({ ok: false, status: 500 }) }),
    /Anthropic 500/
  )
})
