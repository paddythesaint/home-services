// In-memory stand-in for backendApi.js (aliased in mock/test mode).
// Deterministic, keyword-scripted replies so the assistant page is fully
// exercisable in tests and `npm run preview:mock` without a backend.

export const BACKEND_URL = "http://mock.backend"

export async function callBackend(action) {
  if (action === "ping") return { ok: true, hasKey: true, at: new Date().toISOString() }
  return { ok: true }
}

const reply = (text) => ({ content: [{ type: "text", text }] })

export async function callClaude(propertyId, system, messages) {
  // Internal work-order briefing (founder ops tool) — scripted from the
  // order title in the prompt so preview/tests exercise the real flow.
  if (system && system.includes("INTERNAL WORK-ORDER BRIEFING")) {
    const title = (system.match(/- Title: ([^\n]+)/) || [])[1] || "the reported issue"
    return reply(
      `Client is reporting: ${title}. Cross-check the relevant system's age and last service on the record before dispatch — if it's under an active plan or warranty, route it there first. Most likely a wear-or-maintenance item; confirm on site and grab a nameplate photo if we don't already have one. Best handled by the matching trade from the network.`
    )
  }

  const last = messages[messages.length - 1]
  const content = last?.content
  const text = (
    typeof content === "string"
      ? content
      : (content || []).find((b) => b.type === "text")?.text || ""
  ).toLowerCase()
  const hasImage = Array.isArray(content) && content.some((b) => b.type === "image")
  const hasDocument = Array.isArray(content) && content.some((b) => b.type === "document")

  if (hasDocument) {
    return reply(
      'This looks like an HVAC service invoice: Monticello Air serviced the Trane XR16 on June 24, 2026 and replaced the run capacitor under the parts warranty.\n<action>{"type":"save_fact","fact":"HVAC run capacitor replaced under warranty on June 24, 2026 by Monticello Air.","category":"HVAC"}</action>\n<action>{"type":"save_fact","fact":"Trane XR16 parts warranty confirmed active as of June 2026.","category":"HVAC"}</action>'
    )
  }
  if (hasImage) {
    // Vision path (nameplate reads + chat photos): canned nameplate JSON.
    return reply(
      '{"brand":"Generac","model":"Guardian 22kW","serial":"3012345678","installYear":"2021","condition_note":"Light debris on housing top."}'
    )
  }
  if (/you need|\bmissing\b|complete the record/.test(text)) {
    // Answer from the RECORD GAPS section of the system prompt — same
    // source the real model reads — so preview matches production behavior.
    const m = (system || "").match(/RECORD GAPS[^\n]*\n((?:- [^\n]*\n?)*)/)
    const gaps = m
      ? m[1]
          .trim()
          .split("\n")
          .map((l) => l.replace(/^- /, ""))
          .filter(Boolean)
      : []
    if (!gaps.length) {
      return reply("The record looks complete — nothing I need from you right now.")
    }
    return reply(
      `A few things would round out the record: ${gaps.slice(0, 3).join("; ")}. A quick nameplate photo is usually the fastest win.`
    )
  }
  if (text.includes("filter")) {
    return reply(
      "Your HVAC takes a 16x25x1 MERV 11 filter — there's a 3-pack noted on the record from Home Depot."
    )
  }
  if (/i (just )?(flushed|pressure.?washed|cleaned|did|finished)/.test(text)) {
    // Completed-work report → log_job, with the care-calendar task matched
    // when the fixture has one (the water-heater flush) so the full
    // flow-through — job logged + task checked off — is exercisable.
    if (text.includes("flush")) {
      return reply(
        'Nicely done. Want me to log that and check it off this year\'s care calendar?\n<action>{"type":"log_job","title":"Flushed water heater","date":"July 5, 2026","category":"Plumbing","sub":"Owner (DIY)","task":"Flush water heater"}</action>'
      )
    }
    return reply(
      'Nicely done. Want me to log that in the home\'s job history?\n<action>{"type":"log_job","title":"Pressure washed house & walkways","date":"July 5, 2026","category":"Exterior","sub":"Owner (DIY)","task":""}</action>'
    )
  }
  if (text.includes("replaced") || text.includes("new water heater")) {
    return reply(
      'Good to know — congratulations on the upgrade. Want me to add that to the home\'s record?\n<action>{"type":"save_fact","fact":"Water heater replaced in June 2026.","category":"Water Heater"}</action>'
    )
  }
  if (text.includes("jammed") || text.includes("broken") || text.includes("leak")) {
    return reply(
      'That sounds annoying — I can have the team take care of it. Shall I file the request?\n<action>{"type":"service_request","title":"Disposal jammed","details":"Kitchen disposal hums but will not spin."}</action>'
    )
  }
  if (/essay|homework|poem|recipe|stock|news|capital of/.test(text)) {
    // The scope guard, scripted: mirrors the SCOPE rule in the real prompt.
    return reply(
      "That one's outside my lane — I only cover this home and HPS services. Anything about the house I can help with?"
    )
  }
  return reply(
    "Happy to help with anything about the home — its systems, the plan, or filing a request for the team."
  )
}
