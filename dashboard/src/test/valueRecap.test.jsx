import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Overview from "../pages/Overview"
import { buildRecap, formatSpend } from "../valueRecap"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

describe("buildRecap", () => {
  it("counts trailing-12-month work, pro dispatches, resolutions, and spend", () => {
    const recap = buildRecap({
      jobs: [
        { title: "a", status: "completed", date: "June 24, 2026", cost: "$310", sub: "Monticello Air" },
        { title: "b", status: "completed", date: "March 12, 2026", cost: "$225", contractorId: "x" },
        { title: "old", status: "completed", date: "May 1, 2024", cost: "$999", sub: "Y" },
        { title: "scheduled", status: "scheduled", date: "June 1, 2026" },
      ],
      priorities: [
        { status: "resolved", resolvedOn: "June 20, 2026" },
        { status: "open" },
      ],
      now: new Date("2026-07-05"),
    })
    expect(recap).toMatchObject({
      tasksDone: 2,
      withPros: 2,
      issuesResolved: 1,
      coordinatedSpend: 535,
      hasAnything: true,
    })
    expect(formatSpend(535)).toBe("$535")
  })

  it("stays quiet on an empty record", () => {
    expect(buildRecap({ jobs: [], priorities: [] }).hasAnything).toBe(false)
  })
})

describe("recap card on the calm home", () => {
  it("shows the homeowner their year of care — never currency (2a)", async () => {
    renderPage(<Overview />, { uid: "prop-ridge", user: ALTON })
    // The recap now lives in the figure row: care counts, no dollars.
    expect(await screen.findByText("tasks handled for you")).toBeInTheDocument()
    expect(screen.getByText("systems on record")).toBeInTheDocument()
    // Ridge fixture has a $195 job — the amount must NOT reach this surface.
    expect(screen.queryByText(/\$195/)).not.toBeInTheDocument()
  })
})
