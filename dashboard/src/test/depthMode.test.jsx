// Slice 80: Detailed is the homeowner's own expansive layer. Everyone gets
// the Simple/Detailed control; switching reveals the record in depth —
// costs included — while operator economics stay behind the staff gate.

import { describe, it, expect, beforeEach } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { setViewAs } from "../roles"
import Overview from "../pages/Overview"
import HealthReport from "../pages/HealthReport"
import JobHistory from "../pages/JobHistory"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

beforeEach(() => {
  // Depth choice and View-as both persist per device — reset between tests.
  localStorage.clear()
})

describe("homeowner Detailed mode", () => {
  it("Home: Detailed opens the record in depth with costs — never operator economics", async () => {
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    await screen.findByText("42 Ridgeview Rd")
    expect(screen.queryByText("The record in depth")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Detailed"))
    expect(await screen.findByText("The record in depth")).toBeInTheDocument()
    expect(screen.getByText("Last serviced")).toBeInTheDocument()
    // Their own care costs appear in Detailed…
    expect(screen.getByText(/\$195/)).toBeInTheDocument()
    // …but operator economics never reach a homeowner, even here.
    expect(screen.queryByText(/Operator view/)).not.toBeInTheDocument()
    expect(screen.queryByText("Margin")).not.toBeInTheDocument()
  })

  it("Home: the founder previewing as homeowner keeps the operator band on top", async () => {
    setViewAs("homeowner")
    renderPage(<Overview />)
    await screen.findByText("895 Old Ballard Farm Ln")
    fireEvent.click(screen.getByText("Detailed"))
    expect(await screen.findByText(/Operator view/)).toBeInTheDocument()
    expect(screen.getByText("Margin")).toBeInTheDocument()
  })

  it("Health of the house: Detailed adds verification and lifespan depth per system", async () => {
    renderPage(<HealthReport />, { uid: "prop-ridge", user: ALTON })
    await screen.findAllByText("Every system")
    // The unverified banner mentions verification too — so count, don't
    // assert absence: every system row gains a depth line on toggle.
    const before = screen.queryAllByText(/verified in person/i).length

    fireEvent.click(screen.getByText("Detailed"))
    const after = (await screen.findAllByText(/verified in person/i)).length
    expect(after).toBeGreaterThan(before)
  })

  it("Everything we've done: Detailed puts the year's spend on the year eyebrow", async () => {
    renderPage(<JobHistory />)
    await screen.findAllByText("Spring HVAC tune-up")
    expect(screen.queryByText(/\$535/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Detailed"))
    // 2026 completed jobs: $225 + $310.
    expect(await screen.findByText(/\$535/)).toBeInTheDocument()
  })

  it("the choice persists on the device", async () => {
    const first = renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    await screen.findByText("42 Ridgeview Rd")
    fireEvent.click(screen.getByText("Detailed"))
    await screen.findByText("The record in depth")
    first.unmount()

    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    expect(await screen.findByText("The record in depth")).toBeInTheDocument()
  })
})
