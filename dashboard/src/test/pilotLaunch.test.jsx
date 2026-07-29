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
