// Shaping for the Job History views. The record's `date` is the real
// activity date (a free-text label like "June 12, 2026" or "Fall 2025"),
// distinct from the `order` field, which is only the database insert time.
// The old "by date" view sorted by insert order — so imported/backfilled
// jobs landed out of sequence. These helpers sort by the actual activity
// date and bucket it into a month timeline.

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
]

// Best-effort timestamp from a loose date label. Exact dates parse
// directly; imprecise ones ("Fall 2025", "Early April 2026", "2025–2026")
// fall back to the first month name + year found, else Jan of the year.
export function jobTime(job) {
  const s = (job?.date || "").trim()
  if (!s) return NaN
  const direct = Date.parse(s)
  if (!Number.isNaN(direct)) return direct
  const year = s.match(/\b(19|20)\d{2}\b/)?.[0]
  if (!year) return NaN
  const mon = MONTHS.findIndex((m) => s.toLowerCase().includes(m))
  return new Date(Number(year), mon >= 0 ? mon : 0, 1).getTime()
}

// Newest activity date first; undated jobs sink to the bottom, insert
// order breaking ties.
export function byDateDesc(jobs) {
  return [...jobs].sort((a, b) => {
    const ta = jobTime(a)
    const tb = jobTime(b)
    const na = Number.isNaN(ta)
    const nb = Number.isNaN(tb)
    if (na && nb) return (b.order || 0) - (a.order || 0)
    if (na) return 1
    if (nb) return -1
    if (tb !== ta) return tb - ta
    return (b.order || 0) - (a.order || 0)
  })
}

// Month buckets for the timeline, newest month first, "Undated" last.
export function byMonth(jobs) {
  const buckets = new Map()
  for (const j of byDateDesc(jobs)) {
    const t = jobTime(j)
    let key, label, sort
    if (Number.isNaN(t)) {
      key = "undated"
      label = "Undated"
      sort = -Infinity
    } else {
      const d = new Date(t)
      key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
      label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      sort = t
    }
    if (!buckets.has(key)) buckets.set(key, { key, label, sort, jobs: [] })
    buckets.get(key).jobs.push(j)
  }
  return [...buckets.values()].sort((a, b) => b.sort - a.sort)
}

// Per-trade rollup for the by-system view: count, total logged cost,
// latest activity date.
export function tradeJobRollup(jobs) {
  const total = jobs.reduce((sum, j) => {
    const n = Number((j.cost || "").replace(/[^0-9.]/g, ""))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const latest = byDateDesc(jobs)[0]
  const parts = [`${jobs.length} job${jobs.length === 1 ? "" : "s"}`]
  if (total > 0) parts.push(`$${total.toLocaleString("en-US")} logged`)
  if (latest?.date) parts.push(`latest ${latest.date}`)
  return parts.join(" · ")
}
