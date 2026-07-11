import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Walkthrough from "../pages/Walkthrough"

describe("walkthrough focus mode", () => {
  it("jumps straight to the unverified systems, skipping intro and basics", async () => {
    renderPage(<Walkthrough />, {
      path: "/walkthrough?focus=unverified",
      routePath: "walkthrough",
    })
    expect(await screen.findByText("Confirm unverified systems")).toBeInTheDocument()
    // The one unverified fixture system (Septic) is the first and only step.
    expect(await screen.findByRole("heading", { name: "Septic System" })).toBeInTheDocument()
    expect(screen.getByText("System 1 of 1")).toBeInTheDocument()
    // Never lands on the intro or the property-basics step.
    expect(screen.queryByText("Start walkthrough")).not.toBeInTheDocument()
    expect(screen.queryByText("Property basics")).not.toBeInTheDocument()
  })

  it("the full walkthrough still starts at the intro", async () => {
    renderPage(<Walkthrough />, { path: "/walkthrough", routePath: "walkthrough" })
    expect(await screen.findByText("Start walkthrough")).toBeInTheDocument()
  })
})
