// The receipt of value: what the membership actually did over the
// trailing twelve months, computed straight from the record. HNW clients
// don't miss the monthly fee — they cancel things that feel dormant;
// this card is the antidote.

const DAY = 24 * 60 * 60 * 1000

const inWindow = (dateText, now) => {
  const t = Date.parse(dateText || "")
  if (Number.isNaN(t)) return false
  const delta = now.getTime() - t
  return delta >= 0 && delta <= 365 * DAY
}

const parseCost = (text) => {
  const m = (text || "").replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : 0
}

export function buildRecap({ jobs = [], priorities = [], now = new Date() }) {
  const done = jobs.filter((j) => j.status === "completed" && inWindow(j.date, now))
  const withPros = done.filter((j) => j.contractorId || (j.sub && j.sub !== "—"))
  const resolved = priorities.filter(
    (p) => p.status === "resolved" && inWindow(p.resolvedOn, now)
  )
  const spend = done.reduce((sum, j) => sum + parseCost(j.cost), 0)
  return {
    tasksDone: done.length,
    withPros: withPros.length,
    issuesResolved: resolved.length,
    coordinatedSpend: spend,
    hasAnything: done.length > 0 || resolved.length > 0,
  }
}

export const formatSpend = (n) =>
  n >= 1 ? `$${Math.round(n).toLocaleString("en-US")}` : ""
