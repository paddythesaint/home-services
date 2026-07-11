import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import WhatsNext from "../pages/WhatsNext"
import { __getItems } from "../mocks/firestoreApi"
import {
  seasonFor,
  seasonalPlan,
  recurrenceInsights,
  SEASONAL_PLAYBOOK,
} from "../maintenanceIntelligence"

describe("seasonal playbook (pure)", () => {
  it("maps months to meteorological seasons", () => {
    expect(seasonFor(new Date("2026-04-15"))).toBe("spring")
    expect(seasonFor(new Date("2026-07-11"))).toBe("summer")
    expect(seasonFor(new Date("2026-10-01"))).toBe("fall")
    expect(seasonFor(new Date("2026-01-05"))).toBe("winter")
  })

  it("returns the checklist for the current season", () => {
    const plan = seasonalPlan(new Date("2026-10-01"))
    expect(plan.season).toBe("fall")
    expect(plan.label).toBe("Fall")
    expect(plan.tasks).toBe(SEASONAL_PLAYBOOK.fall)
    expect(plan.tasks.length).toBeGreaterThan(0)
  })
})

describe("recurrence & aging (pure)", () => {
  const now = new Date("2026-07-11")

  it("flags a trade that keeps coming back, and rising cost as an aging signal", () => {
    const jobs = [
      { id: "1", date: "March 12, 2026", category: "HVAC", title: "tune-up", cost: "$225", status: "completed" },
      { id: "2", date: "June 24, 2026", category: "HVAC", title: "capacitor", cost: "$310", status: "completed" },
      { id: "3", date: "May 1, 2026", category: "Exterior", title: "gutter clean", cost: "$180", status: "completed" }, // alone
    ]
    const out = recurrenceInsights(jobs, { now })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ key: "hvac", count: 2, rising: true })
    expect(out[0].note).toMatch(/recurring pattern/)
    expect(out[0].note).toMatch(/trending up/)
  })

  it("ignores old jobs outside the 12-month window and scheduled work", () => {
    const jobs = [
      { id: "1", date: "March 12, 2024", category: "HVAC", cost: "$225", status: "completed" },
      { id: "2", date: "June 24, 2026", category: "HVAC", cost: "$310", status: "completed" },
      { id: "3", date: "July 1, 2026", category: "HVAC", cost: "$100", status: "scheduled" },
    ]
    // Only one qualifying job in-window → not recurring.
    expect(recurrenceInsights(jobs, { now })).toHaveLength(0)
  })
})

describe("What's Next proactive layer", () => {
  it("shows the seasonal checklist and adds a task to the 90-day plan", async () => {
    renderPage(<WhatsNext />)
    const seasonHeading = await screen.findByText(/This season at your home/)
    expect(seasonHeading).toBeInTheDocument()
    const addButtons = await screen.findAllByText("+ Add to plan")
    fireEvent.click(addButtons[0])
    await waitFor(() => {
      const seeded = __getItems("prop-ballard", "priorityList")
      expect(seeded.some((p) => p.seasonalId)).toBe(true)
    })
  })

  it("surfaces the recurring-HVAC insight from seeded job history", async () => {
    renderPage(<WhatsNext />)
    expect(await screen.findByText("Worth a closer look")).toBeInTheDocument()
    expect(screen.getByText(/needed attention 2 times/)).toBeInTheDocument()
  })
})
