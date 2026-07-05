// The visit note: silent excellence made visible. Composes a warm,
// client-ready summary from the record — what we completed recently and
// what's coming up — for the founder to tweak and send after a visit.
// Saved notes land in the property's visitNotes collection, and the
// latest one greets the homeowner on their calm home screen.

import { TEAM } from "./team"

const DAY = 24 * 60 * 60 * 1000

function withinDays(dateText, days, now) {
  const t = Date.parse(dateText || "")
  if (Number.isNaN(t)) return false
  const delta = now.getTime() - t
  return delta >= 0 && delta <= days * DAY
}

export function composeVisitNote({ profile, jobs = [], workOrders = [], now = new Date() }) {
  const completed = jobs.filter((j) => j.status === "completed")
  let recent = completed.filter((j) => withinDays(j.date, 21, now))
  if (recent.length === 0) recent = completed.slice(-3)

  const upcoming = [
    ...workOrders
      .filter((w) => w.lane === "scheduled" || w.lane === "in-progress")
      .map((w) => ({
        title: w.title,
        when: w.lane === "in-progress" ? "underway" : w.scheduledFor || "being scheduled",
      })),
    ...jobs
      .filter((j) => j.status === "scheduled")
      .map((j) => ({ title: j.title, when: j.date || "being scheduled" })),
  ]

  const lines = []
  lines.push(`Hi ${profile.clientName ? `${profile.clientName} family` : "there"},`)
  lines.push("")
  lines.push(`A quick note on ${profile.address || "your home"}:`)
  if (recent.length > 0) {
    lines.push("")
    lines.push("Taken care of:")
    for (const j of recent.slice().reverse()) {
      lines.push(`  • ${j.title}${j.date ? ` (${j.date})` : ""}${j.cost ? ` — ${j.cost}` : ""}`)
    }
  }
  if (upcoming.length > 0) {
    lines.push("")
    lines.push("Coming up:")
    for (const u of upcoming) {
      lines.push(`  • ${u.title} — ${u.when}`)
    }
  }
  lines.push("")
  lines.push(
    "Everything else looks good. Reply to this note or use the Request button on your dashboard any time."
  )
  lines.push("")
  lines.push(
    `— ${TEAM.map((t) => t.name).join(" & ")}, Charlottesville Home & Property Services`
  )
  return lines.join("\n")
}
