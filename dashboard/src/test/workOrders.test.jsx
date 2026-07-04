import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import WorkOrders from "../pages/WorkOrders"
import PriorityList from "../pages/PriorityList"
import Overview from "../pages/Overview"
import { workOrderFromPriority, jobFromWorkOrder, nextLane } from "../workOrders"
import { __getItems } from "../mocks/firestoreApi"

describe("workOrders domain", () => {
  it("raises an order from a priority, carrying the link and sensible defaults", () => {
    const w = workOrderFromPriority({
      id: "p1",
      title: "Fix gutter",
      category: "Exterior",
      reason: "Clogs",
      resolutionPath: "project-quote",
    })
    expect(w).toMatchObject({
      title: "Fix gutter",
      priorityId: "p1",
      lane: "triage",
      quoteStatus: "needed",
    })
    // A subscription-visit priority pre-assigns our own visit.
    expect(
      workOrderFromPriority({ id: "p2", title: "x", resolutionPath: "subscription-visit" })
        .assigneeType
    ).toBe("visit")
  })

  it("writes a contractor job with cost on completion", () => {
    const job = jobFromWorkOrder({
      title: "Gutter guards",
      category: "Exterior",
      assigneeType: "contractor",
      contractorId: "net-blueridge",
      contractorName: "Blue Ridge Gutter Co",
      quoteAmount: "$1,450",
    })
    expect(job).toMatchObject({
      title: "Gutter guards",
      sub: "Blue Ridge Gutter Co",
      contractorId: "net-blueridge",
      status: "completed",
      cost: "$1,450",
    })
    expect(nextLane("in-progress")).toBe("done")
    expect(nextLane("done")).toBeNull()
  })
})

describe("Work Orders board", () => {
  it("shows orders from both properties in their lanes", async () => {
    renderPage(<WorkOrders />)
    expect(await screen.findByText("Gutter guards on rear roofline")).toBeInTheDocument()
    expect(await screen.findByText("Re-seat lifted shingle tabs")).toBeInTheDocument()
    expect(screen.getByText("Quote requested")).toBeInTheDocument()
    // The contractor on the card links into the network profile.
    expect(screen.getByText("Blue Ridge Gutter Co").closest("a")).toHaveAttribute(
      "href",
      "/contractor-network/net-blueridge"
    )
  })

  it("advances an order to the next lane", async () => {
    renderPage(<WorkOrders />)
    await screen.findByText("Gutter guards on rear roofline")
    fireEvent.click(screen.getByText("→ Scheduled"))
    await waitFor(() => {
      const w = __getItems("prop-ballard", "workOrders").find((x) => x.id === "wo-gutters")
      expect(w.lane).toBe("scheduled")
    })
  })

  it("completion writes Job History and resolves the linked priority", async () => {
    renderPage(<WorkOrders />)
    await screen.findByText("Re-seat lifted shingle tabs")
    // Ridge order is in "scheduled": advance to in-progress, then mark done.
    fireEvent.click(screen.getByText("→ In progress"))
    fireEvent.click(await screen.findByText("Mark done"))
    fireEvent.click(await screen.findByText("Complete work order"))

    await waitFor(() => {
      const jobs = __getItems("prop-ridge", "jobHistory")
      expect(jobs.find((j) => j.title === "Re-seat lifted shingle tabs")).toMatchObject({
        status: "completed",
        sub: "HPS visit",
      })
      const pri = __getItems("prop-ridge", "priorityList").find((p) => p.id === "r-pri-tabs")
      expect(pri.status).toBe("resolved")
      const w = __getItems("prop-ridge", "workOrders").find((x) => x.id === "wo-tabs")
      expect(w.lane).toBe("done")
    })
  })

  it("refuses non-founders", async () => {
    renderPage(<WorkOrders />, {
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    expect(await screen.findByText("Business owners only.")).toBeInTheDocument()
  })
})

describe("raising from the Priority List", () => {
  it("founders can raise a linked work order from an open priority", async () => {
    renderPage(<PriorityList />)
    const buttons = await screen.findAllByText("Raise work order")
    fireEvent.click(buttons[0])
    await waitFor(() => {
      expect(screen.getByText("Work order raised ›")).toBeInTheDocument()
    })
    const orders = __getItems("prop-ballard", "workOrders")
    const raised = orders.find((w) => w.title === "Replace HVAC filter")
    expect(raised).toMatchObject({ lane: "triage", priorityId: "pri-filter" })
    const pri = __getItems("prop-ballard", "priorityList").find((p) => p.id === "pri-filter")
    expect(pri.workOrderId).toBe(raised.id)
  })

  it("members don't see the raise action", async () => {
    renderPage(<PriorityList />, {
      user: { email: "alton@example.com", displayName: "Alton", uid: "u-alton" },
      uid: "prop-ridge",
    })
    // Title shows on the card and in the next-visit manifest — both fine.
    await screen.findAllByText("Re-seat lifted shingle tabs")
    expect(screen.queryByText("Raise work order")).not.toBeInTheDocument()
  })
})

describe("homeowner-facing 'Happening now'", () => {
  it("shows scheduled work calmly on Overview", async () => {
    renderPage(<Overview />, {
      uid: "prop-ridge",
      user: { email: "alton@example.com", displayName: "Alton", uid: "u-alton" },
    })
    expect(await screen.findByText("Happening now")).toBeInTheDocument()
    expect(screen.getByText(/scheduled for July 12, 2026/)).toBeInTheDocument()
  })

  it("stays hidden while work is only in triage or quote", async () => {
    renderPage(<Overview />)
    await screen.findByText(/895 Old Ballard Farm Ln/)
    // Ballard's only order sits in the quote lane — internal machinery.
    expect(screen.queryByText("Happening now")).not.toBeInTheDocument()
  })
})
