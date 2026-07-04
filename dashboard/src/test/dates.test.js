import { describe, it, expect } from "vitest"
import { todayISO, addMonthsISO, isoToLabel } from "../dates"

describe("todayISO", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("addMonthsISO", () => {
  it("returns an ISO date strictly after today for positive months", () => {
    expect(addMonthsISO(3) > todayISO()).toBe(true)
  })
  it("returns today's date for zero months", () => {
    expect(addMonthsISO(0)).toBe(todayISO())
  })
})

describe("isoToLabel", () => {
  it("renders an ISO date as a long US label", () => {
    expect(isoToLabel("2026-07-04")).toBe("July 4, 2026")
  })
  it("dashes out empty input", () => {
    expect(isoToLabel("")).toBe("—")
    expect(isoToLabel(null)).toBe("—")
  })
})
