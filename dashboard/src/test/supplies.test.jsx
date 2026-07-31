// The filter inventory: need / have / when — pure derivations plus the
// Filters & supplies card's replace-and-deduct loop.

import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import {
  nextDueMs,
  isDue,
  lowStock,
  restockLine,
  replacementSummary,
  upcomingByMonth,
  supplyLabel,
} from "../supplies"

const DAY = 86_400_000

describe("supplies derivations (pure)", () => {
  it("due dates slide from the last replacement by the line's interval", () => {
    const now = new Date("2026-07-31")
    const fresh = { kind: "air", size: "20x25x1", intervalMonths: 3, lastReplacedMs: now.getTime() - 30 * DAY }
    expect(isDue(fresh, now)).toBe(false)
    const stale = { ...fresh, lastReplacedMs: now.getTime() - 100 * DAY }
    expect(isDue(stale, now)).toBe(true)
    // Never replaced: the clock starts when the line entered the record.
    const newLine = { kind: "water", size: "Refrigerator filter", createdOnMs: now.getTime() - 10 * DAY }
    expect(isDue(newLine, now)).toBe(false)
    expect(nextDueMs(newLine, now)).toBeGreaterThan(now.getTime())
  })

  it("low stock means not enough for one full change", () => {
    const low = lowStock([
      { id: "a", kind: "air", size: "20x25x1", count: 4, stock: 6 },
      { id: "b", kind: "air", size: "16x25x1", count: 2, stock: 1 },
      { id: "c", kind: "water", size: "Refrigerator filter", count: 1, stock: 0 },
    ])
    expect(low.map((s) => s.id)).toEqual(["b", "c"])
    expect(low[0].shortBy).toBe(1)
    expect(restockLine(low[1])).toBe("Restock Refrigerator filter — need 1, have 0")
  })

  it("upcoming replacements group by month; past-due lands on the current month", () => {
    const now = new Date("2026-07-15")
    const map = upcomingByMonth(
      [
        { id: "a", kind: "air", size: "20x25x1", count: 4, intervalMonths: 3, lastReplacedMs: new Date("2026-06-01").getTime() },
        { id: "b", kind: "air", size: "16x25x1", count: 2, intervalMonths: 3, lastReplacedMs: new Date("2026-01-10").getTime() },
      ],
      now
    )
    expect(map.get(8).map((s) => s.id)).toEqual(["a"]) // due Sept
    expect(map.get(6).map((s) => s.id)).toEqual(["b"]) // overdue → July
    expect(replacementSummary(map.get(6))).toBe("16x25x1 air filter ×2")
  })
})

describe("Filters & supplies card", () => {
  it("lists the home's sizes with stock, flags low lines", async () => {
    const { default: FilterSupplies } = await import("../FilterSupplies")
    render(<FilterSupplies uid="prop-ballard" />)
    expect(await screen.findByText("20x25x1 air filter")).toBeInTheDocument()
    expect(screen.getByText(/Refrigerator filter — Samsung HAF-CIN/)).toBeInTheDocument()
    // sup-16: takes 2, has 1 → low.
    expect(screen.getAllByText(/— low/).length).toBeGreaterThanOrEqual(1)
  })

  it("marking a line replaced deducts a full change, logs the job, and slides the due date", async () => {
    const { default: FilterSupplies } = await import("../FilterSupplies")
    const { __getItems } = await import("../mocks/firestoreApi")
    render(<FilterSupplies uid="prop-ballard" />)
    await screen.findByText("20x25x1 air filter")
    fireEvent.click(screen.getAllByText("replaced")[0])
    await waitFor(() => {
      const sup = __getItems("prop-ballard", "supplies").find((s) => s.id === "sup-20")
      expect(sup.stock).toBe(2) // 6 − 4
      expect(sup.lastReplacedMs).toBeGreaterThan(Date.now() - 60_000)
      const jobs = __getItems("prop-ballard", "jobHistory")
      expect(jobs.some((j) => j.title.startsWith("Replaced 20x25x1 air filter"))).toBe(true)
    })
  })

  it("labels read naturally for both kinds", () => {
    expect(supplyLabel({ kind: "air", size: "20x25x1" })).toBe("20x25x1 air filter")
    expect(supplyLabel({ kind: "water", size: "Under-sink filter" })).toBe("Under-sink filter")
  })
})
