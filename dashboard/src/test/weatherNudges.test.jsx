// Weather nudges on the homeowner Home: active alerts render as advice;
// an alert that expires disappears with the next data emit.

import { describe, it, expect } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Overview from "../pages/Overview"
import { updateItem } from "../firestoreApi"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

describe("weather nudges", () => {
  it("an active nudge shows on Home; expiring it takes it off the page", async () => {
    renderPage(<Overview />, { user: ALTON })
    expect(await screen.findByText(/Wind Advisory in effect this evening/)).toBeInTheDocument()
    expect(screen.getByText(/tie down outdoor furniture/)).toBeInTheDocument()

    await updateItem("prop-ballard", "nudges", "nudge-wind", {
      endsAt: "2020-01-01T00:00:00-05:00",
    })
    await waitFor(() =>
      expect(screen.queryByText(/Wind Advisory/)).not.toBeInTheDocument()
    )
  })
})
