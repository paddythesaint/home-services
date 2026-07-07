// The 2026 service-records wave (Gmail sweep, Slice 45): one click on the
// Overview banner lands the vendor-email findings as real records — jobs
// with amounts, the systems the record was missing, the coverage-lapse
// priority — without duplicating anything already present.

import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Overview from "../pages/Overview"
import { __getItems } from "../mocks/firestoreApi"

describe("service-records insights wave", () => {
  it("applies jobs, systems, priorities, and calendar tasks from the sweep", async () => {
    renderPage(<Overview />)
    fireEvent.click(await screen.findByText("Apply service records"))

    await waitFor(() => {
      const jobs = __getItems("prop-ballard", "jobHistory")
      expect(jobs.find((j) => j.title.includes("Upstairs HVAC repair"))).toMatchObject({
        cost: "$327.15",
        status: "completed",
      })
    })
    const jobs = __getItems("prop-ballard", "jobHistory")
    expect(jobs.find((j) => j.title.includes("ACC visit #2"))).toMatchObject({
      cost: "$285.21",
    })
    expect(jobs.filter((j) => j.category === "Pest Control")).toHaveLength(2)
    expect(jobs.find((j) => j.title === "Spring cleanup & mulch")).toMatchObject({
      sub: "Jimmie Mills Landscaping",
      cost: "$650",
    })

    const systems = __getItems("prop-ballard", "healthReport")
    expect(systems.find((s) => s.category === "Upstairs HVAC")).toMatchObject({
      brand: "Carrier",
      installYear: "2016",
    })
    expect(systems.find((s) => s.category === "Ting Fire Safety Monitor")).toBeTruthy()
    expect(systems.find((s) => s.category === "Airthings Air Monitor")).toBeTruthy()
    // The existing HVAC record picked up the ACC-plan note in place.
    expect(systems.find((s) => s.id === "sys-hvac").lastServiced).toBe("June 12, 2026")

    const priorities = __getItems("prop-ballard", "priorityList")
    expect(
      priorities.find((p) => p.title.includes("Generator extended coverage"))
    ).toBeTruthy()
    expect(priorities.find((p) => p.title.includes("Fitch Services"))).toBeTruthy()

    const calendar = __getItems("prop-ballard", "careCalendar")
    expect(calendar.find((t) => t.task.includes("Ting fire-monitor"))).toMatchObject({
      month: "June",
    })
  })
})
