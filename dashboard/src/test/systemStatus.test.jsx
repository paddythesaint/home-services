import { describe, it, expect } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Ops from "../pages/Ops"
import { reportDataError, clearDataError, subscribeDataErrors, __resetDataErrors } from "../dataErrors"

describe("dataErrors bus", () => {
  it("reports, dedupes, and clears; subscribers get current state immediately", () => {
    __resetDataErrors()
    const seen = []
    const off = subscribeDataErrors((e) => seen.push(e))
    expect(seen).toHaveLength(1) // initial empty state

    reportDataError("p1/jobHistory", { collection: "jobHistory", code: "permission-denied" })
    reportDataError("p1/jobHistory", { collection: "jobHistory", code: "permission-denied" }) // dedupe
    expect(seen).toHaveLength(2)
    expect(seen.at(-1)["p1/jobHistory"].code).toBe("permission-denied")

    clearDataError("p1/jobHistory")
    expect(Object.keys(seen.at(-1))).toHaveLength(0)
    off()
    __resetDataErrors()
  })
})

describe("System status panel", () => {
  it("appears on the Command Center for founders and runs all-green probes", async () => {
    renderPage(<Ops />)
    expect(await screen.findByText("System status")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Run checks"))
    expect(
      await screen.findByText(/All \d+ checks passed/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Contractor network \(founder-only collection\)/)).toBeInTheDocument()
    expect(screen.getByText(/Property data: jobHistory/)).toBeInTheDocument()
  })

  it("is hidden from non-founders", async () => {
    renderPage(<Ops />, {
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    // Page renders (Sally is a member of the Ballard property)…
    expect(await screen.findByText("895 Old Ballard Farm Ln")).toBeInTheDocument()
    // …but the founder-only panel does not.
    expect(screen.queryByText("System status")).not.toBeInTheDocument()
  })
})
