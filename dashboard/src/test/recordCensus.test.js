import { describe, it, expect } from "vitest"
import {
  assetCompleteness,
  missingSystems,
  featureFuel,
  censusSummary,
  EXPECTED_RURAL_HOME,
} from "../recordCensus"

const fullAsset = {
  id: "s1",
  category: "Standby generator",
  brand: "Generac",
  detail: "Guardian 22kW, serial 123456",
  installYear: "2019",
  condition: "good",
  verified: true,
  location: "East side of house",
}
const context = {
  jobs: [{ id: "j1", title: "Generator annual service", category: "Standby generator", contractorId: "net-fitch" }],
  warranties: [{ id: "w1", item: "Generac generator extended warranty", provider: "Generac" }],
  facts: [],
  photos: [{ id: "p1", systemId: "s1" }],
  careCalendar: [{ id: "c1", month: "July", task: "Exercise check" }],
}

describe("assetCompleteness", () => {
  it("scores a fully documented asset 100", () => {
    const { score, missing } = assetCompleteness(fullAsset, context)
    expect(score).toBe(100)
    expect(missing).toEqual([])
  })

  it("scores a bare asset low and names every missing field", () => {
    const { score, missing } = assetCompleteness({ id: "s2", category: "Dryer" }, context)
    expect(score).toBe(0)
    expect(missing).toContain("make/model")
    expect(missing).toContain("install year")
    expect(missing).toContain("serial")
  })

  it("finds serials in linked facts, not just the detail field", () => {
    const { missing } = assetCompleteness(
      { id: "s3", category: "Well pressure tank", brand: "Zilmet" },
      { ...context, facts: [{ text: "Well pressure tank serial 900906331977, installed July 2026" }] }
    )
    expect(missing).not.toContain("serial")
  })
})

describe("missingSystems", () => {
  it("diffs the registry against the rural-home template", () => {
    const systems = [fullAsset, { id: "s4", category: "HVAC", detail: "Forced-air" }]
    const labels = missingSystems(systems).map((m) => m.label)
    expect(labels).toContain("Dryer")
    expect(labels).toContain("Septic system")
    expect(labels).not.toContain("Standby generator")
    expect(labels).not.toContain("HVAC zones")
  })

  it("reports nothing missing for a complete registry", () => {
    const systems = EXPECTED_RURAL_HOME.map((e, i) => ({ id: `x${i}`, category: e.label }))
    expect(missingSystems(systems)).toEqual([])
  })
})

describe("featureFuel", () => {
  it("marks capital triggers ready only when majors carry install years", () => {
    const ready = featureFuel({ systems: [fullAsset], ...context })
    expect(ready.find((f) => f.feature === "Capital-event triggers").ready).toBe(true)
    const notReady = featureFuel({ systems: [{ id: "s5", category: "Water heater" }], ...context })
    expect(notReady.find((f) => f.feature === "Capital-event triggers").ready).toBe(false)
  })

  it("always marks the Emergency Card as needing its walkthrough", () => {
    expect(featureFuel({ systems: [fullAsset], ...context }).find((f) => f.feature === "Emergency Card").ready).toBe(false)
  })

  it("reports the appliance blind spot honestly", () => {
    const fuel = featureFuel({ systems: [fullAsset], ...context })
    expect(fuel.find((f) => f.feature.startsWith("Repair-vs-replace")).have).toMatch(/^0\//)
  })
})

describe("censusSummary", () => {
  it("emits the paste-back block with scores, gaps, and fuel", () => {
    const text = censusSummary({ systems: [fullAsset], ...context })
    expect(text).toMatch(/1 assets, avg completeness 100\/100/)
    expect(text).toMatch(/MISSING FROM REGISTRY: .*Dryer/)
    expect(text).toMatch(/Capital-event triggers: 1\/1 major systems dated → READY/)
  })
})
