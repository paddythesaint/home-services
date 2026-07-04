import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Overview from "../pages/Overview"
import { onboardingSteps } from "../OnboardingChecklist"

const baseProfile = { members: [{ email: "a@b.c" }] }

describe("onboardingSteps", () => {
  it("derives every done-state from the record", () => {
    const steps = onboardingSteps({
      profile: {
        walkthroughCompletedOn: "July 4, 2026",
        bundleImportedOn: "July 4, 2026",
        members: [{ email: "a@b.c" }, { email: "d@e.f" }],
      },
      systems: [{ id: "s1" }],
      jobs: [{ id: "j1" }],
    })
    expect(steps.every((s) => s.done)).toBe(true)
  })

  it("marks nothing done on a fresh property", () => {
    const steps = onboardingSteps({ profile: baseProfile, systems: [], jobs: [] })
    expect(steps.filter((s) => s.done)).toHaveLength(0)
  })

  it("treats the bundle step as optional", () => {
    const steps = onboardingSteps({ profile: baseProfile, systems: [], jobs: [] })
    expect(steps.find((s) => s.key === "bundle").optional).toBe(true)
    expect(steps.filter((s) => !s.optional)).toHaveLength(4)
  })
})

describe("onboarding checklist on Overview", () => {
  it("shows on a non-seed property with the right steps ticked", async () => {
    renderPage(<Overview />, { uid: "prop-ridge" })
    expect(await screen.findByText("Getting this home ready")).toBeInTheDocument()
    // Ridgeview fixture: systems + a job exist; walkthrough and invite don't.
    expect(screen.getByText(/2 of 5 steps done/)).toBeInTheDocument()
    expect(screen.getByText("Walk the property")).toBeInTheDocument()
    expect(screen.getByText("Invite the homeowner")).toBeInTheDocument()
  })

  it("never shows on the seed property", async () => {
    renderPage(<Overview />)
    expect(await screen.findByText("895 Old Ballard Farm Ln")).toBeInTheDocument()
    expect(screen.queryByText("Getting this home ready")).not.toBeInTheDocument()
  })
})
