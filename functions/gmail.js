// Gmail intake helpers — the pure pieces of the inbound email pipeline,
// kept separate from the scheduled function so they can be unit-tested
// without Google or Firebase in the room.
//
// The pipeline (see emailPoller in index.js): poll the shared intake
// mailbox (cvillehomeservicestest@gmail.com) for unread mail, route each
// message to a property, parse it with Claude into proposed records, and
// write an email-intake conversation whose pending actions surface in the
// app's Awaiting-confirmation queue.

// --- Routing ---------------------------------------------------------------

// The +tag from a message's recipient headers: cvillehomeservicestest+895@…
// → "895". Checks To and Delivered-To (forwards often only carry the tag in
// the latter). Empty string when untagged.
function extractTag(headers) {
  const get = (name) =>
    (headers || [])
      .filter((h) => (h.name || "").toLowerCase() === name)
      .map((h) => h.value || "")
      .join(", ")
  const hay = `${get("to")}, ${get("delivered-to")}, ${get("x-forwarded-to")}`
  const m = hay.match(/\+([a-z0-9._-]+)@/i)
  return m ? m[1].toLowerCase() : ""
}

// Which property a message belongs to. One property in the portfolio →
// everything routes there (the current single-home reality, zero config).
// Multiple → the +tag must match a property's emailTag (set on its profile);
// no match → null, and the poller records it as unrouted.
function routeMessage(tag, properties) {
  if (properties.length === 1) return properties[0]
  if (!tag) return null
  return (
    properties.find((p) => (p.emailTag || "").toLowerCase() === tag) || null
  )
}

// --- Body extraction -------------------------------------------------------

const b64url = (s) => Buffer.from((s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")

// Best-effort plain text from a Gmail payload: prefer text/plain parts,
// fall back to de-tagged text/html, walk nested multiparts.
function extractBody(payload) {
  if (!payload) return ""
  const texts = []
  const htmls = []
  const walk = (part) => {
    if (!part) return
    const mime = part.mimeType || ""
    const data = part.body && part.body.data
    if (data && mime.startsWith("text/plain")) texts.push(b64url(data))
    else if (data && mime.startsWith("text/html")) htmls.push(b64url(data))
    for (const child of part.parts || []) walk(child)
  }
  walk(payload)
  if (texts.length) return texts.join("\n").trim()
  const stripped = htmls
    .join("\n")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
  return stripped.trim()
}

// --- Parsing the model's reply --------------------------------------------

// Mirror of dashboard/src/assistant.js parseAssistantReply — duplicated
// because functions is its own package; keep the action grammar in sync.
const ACTION_TYPES = ["save_fact", "service_request", "log_job", "log_system", "log_quote"]

function parseActions(raw) {
  const actions = []
  const text = (raw || "")
    .replace(/<action>([\s\S]*?)<\/action>/g, (_, json) => {
      try {
        const a = JSON.parse(json)
        if (ACTION_TYPES.includes(a.type)) actions.push({ ...a, status: "pending" })
      } catch {
        /* malformed action block — drop it, keep the text */
      }
      return ""
    })
    .trim()
  return { text, actions }
}

// --- The intake prompt (server copy of dashboard/src/emailIntake.js) -------

function intakePrompt({ workOrders = [], systems = [] }) {
  const openOrders = workOrders
    .filter((w) => w.lane !== "done" && w.lane !== "canceled")
    .map((w) => `- id: ${w.id} · ${w.title}${w.quoteStatus ? ` (quote: ${w.quoteStatus})` : ""}`)
    .join("\n")
  const systemList = systems.map((s) => s.category).filter(Boolean).join(", ")
  return `EMAIL INTAKE: You extract home-service records from one forwarded email (a contractor's quote reply, an invoice, a service confirmation, a warranty notice).

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

// Same date-label format the app writes (dashboard/src/dates.js todayLabel).
function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

module.exports = { extractTag, routeMessage, extractBody, parseActions, intakePrompt, todayLabel }
