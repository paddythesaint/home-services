import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import Layout from "../Layout"
import { viewFor, businessRole, setViewAs } from "../roles"
import { MOCK_FOUNDER } from "../mocks/fixtures"

beforeEach(() => {
  localStorage.clear()
  // These tests exercise nav/roles, not onboarding — keep the first-login
  // tour out of the way (it has its own suite in tour.test.jsx).
  localStorage.setItem("hpsTourSeen", "1")
})

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
  it("founder sees everything: hubs, tools, business section, billing", async () => {
    renderLayout(MOCK_FOUNDER)
    await sees("Property Record")
    await sees("The Plan")
    await sees("Command Center")
    await sees("Contractor Network")
    await sees("Import Records")
    await sees(/Next invoice/)
  })

  it("relationship (Sally) keeps intake tools, loses business plane and billing", async () => {
    renderLayout(SALLY)
    await sees("Walkthrough")
    await sees("Import Records")
    await sees("Property Record")
    hidden("Command Center")
    hidden("Contractor Network")
    hidden(/Next invoice/)
  })

  it("technician gets the visit set: hubs + walkthrough — no import, no money", async () => {
    renderLayout(TECH)
    await sees("Property Record")
    await sees("The Plan")
    await sees("Walkthrough")
    hidden("Import Records")
    hidden("Command Center")
    hidden(/Next invoice/)
  })

  it("homeowner gets a clean four-item nav: no tools, no business plane, billing shown", async () => {
    renderLayout(ALTON)
    await sees("Home")
    await sees("Assistant")
    await sees("Property Record")
    await sees("The Plan")
    hidden("Walkthrough")
    hidden("Import Records")
    hidden("Tools")
    hidden("Command Center")
    await sees(/Next invoice/)
  })
})

// The old page-level nav trims live on as tab trims inside the hubs.
describe("hub tab gating", () => {
  it("technicians see no Contractors tab and no Cost Forecast tab", async () => {
    const { renderPage } = await import("./renderPage")
    const { default: JobHistory } = await import("../pages/JobHistory")
    renderPage(<JobHistory />, { user: TECH })
    await screen.findAllByText("Job History")
    expect(screen.queryByText("Contractors")).not.toBeInTheDocument()
    const { default: CareCalendar } = await import("../pages/CareCalendar")
    renderPage(<CareCalendar />, { user: TECH })
    await screen.findAllByText("What's Next")
    expect(screen.queryByText("Cost Forecast")).not.toBeInTheDocument()
  })

  it("homeowners get all four plan tabs including Cost Forecast", async () => {
    const { renderPage } = await import("./renderPage")
    const { default: CareCalendar } = await import("../pages/CareCalendar")
    renderPage(<CareCalendar />, { user: ALTON })
    const tab = await screen.findByText("Cost Forecast")
    expect(tab.closest("a")).toHaveAttribute("href", "/forecast")
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
