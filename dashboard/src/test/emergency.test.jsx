// The Emergency Card: shutoffs and contacts derived from the record —
// grouped facts + located systems, the team first, designated pros with
// phones pulled from the home's roster.

import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { emergencyShutoffs, emergencyContacts } from "../emergency"
import Emergency from "../pages/Emergency"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

describe("emergency derivation (pure)", () => {
  it("groups facts by shutoff class and skips archived and unrelated ones", () => {
    const groups = emergencyShutoffs([
      { text: "Main water shutoff is left of the pressure tank" },
      { text: "Propane shutoff valve is at the tank" },
      { text: "Old water shutoff note", archived: true },
      { text: "House painted in 2021" },
    ])
    expect(groups.map((g) => g.key)).toEqual(["water", "fuel"])
    expect(groups[0].entries).toHaveLength(1)
  })

  it("located systems anchor their group when no fact covers them", () => {
    const groups = emergencyShutoffs(
      [],
      [
        { category: "Electrical Panel", location: "Garage, north wall", verified: true },
        { category: "HVAC", location: "attic" }, // no emergency class → dropped
      ]
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe("power")
    expect(groups[0].entries[0].text).toMatch(/garage, north wall/)
    expect(groups[0].entries[0].source).toBe("verified in person")
  })

  it("contacts lead with the team, then designated pros with roster phones", () => {
    const contacts = emergencyContacts([{ name: "Monticello Air", phone: "(434) 246-7111" }])
    expect(contacts[0].team).toBe(true)
    expect(contacts[0].name).toBe("Sally")
    const hvac = contacts.find((c) => c.name === "Monticello Air")
    expect(hvac.phone).toBe("(434) 246-7111")
    const electric = contacts.find((c) => c.name === "Fitch Services")
    expect(electric.role).toMatch(/interim/)
  })
})

describe("Emergency page", () => {
  it("renders shutoffs from fixture facts and the who-to-call list", async () => {
    renderPage(<Emergency />, { user: ALTON })
    expect(await screen.findByText("If something goes wrong, start here.")).toBeInTheDocument()
    expect(screen.getByText(/911 first, always/)).toBeInTheDocument()
    expect(screen.getByText(/Main water shutoff is in the basement utility room/)).toBeInTheDocument()
    expect(screen.getByText(/Propane shutoff valve/)).toBeInTheDocument()
    expect(screen.getByText("Who to call")).toBeInTheDocument()
    // The HVAC designation picks its phone off the home's roster.
    expect(screen.getByText("(434) 246-7111")).toBeInTheDocument()
  })

  it("the homeowner Home links to it from the team block", async () => {
    const { default: Overview } = await import("../pages/Overview")
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    const link = await screen.findByText(/Emergency info — shutoffs/)
    expect(link.closest("a")).toHaveAttribute("href", "/emergency")
  })
})
