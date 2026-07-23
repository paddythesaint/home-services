import { describe, it, expect } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Conversations from "../pages/Conversations"
import {
  conversationActions,
  conversationsSummary,
  messageCount,
  byRecency,
  conversationMatches,
  inDateRange,
  filterConversations,
  pendingActions,
  withActionStatus,
} from "../conversations"
import { waitFor } from "@testing-library/react"
import { __getItems } from "../mocks/firestoreApi"

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

describe("search + date filtering (pure)", () => {
  const list = [
    {
      id: "a",
      startedOn: "July 12, 2026",
      summary: "Water pump install",
      messages: [{ role: "assistant", text: "Grundfos MQ3-45", actions: [{ type: "log_system", title: "Water pump (basement)" }] }],
    },
    {
      id: "b",
      startedOn: "March 3, 2026",
      summary: "Gutter question",
      messages: [{ role: "user", text: "When were the gutters cleaned?" }],
    },
  ]

  it("matches free text across summary, messages, and record labels", () => {
    expect(conversationMatches(list[0], "grundfos")).toBe(true) // message text
    expect(conversationMatches(list[0], "water pump (basement)")).toBe(true) // record label
    expect(conversationMatches(list[1], "gutter")).toBe(true)
    expect(conversationMatches(list[1], "grundfos")).toBe(false)
    expect(conversationMatches(list[0], "")).toBe(true) // empty matches all
  })

  it("bounds a free-text date label by a from/to range", () => {
    expect(inDateRange("July 12, 2026", "2026-07-01", "2026-07-31")).toBe(true)
    expect(inDateRange("July 12, 2026", "2026-08-01", "")).toBe(false)
    expect(inDateRange("July 12, 2026", "", "2026-06-30")).toBe(false)
    expect(inDateRange("July 12, 2026", "", "")).toBe(true) // no bounds → all
    expect(inDateRange("", "2026-07-01", "")).toBe(false) // undated excluded when bounded
  })

  it("combines search and date range", () => {
    expect(filterConversations(list, { query: "pump" }).map((c) => c.id)).toEqual(["a"])
    expect(
      filterConversations(list, { from: "2026-07-01", to: "2026-07-31" }).map((c) => c.id)
    ).toEqual(["a"])
    expect(filterConversations(list, {}).map((c) => c.id)).toEqual(["a", "b"])
  })
})

describe("pending-action safety net (pure)", () => {
  const conv = {
    id: "c9",
    startedOn: "July 12, 2026",
    messages: [
      { role: "user", text: "hi" },
      {
        role: "assistant",
        text: "ok",
        actions: [
          { type: "log_job", title: "done thing", status: "done" },
          { type: "save_fact", fact: "warranty registered", status: "pending" },
        ],
      },
    ],
  }
  it("finds only the still-pending actions with their addresses", () => {
    const p = pendingActions([conv])
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ conversationId: "c9", msgIndex: 1, actionIndex: 1 })
    expect(p[0].action.fact).toBe("warranty registered")
  })
  it("rewrites one action's status immutably", () => {
    const msgs = withActionStatus(conv, 1, 1, "done")
    expect(msgs[1].actions[1].status).toBe("done")
    expect(msgs[1].actions[0].status).toBe("done") // untouched sibling
    expect(conv.messages[1].actions[1].status).toBe("pending") // original intact
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

  it("confirms a pending action from the queue: record lands, status flips", async () => {
    renderPage(<Conversations />)
    expect(await screen.findByText(/Awaiting confirmation \(1\)/)).toBeInTheDocument()
    // Appears in the queue AND as a chip on the conversation card below.
    expect(screen.getAllByText(/Water pump warranty registered/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText("Confirm"))
    await waitFor(() => {
      // The fact was written to the record…
      const facts = __getItems("prop-ballard", "facts")
      expect(facts.find((f) => f.text.includes("warranty registered"))).toBeTruthy()
      // …and the transcript's action flipped to done, so the queue clears.
      const conv = __getItems("prop-ballard", "conversations").find((c) => c.id === "conv-1")
      const flat = conv.messages.flatMap((m) => m.actions || [])
      expect(flat.filter((a) => a.status === "pending")).toHaveLength(0)
    })
  })

  it("parses a pasted quote email into pending records, and confirm lands the quote on the order", async () => {
    renderPage(<Conversations />)
    await screen.findByText("Email intake")
    fireEvent.change(screen.getByPlaceholderText(/Paste the email text/), {
      target: {
        value:
          "From: Blue Ridge Gutter Co\nThanks for the opportunity — we can do the gutter guards for $1,650 including haul-away. About a 2-week lead time.",
      },
    })
    fireEvent.click(screen.getByText("Parse into records"))
    // The proposals land in the awaiting-confirmation queue (1 seeded + 2 new).
    expect(await screen.findByText(/Awaiting confirmation \(3\)/)).toBeInTheDocument()
    expect(screen.getAllByText(/Log quote:/).length).toBeGreaterThan(0)

    // Confirm the quote → it lands on the gutter order's comparison list.
    const confirms = screen.getAllByRole("button", { name: "Confirm" })
    // The new quote proposal is in the list; find its row via the label.
    fireEvent.click(confirms[confirms.length - 2]) // log_quote precedes save_fact in the new conv
    await waitFor(() => {
      const w = __getItems("prop-ballard", "workOrders").find((x) => x.id === "wo-gutters")
      expect(w.quotes?.length).toBe(1)
      expect(w.quotes[0]).toMatchObject({ contractor: "Blue Ridge Gutter Co", amount: "$1,650" })
      expect(w.quoteStatus).toBe("received")
    })
  })

  it("filters the log by the search box", async () => {
    renderPage(<Conversations />)
    await screen.findByText(/New water pump installed/)
    fireEvent.change(screen.getByPlaceholderText(/Text, record, contractor/), {
      target: { value: "gutter" },
    })
    expect(await screen.findByText(/No conversations match/)).toBeInTheDocument()
    // The document also drops out of the filtered view.
    expect(screen.queryByText(/water-pump-nameplate.jpg/)).not.toBeInTheDocument()
  })
})
