import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import Layout from "../Layout"
import { tourStepsFor } from "../tourSteps"
import { MOCK_FOUNDER } from "../mocks/fixtures"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }
const TECH = { email: "tech@example.com", displayName: "Tech", uid: "u-tech" }

beforeEach(() => localStorage.clear())

function renderLayout(user) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} />}>
          <Route index element={<div>page-body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("tourStepsFor", () => {
  it("gives founders the full machine and homeowners the calm version", () => {
    expect(tourStepsFor("founder")).toHaveLength(5)
    expect(tourStepsFor("homeowner")).toHaveLength(3)
    expect(tourStepsFor("relationship")).toHaveLength(0)
    expect(tourStepsFor("technician")).toHaveLength(0)
  })
})

describe("first-login tour", () => {
  it("greets a first-time founder, steps through, and never returns once done", async () => {
    renderLayout(MOCK_FOUNDER)
    expect(
      await screen.findByText("Welcome — the two-minute lay of the land")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText("Next"))
    expect(screen.getByText("The home's record")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Next"))
    fireEvent.click(screen.getByText("Next"))
    fireEvent.click(screen.getByText("Next"))
    expect(screen.getByText("Start with your own home")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Done"))
    expect(screen.queryByText(/two-minute lay of the land/)).not.toBeInTheDocument()
    expect(localStorage.getItem("hpsTourSeen")).toBe("1")
  })

  it("skip also marks it seen", async () => {
    renderLayout(MOCK_FOUNDER)
    fireEvent.click(await screen.findByText("Skip"))
    expect(localStorage.getItem("hpsTourSeen")).toBe("1")
    expect(screen.queryByText(/lay of the land/)).not.toBeInTheDocument()
  })

  it("homeowners get the calm script", async () => {
    renderLayout(ALTON)
    expect(await screen.findByText("Your home, handled")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Next"))
    expect(screen.getByText("Need anything? One tap.")).toBeInTheDocument()
  })

  it("stays quiet for staff, and for anyone who has seen it", async () => {
    localStorage.setItem("hpsTourSeen", "1")
    renderLayout(MOCK_FOUNDER)
    await screen.findAllByText("Home")
    expect(screen.queryByText(/lay of the land/)).not.toBeInTheDocument()

    localStorage.clear()
    renderLayout(TECH)
    await screen.findAllByText("Home")
    expect(screen.queryByText(/lay of the land/)).not.toBeInTheDocument()
    expect(screen.queryByText("Your home, handled")).not.toBeInTheDocument()
  })

  it("replays from the sidebar link", async () => {
    localStorage.setItem("hpsTourSeen", "1")
    renderLayout(MOCK_FOUNDER)
    fireEvent.click(await screen.findByText("App tour"))
    expect(
      await screen.findByText("Welcome — the two-minute lay of the land")
    ).toBeInTheDocument()
  })
})
