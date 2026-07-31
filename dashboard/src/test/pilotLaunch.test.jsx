// The pilot launch pack: onboarding selectors capture role + brief style,
// and the contractor suggest-and-approve loop connects a pilot's network
// to the founder roster.

import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
  it("the homeowner is held pending — no access until the founder activates; the founder is never listed", async () => {
    const { createProperty, fetchMemberProperties } = await import("../firestoreApi")
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
    // Three-step signup: the homeowner waits in the wings — not a member,
    // no brief election recorded yet — until the founder activates them.
    expect(p.memberEmails).toEqual([])
    expect(p.members).toEqual([])
    expect(p.pendingOwner).toEqual({
      email: "mike.family@gmail.com",
      name: "Sutton",
      brief: "proactive",
    })
    expect(p.briefStyles).toBeUndefined()
    // The form-only fields never pollute the profile.
    expect(p.ownerEmail).toBeUndefined()
    expect(p.ownerBrief).toBeUndefined()
    // Step two queues automatically: the background address research.
    expect(p.research).toBe("requested")
    // The founder still sees the home in the portfolio — platform-side.
    const portfolio = await fetchMemberProperties(MOCK_FOUNDER.email)
    expect(portfolio.some((x) => x.id === id)).toBe(true)
  })

  it("step three: the founder reviews and activates — owner-member, brief election, pending cleared", async () => {
    const { createProperty } = await import("../firestoreApi")
    const { MOCK_FOUNDER } = await import("../mocks/fixtures")
    const id = await createProperty(
      {
        address: "1600 Old Ballard Road",
        clientName: "Sutton",
        ownerEmail: "mike.family@gmail.com",
        ownerBrief: "proactive",
      },
      MOCK_FOUNDER
    )
    const { default: Overview } = await import("../pages/Overview")
    renderPage(<Overview />, { uid: id })
    fireEvent.click(
      await screen.findByText(/Confirm record & give mike.family@gmail.com access/)
    )
    const { __getProfile } = await import("../mocks/firestoreApi")
    await waitFor(() => {
      const p = __getProfile(id)
      expect(p.memberEmails).toEqual(["mike.family@gmail.com"])
      expect(p.members[0]).toMatchObject({ email: "mike.family@gmail.com", role: "owner" })
      expect(p.briefStyles["mike.family@gmail.com"]).toBe("proactive")
      expect(p.pendingOwner).toBeFalsy()
    })
  })

  it("People with access never lists a staff-seat member row", async () => {
    const { default: Members } = await import("../Members")
    render(
      <Members
        uid="prop-x"
        currentEmail="paddythesaint@gmail.com"
        profile={{
          address: "1600 Old Ballard Road",
          members: [
            { email: "paddythesaint@gmail.com", name: "Patrick", role: "founder" },
            { email: "alex@example.com", name: "Alexander", role: "owner" },
          ],
        }}
      />
    )
    expect(screen.getByText("Alexander")).toBeInTheDocument()
    expect(screen.queryByText("Patrick")).not.toBeInTheDocument()
  })

  it("a diy pilot creating their own home is its owner from birth", async () => {
    const { createProperty } = await import("../firestoreApi")
    const id = await createProperty(
      { address: "42 Ridgeview Rd" },
      { email: "diy@example.com", displayName: "Alex" }
    )
    const { __getProfile } = await import("../mocks/firestoreApi")
    const p = __getProfile(id)
    expect(p.memberEmails).toEqual(["diy@example.com"])
    expect(p.members[0].role).toBe("diy")
  })
})
