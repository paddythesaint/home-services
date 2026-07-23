// The operator's work queue, derived — not a list anyone maintains. The
// Command Center already rolls up record-side alerts (high priorities,
// overdue checks, expiring coverage); this adds the workflow side: new
// client requests waiting in triage, quotes sitting undecided, and open
// orders that have gone quiet past an age threshold. Everything here
// answers "what needs a human right now."

import { isOpenWorkOrder, daysOpen } from "./workOrders"

// How long an order can sit (total age, from createdOn — we don't track
// per-lane transitions) before it reads as stalled, by lane. Scheduled is
// deliberately absent: being on the calendar is the healthy state.
export const STALL_DAYS = { triage: 3, quote: 7, "in-progress": 14 }

export function workOrderAttention(orders = [], now = new Date()) {
  const items = []
  for (const w of orders) {
    if (!isOpenWorkOrder(w)) continue
    const d = daysOpen(w, now)
    const quotes = w.quotes || []

    // Quotes in but none chosen — deciding supersedes any stall nag.
    if (quotes.length > 0 && !quotes.some((q) => q.chosen)) {
      items.push({
        key: `wo-quote-${w.id}`,
        kind: "quote-decision",
        title: `${quotes.length} quote${quotes.length === 1 ? "" : "s"} in — pick a winner: ${w.title}`,
        urgency: "high",
        workOrderId: w.id,
      })
      continue
    }

    // A homeowner request still in triage is the loudest signal there is.
    if (w.source === "homeowner" && w.lane === "triage") {
      items.push({
        key: `wo-request-${w.id}`,
        kind: "request",
        title: `New client request: ${w.title}`,
        detail: d ? `waiting ${d} day${d === 1 ? "" : "s"}` : "just in",
        urgency: "high",
        workOrderId: w.id,
      })
      continue
    }

    const limit = STALL_DAYS[w.lane]
    if (limit != null && d != null && d >= limit) {
      items.push({
        key: `wo-stall-${w.id}`,
        kind: "stalled",
        title: `Stalled: ${w.title}`,
        detail: `open ${d} days, still in ${w.lane}`,
        urgency: "medium",
        workOrderId: w.id,
      })
    }
  }
  return items
}
