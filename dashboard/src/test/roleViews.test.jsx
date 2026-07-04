import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import Layout from "../Layout"
import { viewFor, businessRole, setViewAs } from "../roles"
import { MOCK_FOUNDER } from "../mocks/fixtures"

beforeEach(() => localStorage.clear())

const SALLY = { email: "sally@example.com", displayName: "Sally", uid: "u-sally" }
const TECH = { email: "tech@example.com", displayName: "Tech", uid: "u-tech" }
const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

function renderLayout(user) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} />}>
          <Route index element={<div>page-body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("viewFor (role resolution)", () => {
  it("maps founders, staff, and everyone else", () => {
    expect(viewFor(MOCK_FOUNDER.email).role).toBe("founder")
    expect(viewFor("sally@example.com").role).toBe("relationship")
    expect(viewFor("tech@example.com").role).toBe("technician")
    expect(viewFor("someone@nowhere.com").role).toBe("homeowner")
    expect(viewFor(null).role).toBe("homeowner")
  })

  it("is case-insensitive on email", () => {
    expect(businessRole("Sally@Example.com")).toBe("relationship")
  })

  it("'View as' overrides the lens for founders only", () => {
    setViewAs("homeowner")
    const founderView = viewFor(MOCK_FOUNDER.email)
    expect(founderView.role).toBe("homeowner")
    expect(founderView.actualRole).toBe("founder")
    expect(founderView.preview).toBe(true)
    expect(founderView.business).toBe(false)
    // Non-founders are never affected by the stored preview.
    expect(viewFor("sally@example.com").role).toBe("relationship")
    expect(viewFor("sally@example.com").preview).toBe(false)
    // Reset restores the full view.
    setViewAs("founder")
    expect(viewFor(MOCK_FOUNDER.email).preview).toBe(false)
  })

  it("only founders get the business plane; billing is founder/homeowner", () => {
    expect(viewFor(MOCK_FOUNDER.email).business).toBe(true)
    expect(viewFor("sally@example.com").business).toBe(false)
    expect(viewFor("sally@example.com").showBilling).toBe(false)
    expect(viewFor("tech@example.com").showBilling).toBe(false)
    expect(viewFor("someone@nowhere.com").showBilling).toBe(true)
  })
})

// Nav items render twice (desktop sidebar + mobile menu), so presence is
// "at least one" and absence is "none at all".
const sees = async (label) =>
  expect((await screen.findAllByText(label)).length).toBeGreaterThan(0)
const hidden = (label) => expect(screen.queryAllByText(label)).toHaveLength(0)

describe("role-tailored navigation (Layout)", () => {
  it("founder sees everything: business section, forecast, billing", async () => {
    renderLayout(MOCK_FOUNDER)
    await sees("Command Center")
    await sees("Contractor Network")
    await sees("Cost Forecast")
    await sees(/Next invoice/)
  })

  it("relationship (Sally) keeps intake tools, loses business plane, forecast, billing", async () => {
    renderLayout(SALLY)
    await sees("Walkthrough")
    await sees("Import Bundle")
    hidden("Command Center")
    hidden("Contractor Network")
    hidden("Cost Forecast")
    hidden(/Next invoice/)
  })

  it("technician gets the visit set: systems, calendar, priorities — no money or vendors", async () => {
    renderLayout(TECH)
    await sees("Health Report")
    await sees("90-Day Priorities")
    await sees("Walkthrough")
    hidden("Contractors")
    hidden("Import Bundle")
    hidden("Cost Forecast")
    hidden("Command Center")
    hidden(/Next invoice/)
  })

  it("homeowner gets a clean record: no intake tools, no business plane, billing shown", async () => {
    renderLayout(ALTON)
    await sees("Cost Forecast")
    await sees("Contractors")
    hidden("Walkthrough")
    hidden("Import Bundle")
    hidden("Command Center")
    await sees(/Next invoice/)
  })
})

describe("founder 'View as' switcher", () => {
  it("previews another role from the top ribbon and persists across mounts", async () => {
    const first = renderLayout(MOCK_FOUNDER)
    const pickers = await screen.findAllByLabelText("View as")
    fireEvent.change(pickers[0], { target: { value: "homeowner" } })

    await waitFor(() => hidden("Command Center"))
    await sees(/Previewing as/)
    hidden("Walkthrough")

    // Persists until changed: a fresh mount (new page load) keeps the lens.
    first.unmount()
    renderLayout(MOCK_FOUNDER)
    await sees(/Previewing as/)
    hidden("Command Center")

    // One click back to the full view.
    fireEvent.click(screen.getByText("Back to founder view"))
    await sees("Command Center")
    hidden(/Previewing as/)
  })

  it("never shows the control to non-founders", async () => {
    renderLayout(SALLY)
    await sees("Walkthrough")
    expect(screen.queryAllByLabelText("View as")).toHaveLength(0)
  })
})
