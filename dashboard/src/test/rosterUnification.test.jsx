import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Contractors from "../pages/Contractors"
import BusinessContractors from "../pages/BusinessContractors"
import { unifyRosters, updateContractor, __getItems } from "../mocks/firestoreApi"
import { MOCK_FOUNDER } from "../mocks/fixtures"

describe("unifyRosters (network as source of truth)", () => {
  it("links matching roster entries by name and reports private vendors", async () => {
    const result = await unifyRosters(MOCK_FOUNDER.email)
    expect(result.linked).toBe(1) // Monticello Air on prop-ballard
    expect(result.synced).toBe(0)
    expect(result.unmatched).toEqual(["Joe the Handyman (895 Old Ballard Farm Ln)"])

    const roster = __getItems("prop-ballard", "contractors")
    expect(roster.find((c) => c.id === "roster-monticello").networkId).toBe("net-monticello")
    // Joe is the homeowner's own vendor — untouched.
    expect(roster.find((c) => c.id === "roster-joes").networkId).toBeUndefined()
  })

  it("is idempotent, and pushes later profile edits down to linked entries", async () => {
    await unifyRosters(MOCK_FOUNDER.email)
    const second = await unifyRosters(MOCK_FOUNDER.email)
    expect(second.linked).toBe(0)
    expect(second.synced).toBe(0)

    // The founder updates the network profile; the roster copy follows.
    await updateContractor("net-monticello", { phone: "(434) 246-9999" })
    const third = await unifyRosters(MOCK_FOUNDER.email)
    expect(third.synced).toBe(1)
    const roster = __getItems("prop-ballard", "contractors")
    expect(roster.find((c) => c.id === "roster-monticello").phone).toBe("(434) 246-9999")
  })
})

describe("property roster page after unification", () => {
  it("marks linked entries as HPS vendors, read-only for members", async () => {
    await unifyRosters(MOCK_FOUNDER.email)
    renderPage(<Contractors />, {
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    expect(await screen.findByText("Monticello Air")).toBeInTheDocument()
    expect(screen.getByText("HPS vendor")).toBeInTheDocument()
    expect(
      screen.getByText("Contact details managed by your service team")
    ).toBeInTheDocument()
    // Joe stays fully the homeowner's: no chip, still editable.
    expect(screen.getByText("Joe the Handyman")).toBeInTheDocument()
    expect(screen.getAllByText("Edit")).toHaveLength(1)
  })

  it("keeps linked entries editable for founders", async () => {
    await unifyRosters(MOCK_FOUNDER.email)
    renderPage(<Contractors />)
    await screen.findByText("Monticello Air")
    expect(screen.getAllByText("Edit")).toHaveLength(2)
  })
})

describe("Unify rosters on the Contractor Network page", () => {
  it("runs from the panel and reports the outcome", async () => {
    renderPage(<BusinessContractors />)
    fireEvent.click(await screen.findByText("Unify rosters"))
    await waitFor(() =>
      expect(screen.getByText(/Linked 1 · refreshed 0/)).toBeInTheDocument()
    )
    expect(screen.getByText(/Joe the Handyman/)).toBeInTheDocument()
  })
})
