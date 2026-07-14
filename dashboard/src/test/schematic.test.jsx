import { describe, it, expect } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Schematic from "../pages/Schematic"

describe("System Map page", () => {
  it("renders the four bands and the boxes", async () => {
    renderPage(<Schematic />)
    expect(await screen.findByText("System Map")).toBeInTheDocument()
    // Band subtitles are unique (band titles also appear in the legend chips).
    expect(screen.getByText("How information enters the record")).toBeInTheDocument()
    expect(screen.getByText("Per-property records (Firestore)")).toBeInTheDocument()
    expect(screen.getByText("Where it shows up in the app")).toBeInTheDocument()
    expect(screen.getByText("Spend Intelligence")).toBeInTheDocument()
  })

  it("traces a box's connections when clicked", () => {
    renderPage(<Schematic />)
    fireEvent.click(screen.getByText("Spend Intelligence"))
    // The active engine names what it pulls from and feeds into.
    expect(screen.getByText(/pulls from: .*Job History/)).toBeInTheDocument()
    expect(screen.getByText(/feeds: .*Year in Review/)).toBeInTheDocument()
  })
})
