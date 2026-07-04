import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import ContractorProfile from "../pages/ContractorProfile"
import JobHistory from "../pages/JobHistory"
import { __getItems } from "../mocks/firestoreApi"

const atProfile = (id) => ({
  path: `/contractor-network/${id}`,
  routePath: "contractor-network/:contractorId",
})

describe("contractor profile page", () => {
  it("shows identity, contacts, and work history grouped by home", async () => {
    renderPage(<ContractorProfile />, atProfile("net-monticello"))
    expect(await screen.findByText("Monticello Air")).toBeInTheDocument()
    expect(screen.getByText("(434) 246-7111")).toBeInTheDocument()
    expect(screen.getByText("dispatch@monticelloair.example")).toBeInTheDocument()

    // Jobs at both fixture homes, grouped under their property labels.
    await waitFor(() => {
      expect(screen.getByText(/895 Old Ballard Farm Ln/)).toBeInTheDocument()
      expect(screen.getByText(/42 Ridgeview Rd/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Spring HVAC tune-up/)).toBeInTheDocument()
    expect(screen.getByText(/Heat pump service/)).toBeInTheDocument()

    // Stat tiles: 2 homes, 3 jobs (1 linked + 2 name-matched).
    expect(screen.getByText("Homes served")).toBeInTheDocument()
    expect(screen.getByText("Jobs on record")).toBeInTheDocument()
  })

  it("links name-matched jobs to the profile", async () => {
    renderPage(<ContractorProfile />, atProfile("net-monticello"))
    // Two fixture jobs mention "Monticello Air" without a contractorId.
    const linkBtn = await screen.findByText("Link them")
    expect(screen.getByText(/2 jobs match this name/)).toBeInTheDocument()
    fireEvent.click(linkBtn)
    await waitFor(() =>
      expect(screen.queryByText(/match this name/)).not.toBeInTheDocument()
    )
    const repaired = __getItems("prop-ballard", "jobHistory").find(
      (j) => j.id === "job-hvac-repair"
    )
    expect(repaired.contractorId).toBe("net-monticello")
  })

  it("edits the contractor through the modal", async () => {
    renderPage(<ContractorProfile />, atProfile("net-blueridge"))
    fireEvent.click(await screen.findByText("Edit"))
    const cadence = await screen.findByLabelText("Service cadence")
    fireEvent.change(cadence, { target: { value: "Annual (November)" } })
    fireEvent.click(screen.getByText("Save"))
    expect(await screen.findByText(/Annual \(November\)/)).toBeInTheDocument()
  })

  it("shows a not-found state for unknown ids", async () => {
    renderPage(<ContractorProfile />, atProfile("net-nope"))
    expect(await screen.findByText("Contractor not found")).toBeInTheDocument()
  })

  it("refuses non-founders", async () => {
    renderPage(<ContractorProfile />, {
      ...atProfile("net-monticello"),
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    expect(await screen.findByText("Founders only.")).toBeInTheDocument()
  })
})

describe("job history cross-links", () => {
  it("links a linked job's contractor name to the profile for founders", async () => {
    renderPage(<JobHistory />)
    const name = await screen.findByText("Monticello Air")
    expect(name.closest("a")).toHaveAttribute(
      "href",
      "/contractor-network/net-monticello"
    )
  })

  it("keeps contractor names as plain text for non-founders", async () => {
    renderPage(<JobHistory />, {
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    // Rendered inline as text, so match the whole line and check for no link.
    const line = await screen.findByText(/HVAC · Monticello Air$/)
    expect(line.querySelector("a")).toBeNull()
  })
})
