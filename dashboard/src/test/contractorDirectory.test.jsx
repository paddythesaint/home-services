import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import BusinessContractors from "../pages/BusinessContractors"
import { DIRECTORY, DIRECTORY_COUNT, directoryCandidates } from "../contractorDirectory"

describe("contractorDirectory data", () => {
  it("carries the full researched set with usable fields", () => {
    expect(DIRECTORY_COUNT).toBe(72)
    expect(DIRECTORY.length).toBe(10)
    for (const cat of DIRECTORY) {
      for (const p of cat.providers) {
        expect(p.name).toBeTruthy()
        expect(p.trades).toBe(cat.category)
        expect(p.sourcing).toMatch(/verify contact before first use/)
      }
    }
  })

  it("dedupes against existing network names, case-insensitively", () => {
    const all = directoryCandidates([])
    expect(all.reduce((n, c) => n + c.providers.length, 0)).toBe(DIRECTORY_COUNT)
    const without = directoryCandidates(["polson electrical services"])
    expect(without.reduce((n, c) => n + c.providers.length, 0)).toBe(DIRECTORY_COUNT - 1)
  })
})

describe("directory panel on the Contractor Network", () => {
  it("browses, selects, and adds a provider as a real network profile", async () => {
    renderPage(<BusinessContractors />)
    fireEvent.click(await screen.findByText("Browse directory"))
    expect(await screen.findByText("Charlottesville directory")).toBeInTheDocument()

    // Pick one provider and add it.
    const row = await screen.findByText("Polson Electrical Services")
    const checkbox = row.closest("li").querySelector("input[type=checkbox]")
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText(/Add 1 to network/))

    // It lands in the network list (and the panel dedupes it away).
    await waitFor(() =>
      expect(screen.getAllByText("Polson Electrical Services").length).toBeGreaterThan(0)
    )
    fireEvent.click(screen.getByText("Close"))
    expect(await screen.findByText(/Electrical · 434-465-8608/)).toBeInTheDocument()
  })
})
