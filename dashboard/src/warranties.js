// The coverage ledger: warranties, extended plans, home-warranty policies,
// and service contracts — each with an expiry the household would otherwise
// only discover at the worst possible moment (the compressor dies the month
// after the plan lapsed). The knowledge here is date math + status; the
// records live per-property in the `warranties` collection. Home-agnostic.

// The kinds of coverage a home carries, most-specific first.
export const COVERAGE_TYPES = ["manufacturer", "extended", "home-warranty", "service-contract"]
export const COVERAGE_LABEL = {
  manufacturer: "Manufacturer warranty",
  extended: "Extended warranty",
  "home-warranty": "Home warranty",
  "service-contract": "Service contract",
}

// Coverage inside this many days of expiry is "expiring soon" — near enough
// to act on (renew, use it, or plan the replacement) before it lapses.
export const EXPIRING_WINDOW = 60

// Whole days from now until an ISO/parseable date. Null when unparseable.
export function daysUntil(dateStr, now = new Date()) {
  const t = Date.parse(dateStr || "")
  if (Number.isNaN(t)) return null
  // Compare calendar days, not exact ms, so "today" reads as 0.
  const end = new Date(t)
  const a = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86_400_000)
}

// active | expiring | expired | unknown (no / unreadable end date).
export function coverageStatus(w, now = new Date()) {
  const d = daysUntil(w?.expiry, now)
  if (d === null) return "unknown"
  if (d < 0) return "expired"
  if (d <= EXPIRING_WINDOW) return "expiring"
  return "active"
}

export const STATUS_META = {
  active: { label: "Active", tone: "good" },
  expiring: { label: "Expiring soon", tone: "warn" },
  expired: { label: "Expired", tone: "critical" },
  unknown: { label: "No end date", tone: "muted" },
}

// A short human countdown for a coverage row.
export function expiryLine(w, now = new Date()) {
  const d = daysUntil(w?.expiry, now)
  if (d === null) return "No end date on file"
  if (d < 0) return `Lapsed ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`
  if (d === 0) return "Expires today"
  if (d <= EXPIRING_WINDOW) return `Expires in ${d} day${d === 1 ? "" : "s"}`
  return "Active"
}

// Coverage that needs attention (expiring or already lapsed), soonest first
// — the alert feed for the page banner and any cross-page rollup.
export function coverageAlerts(list, now = new Date()) {
  return list
    .filter((w) => ["expiring", "expired"].includes(coverageStatus(w, now)))
    .sort((a, b) => (daysUntil(a.expiry, now) ?? Infinity) - (daysUntil(b.expiry, now) ?? Infinity))
}

// Ledger order: the things closest to (or past) expiry first, then active
// coverage by soonest expiry, then anything undated. Insert order breaks ties.
export function byExpiry(list, now = new Date()) {
  const rank = { expired: 0, expiring: 1, active: 2, unknown: 3 }
  return [...list].sort((a, b) => {
    const sa = coverageStatus(a, now)
    const sb = coverageStatus(b, now)
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb]
    const da = daysUntil(a.expiry, now)
    const db = daysUntil(b.expiry, now)
    if (da === null && db === null) return (a.order || 0) - (b.order || 0)
    if (da === null) return 1
    if (db === null) return -1
    return da - db
  })
}
