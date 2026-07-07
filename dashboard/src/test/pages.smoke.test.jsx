// One render smoke test per page: mounts against the mock data layer with
// the same outlet context Layout provides, and asserts a piece of fixture
// data actually made it to the screen — not just that render didn't throw.

import { describe, it, expect } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"

import Overview from "../pages/Overview"
import Walkthrough from "../pages/Walkthrough"
import HealthReport from "../pages/HealthReport"
import CareCalendar from "../pages/CareCalendar"
import PriorityList from "../pages/PriorityList"
import JobHistory from "../pages/JobHistory"
import Contractors from "../pages/Contractors"
import ImportBundle from "../pages/ImportBundle"
import Ops from "../pages/Ops"
import BusinessContractors from "../pages/BusinessContractors"
import WhatsNext from "../pages/WhatsNext"

describe("page smoke tests (mock data layer)", () => {
  it("Overview renders the property and its stat tiles", async () => {
    renderPage(<Overview />)
    expect(await screen.findByText("895 Old Ballard Farm Ln")).toBeInTheDocument()
    expect(screen.getByText("Open priorities")).toBeInTheDocument()
  })

  it("Walkthrough offers the guided survey", async () => {
    renderPage(<Walkthrough />)
    expect(await screen.findByText("Start walkthrough")).toBeInTheDocument()
  })

  it("Health Report lists fixture systems", async () => {
    renderPage(<HealthReport />)
    expect((await screen.findAllByText("HVAC")).length).toBeGreaterThan(0)
    expect(screen.getByText("Water Heater")).toBeInTheDocument()
  })

  it("What's Next merges checks, care tasks, and the 90-day queue", async () => {
    renderPage(<WhatsNext />)
    expect((await screen.findAllByText("What's Next")).length).toBeGreaterThan(0)
    expect(screen.getByText(/This month/)).toBeInTheDocument()
    // The overdue radon check surfaces and links to its dossier.
    const radon = screen.getByText("Radon Mitigation")
    expect(radon.closest("a")).toHaveAttribute("href", "/system/sys-radon")
    // July care tasks and the priority queue ride along.
    expect(screen.getByText("Flush water heater")).toBeInTheDocument()
    expect(screen.getByText("Next 90 days")).toBeInTheDocument()
  })

  it("Care Calendar shows seasonal tasks", async () => {
    renderPage(<CareCalendar />)
    expect(await screen.findByText(/Flush water heater/)).toBeInTheDocument()
  })

  it("Priority List renders the resolution pipeline", async () => {
    renderPage(<PriorityList />)
    // Title appears on the item card AND in the next-visit manifest —
    // both existing is exactly the pipeline rendering we want to see.
    const filterMentions = await screen.findAllByText(/Replace HVAC filter/)
    expect(filterMentions.length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Gutter guards on rear roofline/).length).toBeGreaterThan(0)
  })

  it("Job History lists jobs", async () => {
    renderPage(<JobHistory />)
    expect(await screen.findByText("Spring HVAC tune-up")).toBeInTheDocument()
  })

  it("Contractors shows the property-local roster", async () => {
    renderPage(<Contractors />)
    expect(await screen.findByText("Monticello Air")).toBeInTheDocument()
  })

  it("Import Bundle renders its intake form", async () => {
    renderPage(<ImportBundle />)
    expect(await screen.findByText("Import a Bundle")).toBeInTheDocument()
    expect(screen.getByText("Choose a bundle file")).toBeInTheDocument()
  })

  it("Ops aggregates both portfolio properties", async () => {
    renderPage(<Ops />)
    expect((await screen.findAllByText("895 Old Ballard Farm Ln")).length).toBeGreaterThan(0)
    expect((await screen.findAllByText("42 Ridgeview Rd")).length).toBeGreaterThan(0)
  })

  it("Contractor Network table counts a contractor's homes and jobs for founders", async () => {
    renderPage(<BusinessContractors />)
    const nameLink = await screen.findByText("Monticello Air")
    // The name is now a link into the contractor's profile page.
    expect(nameLink.closest("a")).toHaveAttribute("href", "/contractor-network/net-monticello")
    // Monticello has jobs at both fixture properties → the table row counts them.
    await waitFor(() => expect(screen.getByText(/2 homes · 3 jobs/)).toBeInTheDocument())
  })

  it("Contractor Network refuses non-founders", async () => {
    renderPage(<BusinessContractors />, {
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    expect(await screen.findByText("Founders only.")).toBeInTheDocument()
  })
})
