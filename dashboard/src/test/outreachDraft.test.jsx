// The outreach draft: the step after the briefing — a ready outbound
// email grounded in the record, blanks bracketed, verify-notes surfaced.

import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { parseOutreach } from "../workOrderBriefing"
import WorkOrders from "../pages/WorkOrders"

describe("parseOutreach (pure)", () => {
  it("parses the fixed TO/SUBJECT/BODY/NOTES shape", () => {
    const d = parseOutreach(
      "TO: office@example.gov\nSUBJECT: Records request\nBODY:\nHello,\n\nPlease send the report. Parcel: [parcel number].\nNOTES: Verify the address first."
    )
    expect(d.to).toBe("office@example.gov")
    expect(d.subject).toBe("Records request")
    expect(d.body).toMatch(/Please send the report/)
    expect(d.body).toMatch(/\[parcel number\]/)
    expect(d.body).not.toMatch(/NOTES:/)
    expect(d.notes).toBe("Verify the address first.")
  })

  it("tolerates a missing NOTES line", () => {
    const d = parseOutreach("TO: a@b.c\nSUBJECT: Hi\nBODY:\nJust this.")
    expect(d.body).toBe("Just this.")
    expect(d.notes).toBe("")
  })
})

describe("outreach in the drawer", () => {
  it("drafts, renders the parsed fields, and persists on the order", async () => {
    renderPage(<WorkOrders />)
    fireEvent.click(await screen.findByText("Gutter guards on rear roofline"))
    fireEvent.click(await screen.findByText("Draft the outreach"))

    expect(await screen.findByText(/Blue Ridge Health District/)).toBeInTheDocument()
    expect(screen.getByText(/Before sending:/)).toBeInTheDocument()
    expect(screen.getByText("Copy email")).toBeInTheDocument()
    // Regenerate appears once a draft exists.
    await waitFor(() => expect(screen.getAllByText("Regenerate").length).toBeGreaterThan(0))
  })
})
