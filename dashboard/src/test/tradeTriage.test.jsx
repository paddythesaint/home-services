// Trade triage on the dashboard: the background specialist assessment
// renders in the order drawer, and emergency flags reach the attention
// inbox ahead of everything else.

import { describe, it, expect } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { workOrderAttention } from "../attentionInbox"
import WorkOrders from "../pages/WorkOrders"

describe("triage in the drawer", () => {
  it("shows trade, urgency, gaps, homeowner questions, and notes", async () => {
    renderPage(<WorkOrders />)
    fireEvent.click(await screen.findByText("Disposal is jammed"))
    expect(await screen.findByText("Trade triage")).toBeInTheDocument()
    expect(screen.getByText("appliance")).toBeInTheDocument()
    expect(screen.getByText("routine")).toBeInTheDocument()
    expect(screen.getByText(/no disposal brand\/model on record/)).toBeInTheDocument()
    // Questions split into their own bullets.
    expect(screen.getByText(/Does the disposal hum when switched on/)).toBeInTheDocument()
    expect(screen.getByText(/Has the reset button underneath been tried/)).toBeInTheDocument()
    expect(screen.getByText(/hex-key reset is a 10-minute first attempt/)).toBeInTheDocument()
    expect(screen.getByText(/assessed July 26, 2026/)).toBeInTheDocument()
  })
})

describe("triage in the attention inbox (pure)", () => {
  it("an emergency assessment outranks the plain new-request item", () => {
    const items = workOrderAttention([
      {
        id: "w1",
        title: "Outlet sparking",
        lane: "triage",
        source: "homeowner",
        triage: { urgency: "emergency", urgencyReason: "arcing risk — advise breaker off" },
      },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe("triage-safety")
    expect(items[0].title).toMatch(/Safety flag from triage: Outlet sparking/)
    expect(items[0].detail).toMatch(/arcing risk/)
    expect(items[0].urgency).toBe("high")
  })

  it("routine triage leaves the normal request flow untouched", () => {
    const items = workOrderAttention([
      {
        id: "w2",
        title: "Disposal is jammed",
        lane: "triage",
        source: "homeowner",
        createdOn: "July 4, 2026",
        triage: { urgency: "routine" },
      },
    ])
    expect(items[0].kind).toBe("request")
  })
})
