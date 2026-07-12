import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import WorkOrders from "../pages/WorkOrders"
import PriorityList from "../pages/PriorityList"
import Overview from "../pages/Overview"
import {
  workOrderFromPriority,
  workOrderFromBundle,
  linkedPriorityIds,
  jobFromWorkOrder,
  nextLane,
  daysOpen,
  ageSummary,
} from "../workOrders"
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

  it("bundles an issue cluster into one order carrying every priority id", () => {
    const issue = {
      key: "ventilation",
      tradeLabel: "HVAC / ventilation",
      bundle: { title: "Whole-home moisture ventilation project", resolution: "One coordinated pass." },
    }
    const w = workOrderFromBundle(issue, [
      { id: "p1", title: "Replace master bath fan" },
      { id: "p2", title: "Clean window mold" },
    ])
    expect(w).toMatchObject({
      title: "Whole-home moisture ventilation project",
      category: "HVAC / ventilation",
      bundleKey: "ventilation",
      priorityIds: ["p1", "p2"],
      lane: "triage",
      quoteStatus: "needed",
    })
    // The notes itemize what the one order closes.
    expect(w.notes).toContain("Closes 2 priorities")
    expect(w.notes).toContain("Replace master bath fan")
    expect(w.notes).toContain("Clean window mold")
  })

  it("linkedPriorityIds merges the bundle list with the legacy single link", () => {
    expect(linkedPriorityIds({ priorityIds: ["a", "b"] })).toEqual(["a", "b"])
    expect(linkedPriorityIds({ priorityId: "solo" })).toEqual(["solo"])
    // De-duped when both are present and overlap.
    expect(linkedPriorityIds({ priorityIds: ["a", "b"], priorityId: "a" })).toEqual(["a", "b"])
    expect(linkedPriorityIds({})).toEqual([])
  })
})

describe("Work Orders board", () => {
  it("shows orders from both properties in their lanes", async () => {
    renderPage(<WorkOrders />)
    expect(await screen.findByText("Gutter guards on rear roofline")).toBeInTheDocument()
    expect(await screen.findByText("Re-seat lifted shingle tabs")).toBeInTheDocument()
    expect(screen.getByText("Quote requested")).toBeInTheDocument()
    // The contractor name shows on the card as text; the link now lives in
    // the detail drawer (a nested link inside the clickable card is invalid).
    expect(screen.getByText("Blue Ridge Gutter Co")).toBeInTheDocument()
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

describe("work order age helpers", () => {
  it("counts days open and closes them off", () => {
    const now = new Date("2026-07-10")
    expect(daysOpen({ createdOn: "July 4, 2026" }, now)).toBe(6)
    expect(daysOpen({ createdOn: "July 4, 2026", completedOn: "July 6, 2026", lane: "done" })).toBe(2)
    expect(daysOpen({ createdOn: "not a date" }, now)).toBeNull()
    expect(ageSummary({ createdOn: "July 4, 2026", lane: "triage" }, now)).toBe(
      "Opened July 4, 2026 · open 6 days"
    )
    expect(
      ageSummary({ createdOn: "July 4, 2026", completedOn: "July 6, 2026", lane: "done" })
    ).toBe("Completed July 6, 2026 · 2 days to close")
  })
})

describe("Work order detail drawer", () => {
  it("opens a ticket showing the client's words, channel, and timeline", async () => {
    renderPage(<WorkOrders />)
    fireEvent.click(await screen.findByText("Disposal is jammed"))
    expect(
      await screen.findByText("Kitchen disposal hums but won't spin.")
    ).toBeInTheDocument()
    expect(screen.getByText(/via Request button/)).toBeInTheDocument()
    expect(screen.getByText(/alton@example.com/)).toBeInTheDocument()
    expect(screen.getByText(/Opened July 4, 2026/)).toBeInTheDocument()
  })

  it("puts the contractor link in the drawer", async () => {
    renderPage(<WorkOrders />)
    fireEvent.click(await screen.findByText("Gutter guards on rear roofline"))
    const linked = (await screen.findAllByText("Blue Ridge Gutter Co"))
      .map((el) => el.closest("a"))
      .find(Boolean)
    expect(linked).toHaveAttribute("href", "/contractor-network/net-blueridge")
  })

  it("offers a quote-request pack with the trade-matched contractor pre-filled", async () => {
    renderPage(<WorkOrders />)
    // The gutter order is Exterior; Blue Ridge Gutter is the matching trade.
    fireEvent.click(await screen.findByText("Gutter guards on rear roofline"))
    expect(await screen.findByText(/^Request a quote/)).toBeInTheDocument()
    const draft = (await screen.findAllByText(/Draft/))
      .map((el) => el.closest("a"))
      .find(Boolean)
    expect(draft.getAttribute("href")).toMatch(/^mailto:/)
    expect(draft.getAttribute("href")).toContain("subject=Quote%20request")
  })

  it("combines a sibling order and a same-trade priority into one quote", async () => {
    const { addItem } = await import("../mocks/firestoreApi")
    // Two more HVAC work orders + an open HVAC priority on the same property.
    await addItem("prop-ballard", "workOrders", {
      title: "Replace hall bath fan motor",
      category: "HVAC",
      lane: "triage",
      createdOn: "July 5, 2026",
    })
    await addItem("prop-ballard", "priorityList", {
      title: "Service the return-air filter",
      category: "HVAC",
      urgency: "low",
    })
    renderPage(<WorkOrders />)
    fireEvent.click(await screen.findByText("Replace hall bath fan motor"))

    // The combine selector offers the same-trade priority as a suggestion.
    expect(await screen.findByText("Service the return-air filter")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Service the return-air filter"))

    // Folding it in makes the request a 2-item pack.
    expect(await screen.findByText(/Request a quote · 2 items/)).toBeInTheDocument()
  })

  it("generates and caches an AI briefing from the home's record", async () => {
    renderPage(<WorkOrders />)
    fireEvent.click(await screen.findByText("Disposal is jammed"))
    fireEvent.click(await screen.findByText("Generate briefing"))
    expect(
      await screen.findByText(/Client is reporting: Disposal is jammed/)
    ).toBeInTheDocument()
    await waitFor(() => {
      const w = __getItems("prop-ridge", "workOrders").find((x) => x.id === "wo-disposal")
      expect(w.aiSummary).toContain("Client is reporting")
      expect(w.aiSummaryOn).toBeTruthy()
    })
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
