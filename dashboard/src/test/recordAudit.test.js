import { describe, it, expect } from "vitest"
import { auditAction, hasDuplicate, overlap, sweepRecord } from "../recordAudit"

const record = {
  facts: [
    { id: "f1", text: "Sunwave recommended replacing the well pressure tank; replacement not yet completed as of July 2026." },
    { id: "f2", text: "Water pump warranty registered with Grundfos, July 2026" },
  ],
  systems: [
    { id: "s1", category: "Well pressure tank", detail: "Zilmet Hydro-Plus ZHP 52 gal", installYear: "2026" },
  ],
  jobs: [{ id: "j1", title: "Repaired slow leak at well pressure switch/tank fittings", date: "July 22, 2026" }],
  workOrders: [
    {
      id: "wo1",
      title: "Replace well pressure tank per Sunwave recommendation",
      lane: "quote",
      quotes: [{ contractor: "Sunwave Plumbing", amount: "$2,545.00" }],
    },
    { id: "wo2", title: "Old finished thing", lane: "done" },
  ],
}

describe("recordAudit", () => {
  it("overlap scores containment of the smaller statement", () => {
    expect(overlap("well pressure tank", "Replace the well pressure tank soon")).toBe(1)
    expect(overlap("gutter guards", "well pressure tank")).toBe(0)
  })

  it("flags a near-duplicate fact", () => {
    const findings = auditAction(
      { type: "save_fact", fact: "Grundfos water pump warranty was registered in July 2026" },
      record
    )
    expect(hasDuplicate(findings)).toBe(true)
    expect(findings[0].match).toMatch(/Grundfos/)
  })

  it("flags a completion fact as superseding a stale pending fact", () => {
    const findings = auditAction(
      { type: "save_fact", fact: "Well pressure tank replaced with Zilmet Hydro-Plus ZHP, installed July 2026 by Sunwave." },
      record
    )
    const conflict = findings.find((f) => f.kind === "conflict")
    expect(conflict).toBeTruthy()
    expect(conflict.match).toMatch(/not yet completed/)
  })

  it("flags an already-tracked system and an install-year mismatch", () => {
    const findings = auditAction(
      { type: "log_system", title: "Well pressure tank", detail: "Zilmet", installYear: "2024" },
      record
    )
    expect(hasDuplicate(findings)).toBe(true)
    expect(findings.find((f) => f.kind === "conflict").note).toMatch(/2026 on record/)
  })

  it("flags a duplicate job and a missing date", () => {
    const findings = auditAction(
      { type: "log_job", title: "Repaired leak at well pressure switch fittings" },
      record
    )
    expect(hasDuplicate(findings)).toBe(true)
    expect(findings.find((f) => f.kind === "unclear").note).toMatch(/No date/)
  })

  it("flags a service request already covered by an open order, ignoring done lanes", () => {
    expect(
      hasDuplicate(auditAction({ type: "service_request", title: "Replace the well pressure tank" }, record))
    ).toBe(true)
    expect(
      auditAction({ type: "service_request", title: "Old finished thing" }, record)
    ).toEqual([])
  })

  it("flags a quote already on the order and a missing amount", () => {
    const dup = auditAction(
      { type: "log_quote", workOrderId: "wo1", contractor: "Sunwave Plumbing", amount: "$2,545.00" },
      record
    )
    expect(hasDuplicate(dup)).toBe(true)
    const thin = auditAction({ type: "log_quote", workOrderId: "wo1", contractor: "Acme" }, record)
    expect(thin.find((f) => f.kind === "unclear").note).toMatch(/No amount/)
  })

  it("stays quiet on a genuinely new record", () => {
    expect(
      auditAction(
        { type: "save_fact", fact: "Driveway gate keypad code changed after the landscaping crew rotation, July 2026" },
        record
      )
    ).toEqual([])
  })

  it("ignores archived facts everywhere", () => {
    const rec = {
      facts: [{ id: "f1", text: "Grundfos water pump warranty registered July 2026", archived: true }],
    }
    expect(auditAction({ type: "save_fact", fact: "Water pump warranty registered with Grundfos, July 2026" }, rec)).toEqual([])
    expect(sweepRecord(rec)).toEqual([])
  })
})

describe("sweepRecord (Slice 74)", () => {
  const facts = [
    { id: "f1", text: "Well pressure tank replacement recommended; not yet completed (June 2026)" },
    { id: "f2", text: "Replacement well pressure tank installed by Sunwave, July 2026" },
    { id: "f3", text: "Whole-house generator serviced by Fitch, annual plan, October 2025" },
    { id: "f4", text: "Generator serviced by Fitch on the annual plan, October 2025" },
    { id: "f5", text: "Roof unknown" },
  ]

  it("pairs duplicate facts, keeping the fuller statement", () => {
    const f = sweepRecord({ facts }).find((x) => x.kind === "duplicate-facts")
    expect(f).toBeTruthy()
    expect(f.keep.id).toBe("f3")
    expect(f.redundant.id).toBe("f4")
  })

  it("flags a stale pending fact superseded by a completion fact", () => {
    const f = sweepRecord({ facts }).find((x) => x.kind === "stale-fact")
    expect(f.stale.id).toBe("f1")
    expect(f.evidence).toMatch(/installed by Sunwave/)
  })

  it("accepts a logged job as completion evidence", () => {
    const f = sweepRecord({
      facts: [facts[0]],
      jobs: [{ id: "j9", title: "Well pressure tank replacement", date: "July 23, 2026" }],
    }).find((x) => x.kind === "stale-fact")
    expect(f.evidence).toMatch(/July 23, 2026/)
  })

  it("flags thin facts, duplicate systems, and same-day duplicate jobs", () => {
    const out = sweepRecord({
      facts: [facts[4]],
      systems: [
        { id: "s1", category: "Water pump" },
        { id: "s2", category: "Water pump (basement)", detail: "Grundfos" },
      ],
      jobs: [
        { id: "j1", title: "Gutter cleaning", date: "May 1, 2026" },
        { id: "j2", title: "Gutter cleaning", date: "May 1, 2026" },
      ],
    })
    expect(out.map((x) => x.kind).sort()).toEqual(["duplicate-jobs", "duplicate-systems", "thin-fact"])
  })

  it("honors remembered dismissals by key", () => {
    const all = sweepRecord({ facts })
    const keys = all.map((f) => f.key)
    expect(sweepRecord({ facts }, keys)).toEqual([])
  })
})
