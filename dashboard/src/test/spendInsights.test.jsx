import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import HomeReport from "../pages/HomeReport"
import {
  parseCost,
  totalSpend,
  jobsInYear,
  spendByTrade,
  spendByMonth,
  spendByContractor,
  annualReport,
} from "../spendInsights"

describe("spend insights (pure)", () => {
  it("reads the first money value out of free-text costs", () => {
    expect(parseCost("$225")).toBe(225)
    expect(parseCost("$1,450")).toBe(1450)
    expect(parseCost("$150 – $350")).toBe(150)
    expect(parseCost("")).toBe(0)
    expect(parseCost(undefined)).toBe(0)
    expect(parseCost("no charge")).toBe(0)
  })

  it("scopes to completed jobs in a calendar year by real activity date", () => {
    const jobs = [
      { id: "a", date: "March 12, 2026", cost: "$225", status: "completed" },
      { id: "b", date: "July 4, 2025", cost: "$500", status: "completed" },
      { id: "c", date: "May 1, 2026", cost: "$100", status: "scheduled" }, // not done
      { id: "d", date: "", cost: "$999", status: "completed" }, // undated
    ]
    expect(jobsInYear(jobs, 2026).map((j) => j.id)).toEqual(["a"])
    expect(totalSpend(jobsInYear(jobs, 2026))).toBe(225)
  })

  it("groups spend by trade, largest first, with shares", () => {
    const jobs = [
      { id: "1", category: "HVAC", title: "tune-up", cost: "$300" },
      { id: "2", category: "HVAC", title: "capacitor", cost: "$200" },
      { id: "3", category: "Exterior", title: "gutter", cost: "$100" },
    ]
    const t = spendByTrade(jobs)
    expect(t[0]).toMatchObject({ key: "hvac", amount: 500, count: 2 })
    expect(t[0].share).toBeCloseTo(500 / 600, 5)
    expect(t[1]).toMatchObject({ key: "exterior", amount: 100 })
  })

  it("buckets spend by month and by contractor", () => {
    const jobs = [
      { id: "1", date: "March 12, 2026", cost: "$300", sub: "Monticello Air" },
      // Same vendor, written with a phone suffix — should merge, not split.
      { id: "2", date: "March 20, 2026", cost: "$200", sub: "Monticello Air — (434) 246-7111" },
      { id: "3", date: "June 1, 2026", cost: "$100", sub: "Blue Ridge Gutter Co" },
    ]
    const months = spendByMonth(jobs)
    expect(months[0]).toMatchObject({ label: "June 2026", amount: 100 })
    expect(months[1]).toMatchObject({ label: "March 2026", amount: 500 })
    const vendors = spendByContractor(jobs)
    expect(vendors[0]).toMatchObject({ name: "Monticello Air", amount: 500, count: 2 })
  })

  it("assembles the annual report", () => {
    const jobs = [
      { id: "1", date: "March 12, 2026", category: "HVAC", cost: "$300", status: "completed", sub: "Monticello Air" },
      { id: "2", date: "June 24, 2026", category: "HVAC", cost: "$310", status: "completed", sub: "Monticello Air" },
    ]
    const systems = [{ id: "s1", verified: true }, { id: "s2" }]
    const r = annualReport(jobs, systems, 2026)
    expect(r.total).toBe(610)
    expect(r.jobCount).toBe(2)
    expect(r.topTrade.key).toBe("hvac")
    expect(r.systemsTracked).toBe(2)
    expect(r.systemsVerified).toBe(1)
  })
})

describe("Home Report page", () => {
  it("renders the year-in-review from seeded job history", async () => {
    renderPage(<HomeReport />)
    expect(await screen.findByText("Your Home, in Review")).toBeInTheDocument()
    expect(screen.getByText("Where your investment went")).toBeInTheDocument()
    // Seeded 895 HVAC spend ($225 + $310) is the biggest area.
    expect(screen.getAllByText(/HVAC/).length).toBeGreaterThan(0)
  })
})
