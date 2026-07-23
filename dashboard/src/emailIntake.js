// Email intake: turn a pasted (later: forwarded) email into proposed
// records. Phase 1 of the inbound pipeline — the parsing and review
// machinery is transport-independent, so when a Gmail poller or webhook
// lands later it feeds exactly this. Proposals ride the same <action>
// format as the assistant and land as a stored conversation with pending
// actions — the Awaiting-confirmation queue and applyAssistantAction do
// the rest.

export const INTAKE_MARKER = "EMAIL INTAKE"

export function emailIntakePrompt({ workOrders = [], systems = [] } = {}) {
  const openOrders = workOrders
    .filter((w) => w.lane !== "done" && w.lane !== "canceled")
    .map((w) => `- id: ${w.id} · ${w.title}${w.quoteStatus ? ` (quote: ${w.quoteStatus})` : ""}`)
    .join("\n")
  const systemList = systems.map((s) => s.category).filter(Boolean).join(", ")

  return `${INTAKE_MARKER}: You extract home-service records from one pasted email (a contractor's quote reply, an invoice, a service confirmation, a warranty notice).

OPEN WORK ORDERS (match quotes to these by content):
${openOrders || "(none)"}

TRACKED SYSTEMS: ${systemList || "(none)"}

Reply with 1-2 sentences saying what the email is, then propose records with these action tags (one per line, at most five):
<action>{"type":"log_quote","workOrderId":"<id from the list above that this quote answers, else empty>","contractor":"<company name>","amount":"<e.g. $1,450>","note":"<scope/terms worth keeping, else empty>"}</action>
<action>{"type":"log_job","title":"<short job title>","date":"<when done>","category":"<matching system if any>","sub":"<who did it>","task":""}</action>
<action>{"type":"save_fact","fact":"<one durable sentence, past tense, with dates>","category":"<matching system if any>"}</action>
<action>{"type":"log_system","title":"<system name>","detail":"<brand/model>","category":"<trade>","installYear":"<4-digit year or empty>"}</action>

Rules: a price quote for pending work → log_quote (never log_job — the work isn't done). An invoice/receipt for completed work → log_job with the cost in the title or note, plus save_fact for durable details (warranty terms, model numbers). Propose nothing you can't ground in the email's text.`
}
