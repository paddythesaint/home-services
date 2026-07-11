import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import SystemProfile from "../pages/SystemProfile"
import HealthReport from "../pages/HealthReport"
import PriorityList from "../pages/PriorityList"
import JobHistory from "../pages/JobHistory"
import Overview from "../pages/Overview"
import { tradeForText, groupByTrade } from "../trades"
import { addItem } from "../mocks/firestoreApi"

const atSystem = (id) => ({ path: `/system/${id}`, routePath: "system/:systemId" })

describe("trade taxonomy", () => {
  it("maps free-text categories onto canonical trades", () => {
    expect(tradeForText("HVAC").key).toBe("hvac")
    expect(tradeForText("Water Heater").key).toBe("plumbing") // not HVAC via 'heat'
    expect(tradeForText("Gutter guards on rear roofline").key).toBe("exterior")
    expect(tradeForText("Radon Mitigation").key).toBe("water")
    expect(tradeForText("Standby Generator").key).toBe("electrical")
    expect(tradeForText("Mystery widget").key).toBe("other")
  })

  it("groups in canonical order and drops empty trades", () => {
    const groups = groupByTrade([
      { category: "HVAC", title: "a" },
      { category: "Exterior", title: "Gutter clean" },
      { category: "HVAC", title: "b" },
    ])
    expect(groups.map((g) => g.trade.key)).toEqual(["hvac", "exterior"])
    expect(groups[0].items).toHaveLength(2)
  })
})

describe("system dossier page", () => {
  it("assembles the full story of one system", async () => {
    await addItem("prop-ballard", "facts", {
      text: "HVAC run capacitor replaced under warranty on June 24, 2026.",
      category: "HVAC",
      date: "July 5, 2026",
    })
    renderPage(<SystemProfile />, atSystem("sys-hvac"))

    expect(await screen.findByRole("heading", { name: "HVAC" })).toBeInTheDocument()
    // The record card: brand + install year + lifespan line.
    expect(screen.getByText("Trane XR16")).toBeInTheDocument()
    expect(screen.getByText(/replacement window/)).toBeInTheDocument()
    // Trade-related jobs (both HVAC jobs).
    expect(screen.getByText("Spring HVAC tune-up")).toBeInTheDocument()
    expect(screen.getByText("Capacitor replacement")).toBeInTheDocument()
    // Open priority in the trade.
    expect(screen.getByText(/Replace HVAC filter/)).toBeInTheDocument()
    // Learned fact and photo.
    expect(screen.getByText(/run capacitor replaced under warranty/)).toBeInTheDocument()
    expect(screen.getByText("Photos (1)")).toBeInTheDocument()
  })

  it("shows a not-found state for unknown systems", async () => {
    renderPage(<SystemProfile />, atSystem("sys-nope"))
    expect(await screen.findByText("System not found")).toBeInTheDocument()
  })
})

describe("doors and lenses", () => {
  it("Health Report card titles link to the dossier", async () => {
    renderPage(<HealthReport />)
    // "HVAC" now appears in the summary and section heading too — find the
    // card title, the one that links into the dossier.
    const title = (await screen.findAllByText("HVAC")).find(
      (el) => el.closest("a")?.getAttribute("href") === "/system/sys-hvac"
    )
    expect(title).toBeTruthy()
  })

  it("collapses and expands a trade section", async () => {
    localStorage.removeItem("healthCollapsed")
    renderPage(<HealthReport />)
    // Plumbing holds the water heater; it's visible until collapsed.
    expect(await screen.findByText("Water Heater")).toBeInTheDocument()
    // The trade header (uppercase label) is the toggle. Plumbing appears in
    // the glance summary too, so click the section heading specifically.
    const headings = screen.getAllByRole("button", { name: /Plumbing/ })
    fireEvent.click(headings[headings.length - 1])
    await waitFor(() =>
      expect(screen.queryByText("Water Heater")).not.toBeInTheDocument()
    )
    fireEvent.click(screen.getAllByRole("button", { name: /Plumbing/ }).slice(-1)[0])
    expect(await screen.findByText("Water Heater")).toBeInTheDocument()
  })

  it("Health Report consolidates systems under trade sections with rollups", async () => {
    renderPage(<HealthReport />)
    expect(await screen.findByText("Systems at a glance")).toBeInTheDocument()
    expect(screen.getByText(/4 systems across 3 trade groups/)).toBeInTheDocument()
    // Water Heater sits under Plumbing; Radon + Septic under Water & Septic —
    // separate records, one section each. Label shows as summary row + heading.
    expect(screen.getAllByText("Plumbing")).toHaveLength(2)
    expect(screen.getAllByText("Water & Septic")).toHaveLength(2)
    // Rollups: the water heater's condition surfaces on its trade…
    expect(screen.getAllByText(/1 needs attention/).length).toBeGreaterThan(0)
    // …and the never-verified septic system counts as unverified.
    expect(screen.getAllByText(/2 systems · all good · 1 unverified/).length).toBeGreaterThan(0)
  })

  it("Overview stat tiles are doors to their pages", async () => {
    renderPage(<Overview />)
    const tile = (await screen.findByText("Open priorities")).closest("a")
    expect(tile).toHaveAttribute("href", "/priority-list")
    expect(screen.getByText("Jobs completed").closest("a")).toHaveAttribute(
      "href",
      "/job-history"
    )
    expect(screen.getByText("Systems verified").closest("a")).toHaveAttribute(
      "href",
      "/health-report"
    )
  })

  it("Overview shares Systems at a glance; rows land on trade sections", async () => {
    renderPage(<Overview />)
    expect(await screen.findByText("Systems at a glance")).toBeInTheDocument()
    const row = screen.getByText("Water & Septic").closest("a")
    expect(row).toHaveAttribute("href", "/health-report#trade-water")
  })

  it("due-check banner names link to the system dossier", async () => {
    renderPage(<Overview />)
    const link = (await screen.findAllByText("Radon Mitigation"))
      .map((el) => el.closest("a"))
      .find((a) => a?.getAttribute("href") === "/system/sys-radon")
    expect(link).toBeTruthy()
  })

  it("job categories link to their trade section", async () => {
    renderPage(<JobHistory />)
    const cat = (await screen.findAllByText("HVAC"))
      .map((el) => el.closest("a"))
      .find((a) => a?.getAttribute("href") === "/health-report#trade-hvac")
    expect(cat).toBeTruthy()
  })

  it("Priority List groups by system on demand", async () => {
    renderPage(<PriorityList />)
    fireEvent.click(await screen.findByText("Group by system"))
    expect(await screen.findByText("HVAC (1)")).toBeInTheDocument()
    expect(screen.getByText("Roof & Exterior (1)")).toBeInTheDocument()
    // Ranking chrome is hidden in the grouped lens.
    expect(screen.queryByText("↑")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("View ranked"))
    expect(await screen.findByText("Group by system")).toBeInTheDocument()
  })

  it("Job History groups by system on demand", async () => {
    renderPage(<JobHistory />)
    fireEvent.click(await screen.findByText("Group by system"))
    expect(await screen.findByText("HVAC (2)")).toBeInTheDocument()
    expect(screen.getByText("Roof & Exterior (1)")).toBeInTheDocument()
  })
})
