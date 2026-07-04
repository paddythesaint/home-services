import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Forecast from "../pages/Forecast"
import HealthReport from "../pages/HealthReport"
import PriorityList from "../pages/PriorityList"

describe("Cost Forecast page", () => {
  it("shows the outlook table and year buckets from fixture data", async () => {
    renderPage(<Forecast />)
    expect(await screen.findByText("3-Year Cost Forecast")).toBeInTheDocument()
    // Ballard fixtures: HVAC 2016 (window 2028–2033) + Water Heater 2019
    // (window 2027–2031) both have lifespan reads.
    expect(screen.getByText("Systems outlook")).toBeInTheDocument()
    expect(screen.getByText("2027")).toBeInTheDocument() // water heater window opens
    expect(screen.getByText("2028")).toBeInTheDocument() // HVAC window opens
    // Open priority with estCost lands in the current year.
    expect(screen.getAllByText(/Gutter guards on rear roofline/).length).toBeGreaterThan(0)
  })
})

describe("lifespan line on the Health Report", () => {
  it("annotates systems that have a benchmark and an install year", async () => {
    renderPage(<HealthReport />)
    await screen.findByText("Water Heater")
    expect(screen.getByText(/Year 7 of a typical 8–12/)).toBeInTheDocument()
    expect(screen.getByText(/replacement window 2027–2031/)).toBeInTheDocument()
  })
})

describe("requirement suggestions on the Priority List", () => {
  it("offers typical asks as one-click adds and adds them on click", async () => {
    renderPage(<PriorityList />)
    // The caulk fixture has no requirements — the playbook offers both.
    const chip = await screen.findByText("+ Silicone caulk")
    fireEvent.click(chip)
    // Added as a real material requirement…
    await waitFor(() =>
      expect(screen.getAllByText(/Silicone caulk/).length).toBeGreaterThan(0)
    )
    // …and the suggestion chip is gone (deduped against the record).
    expect(screen.queryByText("+ Silicone caulk")).not.toBeInTheDocument()
  })
})
