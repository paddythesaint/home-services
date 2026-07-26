// Photo-only capture: snapping a nameplate is a complete message — the
// assistant's send gate no longer demands typed text when a photo (or
// document) is attached. compressImage needs a real canvas, so photoUtils
// is mocked; storage and the model come from the standard mock layer.

import { describe, it, expect, vi } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"

vi.mock("../photoUtils", () => ({
  compressImage: async () => "data:image/jpeg;base64,ZmFrZS1qcGVn",
  dataUrlToFile: (dataUrl, name) =>
    new File(["fake"], name || "photo.jpg", { type: "image/jpeg" }),
  runOcr: async () => "",
  parseNameplate: () => ({}),
}))

import Assistant from "../pages/Assistant"

const photoInput = () => document.querySelector('input[type="file"][accept="image/*"]')

describe("photo-only send", () => {
  it("an attached photo enables Send with an empty composer", async () => {
    renderPage(<Assistant />)
    const sendBtn = await screen.findByLabelText("Send")
    expect(sendBtn).toBeDisabled()

    fireEvent.change(photoInput(), {
      target: { files: [new File(["x"], "nameplate.jpg", { type: "image/jpeg" })] },
    })
    expect(await screen.findByText(/photo ready/)).toBeInTheDocument()
    expect(sendBtn).not.toBeDisabled()

    fireEvent.click(sendBtn)
    // The user bubble carries the photo flag; the composer stays empty.
    expect(await screen.findByText("📷 photo attached")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/photo ready/)).not.toBeInTheDocument())
  })

  it("empty composer with nothing attached still refuses to send", async () => {
    renderPage(<Assistant />)
    const sendBtn = await screen.findByLabelText("Send")
    fireEvent.click(sendBtn)
    expect(screen.queryByText("📷 photo attached")).not.toBeInTheDocument()
    expect(sendBtn).toBeDisabled()
  })
})
