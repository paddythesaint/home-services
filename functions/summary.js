// The home-summary read API's brain (9/9): one JSON snapshot of a home's
// current state, composed for an external personal assistant (Patrick's
// family-ops) rather than for human eyes. Everything derives from the
// record — nothing new is stored. Pure and fetch-free so it unit-tests
// cold; the HTTPS endpoint in index.js owns auth and Firestore.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const when = (label) => {
  const t = Date.parse(label || "")
  return Number.isNaN(t) ? 0 : t
}

const isOpenOrder = (w) => !["done", "canceled", "parked"].includes(w.lane)
const isOpenPriority = (p) => !p.status || p.status === "open" || p.status === "scheduled"

// Mirrors dashboard/src/supplies.js (functions can't import dashboard).
const supplyLabel = (s) => (s.kind === "air" ? `${s.size} air filter` : s.size || "Water filter")
const intervalFor = (s) => Number(s.intervalMonths) || (s.kind === "water" ? 6 : 3)
function nextDueMs(s, now) {
  const base = s.lastReplacedMs || s.createdOnMs || now.getTime()
  const d = new Date(base)
  d.setMonth(d.getMonth() + intervalFor(s))
  return d.getTime()
}

function homeSummary(
  { profile = {}, jobs = [], workOrders = [], calendar = [], systems = [], supplies = [], priorities = [] },
  now = new Date()
) {
  const todayIso = now.toISOString().slice(0, 10)
  const monthOut = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
  const month = MONTHS[now.getMonth()]
  const year = now.getFullYear()

  return {
    generatedAt: now.toISOString(),
    address: profile.address || "",
    profile: {
      areaLabel: profile.areaLabel || "",
      yearBuilt: profile.yearBuilt || "",
      acreage: profile.acreage || "",
    },
    // What's live right now — open work with where it stands.
    openWorkOrders: workOrders.filter(isOpenOrder).map((w) => ({
      title: w.title,
      lane: w.lane || "triage",
      contractor: w.contractorName || "",
      scheduledFor: w.scheduledFor || "",
    })),
    highPriorities: priorities
      .filter((p) => isOpenPriority(p) && p.urgency === "high")
      .map((p) => p.title),
    // This month's care rhythm, minus what's already done this year.
    careThisMonth: calendar
      .filter((t) => t.month === month && t.doneYear !== year)
      .map((t) => t.task),
    // Recurring checks due inside ~30 days, overdue included.
    checksDue: systems
      .filter((s) => s.nextDue && s.nextDue <= monthOut)
      .map((s) => ({
        system: s.category,
        due: s.nextDue,
        overdue: s.nextDue <= todayIso,
      })),
    // The consumables ledger: what to buy before the next change.
    filters: supplies.map((s) => ({
      item: supplyLabel(s),
      location: s.location || "",
      takes: s.count || 1,
      onHand: s.stock ?? 0,
      low: (s.stock ?? 0) < (s.count || 1),
      nextDue: new Date(Math.max(nextDueMs(s, now), now.getTime()))
        .toISOString()
        .slice(0, 10),
    })),
    // Care given lately — completed work, newest first, last 30 days.
    recentJobs: jobs
      .filter((j) => (j.status || "completed") === "completed" && now.getTime() - when(j.date) <= 30 * 86_400_000 && when(j.date) > 0)
      .sort((a, b) => when(b.date) - when(a.date))
      .map((j) => ({ title: j.title, date: j.date || "", by: j.sub || "" })),
  }
}

module.exports = { homeSummary }
