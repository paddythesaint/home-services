import { describe, it, expect, beforeEach } from "vitest"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import Layout from "../Layout"
import Ops from "../pages/Ops"
import Overview from "../pages/Overview"
import { renderPage } from "./renderPage"
import { MOCK_FOUNDER } from "../mocks/fixtures"
import { createProperty, fetchMemberProperties } from "../mocks/firestoreApi"

const SALLY = { email: "sally@example.com", displayName: "Sally", uid: "u-sally" }

function renderLayout(user) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} />}>
          <Route index element={<div>PAGE BODY</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe("createProperty", () => {
  it("creates a property with the creator as first member", async () => {
    const id = await createProperty({ address: "9 New Place Ct", tier: "Standard" }, MOCK_FOUNDER)
    expect(id).toBeTruthy()
    const portfolio = await fetchMemberProperties(MOCK_FOUNDER.email)
    const created = portfolio.find((p) => p.id === id)
    expect(created.address).toBe("9 New Place Ct")
    expect(created.memberEmails).toEqual([MOCK_FOUNDER.email])
  })
})

describe("founder property switcher", () => {
  it("lets a founder switch which property the dashboard shows", async () => {
    renderLayout(MOCK_FOUNDER)
    // Portfolio has two fixture properties → switcher renders (desktop+mobile).
    const selects = await screen.findAllByRole("combobox")
    expect(selects.length).toBeGreaterThan(0)
    // Default resolves to the Ballard property.
    expect((await screen.findAllByText(/Herron Family/)).length).toBeGreaterThan(0)

    fireEvent.change(selects[0], { target: { value: "prop-ridge" } })
    // Header greeting now reflects the Ridgeview profile.
    expect((await screen.findAllByText(/Alton Family/)).length).toBeGreaterThan(0)
    // Selection persists for next load.
    expect(localStorage.getItem("activePropertyId")).toBe("prop-ridge")
  })

  it("never shows the switcher to homeowners", async () => {
    renderLayout(SALLY)
    expect(await screen.findByText("PAGE BODY")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
})

describe("seed/insights banners stay on the source property", () => {
  it("offers document insights on the original property only", async () => {
    const { unmount } = renderPage(<Overview />)
    expect(
      await screen.findByText("Apply insights from your closing documents?")
    ).toBeInTheDocument()
    unmount()

    renderPage(<Overview />, { uid: "prop-ridge" })
    expect(await screen.findByText("42 Ridgeview Rd")).toBeInTheDocument()
    expect(
      screen.queryByText("Apply insights from your closing documents?")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Start with a pre-filled profile?")).not.toBeInTheDocument()
  })
})

describe("Ops portfolio actions", () => {
  it("offers founders + New property and per-home View dashboard", async () => {
    renderPage(<Ops />)
    expect(await screen.findByText("+ New property")).toBeInTheDocument()
    const viewLinks = await screen.findAllByText(/View dashboard/)
    expect(viewLinks).toHaveLength(2) // one per fixture property
  })

  it("offers neither to non-founder members", async () => {
    renderPage(<Ops />, { user: SALLY })
    // The whole Command Center is founder-gated now.
    expect(await screen.findByText("Business owners only.")).toBeInTheDocument()
    expect(screen.queryByText("+ New property")).not.toBeInTheDocument()
    expect(screen.queryByText(/View dashboard/)).not.toBeInTheDocument()
  })
})
