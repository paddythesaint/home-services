// Unit tests for the onboarding automation. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { STARTER_CALENDAR, radonZoneFact, floodZoneFact, wellTestTask } =
  require("./onboarding.js")

test("the starter calendar covers all twelve months", () => {
  const months = new Set(STARTER_CALENDAR.map((t) => t.month))
  assert.equal(months.size, 12)
  assert.ok(STARTER_CALENDAR.every((t) => t.task.length > 10))
})

test("radon fact only for the Zone 1 ZIPs we serve", () => {
  const fact = radonZoneFact({ areaLabel: "Charlottesville, VA 22901" })
  assert.equal(fact.id, "enrich-radonzone")
  assert.match(fact.text, /Radon Zone 1/)
  assert.equal(radonZoneFact({ areaLabel: "Seattle, WA 98107" }), null)
  assert.equal(radonZoneFact({}), null)
})

test("flood fact from FEMA, null on failure — never throws", async () => {
  const ok = {
    ok: true,
    json: async () => ({
      features: [{ attributes: { FLD_ZONE: "X", ZONE_SUBTY: "AREA OF MINIMAL FLOOD HAZARD" } }],
    }),
  }
  const fact = await floodZoneFact(38.08, -78.55, async () => ok)
  assert.equal(fact.id, "enrich-floodzone")
  assert.match(fact.text, /flood zone X — area of minimal flood hazard \(no flood insurance requirement\)/)
  assert.equal(await floodZoneFact(38, -78, async () => ({ ok: false, status: 500 })), null)
  assert.equal(
    await floodZoneFact(38, -78, async () => {
      throw new Error("network")
    }),
    null
  )
})

test("a well on record adds the annual water test exactly once", () => {
  const systems = [{ category: "Well pump", detail: "private well" }]
  const task = wellTestTask(systems, [])
  assert.match(task.task, /well water test/i)
  assert.equal(task.month, "May")
  // Already covered → nothing; no well → nothing.
  assert.equal(wellTestTask(systems, [{ task: "Annual well water test" }]), null)
  assert.equal(wellTestTask([{ category: "HVAC" }], []), null)
})
