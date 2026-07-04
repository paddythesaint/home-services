import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import Layout from "../Layout"
import { viewFor, businessRole } from "../roles"
import { MOCK_FOUNDER } from "../mocks/fixtures"

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
