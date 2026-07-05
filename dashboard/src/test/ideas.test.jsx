import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor, within } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Ideas from "../pages/Ideas"
import { runDiagnostics } from "../mocks/firestoreApi"
import { MOCK_FOUNDER } from "../mocks/fixtures"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

describe("founders' idea board", () => {
  it("lists open ideas with attribution; done ones fold away", async () => {
    renderPage(<Ideas />)
    expect(
      await screen.findByText("Seasonal photo report — before/after each visit")
    ).toBeInTheDocument()
    expect(screen.getByText(/Paddy · July 4, 2026/)).toBeInTheDocument()
    // Done fixture is folded behind the toggle.
    expect(screen.queryByText(/Holiday lights install/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Show done (1)"))
    expect(screen.getByText(/Holiday lights install/)).toBeInTheDocument()
  })

  it("adds an idea attributed to the signed-in founder", async () => {
    renderPage(<Ideas />)
    fireEvent.change(await screen.findByPlaceholderText("What's the idea?"), {
      target: { value: "Annual chimney sweep bundle" },
    })
    fireEvent.click(screen.getByText("Add idea"))
    expect(await screen.findByText("Annual chimney sweep bundle")).toBeInTheDocument()
    // Attributed to the signed-in founder with today's date (the fixture
    // idea is also Paddy's, so anchor on the new idea's card).
    const card = screen.getByText("Annual chimney sweep bundle").closest(".bg-surface")
    expect(within(card).getByText(new RegExp(MOCK_FOUNDER.displayName))).toBeInTheDocument()
  })

  it("marks done and reopens", async () => {
    renderPage(<Ideas />)
    const card = (
      await screen.findByText("Seasonal photo report — before/after each visit")
    ).closest(".bg-surface")
    fireEvent.click(within(card).getByText("Done"))
    await waitFor(() =>
      expect(screen.getByText("Show done (2)")).toBeInTheDocument()
    )
  })

  it("refuses non-founders", async () => {
    renderPage(<Ideas />, { uid: "prop-ridge", user: ALTON })
    expect(await screen.findByText("Business owners only.")).toBeInTheDocument()
  })

  it("diagnostics probe covers the ideas store", async () => {
    const results = await runDiagnostics(MOCK_FOUNDER)
    expect(results.find((r) => r.key === "ideas")?.ok).toBe(true)
  })
})
