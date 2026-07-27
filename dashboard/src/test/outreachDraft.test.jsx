// The outreach draft: the step after the briefing — a ready outbound
// email grounded in the record, blanks bracketed, verify-notes surfaced.

import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { parseOutreach, outreachTools, outreachSystemPrompt } from "../workOrderBriefing"
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

describe("outreach web search (pure)", () => {
  it("requests the web_search server tool with a search cap", () => {
    expect(outreachTools()).toEqual([
      { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    ])
  })

  it("the prompt directs the search at the exact recipient", () => {
    const p = outreachSystemPrompt({
      profile: { address: "895 Old Ballard Road" },
      systems: [],
      priorities: [],
      jobs: [],
      workOrders: [],
      facts: [],
      order: { title: "Well report", notes: "", category: "Water" },
    })
    expect(p).toMatch(/web_search tool/)
    expect(p).toMatch(/Albemarle County, Virginia/)
    expect(p).toMatch(/where the TO address came from/)
  })
})

describe("outreach in the drawer", () => {
  it("searches, resumes the paused turn, joins split text blocks, and renders", async () => {
    renderPage(<WorkOrders />)
    fireEvent.click(await screen.findByText("Gutter guards on rear roofline"))
    fireEvent.click(await screen.findByText("Draft the outreach"))

    // The mock's first reply is a pause_turn mid-search; the address only
    // arrives on the resumed call — seeing it proves the loop ran.
    expect(await screen.findByText(/BlueRidgeHD@vdh\.virginia\.gov/)).toBeInTheDocument()
    // NOTES cite where the searched-up address came from.
    expect(screen.getByText(/Blue Ridge Health District contact page/)).toBeInTheDocument()
    // Text from the SECOND text block — the draft is the join, not the first.
    expect(screen.getByText(/owner authorization/)).toBeInTheDocument()
    expect(screen.getByText(/Before sending:/)).toBeInTheDocument()
    expect(screen.getByText("Copy email")).toBeInTheDocument()
    // Regenerate appears once a draft exists.
    await waitFor(() => expect(screen.getAllByText("Regenerate").length).toBeGreaterThan(0))
  })
})
