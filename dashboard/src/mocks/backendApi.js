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
  if (text.includes("filter")) {
    return reply(
      "Your HVAC takes a 16x25x1 MERV 11 filter — there's a 3-pack noted on the record from Home Depot."
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
  return reply(
    "Happy to help with anything about the home — its systems, the plan, or filing a request for the team."
  )
}
