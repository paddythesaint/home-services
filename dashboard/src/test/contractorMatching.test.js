import { describe, it, expect } from "vitest"
import {
  jobMatchesContractor,
  unlinkedMatches,
  groupJobsByProperty,
} from "../contractorMatching"

const monticello = { id: "net-1", name: "Monticello Air" }

describe("jobMatchesContractor", () => {
  it("matches on contractorId regardless of sub text", () => {
    expect(jobMatchesContractor({ contractorId: "net-1", sub: "someone else" }, monticello)).toBe(true)
  })
  it("falls back to case-insensitive name containment for unlinked jobs", () => {
    expect(jobMatchesContractor({ sub: "MONTICELLO AIR — (434) 246-7111" }, monticello)).toBe(true)
    expect(jobMatchesContractor({ sub: "Blue Ridge Gutter Co" }, monticello)).toBe(false)
  })
  it("a job linked to a different contractor never string-matches", () => {
    expect(jobMatchesContractor({ contractorId: "net-2", sub: "Monticello Air" }, monticello)).toBe(false)
  })
})

describe("unlinkedMatches", () => {
  it("returns only unlinked jobs whose sub names the contractor", () => {
    const jobs = [
      { id: "j1", contractorId: "net-1", sub: "Monticello Air" }, // already linked
      { id: "j2", sub: "Monticello Air — annual service" },
      { id: "j3", sub: "Blue Ridge Gutter Co" },
      { id: "j4" }, // no sub at all
    ]
    expect(unlinkedMatches(jobs, monticello).map((j) => j.id)).toEqual(["j2"])
  })
})

describe("groupJobsByProperty", () => {
  it("groups by property, most-worked-at home first, newest job first within", () => {
    const jobs = [
      { id: "a1", propertyId: "A", propertyLabel: "895 Old Ballard", order: 10 },
      { id: "b1", propertyId: "B", propertyLabel: "42 Ridgeview", order: 5 },
      { id: "a2", propertyId: "A", propertyLabel: "895 Old Ballard", order: 30 },
    ]
    const groups = groupJobsByProperty(jobs)
    expect(groups.map((g) => g.propertyId)).toEqual(["A", "B"])
    expect(groups[0].propertyLabel).toBe("895 Old Ballard")
    expect(groups[0].jobs.map((j) => j.id)).toEqual(["a2", "a1"]) // newest first
    expect(groups[1].jobs.map((j) => j.id)).toEqual(["b1"])
  })
})
