// Turning a triaged work order into an outward quote request. Two jobs:
//   1. Suggest the right contractors — those whose trade matches the work —
//      so the operator isn't scrolling the whole roster.
//   2. Compose a copy-paste email pack with enough detail for a contractor
//      to quote, or a mailto: link that opens their client pre-filled.
// No email integration — the operator sends it from Outlook/Gmail themselves.

import { tradeForItem, tradeForText, OTHER_TRADE } from "./trades"
import { isOpenWorkOrder } from "./workOrders"

const priorityIsOpen = (p) => !p.status || p.status === "open" || p.status === "scheduled"

// The trade a work order belongs to. The operator's explicit `category` wins
// (so a "bathroom exhaust fan" under category HVAC routes to HVAC, not
// Plumbing on the word "bath"); only when category is blank/unrecognized do
// we fall back to inferring from the title.
export function orderTrade(order = {}) {
  const byCategory = tradeForText(order.category)
  return byCategory.key !== OTHER_TRADE.key ? byCategory : tradeForItem(order)
}

// Split the roster into the contractors whose trade matches this work order
// and the rest. `trade` is the work order's own trade (or Other). When the
// order has no recognizable trade, nothing is "suggested" and everyone falls
// into `others`.
export function suggestedContractors(order, contractors = []) {
  const trade = orderTrade(order || {})
  if (trade.key === OTHER_TRADE.key) {
    return { trade, matched: [], others: contractors }
  }
  const matched = []
  const others = []
  for (const c of contractors) {
    if (tradeForText(c.trades).key === trade.key) matched.push(c)
    else others.push(c)
  }
  return { trade, matched, others }
}

// The quote-request email for a work order: a subject line and a body with
// the address, the work, the trade, a note that photos are on file, and the
// standard "please include" checklist. Deterministic and editable — good
// enough to send, not meant to be perfect.
export function quoteRequestEmail(order = {}, property = {}) {
  const where = [property.address, property.areaLabel].filter(Boolean).join(", ")
  const trade = orderTrade(order)
  const subject = `Quote request: ${order.title || "home services work"}${
    property.address ? ` — ${property.address}` : ""
  }`

  const body = [
    "Hello,",
    "",
    `Charlottesville Home & Property Services manages ${
      where || "a property"
    } and is requesting a quote for the work below.`,
    "",
    "WHAT WE NEED",
    order.title || "(see details)",
    ...(order.notes ? ["", order.notes.trim()] : []),
    "",
    `TRADE: ${trade.label}`,
    ...(order.scheduledFor ? [`PREFERRED TIMING: ${order.scheduledFor}`] : []),
    "",
    "We have photos of the affected units on file and can send them over on request.",
    "",
    "Please include in your reply:",
    "  • An itemized estimate (parts and labour)",
    "  • Your earliest availability for a site visit and for the work",
    "  • Estimated time to complete",
    "  • Confirmation of license and insurance",
    "",
    "Reply to this email or call us with any questions. Thank you.",
    "",
    "Charlottesville Home & Property Services",
  ].join("\n")

  return { subject, body }
}

// Other OPEN work orders at the same property whose trade matches the anchor
// — the ones a single contractor could quote in one visit.
export function combinableOrders(anchor = {}, orders = []) {
  const trade = orderTrade(anchor)
  if (trade.key === OTHER_TRADE.key) return []
  return orders.filter(
    (o) =>
      o.id !== anchor.id &&
      o.propertyId === anchor.propertyId &&
      isOpenWorkOrder(o) &&
      orderTrade(o).key === trade.key
  )
}

// Open 90-day priorities of the same trade that aren't already on a work
// order — the "while you're here" candidates (any urgency, incl. med/low)
// worth flagging into the same quote. Excludes the priority that spawned the
// anchor.
export function combinablePriorities(anchor = {}, priorities = []) {
  const trade = orderTrade(anchor)
  if (trade.key === OTHER_TRADE.key) return []
  const anchorPriorityIds = new Set([
    ...(anchor.priorityIds || []),
    ...(anchor.priorityId ? [anchor.priorityId] : []),
  ])
  return priorities.filter(
    (p) =>
      priorityIsOpen(p) &&
      !p.workOrderId &&
      !anchorPriorityIds.has(p.id) &&
      orderTrade({ category: p.category, title: p.title }).key === trade.key
  )
}

// One consolidated quote request: the anchor work order plus any extra line
// items (other orders / priorities) the operator folded in. Falls back to the
// single-item email when there's nothing extra.
export function combinedQuoteEmail(anchor = {}, extras = [], property = {}) {
  const lines = [{ title: anchor.title, notes: anchor.notes }, ...extras].filter((l) => l && l.title)
  if (lines.length <= 1) return quoteRequestEmail(anchor, property)

  const where = [property.address, property.areaLabel].filter(Boolean).join(", ")
  const trade = orderTrade(anchor)
  const need = lines.flatMap((l, i) => [
    `${i + 1}. ${l.title}`,
    ...(l.notes ? [`   ${l.notes.trim()}`] : []),
  ])
  const subject = `Quote request: ${lines.length} items${
    property.address ? ` — ${property.address}` : ""
  }`
  const body = [
    "Hello,",
    "",
    `Charlottesville Home & Property Services manages ${
      where || "a property"
    } and is requesting a quote for the ${lines.length} items below — ideally handled in one visit.`,
    "",
    `WHAT WE NEED (${lines.length} items)`,
    ...need,
    "",
    `TRADE: ${trade.label}`,
    ...(anchor.scheduledFor ? [`PREFERRED TIMING: ${anchor.scheduledFor}`] : []),
    "",
    "We have photos of the affected units on file and can send them over on request.",
    "",
    "Please include in your reply:",
    "  • An itemized estimate per item (parts and labour)",
    "  • Your earliest availability for a site visit and for the work",
    "  • Estimated time to complete",
    "  • Confirmation of license and insurance",
    "",
    "Reply to this email or call us with any questions. Thank you.",
    "",
    "Charlottesville Home & Property Services",
  ].join("\n")
  return { subject, body }
}

// The property's photo-type documents — candidates to attach to a pack.
export function imageDocuments(documents = []) {
  return documents.filter(
    (d) =>
      (d.contentType || "").startsWith("image/") ||
      /\.(jpe?g|png|gif|webp|heic)$/i.test(d.name || "")
  )
}

// Append a photos section (shareable storage links) to an email body.
export function withPhotoLinks(body, photos = []) {
  if (!photos.length) return body
  const lines = photos.map((p) => `  • ${p.name}: ${p.url}`)
  return body.replace(
    "We have photos of the affected units on file and can send them over on request.",
    `PHOTOS (view links):\n${lines.join("\n")}`
  )
}

// A print-ready pack: the quote request as one clean page — details, line
// items, photos inline — for print-to-PDF or handing over as a file. Plain
// HTML string; the drawer opens it in a new window and calls print().
export function packHtml({ subject, body }, photos = []) {
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const imgs = photos
    .map(
      (p) =>
        `<figure style="margin:0"><img src="${esc(p.url)}" alt="${esc(p.name)}" style="max-width:100%;max-height:340px;border-radius:8px"/><figcaption style="font:12px sans-serif;color:#666">${esc(p.name)}</figcaption></figure>`
    )
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="font:14px/1.5 -apple-system,sans-serif;color:#1a241e;max-width:44rem;margin:2rem auto;padding:0 1rem">
<h1 style="font-size:20px">${esc(subject)}</h1>
<pre style="white-space:pre-wrap;font:inherit">${esc(body)}</pre>
${imgs ? `<h2 style="font-size:16px">Photos</h2><div style="display:flex;flex-direction:column;gap:12px">${imgs}</div>` : ""}
</body></html>`
}

// A mailto: link that opens the operator's email client with the request
// pre-filled. `to` is optional — a blank recipient still opens a draft.
export function mailtoHref({ to = "", subject = "", body = "" }) {
  const params = new URLSearchParams()
  if (subject) params.set("subject", subject)
  if (body) params.set("body", body)
  const qs = params.toString().replace(/\+/g, "%20")
  return `mailto:${encodeURIComponent(to)}${qs ? `?${qs}` : ""}`
}
