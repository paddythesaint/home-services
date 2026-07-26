// Slice 81: parked projects — the homeowner's-court backlog. A parked
// work order leaves the pipeline and every "act on this" view; it waits
// on the homeowner's trigger, resurfacing only when its revisit date
// arrives. Homeowners see the list on What's next as "Parked — your call."

import { describe, it, expect, beforeEach } from "vitest"
import { screen, fireEvent, waitFor, within } from "@testing-library/react"
import { renderPage } from "./renderPage"
import {
  isParked,
  isOpenWorkOrder,
  parkPatch,
  unparkPatch,
  revisitDue,
} from "../workOrders"
import { workOrderAttention } from "../attentionInbox"
import WorkOrders from "../pages/WorkOrders"
import PriorityList from "../pages/PriorityList"
import Overview from "../pages/Overview"
import { __getItems } from "../mocks/firestoreApi"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }
const JUL_2026 = new Date("2026-07-26")

beforeEach(() => localStorage.clear())

describe("parked state (pure)", () => {
  it("parked is neither open nor done, and park/unpark round-trips", () => {
    const w = { id: "w1", lane: "triage", createdOn: "July 1, 2026" }
    const parked = { ...w, ...parkPatch({ waitingOn: "bathroom remodel", revisitOn: "2028-03-01" }) }
    expect(isParked(parked)).toBe(true)
    expect(isOpenWorkOrder(parked)).toBe(false)
    expect(parked.waitingOn).toBe("bathroom remodel")

    const back = { ...parked, ...unparkPatch() }
    expect(back.lane).toBe("triage")
    expect(isOpenWorkOrder(back)).toBe(true)
    expect(back.waitingOn).toBe("")
  })

  it("revisitDue: past date fires, future or missing date stays silent", () => {
    const base = { lane: "parked" }
    expect(revisitDue({ ...base, revisitOn: "2026-07-01" }, JUL_2026)).toBe(true)
    expect(revisitDue({ ...base, revisitOn: "2028-03-01" }, JUL_2026)).toBe(false)
    expect(revisitDue({ ...base, revisitOn: "" }, JUL_2026)).toBe(false)
    expect(revisitDue({ lane: "triage", revisitOn: "2026-07-01" }, JUL_2026)).toBe(false)
  })

  it("attention inbox: only a due revisit surfaces — parked never stalls", () => {
    const orders = [
      // Due for a check-in.
      { id: "a", lane: "parked", revisitOn: "2026-07-01", waitingOn: "spring budget", createdOn: "January 10, 2026" },
      // Dated in the future: silent, even though it's months old.
      { id: "b", lane: "parked", revisitOn: "2028-03-01", createdOn: "January 10, 2026" },
      // Undated: silent forever until someone unparks it.
      { id: "c", lane: "parked", revisitOn: "", createdOn: "January 10, 2026" },
    ]
    const items = workOrderAttention(orders, JUL_2026)
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe("revisit")
    expect(items[0].title).toMatch(/due for a check-in/)
    expect(items[0].detail).toMatch(/spring budget/)
  })
})

describe("parked projects across the surfaces", () => {
  it("Work Orders: parked orders sit in their own section, off the board, and unpark to triage", async () => {
    renderPage(<WorkOrders />)
    await screen.findByText("Gutter guards on rear roofline")
    // In the parked section, with trigger and revisit visible.
    expect(screen.getByText(/Parked projects · homeowner's court/)).toBeInTheDocument()
    expect(screen.getByText("Replace ceiling exhaust fans (both baths)")).toBeInTheDocument()
    expect(screen.getByText(/waiting on bathroom remodel/)).toBeInTheDocument()
    // The ridge one is past its date → flagged as due.
    expect(screen.getByText(/revisit was due 2026-07-01/)).toBeInTheDocument()

    // Unpark sends it back to triage.
    fireEvent.click(screen.getAllByText("Unpark → Triage")[0])
    await waitFor(() => {
      const w = __getItems("prop-ballard", "workOrders").find((x) => x.id === "wo-exhaust-fans")
      expect(w.lane).toBe("triage")
      expect(w.waitingOn).toBe("")
    })
  })

  it("Work Orders: parking a triage order collects the trigger and leaves the pipeline", async () => {
    renderPage(<WorkOrders />)
    await screen.findByText("Disposal is jammed")
    // Park it from the card actions.
    fireEvent.click(screen.getAllByText("Park")[0])
    await screen.findByText(/Park "Disposal is jammed"/)
    fireEvent.change(screen.getByLabelText("Waiting on"), {
      target: { value: "kitchen refresh" },
    })
    fireEvent.click(screen.getByText("Park it"))
    await waitFor(() => {
      const w = __getItems("prop-ridge", "workOrders").find((x) => x.id === "wo-disposal")
      expect(w.lane).toBe("parked")
      expect(w.waitingOn).toBe("kitchen refresh")
    })
  })

  it("What's next: homeowners see 'Parked — your call' with the trigger, no pressure", async () => {
    renderPage(<PriorityList />, { uid: "prop-ridge", user: ALTON })
    expect(await screen.findByText("Parked — your call")).toBeInTheDocument()
    expect(screen.getByText("Whole-house water filter install")).toBeInTheDocument()
    expect(screen.getByText(/waiting on the spring budget/)).toBeInTheDocument()
    expect(screen.getByText(/On your list, not ours/)).toBeInTheDocument()
  })

  it("Home: a parked project never reads as work in motion", async () => {
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    await screen.findByText("In motion")
    expect(screen.queryByText("Whole-house water filter install")).not.toBeInTheDocument()
  })
})
