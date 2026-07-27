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

Write 3-5 sentences, plain internal tone, no markdown, no pleasantries. Lead with what the client is asking for and the single most useful next step. Include record facts (make/model, age, service history, related open items) ONLY when they change what the handler should do — leave tangential history out. Name the right trade or vendor when one fits. End with one line: "NEXT: <one imperative sentence — the very next concrete action>".`
}

// Briefings are prose only — no action tags to parse.
export function briefingMessages() {
  return [{ role: "user", content: "Brief me on this work order." }]
}

// --- Outreach draft --------------------------------------------------------
// The step after the briefing: don't describe the ask — write it. A ready
// outbound email grounded in the record, with [brackets] where the record
// is blank instead of invented details. Founder reviews, fills brackets,
// sends from their own mail.

export const OUTREACH_MARKER = "OUTREACH DRAFT"

// The web-search server tool the drafter is allowed: enough searches to
// find and confirm one recipient address, not to wander.
export function outreachTools() {
  return [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }]
}

export function outreachSystemPrompt({ profile, systems, priorities, jobs, workOrders, facts, order }) {
  const homeContext = buildAssistantContext({ profile, systems, priorities, jobs, workOrders, facts })
  return `${OUTREACH_MARKER}
You are the operations lead at Charlottesville Home & Property Services (HPS). Draft the outbound email that actually moves the work order below — to the vendor, agency, or office that must act.

HOME RECORD:
${homeContext}

THIS WORK ORDER:
- Title: ${order.title}
- What was said: ${order.notes || "(no detail captured)"}
- Category: ${order.category || "unspecified"}

You have the web_search tool. Use it to find the correct recipient email address for the EXACT office or organization that must act — search the organization's own site or an official directory, not a generic guess. This home is in Albemarle County, Virginia (Charlottesville area); pick the office with jurisdiction here.

Reply in EXACTLY this format, nothing before or after (do NOT include citations or footnote markers in these lines):
TO: <the recipient. A specific email address ONLY if the HOME RECORD or a search result confirms it for this exact organization; otherwise name the office precisely and write "verify address">
SUBJECT: <subject line>
BODY:
<the email, ready to send. Ground every property detail in the HOME RECORD above. Use [square brackets] for anything the record does not contain (parcel/tax-map number, permit ids, account numbers) — never invent specifics. Under 150 words, direct and courteous. Sign it "Patrick\nCharlottesville Home & Property Services\non behalf of the owner, ${profile.address || "the property"}">
NOTES: <one line: where the TO address came from (site or page) or what still needs verifying, plus anything to attach before sending>`
}

export function outreachMessages() {
  return [{ role: "user", content: "Draft the outreach email for this work order." }]
}

// Parse the fixed TO/SUBJECT/BODY/NOTES shape; tolerate a missing NOTES.
export function parseOutreach(raw = "") {
  const to = (raw.match(/^TO:\s*(.+)$/m) || [])[1]?.trim() || ""
  const subject = (raw.match(/^SUBJECT:\s*(.+)$/m) || [])[1]?.trim() || ""
  const bodyMatch = raw.match(/^BODY:\s*\n([\s\S]*?)(?:\n^NOTES:|$(?![\s\S]))/m)
  const body = (bodyMatch?.[1] || "").trim()
  const notes = (raw.match(/^NOTES:\s*(.+)$/m) || [])[1]?.trim() || ""
  return { to, subject, body, notes }
}
