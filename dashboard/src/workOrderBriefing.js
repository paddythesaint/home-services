// The work-order briefing: an internal, staff-facing read on a ticket that
// draws on the home's whole record. Where the assistant speaks TO the
// client, this speaks ABOUT the job to the team member who'll handle it —
// what the client asked for, what our record says about the system, likely
// causes given its history, and who's the right hands for it.
//
// It reuses the same property context the assistant assembles, plus the
// order itself. The marker lets the mock backend recognize and script it.

import { buildAssistantContext } from "./assistant"

export const BRIEFING_MARKER = "INTERNAL WORK-ORDER BRIEFING"

export function briefingSystemPrompt({ profile, systems, priorities, jobs, workOrders, facts, order }) {
  const homeContext = buildAssistantContext({ profile, systems, priorities, jobs, workOrders, facts })
  return `${BRIEFING_MARKER}
You are the operations lead at Charlottesville Home & Property Services (HPS). A team member is about to pick up the work order below. Write a tight internal briefing — for staff, never shown to the client.

HOME RECORD:
${homeContext}

THIS WORK ORDER:
- Title: ${order.title}
- Raised: ${order.createdOn || "date unknown"} (${order.source === "homeowner" ? "client request" : "team-filed"})
- What was said: ${order.notes || "(no detail captured)"}
- Category: ${order.category || "unspecified"}
- Current stage: ${order.lane}

Write 4-6 sentences, plain internal tone, no markdown, no pleasantries, covering in order: (1) what the client is asking for; (2) what our record says about the system(s) involved — make/model, age, service history, any related open priorities; (3) the most likely causes or the specific things to check on site given that history; (4) which trade or vendor is the right fit. If the record is thin on the relevant system, say plainly what we should confirm on site.`
}

// Briefings are prose only — no action tags to parse.
export function briefingMessages() {
  return [{ role: "user", content: "Brief me on this work order." }]
}
