import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import JobHistory from "../pages/JobHistory"
import Overview from "../pages/Overview"
import { composeVisitNote } from "../visitNotes"
import { __getItems, addItem } from "../mocks/firestoreApi"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

describe("composeVisitNote", () => {
  it("writes a warm note from recent completed work and upcoming items", () => {
    const note = composeVisitNote({
      profile: { clientName: "Herron", address: "895 Old Ballard Farm Ln" },
      jobs: [
        { title: "Capacitor replacement", date: "June 24, 2026", status: "completed", cost: "$310" },
        { title: "Old thing", date: "January 2, 2020", status: "completed" },
      ],
      workOrders: [{ title: "Gutter guards", lane: "scheduled", scheduledFor: "July 12, 2026" }],
      now: new Date("2026-07-05"),
    })
    expect(note).toContain("Hi Herron family,")
    expect(note).toContain("Capacitor replacement (June 24, 2026) — $310")
    expect(note).not.toContain("Old thing") // outside the 21-day window
    expect(note).toContain("Gutter guards — July 12, 2026")
    expect(note).toContain("Sally & Paddy")
  })

  it("falls back to the last few completed jobs when nothing is recent", () => {
    const note = composeVisitNote({
      profile: { address: "42 Ridgeview Rd" },
      jobs: [{ title: "Heat pump service", date: "May 2, 2026", status: "completed" }],
      workOrders: [],
      now: new Date("2026-07-05"),
    })
    expect(note).toContain("Heat pump service")
  })
})

describe("visit note flow", () => {
  it("founder composes from the record and saves it", async () => {
    renderPage(<JobHistory />)
    fireEvent.click(await screen.findByText("Compose visit note"))
    const textarea = await screen.findByDisplayValue(/Hi Herron family/)
    // Only the within-window job prefills (March's tune-up is too old).
    expect(textarea.value).toContain("Capacitor replacement")
    fireEvent.click(screen.getByText("Save note"))
    await waitFor(() => {
      expect(screen.getByText(/Saved — it's on their dashboard now/)).toBeInTheDocument()
    })
    const notes = __getItems("prop-ballard", "visitNotes")
    expect(notes).toHaveLength(1)
    expect(notes[0].body).toContain("Hi Herron family")
  })

  it("homeowners never see the composer", async () => {
    renderPage(<JobHistory />, { uid: "prop-ridge", user: ALTON })
    await screen.findByText("Heat pump service")
    expect(screen.queryByText("Compose visit note")).not.toBeInTheDocument()
  })

  it("the latest saved note greets the homeowner on their home screen", async () => {
    await addItem("prop-ridge", "visitNotes", {
      body: "Hi Alton family,\nAll quiet this week — heat pump serviced and humming.",
      sentOn: "July 3, 2026",
    })
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    expect(await screen.findByText(/A note from your team · July 3, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/heat pump serviced and humming/)).toBeInTheDocument()
  })
})
