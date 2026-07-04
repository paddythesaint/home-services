import { describe, it, expect } from "vitest"
import { benchmarkFor, replacementHorizon, fmtMoneyRange } from "../benchmarks"
import { buildForecast, parseCostRange } from "../forecast"

describe("benchmarkFor", () => {
  it("matches systems by category + detail text", () => {
    expect(benchmarkFor({ category: "Water Heater", detail: "50-gal electric" }).key).toBe("water-heater")
    expect(benchmarkFor({ category: "Roof", detail: "Architectural shingle" }).key).toBe("roof")
    expect(benchmarkFor({ category: "Radon Mitigation", detail: "" }).key).toBe("radon")
  })
  it("prefers the more specific entry (tankless before tank)", () => {
    expect(benchmarkFor({ category: "Water Heater", detail: "Tankless propane" }).key).toBe(
      "water-heater-tankless"
    )
  })
  it("returns null for systems it has no read on", () => {
    expect(benchmarkFor({ category: "Wine Cellar", detail: "" })).toBeNull()
  })
})

describe("replacementHorizon", () => {
  const wh = { category: "Water Heater", detail: "", installYear: "2019" }
  it("computes age, window, and status from installYear (fixed 'now')", () => {
    const h = replacementHorizon(wh, 2026)
    expect(h.age).toBe(7)
    expect(h.windowStart).toBe(2027) // 2019 + 8
    expect(h.windowEnd).toBe(2031) // 2019 + 12
    expect(h.status).toBe("approaching") // opens next year
  })
  it("flags in-window and past correctly", () => {
    expect(replacementHorizon(wh, 2028).status).toBe("in-window")
    expect(replacementHorizon(wh, 2032).status).toBe("past")
    expect(replacementHorizon(wh, 2022).status).toBe("healthy")
  })
  it("returns null without an install year or a benchmark", () => {
    expect(replacementHorizon({ category: "Water Heater" }, 2026)).toBeNull()
    expect(replacementHorizon({ category: "Koi Pond", installYear: "2019" }, 2026)).toBeNull()
  })
})

describe("parseCostRange", () => {
  it("reads single figures and ranges, ignoring formatting", () => {
    expect(parseCostRange("$1,800")).toEqual([1800, 1800])
    expect(parseCostRange("$150 – $350")).toEqual([150, 350])
    expect(parseCostRange("~$687/yr")).toEqual([687, 687])
    expect(parseCostRange("TBD")).toBeNull()
    expect(parseCostRange("")).toBeNull()
  })
})

describe("buildForecast", () => {
  const systems = [
    { id: "s1", category: "Water Heater", detail: "", installYear: "2019" }, // window 2027–2031
    { id: "s2", category: "HVAC", detail: "Forced-air", installYear: "2010" }, // window 2022–2027 → already open
    { id: "s3", category: "Roof", detail: "shingle", installYear: "2020" }, // window 2042+ → outside horizon
  ]
  const priorities = [
    { id: "p1", title: "Gutter guards", estCost: "$1,800" },
    { id: "p2", title: "Done thing", estCost: "$500", status: "resolved" },
    { id: "p3", title: "No estimate yet" },
  ]

  it("buckets in-window systems now, opening windows in their year, priorities this year", () => {
    const f = buildForecast(systems, priorities, 2026)
    const y2026 = f.years[0]
    expect(y2026.items.map((i) => i.kind).sort()).toEqual(["priority", "replacement"])
    expect(y2026.items.find((i) => i.kind === "replacement").systemId).toBe("s2")
    const y2027 = f.years[1]
    expect(y2027.items).toHaveLength(1)
    expect(y2027.items[0].systemId).toBe("s1")
    expect(f.years[2].items).toHaveLength(0)
  })

  it("totals ranges per year and overall, excluding per-unit costs", () => {
    const f = buildForecast(systems, priorities, 2026)
    // 2026: HVAC 7000–14000 + gutter 1800 = 8800–15800
    expect(f.years[0].total).toEqual([8800, 15800])
    // grand adds 2027's water heater 1300–2500
    expect(f.grand).toEqual([10100, 18300])
  })

  it("excludes resolved priorities and ones without estimates", () => {
    const f = buildForecast([], priorities, 2026)
    expect(f.years[0].items).toHaveLength(1)
    expect(f.years[0].items[0].priorityId).toBe("p1")
  })
})

describe("fmtMoneyRange", () => {
  it("formats ranges, single values, and per-unit costs", () => {
    expect(fmtMoneyRange([1300, 2500])).toBe("$1,300–2,500")
    expect(fmtMoneyRange([1800, 1800])).toBe("$1,800")
    expect(fmtMoneyRange([500, 1200], "per window")).toBe("$500–1,200 per window")
  })
})
