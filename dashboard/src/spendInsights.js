// Spend intelligence: the backward-looking companion to the cost forecast.
// Job History records what was done and what it cost; this layer reads that
// as a story — what the household has invested in the home, where it went,
// and when — and rolls it into an annual "state of your home" summary.
// Home-agnostic; pure functions over the jobHistory + healthReport records.

import { groupByTrade, tradeForItem } from "./trades"
import { byMonth, jobTime } from "./jobHistoryView"
import { canonicalName } from "./contractorMatching"

// First money-like number in a free-text cost ("$225", "$1,450",
// "$150 – $350" → 150). Returns 0 when there's nothing to read, so a job
// with no logged cost simply doesn't move the totals.
export function parseCost(str) {
  const m = String(str ?? "").match(/\d[\d,]*(\.\d+)?/)
  if (!m) return 0
  const n = Number(m[0].replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function totalSpend(jobs) {
  return jobs.reduce((sum, j) => sum + parseCost(j.cost), 0)
}

// Money formatting shared by the report — whole dollars, grouped.
export function fmtDollars(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

// Only completed jobs in a given calendar year (from the real activity
// date). Year defaults to the current year. Undated jobs are excluded from
// year scoping so the annual report stays honest.
export function jobsInYear(jobs, year = new Date().getFullYear()) {
  return jobs.filter((j) => {
    if ((j.status || "completed") !== "completed") return false
    const t = jobTime(j)
    return !Number.isNaN(t) && new Date(t).getFullYear() === year
  })
}

// Spend grouped by trade, largest first, each with its share of the total.
export function spendByTrade(jobs) {
  const total = totalSpend(jobs)
  return groupByTrade(jobs)
    .map(({ trade, items }) => {
      const amount = totalSpend(items)
      return {
        key: trade.key,
        label: trade.label,
        amount,
        count: items.length,
        share: total > 0 ? amount / total : 0,
      }
    })
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

// Spend per month (newest first), reusing the Job History month buckets so
// the timeline lines up with what the history page shows. Undated jobs are
// dropped from the monthly view.
export function spendByMonth(jobs) {
  return byMonth(jobs)
    .filter((m) => m.key !== "undated")
    .map((m) => ({ key: m.key, label: m.label, amount: totalSpend(m.jobs), count: m.jobs.length }))
}

// Spend per contractor/vendor, largest first — who the investment actually
// went to. Groups by canonical name so the same vendor written two ways
// ("Monticello Air" and "Monticello Air — (434) 246-7111") counts once, and
// displays the cleanest (shortest) variant seen.
export function spendByContractor(jobs) {
  const buckets = new Map()
  for (const j of jobs) {
    const raw = (j.sub || "").trim()
    if (!raw || raw === "—") continue
    const key = canonicalName(raw) || raw.toLowerCase()
    const amount = parseCost(j.cost)
    const cur = buckets.get(key) || { name: raw, amount: 0, count: 0 }
    if (raw.length < cur.name.length) cur.name = raw // prefer the cleanest label
    cur.amount += amount
    cur.count += 1
    buckets.set(key, cur)
  }
  return [...buckets.values()].sort((a, b) => b.amount - a.amount)
}

// The annual report: everything the "state of your home" view needs in one
// pass, scoped to a year.
export function annualReport(jobs, systems = [], year = new Date().getFullYear()) {
  const yearly = jobsInYear(jobs, year)
  const byTrade = spendByTrade(yearly)
  return {
    year,
    total: totalSpend(yearly),
    jobCount: yearly.length,
    byTrade,
    byMonth: spendByMonth(yearly),
    byContractor: spendByContractor(yearly),
    topTrade: byTrade[0] || null,
    systemsTracked: systems.length,
    systemsVerified: systems.filter((s) => s.verified).length,
  }
}
