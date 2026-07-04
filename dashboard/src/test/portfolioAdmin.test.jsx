import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Ops from "../pages/Ops"
import { deletePropertyDeep, fetchMemberProperties } from "../mocks/firestoreApi"
import { MOCK_FOUNDER } from "../mocks/fixtures"

describe("deletePropertyDeep (mock)", () => {
  it("removes the property and reports how many subcollection docs went with it", async () => {
    const before = await fetchMemberProperties(MOCK_FOUNDER.email)
    expect(before.some((p) => p.id === "prop-ridge")).toBe(true)

    const removed = await deletePropertyDeep("prop-ridge")
    expect(removed).toBeGreaterThan(0) // ridgeview fixture has systems + a job

    const after = await fetchMemberProperties(MOCK_FOUNDER.email)
    expect(after.some((p) => p.id === "prop-ridge")).toBe(false)
  })
})

describe("Portfolio admin on the Command Center", () => {
  it("lists properties with delete actions for founders", async () => {
    renderPage(<Ops />)
    expect(await screen.findByText("Portfolio admin")).toBeInTheDocument()
    expect(await screen.findAllByText("Delete…")).toHaveLength(2)
  })

  it("is hidden from non-founders", async () => {
    renderPage(<Ops />, {
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    // The whole Command Center is founder-gated now.
    expect(await screen.findByText("Business owners only.")).toBeInTheDocument()
    expect(screen.queryByText("Portfolio admin")).not.toBeInTheDocument()
  })

  it("requires typing the exact address, then deletes the property", async () => {
    renderPage(<Ops />)
    const buttons = await screen.findAllByText("Delete…")
    fireEvent.click(buttons[1]) // 42 Ridgeview Rd (second in portfolio order)

    const confirm = await screen.findByText("Delete permanently")
    expect(confirm).toBeDisabled()

    const input = screen.getByPlaceholderText("42 Ridgeview Rd")
    fireEvent.change(input, { target: { value: "wrong address" } })
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: "42 Ridgeview Rd" } })
    expect(confirm).not.toBeDisabled()

    fireEvent.click(confirm)
    await waitFor(() =>
      expect(screen.queryByText("42 Ridgeview Rd")).not.toBeInTheDocument()
    )
    // The other property is untouched.
    expect(screen.getAllByText("895 Old Ballard Farm Ln").length).toBeGreaterThan(0)
  })
})
