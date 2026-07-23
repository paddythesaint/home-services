import { describe, it, expect } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Conversations from "../pages/Conversations"
import {
  conversationActions,
  conversationsSummary,
  messageCount,
  byRecency,
} from "../conversations"

const conv = {
  id: "c1",
  startedOn: "July 12, 2026",
  order: 2,
  messages: [
    { role: "user", text: "New softener installed" },
    { role: "assistant", text: "Saved.", actions: [{ type: "save_fact", fact: "Culligan softener", status: "applied" }] },
    { role: "user", text: "And a generator service" },
    { role: "assistant", text: "Logged.", actions: [{ type: "log_job", title: "Generator service", status: "applied" }] },
  ],
}

describe("conversations shaping (pure)", () => {
  it("flattens the records a conversation committed, with counts", () => {
    const { items, counts, total } = conversationActions(conv)
    expect(total).toBe(2)
    expect(items.map((i) => i.label)).toEqual(["Culligan softener", "Generator service"])
    expect(counts).toEqual({ save_fact: 1, log_job: 1 })
  })
  it("counts messages and rolls a set up", () => {
    expect(messageCount(conv)).toBe(4)
    expect(conversationsSummary([conv, { messages: [] }])).toEqual({ conversations: 2, records: 2 })
  })
  it("orders newest first by insert order", () => {
    const out = byRecency([{ id: "a", order: 1 }, { id: "b", order: 5 }, { id: "c", order: 3 }])
    expect(out.map((c) => c.id)).toEqual(["b", "c", "a"])
  })
})

describe("Assistant Log page", () => {
  it("lists the seeded conversation and expands to the transcript + records", async () => {
    renderPage(<Conversations />)
    expect(await screen.findByText("Assistant Log")).toBeInTheDocument()
    const header = await screen.findByText(/New water pump/)
    fireEvent.click(header)
    // Expanded: the user's words and the committed records show.
    expect(await screen.findByText(/here's the nameplate/)).toBeInTheDocument()
    expect(screen.getAllByText(/System added:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Job logged:/).length).toBeGreaterThan(0)
  })

  it("shows uploaded documents that came in", async () => {
    renderPage(<Conversations />)
    expect(await screen.findByText("Uploads & documents")).toBeInTheDocument()
    expect(screen.getByText(/water-pump-nameplate.jpg/)).toBeInTheDocument()
  })
})
