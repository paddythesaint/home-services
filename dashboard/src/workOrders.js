// The work order: the object that carries an issue from "we should fix
// this" to "fixed, on the record." One per piece of work, property-scoped
// (properties/{id}/workOrders), moving through lanes:
//
//   triage → quote → scheduled → in-progress → done
//
// Not every order needs every lane — a tech-visit job can go straight from
// triage to scheduled. The lane answers "where does this stand", the
// assignment answers "who does it", the quote trail answers "what will it
// cost and did we agree." Completion is the handshake with the rest of the
// record: it writes the Job History entry and resolves the linked priority,
// so nothing is bookkept twice.

import { todayLabel } from "./dates"

export const LANES = ["triage", "quote", "scheduled", "in-progress", "done"]

export const LANE_META = {
  triage: { label: "Triage", hint: "Decide who does it" },
  quote: { label: "Quote", hint: "Pricing in motion" },
  scheduled: { label: "Scheduled", hint: "On the calendar" },
  "in-progress": { label: "In progress", hint: "Being worked" },
  done: { label: "Done", hint: "On the record" },
}

export const ASSIGNEE_TYPES = ["visit", "contractor"]
export const ASSIGNEE_LABEL = {
  visit: "Our visit (in-house)",
  contractor: "Contractor",
}

export const QUOTE_STATUSES = ["none", "needed", "requested", "received", "approved", "declined"]
export const QUOTE_LABEL = {
  none: "No quote needed",
  needed: "Quote needed",
  requested: "Quote requested",
  received: "Quote received",
  approved: "Quote approved",
  declined: "Quote declined",
}

export const nextLane = (lane) => {
  const i = LANES.indexOf(lane)
  return i >= 0 && i < LANES.length - 1 ? LANES[i + 1] : null
}

// Active = the homeowner-visible sense of "something is happening."
// Triage and quote are internal machinery; homeowners see work once it's
// real (scheduled or underway).
export const isUnderway = (w) => w.lane === "scheduled" || w.lane === "in-progress"
export const isOpenWorkOrder = (w) => w.lane !== "done" && w.lane !== "canceled"

// Raise a work order straight off a 90-day priority.
export function workOrderFromPriority(priority) {
  return {
    title: priority.title,
    category: priority.category || "",
    priorityId: priority.id,
    lane: "triage",
    assigneeType: priority.resolutionPath === "subscription-visit" ? "visit" : "",
    contractorId: "",
    contractorName: "",
    quoteStatus: priority.resolutionPath === "project-quote" ? "needed" : "none",
    quoteAmount: "",
    scheduledFor: "",
    notes: priority.reason || "",
    createdOn: todayLabel(),
  }
}

// The Job History entry a completed work order leaves behind.
export function jobFromWorkOrder(w) {
  return {
    date: todayLabel(),
    title: w.title,
    category: w.category || "",
    sub: w.assigneeType === "contractor" && w.contractorName ? w.contractorName : "HPS visit",
    ...(w.assigneeType === "contractor" && w.contractorId
      ? { contractorId: w.contractorId }
      : {}),
    status: "completed",
    cost: w.quoteAmount || "",
    notes: w.notes ? `Work order: ${w.notes}` : "Closed from work order.",
  }
}
