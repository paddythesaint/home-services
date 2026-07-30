// The pilot launch pack: onboarding selectors capture role + brief style,
// and the contractor suggest-and-approve loop connects a pilot's network
// to the founder roster.

import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { __getItems } from "../mocks/firestoreApi"
import { addItem } from "../firestoreApi"
import Contractors from "../pages/Contractors"

const DIY = { email: "diy@example.com", displayName: "Alex", uid: "u-diy" }

describe("pilot contractor suggestions", () => {
  it("a diy member suggests their contractor to the HPS network", async () => {
    // The pilot's own roster entry — the network intel Patrick wants to tap.
    await addItem("prop-ridge", "contractors", {
      name: "Piedmont Electric",
      trades: "Electrical",
      phone: "434-555-0101",
    })
    renderPage(<Contractors />, { uid: "prop-ridge", user: DIY })
    const btn = (await screen.findAllByText("Suggest to HPS"))[0]
    fireEvent.click(btn)
    await waitFor(() => {
      const s = __getItems("prop-ridge", "networkSuggestions")
      expect(s.length).toBe(1)
      expect(s[0].status).toBe("pending")
      expect(s[0].suggestedBy).toBe("diy@example.com")
    })
    // The button flips to a confirmation — no duplicate suggestions.
    expect(await screen.findByText("Suggested to HPS ✓")).toBeInTheDocument()
  })

  it("founders never see the suggest button on their own tab access", async () => {
    renderPage(<Contractors />, { uid: "prop-ridge" })
    await screen.findAllByText(/Contractors/)
    expect(screen.queryByText("Suggest to HPS")).not.toBeInTheDocument()
  })
})

describe("the seed hint stays exact", () => {
  it("matches only the flagship home, never neighbors on the same street", async () => {
    const { seedAddressHint } = await import("../seedData")
    expect(seedAddressHint.test("895 Old Ballard Road")).toBe(true)
    expect(seedAddressHint.test("895 Old Ballard Farm Ln")).toBe(true)
    // The bug: a new home up the street inherited the 895 hero + banners.
    expect(seedAddressHint.test("1600 Old Ballard Road")).toBe(false)
    expect(seedAddressHint.test("42 Ridgeview Rd")).toBe(false)
  })
})

describe("enter-once creation", () => {
  it("the homeowner named on the form becomes the owner-member; the founder stays founder", async () => {
    const { createProperty } = await import("../firestoreApi")
    const { MOCK_FOUNDER } = await import("../mocks/fixtures")
    const id = await createProperty(
      {
        address: "1600 Old Ballard Road",
        clientName: "Sutton",
        ownerEmail: "Mike.Family@Gmail.com",
        ownerBrief: "proactive",
      },
      MOCK_FOUNDER
    )
    const { __getProfile } = await import("../mocks/firestoreApi")
    const p = __getProfile(id)
    expect(p.memberEmails).toContain("mike.family@gmail.com")
    expect(p.memberEmails).toContain(MOCK_FOUNDER.email)
    const owner = p.members.find((m) => m.email === "mike.family@gmail.com")
    expect(owner.role).toBe("owner")
    expect(owner.name).toBe("Sutton")
    const creator = p.members.find((m) => m.email === MOCK_FOUNDER.email)
    expect(creator.role).toBe("founder")
    expect(p.briefStyles["mike.family@gmail.com"]).toBe("proactive")
    // The form-only fields never pollute the profile.
    expect(p.ownerEmail).toBeUndefined()
    expect(p.ownerBrief).toBeUndefined()
  })
})
