// The 3-year cost outlook, computed from the record: systems whose typical
// replacement window opens (or is already open) within the horizon, plus
// open priorities that carry a cost estimate. Planning ranges, not quotes.

import { replacementHorizon } from "./benchmarks"
import { isOpenPriority } from "./resolution"

// "$1,800", "$150 – $350", "~$687/yr" → [lo, hi] in dollars, or null.
export function parseCostRange(text) {
  const nums = String(text || "")
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g)
  if (!nums || nums.length === 0) return null
  const values = nums.map(Number).filter((n) => n > 0)
  if (values.length === 0) return null
  return [Math.min(...values), Math.max(...values)]
}

const addRange = (a, b) => [a[0] + b[0], a[1] + b[1]]

export function buildForecast(systems, priorities, nowYear = new Date().getFullYear()) {
  const horizonYears = [nowYear, nowYear + 1, nowYear + 2]
  const years = horizonYears.map((year) => ({ year, items: [] }))

  for (const s of systems) {
    const h = replacementHorizon(s, nowYear)
    if (!h) continue
    // Already in (or past) the window → budget it this year; window opening
    // within the horizon → budget it in its opening year.
    let bucketYear = null
    if (h.status === "in-window" || h.status === "past") bucketYear = nowYear
    else if (h.windowStart <= nowYear + 2) bucketYear = h.windowStart
    if (bucketYear === null) continue
    years[bucketYear - nowYear].items.push({
      kind: "replacement",
      label: `${s.category} — replacement window ${h.status === "past" ? "passed" : "opens"} (${h.windowStart}–${h.windowEnd})`,
      sub: `${h.benchmark.label} · installed ${s.installYear} · typical life ${h.benchmark.lifeYears[0]}–${h.benchmark.lifeYears[1]} yrs`,
      cost: h.benchmark.replaceCost,
      costUnit: h.benchmark.costUnit,
      systemId: s.id,
      status: h.status,
    })
  }

  for (const p of priorities.filter(isOpenPriority)) {
    const cost = parseCostRange(p.estCost)
    if (!cost) continue
    years[0].items.push({
      kind: "priority",
      label: p.title,
      sub: `Open priority · ${p.estCost}`,
      cost,
      priorityId: p.id,
    })
  }

  for (const y of years) {
    // Per-unit costs (e.g. windows) can't be totaled without a count — they
    // display on the line but stay out of the sums.
    y.total = y.items
      .filter((i) => !i.costUnit)
      .reduce((acc, i) => addRange(acc, i.cost), [0, 0])
  }
  const grand = years.reduce((acc, y) => addRange(acc, y.total), [0, 0])

  return { years, grand }
}
