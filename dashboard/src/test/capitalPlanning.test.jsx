// Capital-event triggers: replacement-window arithmetic becomes a ranked
// planning feed, and the Command Center gets a Capital horizon card.

import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { capitalEvents, capitalPhrase } from "../capitalPlanning"
import Ops from "../pages/Ops"

describe("capitalEvents (pure)", () => {
  const systems = [
    // Past its window entirely.
    { id: "a", category: "Water Heater", installYear: "2008" },
    // In the window now (typical 12–17 from 2012 → 2024–2029).
    { id: "b", category: "HVAC", installYear: "2012" },
    // Young — healthy, drops out.
    { id: "c", category: "HVAC", installYear: "2025" },
    // No install year — no arithmetic possible, drops out.
    { id: "d", category: "Septic System" },
  ]

  it("ranks past before in-window and drops healthy/undated systems", () => {
    const events = capitalEvents(systems, 2026)
    expect(events.map((e) => e.system.id)).toEqual(["a", "b"])
    expect(events[0].horizon.status).toBe("past")
    expect(events[1].horizon.status).toBe("in-window")
  })

  it("phrases each status as a planning sentence with the cost range", () => {
    const [past, inWindow] = capitalEvents(systems, 2026)
    expect(capitalPhrase(past)).toMatch(/beyond its typical life/)
    expect(capitalPhrase(past)).toMatch(/\$/)
    expect(capitalPhrase(inWindow)).toMatch(/replacement window \(2024–2029\)/)
  })

  it("approaching windows get the heads-up phrasing", () => {
    // 15-year-typical roof from 2013 → window opens 2028, within 3 years.
    const events = capitalEvents([{ id: "r", category: "HVAC", installYear: "2016" }], 2026)
    expect(events).toHaveLength(1)
    expect(events[0].horizon.status).toBe("approaching")
    expect(capitalPhrase(events[0])).toMatch(/enters its replacement window in 2028/)
  })
})

describe("Capital horizon on the Command Center", () => {
  it("lists dated fixture systems with their planning phrases", async () => {
    renderPage(<Ops />)
    expect(await screen.findByText(/Capital horizon/)).toBeInTheDocument()
    // Ballard HVAC (2016) and Water Heater (2019) both approach their windows.
    expect(screen.getAllByText(/enters its replacement window/).length).toBeGreaterThan(0)
    expect(screen.getByText(/census fill adds joins this view/)).toBeInTheDocument()
  })
})
