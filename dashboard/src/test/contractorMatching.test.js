import { describe, it, expect } from "vitest"
import {
  jobMatchesContractor,
  unlinkedMatches,
  groupJobsByProperty,
  canonicalName,
  looksSameContractor,
  findContractorMatch,
  findDuplicateContractors,
  combineTrades,
} from "../contractorMatching"

const monticello = { id: "net-1", name: "Monticello Air" }

describe("canonicalName", () => {
  it("strips contact clauses, phone, and legal/filler tokens", () => {
    expect(canonicalName("Monticello Air — (434) 246-7111")).toBe("monticello air")
    expect(canonicalName("Blue Ridge Gutter Co")).toBe("blue ridge gutter")
    expect(canonicalName("Dodson Pest Control, LLC")).toBe("dodson pest control")
    expect(canonicalName("Insured Roofs (Franco)")).toBe("insured roofs")
  })
})

describe("looksSameContractor", () => {
  it("matches spelling/format variants of the same vendor", () => {
    expect(looksSameContractor("Monticello Air", "Monticello Air — (434) 246-7111")).toBe(true)
    expect(looksSameContractor("Dodson Pest Control", "Dodson Pest Control, LLC")).toBe(true)
    expect(looksSameContractor("Monticello Air", "Monticello Air Conditioning")).toBe(true)
  })
  it("keeps genuinely different vendors distinct", () => {
    expect(looksSameContractor("Blue Ridge Gutter", "Blue Ridge Electric")).toBe(false)
    expect(looksSameContractor("Monticello Air", "Charlottesville Generators")).toBe(false)
  })
})

describe("findContractorMatch / findDuplicateContractors", () => {
  const net = [
    { id: "a", name: "Monticello Air" },
    { id: "b", name: "Monticello Air LLC — (434) 246-7111" },
    { id: "c", name: "Blue Ridge Gutter Co" },
  ]
  it("resolves a free-text vendor to an existing profile", () => {
    expect(findContractorMatch("Monticello Air, annual service", net).id).toBe("a")
    expect(findContractorMatch("Someone New Plumbing", net)).toBeNull()
  })
  it("groups the look-alike profiles", () => {
    const groups = findDuplicateContractors(net)
    expect(groups).toHaveLength(1)
    expect(groups[0].map((c) => c.id).sort()).toEqual(["a", "b"])
  })

  it("stops grouping profiles the founder marked as distinct", () => {
    // The three tree companies look alike but are genuinely different vendors.
    const trees = [
      { id: "t1", name: "Charlottesville Tree Service" },
      { id: "t2", name: "Charlottesville Tree Works" },
      { id: "t3", name: "Tree Service of Charlottesville" },
    ]
    expect(findDuplicateContractors(trees)).toHaveLength(1) // flagged by default
    // Once pinned apart (each lists the others in notDuplicate), no group forms.
    const pinned = trees.map((t) => ({
      ...t,
      notDuplicate: trees.filter((o) => o.id !== t.id).map((o) => o.id),
    }))
    expect(findDuplicateContractors(pinned)).toHaveLength(0)
  })
})

describe("combineTrades", () => {
  it("unions distinct trades so a merged vendor keeps every line of work", () => {
    expect(combineTrades("Electrical", "Plumbing")).toBe("Electrical · Plumbing")
    // Michael & Son: three trades, one of which contains an ampersand.
    expect(combineTrades("Electrical · Plumbing", "Septic & Well")).toBe(
      "Electrical · Plumbing · Septic & Well"
    )
  })
  it("dedupes case-insensitively and tolerates blanks", () => {
    expect(combineTrades("HVAC", "hvac, Plumbing")).toBe("HVAC · Plumbing")
    expect(combineTrades("", "Roofing")).toBe("Roofing")
    expect(combineTrades("Roofing", "")).toBe("Roofing")
    expect(combineTrades(undefined, null)).toBe("")
  })
})

describe("jobMatchesContractor", () => {
  it("matches on contractorId regardless of sub text", () => {
    expect(jobMatchesContractor({ contractorId: "net-1", sub: "someone else" }, monticello)).toBe(true)
  })
  it("fuzzy-matches format variants of the name for unlinked jobs", () => {
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
