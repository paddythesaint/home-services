import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor, within } from "@testing-library/react"
import { renderPage } from "./renderPage"
import HealthReport from "../pages/HealthReport"
import { parseVisionReply } from "../nameplateVision"
import { __getItems, fetchAllPhotos } from "../mocks/firestoreApi"

describe("parseVisionReply (nameplate vision shaping)", () => {
  it("combines brand+model, keeps 4-digit years, passes serial and note", () => {
    const out = parseVisionReply(
      '{"brand":"Generac","model":"Guardian 22kW","serial":"3012345678","installYear":"2021","condition_note":"Light debris on housing top."}'
    )
    expect(out).toEqual({
      brand: "Generac Guardian 22kW",
      installYear: "2021",
      serial: "3012345678",
      note: "Light debris on housing top.",
    })
  })
  it("strips markdown fences and drops nulls/bad years", () => {
    const out = parseVisionReply(
      '```json\n{"brand":null,"model":null,"serial":null,"installYear":"unknown","condition_note":null}\n```'
    )
    expect(out).toEqual({})
  })
})

describe("photo visibility and audit", () => {
  it("shows a photo count on the collapsed toggle", async () => {
    renderPage(<HealthReport />)
    expect(await screen.findByText("Photos (1) ›")).toBeInTheDocument()
  })

  it("audits: per-system counts, orphan surfaced, reattach works", async () => {
    renderPage(<HealthReport />)
    fireEvent.click(await screen.findByText("Audit photos"))

    expect(await screen.findByText(/2 photos on the property — 1 orphaned/)).toBeInTheDocument()

    // Reattach the orphan to the water heater.
    const select = screen.getByDisplayValue("— choose system —")
    fireEvent.change(select, { target: { value: "sys-waterheater" } })
    fireEvent.click(screen.getByText("Attach"))
    await waitFor(() =>
      expect(screen.queryByText(/1 orphaned/)).not.toBeInTheDocument()
    )
    const photos = await fetchAllPhotos("prop-ballard")
    expect(photos.find((p) => p.id === "photo-orphan-1").systemId).toBe("sys-waterheater")
    // Count backfill stamped the water heater.
    const wh = __getItems("prop-ballard", "healthReport").find((s) => s.id === "sys-waterheater")
    expect(wh.photoCount).toBe(1)
  })

  it("deleting a system takes its photos with it — no new orphans", async () => {
    renderPage(<HealthReport />)
    // HVAC carries photo-hvac-1. Delete the system from its card.
    const hvacTitle = (await screen.findAllByText("HVAC")).find(
      (el) => el.closest("a")?.getAttribute("href") === "/system/sys-hvac"
    )
    const hvacCard = hvacTitle.closest(".bg-surface")
    fireEvent.click(within(hvacCard).getByText("Delete"))
    expect(
      await screen.findByText(/Its 1 photo will be removed with it/)
    ).toBeInTheDocument()
    // The confirm modal's Delete is the last one rendered.
    const deletes = screen.getAllByText("Delete")
    fireEvent.click(deletes[deletes.length - 1])
    await waitFor(() => {
      expect(
        __getItems("prop-ballard", "healthReport").find((s) => s.id === "sys-hvac")
      ).toBeUndefined()
    })
    const photos = await fetchAllPhotos("prop-ballard")
    expect(photos.find((p) => p.id === "photo-hvac-1")).toBeUndefined()
    // The pre-existing orphan (filed under a long-gone system) is untouched.
    expect(photos.find((p) => p.id === "photo-orphan-1")).toBeDefined()
  })

  it("hides the audit tool from non-founders", async () => {
    renderPage(<HealthReport />, {
      user: { email: "sally@example.com", displayName: "Sally", uid: "u-sally" },
    })
    await screen.findAllByText("HVAC")
    expect(screen.queryByText("Photo audit")).not.toBeInTheDocument()
  })
})
