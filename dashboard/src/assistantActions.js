// Applying a confirmed assistant action to the record — the ONE place the
// writes live, shared by the live chat's confirm chips and the Assistant
// Log's awaiting-confirmation queue (the safety net for actions nobody
// tapped before closing the app). Returns where the created record lives,
// so confirmations can link straight to it.

import { addItem, updateItem, fetchItems } from "./firestoreApi"
import { todayLabel } from "./dates"

// Where each action type's record can be seen once applied.
export const ACTION_DESTINATION = {
  save_fact: null, // facts feed the assistant's context, no page of their own
  log_job: "/job-history",
  log_system: "/health-report",
  service_request: "/",
}

export async function applyAssistantAction(pid, action, email) {
  if (action.type === "save_fact") {
    await addItem(pid, "facts", {
      text: action.fact,
      category: action.category || "",
      source: "assistant",
      confirmedBy: email || "",
      date: todayLabel(),
    })
  } else if (action.type === "log_job") {
    // One confirmation, two writes: the job enters the history, and if the
    // model matched a care-calendar task, this year's is checked off.
    await addItem(pid, "jobHistory", {
      date: action.date || todayLabel(),
      title: action.title,
      category: action.category || "",
      sub: action.sub || "",
      status: "completed",
      notes: "Reported via assistant.",
      via: "assistant",
    })
    if (action.task) {
      const calendar = await fetchItems(pid, "careCalendar")
      const t = calendar.find((x) => x.task === action.task)
      if (t) {
        await updateItem(pid, "careCalendar", t.id, {
          doneOn: todayLabel(),
          doneYear: new Date().getFullYear(),
        })
      }
    }
  } else if (action.type === "log_system") {
    // A newly installed unit becomes a tracked system on the Health Report —
    // unverified until someone confirms it in person.
    await addItem(pid, "healthReport", {
      category: action.title,
      detail: action.detail || "",
      installYear: action.installYear || "",
      condition: "good",
      verified: false,
      source: "assistant",
    })
  } else if (action.type === "service_request") {
    await addItem(pid, "workOrders", {
      title: action.title,
      notes: action.details || "",
      category: "",
      lane: "triage",
      source: "homeowner",
      via: "assistant",
      requestedBy: email || "",
      assigneeType: "",
      contractorId: "",
      contractorName: "",
      quoteStatus: "none",
      quoteAmount: "",
      scheduledFor: "",
      createdOn: todayLabel(),
    })
  }
  return ACTION_DESTINATION[action.type] ?? null
}
