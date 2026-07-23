import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Ops from "../pages/Ops"
import { workOrderAttention, STALL_DAYS } from "../attentionInbox"

const NOW = new Date("2026-07-13")

describe("workOrderAttention (pure, injected clock)", () => {
  it("flags a homeowner request sitting in triage, with its age", () => {
    const items = workOrderAttention(
      [{ id: "a", title: "Disposal is jammed", source: "homeowner", lane: "triage", createdOn: "July 10, 2026" }],
      NOW
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: "request", urgency: "high", workOrderId: "a" })
    expect(items[0].detail).toBe("waiting 3 days")
  })

  it("flags undecided quotes, superseding the stall nag", () => {
    const items = workOrderAttention(
      [
        {
          id: "b",
          title: "Gutter guards",
          lane: "quote",
          createdOn: "July 1, 2026", // 12 days — would stall, but quotes take precedence
          quotes: [{ id: "q1", contractor: "Blue Ridge", amount: "$1,800" }],
        },
      ],
      NOW
    )
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe("quote-decision")
    expect(items[0].title).toContain("1 quote in")
  })

  it("a chosen quote clears the decision flag", () => {
    const items = workOrderAttention(
      [
        {
          id: "b2",
          title: "Gutter guards",
          lane: "scheduled",
          createdOn: "July 1, 2026",
          quotes: [{ id: "q1", contractor: "Blue Ridge", amount: "$1,800", chosen: true }],
        },
      ],
      NOW
    )
    expect(items).toHaveLength(0) // scheduled + decided = healthy
  })

  it("flags stalled orders per lane threshold, and skips fresh/done ones", () => {
    const items = workOrderAttention(
      [
        { id: "c", title: "Team order", lane: "triage", createdOn: "July 9, 2026" }, // 4d ≥ 3 → stalled
        { id: "d", title: "Fresh order", lane: "triage", createdOn: "July 12, 2026" }, // 1d → fine
        { id: "e", title: "Quoting", lane: "quote", createdOn: "July 8, 2026" }, // 5d < 7 → fine
        { id: "f", title: "Done", lane: "done", createdOn: "June 1, 2026" }, // closed
      ],
      NOW
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: "stalled", workOrderId: "c" })
    expect(items[0].detail).toContain("open 4 days")
    expect(STALL_DAYS.triage).toBe(3)
  })
})

describe("Attention inbox on the Command Center", () => {
  it("surfaces the fixture's homeowner request as a clickable inbox row", async () => {
    renderPage(<Ops />)
    // Ridge's "Disposal is jammed" sits in triage as a client request.
    expect(
      await screen.findByText(/New client request: Disposal is jammed/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Attention inbox \(\d+\)/)).toBeInTheDocument()
  })
})
