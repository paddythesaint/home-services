import { describe, it, expect } from "vitest"
import { suggestedContractors, quoteRequestEmail, mailtoHref } from "../quoteRequest"

const net = [
  { id: "hvac", name: "Monticello Air", trades: "HVAC", email: "d@monticello.example" },
  { id: "gut", name: "Blue Ridge Gutter Co", trades: "Gutters, Exterior" },
]

describe("suggestedContractors", () => {
  it("surfaces the trade-matched vendors and keeps the rest", () => {
    const { trade, matched, others } = suggestedContractors({ category: "HVAC" }, net)
    expect(trade.key).toBe("hvac")
    expect(matched.map((c) => c.id)).toEqual(["hvac"])
    expect(others.map((c) => c.id)).toEqual(["gut"])
  })
  it("suggests nobody when the order has no recognizable trade", () => {
    const { matched, others } = suggestedContractors({ category: "" }, net)
    expect(matched).toHaveLength(0)
    expect(others).toHaveLength(2)
  })
})

describe("quoteRequestEmail", () => {
  const order = {
    title: "Clean master-bath exhaust fan",
    category: "HVAC",
    notes: "Motor runs but no airflow — needs cleaning.",
    scheduledFor: "July 20, 2026",
  }
  const property = { address: "895 Old Ballard Farm Ln", areaLabel: "Charlottesville, VA 22901" }

  it("builds a subject and a body with the address, work, notes, and checklist", () => {
    const { subject, body } = quoteRequestEmail(order, property)
    expect(subject).toBe("Quote request: Clean master-bath exhaust fan — 895 Old Ballard Farm Ln")
    expect(body).toContain("895 Old Ballard Farm Ln, Charlottesville, VA 22901")
    expect(body).toContain("Clean master-bath exhaust fan")
    expect(body).toContain("Motor runs but no airflow")
    expect(body).toContain("TRADE: HVAC")
    expect(body).toContain("PREFERRED TIMING: July 20, 2026")
    expect(body).toContain("itemized estimate")
    expect(body).toContain("license and insurance")
  })
  it("degrades gracefully with sparse data", () => {
    const { subject, body } = quoteRequestEmail({}, {})
    expect(subject).toContain("Quote request")
    expect(body).toContain("a property")
  })
})

describe("mailtoHref", () => {
  it("encodes recipient, subject, and body with %20 for spaces", () => {
    const href = mailtoHref({ to: "d@x.example", subject: "Quote request", body: "Line one" })
    expect(href.startsWith("mailto:d%40x.example?")).toBe(true)
    expect(href).toContain("subject=Quote%20request")
    expect(href).toContain("body=Line%20one")
  })
  it("still opens a draft with no recipient", () => {
    expect(mailtoHref({ subject: "Hi", body: "x" })).toBe("mailto:?subject=Hi&body=x")
  })
})
