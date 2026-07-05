import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Overview from "../pages/Overview"
import Ops from "../pages/Ops"
import { fetchLatestTouch, addTouch, runDiagnostics } from "../mocks/firestoreApi"
import { MOCK_FOUNDER } from "../mocks/fixtures"

const SALLY = { email: "sally@example.com", displayName: "Sally", uid: "u-sally" }

describe("client relationship card (founder Overview)", () => {
  it("shows what the business remembers, founder-only", async () => {
    renderPage(<Overview />)
    expect(
      await screen.findByText("Client relationship (private to HPS)")
    ).toBeInTheDocument()
    expect(screen.getByText(/Gate code 1187/)).toBeInTheDocument()
    expect(screen.getByText(/Away most of August/)).toBeInTheDocument()
    // Touch log with the fixture call.
    expect(screen.getByText(/Quarterly check-in/)).toBeInTheDocument()
    expect(screen.getByText(/last: July 2, 2026/)).toBeInTheDocument()
  })

  it("stays invisible to staff and homeowners", async () => {
    renderPage(<Overview />, { user: SALLY })
    await screen.findByText("895 Old Ballard Farm Ln")
    expect(
      screen.queryByText("Client relationship (private to HPS)")
    ).not.toBeInTheDocument()
  })

  it("logs a touch from the card", async () => {
    renderPage(<Overview />)
    await screen.findByText("Client relationship (private to HPS)")
    fireEvent.change(screen.getByPlaceholderText(/One line on the conversation/), {
      target: { value: "Texted about gutter quote — approved verbally." },
    })
    fireEvent.click(screen.getByText("Log"))
    await waitFor(async () => {
      const latest = await fetchLatestTouch("prop-ballard")
      expect(latest.note).toContain("approved verbally")
    })
    expect(await screen.findByText(/approved verbally/)).toBeInTheDocument()
  })

  it("saves edited preferences", async () => {
    renderPage(<Overview />)
    await screen.findByText("Client relationship (private to HPS)")
    fireEvent.click(screen.getAllByText("Edit").pop())
    const pref = await screen.findByDisplayValue(/Afternoon visits preferred/)
    fireEvent.change(pref, { target: { value: "Mornings now — school runs changed." } })
    fireEvent.click(screen.getByText("Save"))
    await waitFor(() => expect(screen.getByText(/Mornings now/)).toBeInTheDocument())
  })
})

describe("relationship health on the Command Center", () => {
  it("shows last touch per property, or calls out silence", async () => {
    await addTouch("prop-ballard", { date: "July 4, 2026", type: "visit", note: "x" })
    renderPage(<Ops />)
    expect(await screen.findByText(/last touch July 4, 2026/)).toBeInTheDocument()
    // Ridge has no touches — the silence is the signal.
    expect(await screen.findByText(/no touches logged/)).toBeInTheDocument()
  })
})

describe("diagnostics", () => {
  it("probes the clients store", async () => {
    const results = await runDiagnostics(MOCK_FOUNDER)
    const row = results.find((r) => r.key === "clients")
    expect(row).toBeTruthy()
    expect(row.ok).toBe(true)
  })
})
