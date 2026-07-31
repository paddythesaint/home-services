// Unit tests for the address researcher. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { researchSystemPrompt, parseResearch, fillProfileGaps, runResearch, RESEARCH_TOOLS } =
  require("./enrichment.js")

test("the prompt targets exactly one address and demands the fixed shape", () => {
  const p = researchSystemPrompt({ address: "1600 Old Ballard Road", areaLabel: "Charlottesville, VA 22901" })
  assert.match(p, /ADDRESS RESEARCH/)
  assert.match(p, /1600 Old Ballard Road, Charlottesville, VA 22901/)
  assert.match(p, /Never research any other property/)
  assert.match(p, /county\/official sources over listing sites/)
  assert.match(p, /PROFILE:/)
  assert.match(p, /never guess or average/)
})

test("parseResearch reads the fixed shape; unknowns drop out", () => {
  const { profile, facts, note } = parseResearch(`PROFILE:
yearBuilt: 1987
acreage: 2.1
bedrooms: unknown
bathrooms: 3
parcelId: 05900-00-00-031A0
areaLabel: Charlottesville, VA 22901
FACTS:
- Roof | Architectural shingle roof, replaced 2019 per the 2022 Redfin listing.
- Water & Septic | Private well and septic per the county assessor card.
- not a fact line
NOTE: High confidence — county assessor card and one recent listing agree.`)
  assert.equal(profile.yearBuilt, "1987")
  assert.equal(profile.bathrooms, "3")
  assert.equal(profile.bedrooms, undefined) // unknown dropped
  assert.equal(profile.parcelId, "05900-00-00-031A0")
  assert.equal(facts.length, 2)
  assert.equal(facts[0].category, "Roof")
  assert.match(facts[1].text, /Private well and septic/)
  assert.match(note, /High confidence/)
})

test("gap-fill never overwrites a founder-entered value", () => {
  const patch = fillProfileGaps(
    { address: "x", yearBuilt: "1990", acreage: "" },
    { yearBuilt: "1987", acreage: "2.1", bathrooms: "3" }
  )
  assert.deepEqual(patch, { acreage: "2.1", bathrooms: "3" })
})

test("runResearch resumes pause_turn and joins every text block", async () => {
  const replies = [
    { stop_reason: "pause_turn", content: [{ type: "text", text: "searching…" }] },
    {
      stop_reason: "end_turn",
      content: [
        { type: "text", text: "PROFILE:\nyearBuilt: 1987\n" },
        { type: "web_search_tool_result", content: [] },
        { type: "text", text: "FACTS:\n- Roof | Metal roof per listing.\nNOTE: ok" },
      ],
    },
  ]
  let calls = 0
  const fetchImpl = async (_url, opts) => {
    const body = JSON.parse(opts.body)
    assert.deepEqual(body.tools, RESEARCH_TOOLS)
    return { ok: true, json: async () => replies[calls++] }
  }
  const raw = await runResearch({ apiKey: "k", model: "m", maxTokens: 100, system: "s", fetchImpl })
  assert.equal(calls, 2)
  assert.match(raw, /yearBuilt: 1987/)
  assert.match(raw, /Metal roof per listing/)
})
