// Unit tests for the CPSC recall matcher. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { recallMatches, scanBrands } = require("./recalls.js")

const heaterRecall = {
  RecallNumber: "26-114",
  RecallDate: "2026-03-04T00:00:00",
  Title: "Rheem Recalls Electric Water Heaters Due to Fire Hazard",
  URL: "https://www.cpsc.gov/x",
  Manufacturers: [{ Name: "Rheem Manufacturing" }],
  Products: [{ Name: "Electric water heaters", Model: "XE50" }],
  Hazards: [{ Name: "Fire" }],
}
const grillRecall = {
  RecallNumber: "26-201",
  RecallDate: "2026-05-01T00:00:00",
  Title: "Rheem Recalls Patio Grills",
  Manufacturers: [{ Name: "Rheem Manufacturing" }],
  Products: [{ Name: "Gas patio grills" }],
  Hazards: [{ Name: "Burn" }],
}

test("brand AND product context must both match", () => {
  const systems = [{ id: "wh", category: "Water Heater", brand: "Rheem", detail: "50-gal electric" }]
  const findings = recallMatches(systems, [heaterRecall, grillRecall])
  assert.equal(findings.length, 1)
  assert.equal(findings[0].recallNumber, "26-114")
  assert.equal(findings[0].systemId, "wh")
  assert.equal(findings[0].hazard, "Fire")
})

test("no brand or no context → never matches", () => {
  assert.deepEqual(recallMatches([{ id: "a", category: "Water Heater" }], [heaterRecall]), [])
  assert.deepEqual(recallMatches([{ id: "b", brand: "Rheem" }], [heaterRecall]), [])
})

test("a Trane system ignores Rheem recalls entirely", () => {
  const systems = [{ id: "hv", category: "HVAC", brand: "Trane", detail: "heat and air" }]
  assert.deepEqual(recallMatches(systems, [heaterRecall, grillRecall]), [])
})

test("scanBrands dedupes and drops short/empty brands", () => {
  const brands = scanBrands([
    { brand: "Rheem" },
    { brand: "rheem " },
    { brand: "GE" },
    { brand: "" },
    {},
    { brand: "Trane XR16" },
  ])
  assert.deepEqual(brands.sort(), ["rheem", "trane xr16"])
})
