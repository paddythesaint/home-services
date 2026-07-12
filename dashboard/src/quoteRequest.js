// Turning a triaged work order into an outward quote request. Two jobs:
//   1. Suggest the right contractors — those whose trade matches the work —
//      so the operator isn't scrolling the whole roster.
//   2. Compose a copy-paste email pack with enough detail for a contractor
//      to quote, or a mailto: link that opens their client pre-filled.
// No email integration — the operator sends it from Outlook/Gmail themselves.

import { tradeForItem, tradeForText, OTHER_TRADE } from "./trades"

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

// A mailto: link that opens the operator's email client with the request
// pre-filled. `to` is optional — a blank recipient still opens a draft.
export function mailtoHref({ to = "", subject = "", body = "" }) {
  const params = new URLSearchParams()
  if (subject) params.set("subject", subject)
  if (body) params.set("body", body)
  const qs = params.toString().replace(/\+/g, "%20")
  return `mailto:${encodeURIComponent(to)}${qs ? `?${qs}` : ""}`
}
