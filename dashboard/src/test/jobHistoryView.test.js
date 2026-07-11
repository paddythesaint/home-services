import { describe, it, expect } from "vitest"
import { jobTime, byDateDesc, byMonth, tradeJobRollup } from "../jobHistoryView"

describe("jobTime (loose date parsing)", () => {
  it("parses exact and imprecise labels, ignoring insert order", () => {
    expect(Number.isNaN(jobTime({ date: "June 12, 2026" }))).toBe(false)
    // "Early April 2026" → April 2026, not January.
    expect(new Date(jobTime({ date: "Early April 2026" })).getMonth()).toBe(3)
    // Year-only fallback.
    expect(new Date(jobTime({ date: "Fall 2025" })).getFullYear()).toBe(2025)
    expect(Number.isNaN(jobTime({ date: "" }))).toBe(true)
  })
})

describe("byDateDesc", () => {
  it("orders by the real activity date, not the insert order", () => {
    // insert order (b newest) disagrees with activity date (a is newer)
    const jobs = [
      { id: "a", date: "June 12, 2026", order: 1 },
      { id: "b", date: "February 20, 2026", order: 99 },
      { id: "c", date: "", order: 50 }, // undated → last
    ]
    expect(byDateDesc(jobs).map((j) => j.id)).toEqual(["a", "b", "c"])
  })
})

describe("byMonth", () => {
  it("buckets by the month the work happened, newest first, undated last", () => {
    const groups = byMonth([
      { id: "a", date: "June 12, 2026" },
      { id: "b", date: "June 2, 2026" },
      { id: "c", date: "February 20, 2026" },
      { id: "d", date: "unknown" },
    ])
    expect(groups.map((g) => g.label)).toEqual(["June 2026", "February 2026", "Undated"])
    expect(groups[0].jobs.map((j) => j.id)).toEqual(["a", "b"])
  })
})

describe("tradeJobRollup", () => {
  it("summarizes count, total logged cost, and latest date", () => {
    const line = tradeJobRollup([
      { id: "a", date: "June 12, 2026", cost: "$285.21" },
      { id: "b", date: "April 22, 2026", cost: "$327.15" },
    ])
    expect(line).toMatch(/2 jobs/)
    expect(line).toMatch(/\$612/)
    expect(line).toMatch(/latest June 12, 2026/)
  })
})
