import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Overview from "../pages/Overview"
import WorkOrders from "../pages/WorkOrders"
import { __getItems } from "../mocks/firestoreApi"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

describe("calm homeowner home screen", () => {
  it("replaces the operational overview for homeowners (2a: ask bar, no modal)", async () => {
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    expect(await screen.findByText("42 Ridgeview Rd")).toBeInTheDocument()
    // Calm surface: the always-open ask bar + team; none of our machinery.
    expect(screen.getByPlaceholderText(/Something need attention/)).toBeInTheDocument()
    expect(screen.getByText("Your team")).toBeInTheDocument()
    expect(screen.getByText("Sally")).toBeInTheDocument()
    expect(screen.queryByText("Open priorities")).not.toBeInTheDocument()
    expect(screen.queryByText(/Apply insights/)).not.toBeInTheDocument()
    expect(screen.queryByText("Edit property info")).not.toBeInTheDocument()
    // Homeowner accounts never get the depth control, and no currency shows.
    expect(screen.queryByText("Detailed")).not.toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it("answers 'is my home okay' from the systems record", async () => {
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    // Ridge fixture has one 'attention' system (roof) → watch-list clause.
    expect(await screen.findByText(/1 item sits on our watch list/)).toBeInTheDocument()
  })

  it("shows their own request as received, and scheduled work as scheduled", async () => {
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    expect(await screen.findByText("In motion")).toBeInTheDocument()
    expect(screen.getByText(/received — we're arranging it/)).toBeInTheDocument()
    expect(screen.getByText(/scheduled for July 12, 2026/)).toBeInTheDocument()
  })

  it("the ask bar sends straight into the work-order triage lane", async () => {
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    // The ask bar is a single-line field — one plain sentence, no dialog.
    fireEvent.change(await screen.findByPlaceholderText(/Something need attention/), {
      target: { value: "Gate latch is sticking — hard to open since the rain." },
    })
    fireEvent.click(screen.getByText("Send"))

    expect(await screen.findByText(/Received — you'll see it above/)).toBeInTheDocument()
    await waitFor(() => {
      const w = __getItems("prop-ridge", "workOrders").find((x) =>
        x.title.startsWith("Gate latch is sticking")
      )
      expect(w).toMatchObject({
        lane: "triage",
        source: "homeowner",
        requestedBy: "alton@example.com",
      })
    })
    // And it appears in their In motion list immediately.
    expect(await screen.findByText(/Gate latch is sticking/)).toBeInTheDocument()
  })

  it("founders keep the full operational overview", async () => {
    renderPage(<Overview />)
    expect(await screen.findByText("Open priorities")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Something need attention/)).not.toBeInTheDocument()
  })
})

describe("client requests on the founder board", () => {
  it("carries a Client request chip in triage", async () => {
    renderPage(<WorkOrders />)
    expect(await screen.findByText("Disposal is jammed")).toBeInTheDocument()
    expect(screen.getByText("Client request")).toBeInTheDocument()
  })
})
