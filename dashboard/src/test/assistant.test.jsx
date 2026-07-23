import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import { renderPage } from "./renderPage"
import Assistant from "../pages/Assistant"
import {
  buildAssistantContext,
  assistantSystemPrompt,
  parseAssistantReply,
  transcriptMessage,
  recordGaps,
} from "../assistant"
import { __getItems } from "../mocks/firestoreApi"

describe("assistant core (pure)", () => {
  it("builds context from the record, including learned facts", () => {
    const ctx = buildAssistantContext({
      profile: { address: "895 Old Ballard Farm Ln", clientName: "Herron" },
      systems: [{ category: "HVAC", brand: "Trane XR16", installYear: "2016", condition: "good" }],
      facts: [{ text: "Water heater replaced in June 2026.", date: "July 5, 2026" }],
    })
    expect(ctx).toContain("PROPERTY: 895 Old Ballard Farm Ln")
    expect(ctx).toContain("HVAC")
    expect(ctx).toContain("Trane XR16")
    expect(ctx).toContain("LEARNED FACTS")
    expect(ctx).toContain("Water heater replaced in June 2026.")
  })

  it("carries the full home record: visit notes, documents, horizons, plan", () => {
    const ctx = buildAssistantContext({
      profile: { address: "895 Old Ballard Farm Ln", tier: "Standard" },
      systems: [{ category: "Water Heater", installYear: "2019" }],
      visitNotes: [{ body: "Hi Herron family,\nGutters cleared.", sentOn: "July 3, 2026" }],
      documents: [{ name: "hvac-invoice.pdf", uploadedOn: "2026-07-06" }],
    })
    expect(ctx).toContain("Membership: Standard plan")
    expect(ctx).toContain("RECENT NOTES FROM THE TEAM")
    expect(ctx).toContain("Gutters cleared.")
    expect(ctx).toContain("DOCUMENTS ON FILE")
    expect(ctx).toContain("hvac-invoice.pdf (uploaded 2026-07-06)")
    // Water heater installed 2019, typical life 8–12 → window 2027–2031.
    expect(ctx).toContain("typical replacement window 2027–2031")
  })

  it("pre-wires the scope guard into the system prompt", () => {
    const prompt = assistantSystemPrompt("CONTEXT HERE")
    expect(prompt).toContain("SCOPE: you only discuss this home")
    expect(prompt).toContain("WHAT HPS DOES")
    expect(prompt).toContain("don't quote numbers")
  })

  it("knows what the record is missing (the generator case)", () => {
    const gaps = recordGaps({
      systems: [
        {
          category: "Backup Generator",
          brand: "Generac Guardian 22kW",
          installYear: "2021",
          // no serial, no location, no photo, never verified
        },
        {
          category: "HVAC",
          brand: "Trane XR16",
          installYear: "2016",
          serial: "XR1612345",
          location: "Basement utility room",
          photoCount: 1,
          verified: true,
        },
      ],
      priorities: [
        {
          title: "Generator load test",
          status: "open",
          infoNeeded: [
            { ask: "When was the transfer switch last exercised?", status: "pending" },
            { ask: "Fuel type confirmed?", status: "provided" },
          ],
        },
        {
          title: "Old resolved thing",
          status: "resolved",
          infoNeeded: [{ ask: "should not appear", status: "pending" }],
        },
      ],
    })
    expect(gaps).toEqual([
      "Backup Generator: missing serial number, location in the home, a nameplate photo, an in-person verification",
      'For "Generator load test": When was the transfer switch last exercised?',
    ])
  })

  it("surfaces record gaps in the context so the model can answer 'what do you need?'", () => {
    const withGaps = buildAssistantContext({
      profile: { address: "895 Old Ballard Farm Ln" },
      systems: [{ category: "Backup Generator", brand: "Generac" }],
    })
    expect(withGaps).toContain("RECORD GAPS")
    expect(withGaps).toContain("Backup Generator: missing install year")
    const complete = buildAssistantContext({
      profile: { address: "895 Old Ballard Farm Ln" },
      systems: [
        {
          category: "HVAC",
          brand: "Trane",
          installYear: "2016",
          serial: "X1",
          location: "Basement",
          photoCount: 2,
          verified: true,
        },
      ],
    })
    expect(complete).not.toContain("RECORD GAPS")
  })

  it("marks done care tasks in context and accepts log_job actions", () => {
    const ctx = buildAssistantContext({
      profile: { address: "x" },
      calendar: [
        {
          month: "July",
          task: "Flush water heater",
          doneYear: new Date().getFullYear(),
          doneOn: "July 7, 2026",
        },
        { month: "October", task: "Clean gutters" },
      ],
    })
    expect(ctx).toContain("Flush water heater (done July 7, 2026)")
    expect(ctx).not.toContain("Clean gutters (done")
    const { actions } = parseAssistantReply(
      'ok\n<action>{"type":"log_job","title":"Pressure washed","date":"July 5, 2026","task":""}</action>'
    )
    expect(actions[0]).toMatchObject({ type: "log_job", status: "pending" })
  })

  it("parses action tags out of replies and tolerates malformed ones", () => {
    const { text, actions } = parseAssistantReply(
      'Sure thing.\n<action>{"type":"save_fact","fact":"New roof 2026.","category":"Roof"}</action>\n<action>not json</action>'
    )
    expect(text).toBe("Sure thing.")
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ type: "save_fact", fact: "New roof 2026.", status: "pending" })
  })

  it("omits action fields it doesn't have — Firestore rejects undefined", () => {
    const t = transcriptMessage({
      role: "assistant",
      text: "done",
      actions: [{ type: "log_job", title: "Generator service", task: "x", status: "pending" }],
    })
    expect(t.actions[0]).toEqual({
      type: "log_job",
      title: "Generator service",
      status: "pending",
    })
    expect("fact" in t.actions[0]).toBe(false)
  })

  it("keeps transcripts small: photos become a flag, actions slim down", () => {
    const t = transcriptMessage({
      role: "user",
      text: "look at this",
      hadPhoto: true,
      actions: [{ type: "save_fact", fact: "x", category: "y", status: "done", extra: "drop" }],
    })
    expect(t).toEqual({
      role: "user",
      text: "look at this",
      hadPhoto: true,
      actions: [{ type: "save_fact", fact: "x", status: "done" }],
    })
  })
})

describe("assistant page", () => {
  async function ask(text) {
    fireEvent.change(
      screen.getByPlaceholderText(/Ask about the home/),
      { target: { value: text } }
    )
    fireEvent.click(screen.getByLabelText("Send"))
  }

  it("introduces itself with the home and answers from the record", async () => {
    renderPage(<Assistant />)
    expect(
      await screen.findByText(/I'm the HPS assistant for 895 Old Ballard Farm Ln/)
    ).toBeInTheDocument()
    await ask("What filter size do I need?")
    expect(await screen.findByText(/16x25x1 MERV 11/)).toBeInTheDocument()
  })

  it("learns via confirm-then-write: proposes, member saves, fact lands", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    await ask("We replaced the water heater last month")
    expect(await screen.findByText(/Record: "Water heater replaced/)).toBeInTheDocument()
    // Nothing written until the member confirms.
    expect(__getItems("prop-ballard", "facts")).toHaveLength(0)
    fireEvent.click(screen.getByText("Save"))
    expect(await screen.findByText(/Saved to the record/)).toBeInTheDocument()
    const facts = __getItems("prop-ballard", "facts")
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({
      text: "Water heater replaced in June 2026.",
      source: "assistant",
    })
  })

  it("adds a newly installed unit to the Health Report via log_system", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    await ask("We had a new water pump installed in the basement")
    expect(await screen.findByText(/Add to systems: "Water pump/)).toBeInTheDocument()
    const before = __getItems("prop-ballard", "healthReport").length
    fireEvent.click(screen.getByText("Add system"))
    expect(await screen.findByText(/Added to your Property Health Report/)).toBeInTheDocument()
    const systems = __getItems("prop-ballard", "healthReport")
    expect(systems).toHaveLength(before + 1)
    expect(systems.find((s) => s.category === "Water pump (basement)")).toMatchObject({
      detail: "Grundfos MQ3-45",
      installYear: "2026",
      verified: false,
      source: "assistant",
    })
  })

  it("declines off-topic asks and steers back to the home", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    await ask("Can you write my kid an essay about Rome?")
    expect(await screen.findByText(/outside my lane/)).toBeInTheDocument()
  })

  it("answers 'what do you need from me?' from the record's gaps", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    await ask("What information do you need from me?")
    const answer = await screen.findByText(/round out the record/)
    // Fixture systems are missing serials — that concrete ask surfaces.
    expect(answer.textContent).toMatch(/serial number/)
  })

  it("files a service request into triage after confirmation", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    await ask("the kitchen disposal is jammed")
    expect(await screen.findByText(/File request: "Disposal jammed"/)).toBeInTheDocument()
    fireEvent.click(screen.getByText("Send request"))
    await screen.findByText(/Request filed/)
    const orders = __getItems("prop-ballard", "workOrders")
    const filed = orders.find((w) => w.title === "Disposal jammed")
    expect(filed).toMatchObject({
      lane: "triage",
      source: "homeowner",
      via: "assistant",
      requestedBy: "paddythesaint@gmail.com",
    })
  })

  it("reads an attached document, files it, and proposes facts to save", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    const file = new File(["%PDF-1.4 fake invoice"], "hvac-invoice.pdf", {
      type: "application/pdf",
    })
    const input = document.querySelector('input[accept="application/pdf"]')
    fireEvent.change(input, { target: { files: [file] } })
    // attachDoc reads the file asynchronously — wait for the ready chip.
    await screen.findByText(/📎 ✓/)
    await ask("here's the invoice from the HVAC visit")

    // Summary + two proposed facts from the scripted document reply.
    expect(await screen.findByText(/HVAC service invoice/)).toBeInTheDocument()
    const saves = await screen.findAllByText("Save")
    expect(saves).toHaveLength(2)
    fireEvent.click(saves[0])
    await screen.findByText(/Saved to the record/)
    expect(
      __getItems("prop-ballard", "facts").find((f) => f.text.includes("run capacitor"))
    ).toBeTruthy()

    // The file itself landed in the property's documents (alongside any seed).
    await waitFor(() => {
      const docs = __getItems("prop-ballard", "documents")
      expect(docs.find((d) => d.name === "hvac-invoice.pdf")).toBeTruthy()
    })
  })

  it("persists the transcript on the property", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    await ask("What filter size do I need?")
    await screen.findByText(/16x25x1 MERV 11/)
    await waitFor(() => {
      // A seeded conversation exists in the fixture, so find the one this chat
      // just created rather than assuming an empty collection.
      const convs = __getItems("prop-ballard", "conversations")
      const mine = convs.find((c) =>
        (c.messages || []).some((m) => m.text?.includes("filter size"))
      )
      expect(mine).toBeTruthy()
      expect(mine.messages).toHaveLength(2)
      expect(mine.startedBy).toBe("paddythesaint@gmail.com")
    })
  })
})
