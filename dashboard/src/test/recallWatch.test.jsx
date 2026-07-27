// The Recall watch on the Command Center: open CPSC findings surface for
// founder review; Dismiss buries one for good.

import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Ops from "../pages/Ops"
import { __getItems } from "../mocks/firestoreApi"

describe("Recall watch", () => {
  it("lists open findings with the CPSC link, and Dismiss sticks", async () => {
    renderPage(<Ops />)
    expect(await screen.findByText(/Recall watch \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Water Heater · Rheem/)).toBeInTheDocument()
    expect(screen.getByText(/Fire Hazard/)).toBeInTheDocument()
    expect(screen.getByText("CPSC notice →").closest("a")).toHaveAttribute(
      "href",
      expect.stringContaining("cpsc.gov")
    )

    fireEvent.click(screen.getByText("Dismiss"))
    await waitFor(() => {
      const f = __getItems("prop-ballard", "recallFindings").find((x) => x.id === "rf-water-heater")
      expect(f.status).toBe("dismissed")
    })
    await waitFor(() =>
      expect(screen.queryByText(/Recall watch/)).not.toBeInTheDocument()
    )
  })
})
