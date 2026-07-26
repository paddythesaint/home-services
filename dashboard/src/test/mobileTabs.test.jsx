// The mobile pass: a fixed bottom tab bar carries the property
// destinations plus Menu (which opens the drawer), and the top bar
// carries a one-tap Emergency link. Rendered for every viewport in
// jsdom — CSS hides the right pieces per breakpoint in the browser.

import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import Layout from "../Layout"
import { MOCK_FOUNDER } from "../mocks/fixtures"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem("hpsTourSeen", "1")
})

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

describe("mobile bottom tabs", () => {
  it("homeowners get their four destinations plus Menu, with short labels", async () => {
    renderLayout(ALTON)
    const tabs = (await screen.findByLabelText("Primary")).querySelectorAll("a, button")
    const labels = [...tabs].map((t) => t.textContent.trim())
    expect(labels).toEqual(["Home", "Assistant", "Record", "Plan", "Menu"])
  })

  it("the Menu tab opens the drawer", async () => {
    renderLayout(ALTON)
    fireEvent.click(await screen.findByLabelText("Open menu"))
    expect(screen.getByLabelText("Close menu")).toBeInTheDocument()
    // Drawer carries the full nav + sign out.
    expect(screen.getAllByText("Sign out").length).toBeGreaterThan(0)
  })

  it("the top bar links straight to the Emergency Card", async () => {
    renderLayout(ALTON)
    const link = await screen.findByText("Emergency")
    expect(link.closest("a")).toHaveAttribute("href", "/emergency")
  })

  it("founders' business pages stay off the tabs — they live in the Menu drawer", async () => {
    renderLayout(MOCK_FOUNDER)
    const tabs = (await screen.findByLabelText("Primary")).querySelectorAll("a, button")
    const labels = [...tabs].map((t) => t.textContent.trim())
    expect(labels).not.toContain("Command Center")
    expect(labels).toContain("Menu")
  })
})
