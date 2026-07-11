import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Warranties from "../pages/Warranties"
import {
  daysUntil,
  coverageStatus,
  coverageAlerts,
  byExpiry,
  expiryLine,
} from "../warranties"

const NOW = new Date("2026-07-11")

describe("warranties domain (pure, injected clock)", () => {
  it("computes whole-day countdowns and calendar-day 'today'", () => {
    expect(daysUntil("2026-07-21", NOW)).toBe(10)
    expect(daysUntil("2026-07-11", NOW)).toBe(0)
    expect(daysUntil("2026-07-01", NOW)).toBe(-10)
    expect(daysUntil("", NOW)).toBeNull()
    expect(daysUntil("not a date", NOW)).toBeNull()
  })

  it("classifies coverage by its expiry against the 60-day window", () => {
    expect(coverageStatus({ expiry: "2029-05-01" }, NOW)).toBe("active")
    expect(coverageStatus({ expiry: "2026-08-20" }, NOW)).toBe("expiring") // ~40 days out
    expect(coverageStatus({ expiry: "2025-11-15" }, NOW)).toBe("expired")
    expect(coverageStatus({ expiry: "" }, NOW)).toBe("unknown")
  })

  it("alerts on expiring + expired only, soonest first", () => {
    const list = [
      { id: "active", expiry: "2029-05-01" },
      { id: "soon", expiry: "2026-08-20" },
      { id: "lapsed", expiry: "2025-11-15" },
      { id: "undated", expiry: "" },
    ]
    expect(coverageAlerts(list, NOW).map((w) => w.id)).toEqual(["lapsed", "soon"])
  })

  it("orders the ledger expired → expiring → active → undated", () => {
    const list = [
      { id: "active", expiry: "2029-05-01", order: 1 },
      { id: "undated", expiry: "", order: 2 },
      { id: "expired", expiry: "2025-11-15", order: 3 },
      { id: "soon", expiry: "2026-08-20", order: 4 },
    ]
    expect(byExpiry(list, NOW).map((w) => w.id)).toEqual(["expired", "soon", "active", "undated"])
  })

  it("phrases the countdown line", () => {
    expect(expiryLine({ expiry: "2026-07-21" }, NOW)).toBe("Expires in 10 days")
    expect(expiryLine({ expiry: "2026-07-11" }, NOW)).toBe("Expires today")
    expect(expiryLine({ expiry: "2025-11-15" }, NOW)).toMatch(/Lapsed \d+ days ago/)
    expect(expiryLine({ expiry: "" }, NOW)).toBe("No end date on file")
  })
})

describe("Coverage page", () => {
  it("renders the ledger and the attention banner from seeded coverage", async () => {
    renderPage(<Warranties />)
    expect(await screen.findByText("HVAC — Trane XR16 condenser")).toBeInTheDocument()
    // The GAF roof warranty (expiry 2025-11-15) is always in the past, so it
    // shows in both the attention banner and the ledger — a stable signal
    // regardless of the run date.
    expect((await screen.findAllByText("Roof — architectural shingles")).length).toBeGreaterThan(1)
    expect(screen.getByText(/need attention/)).toBeInTheDocument()
    // Home warranty may or may not be in the banner depending on run date, so
    // assert presence without pinning the count.
    expect((await screen.findAllByText(/Whole-home systems & appliances/)).length).toBeGreaterThan(0)
  })
})
