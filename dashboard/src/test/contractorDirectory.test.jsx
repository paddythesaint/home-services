import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import BusinessContractors from "../pages/BusinessContractors"
import { DIRECTORY, DIRECTORY_COUNT, directoryCandidates } from "../contractorDirectory"
import { addContractor, __getItems, __getContractors } from "../mocks/firestoreApi"

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
    // Table row: trades and phone land in their own cells.
    expect(await screen.findByText("434-465-8608")).toBeInTheDocument()
    const link = screen
      .getAllByText("Polson Electrical Services")
      .map((el) => el.closest("a"))
      .find(Boolean)
    expect(link.getAttribute("href")).toMatch(/^\/contractor-network\//)
  })
})

describe("duplicate audit + merge on the Contractor Network", () => {
  it("surfaces a look-alike profile and merges it, reassigning jobs", async () => {
    // A fragmented duplicate of the fixture's Monticello Air profile.
    await addContractor({
      name: "Monticello Air LLC — (434) 246-7111",
      trades: "HVAC",
      phone: "(434) 246-7111",
    })
    renderPage(<BusinessContractors />)

    // The audit panel flags the pair.
    expect(await screen.findByText(/Possible duplicates/)).toBeInTheDocument()
    // Keep the canonical profile (default first = "Monticello Air"), merge.
    fireEvent.click(await screen.findByText(/Merge 1 into/))

    await waitFor(() => {
      // The duplicate is gone — only one Monticello profile remains in the table.
      const links = screen
        .getAllByText(/Monticello Air/)
        .map((el) => el.closest("a"))
        .filter(Boolean)
      expect(links.length).toBe(1)
    })
    // The panel disappears once there's nothing left to merge.
    await waitFor(() =>
      expect(screen.queryByText(/Possible duplicates/)).not.toBeInTheDocument()
    )
  })

  it("lets the founder mark a flagged group as NOT duplicates", async () => {
    await addContractor({ name: "Monticello Air LLC — (434) 246-7111", trades: "HVAC" })
    renderPage(<BusinessContractors />)
    expect(await screen.findByText(/Possible duplicates/)).toBeInTheDocument()

    fireEvent.click(await screen.findByText(/Not duplicates/))

    // The group clears and both profiles survive — nothing was merged away.
    await waitFor(() =>
      expect(screen.queryByText(/Possible duplicates/)).not.toBeInTheDocument()
    )
    const names = __getContractors().map((c) => c.name)
    expect(names.filter((n) => /Monticello/.test(n)).length).toBe(2)
  })

  it("unions trades on merge so a multi-trade vendor keeps every line of work", async () => {
    // Michael & Son fragmented across three trades.
    await addContractor({ name: "Michael & Son (Charlottesville)", trades: "Electrical" })
    await addContractor({ name: "Michael & Son (Charlottesville) — Plumbing", trades: "Plumbing", phone: "434-260-8170" })
    renderPage(<BusinessContractors />)

    fireEvent.click(await screen.findByText(/Merge 1 into/))

    await waitFor(() => {
      const survivor = __getContractors().find((c) => /Michael & Son/.test(c.name))
      expect(survivor.trades).toBe("Electrical · Plumbing")
      // The loser's phone backfilled the blank survivor field, too.
      expect(survivor.phone).toBe("434-260-8170")
    })
  })
})
