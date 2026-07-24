import { describe, it, expect } from "vitest"
import { auditAction, hasDuplicate, overlap } from "../recordAudit"

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
})
