import { addItem } from "./firestoreApi"
import { todayLabel } from "./dates"

// Readable names for the structured system fields, used when summarizing
// what changed in a fact's activity-log entry.
const FIELD_LABELS = {
  detail: "description",
  brand: "brand",
  installYear: "install year",
  lastServiced: "last serviced",
  location: "location",
  condition: "condition",
  note: "note",
  verified: "verified",
}

export const fieldLabel = (key) => FIELD_LABELS[key] || key

// Provenance for a structured fact change: which automated path asserted
// it, and when — the answer to "how do we know this?" (SCHEMA.md, 7/4/26).
// Logged automatically alongside the underlying field write, as a `fact`-
// type activity entry; never something a user hand-adds via the form.
export function logFact(uid, systemId, summary, source, date) {
  return addItem(uid, "activity", {
    systemId,
    type: "fact",
    summary,
    source,
    date: date || todayLabel(),
    order: Date.now(),
  })
}
