// Proactive maintenance intelligence, in two halves:
//
//   1. A seasonal playbook — the home-agnostic "what a home in this climate
//      wants done this time of year" checklist, so care gets ahead of the
//      season instead of reacting to a failure.
//   2. Recurrence & aging detection — reading Job History for systems that
//      keep coming back (a recurring problem is usually a root cause worth
//      addressing, not re-patching) and whose costs are trending up (a sign
//      the system is aging toward replacement).
//
// Pure functions over the record; seeded from a Mid-Atlantic (Charlottesville)
// climate but written generically.

import { tradeForItem } from "./trades"
import { jobTime } from "./jobHistoryView"
import { parseCost } from "./spendInsights"

// --- Seasonal playbook ---------------------------------------------------

export const SEASONS = ["spring", "summer", "fall", "winter"]
export const SEASON_LABEL = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
}

// Each task carries the trade it belongs to (so it can be raised as a
// priority in the right bucket) and a one-line why.
export const SEASONAL_PLAYBOOK = {
  spring: [
    { id: "sp-ac", label: "Service the AC before the first hot spell", trade: "HVAC", note: "Coil clean + refrigerant check while techs aren't slammed." },
    { id: "sp-gutter", label: "Clear gutters and downspouts", trade: "Roof & Exterior", note: "Spring rain needs somewhere to go — away from the foundation." },
    { id: "sp-filter", label: "Replace HVAC filters", trade: "HVAC", note: "Fresh filter going into the cooling season." },
    { id: "sp-exterior", label: "Walk the exterior & roofline", trade: "Roof & Exterior", note: "Catch winter damage — lifted shingles, caulk gaps, cracked grout." },
    { id: "sp-sump", label: "Test the sump pump", trade: "Plumbing", note: "Before the wet months, not during them." },
  ],
  summer: [
    { id: "su-ac-perf", label: "Check AC performance & drain line", trade: "HVAC", note: "A clogged condensate line is the classic mid-summer failure." },
    { id: "su-pest", label: "Pest & deck/porch inspection", trade: "Safety & Air", note: "Wood-boring insects and rot are most active now." },
    { id: "su-humidity", label: "Watch humidity & ventilation", trade: "Safety & Air", note: "Bath/attic ventilation earns its keep in humid months." },
    { id: "su-irrigation", label: "Check irrigation & outdoor spigots", trade: "Landscaping", note: "Leaks waste water quietly all season." },
  ],
  fall: [
    { id: "fa-heat", label: "Service the heating system", trade: "HVAC", note: "Furnace/heat-pump check before the first cold night." },
    { id: "fa-gutter", label: "Clean gutters after leaf drop", trade: "Roof & Exterior", note: "Second gutter pass once the trees are bare." },
    { id: "fa-flue", label: "Inspect chimney & flue", trade: "Safety & Air", note: "Combustion safety before wood-stove / fireplace season." },
    { id: "fa-winterize", label: "Winterize exterior faucets & irrigation", trade: "Plumbing", note: "Drain and shut off before the first hard freeze." },
    { id: "fa-detectors", label: "Test smoke & CO detectors", trade: "Safety & Air", note: "Heating season is when CO risk is highest." },
  ],
  winter: [
    { id: "wi-freeze", label: "Freeze protection for pipes", trade: "Plumbing", note: "Insulate vulnerable runs; know where the main shutoff is." },
    { id: "wi-drafts", label: "Check insulation & drafts", trade: "Safety & Air", note: "Cheapest efficiency win of the year." },
    { id: "wi-generator", label: "Test the standby generator", trade: "Electrical", note: "Confirm it starts before the storm that needs it." },
    { id: "wi-roof", label: "Watch for ice dams after snow", trade: "Roof & Exterior", note: "Ice dams push water back under the shingles." },
  ],
}

// Which season a date falls in (Northern-hemisphere meteorological seasons).
export function seasonFor(date = new Date()) {
  const m = date.getMonth() // 0-11
  if (m >= 2 && m <= 4) return "spring"
  if (m >= 5 && m <= 7) return "summer"
  if (m >= 8 && m <= 10) return "fall"
  return "winter"
}

// The seasonal plan for a given date: the season and its checklist.
export function seasonalPlan(date = new Date()) {
  const season = seasonFor(date)
  return { season, label: SEASON_LABEL[season], tasks: SEASONAL_PLAYBOOK[season] }
}

// --- Recurrence & aging --------------------------------------------------

const YEAR_MS = 365 * 86_400_000

// Systems/trades that keep coming back. Groups completed jobs by trade over
// a trailing window (default 12 months); any trade with `minCount`+ jobs is
// "recurring". If the cost of the latest job exceeds the earliest, that's an
// "aging" signal (repairs getting pricier). Ranked by frequency.
export function recurrenceInsights(jobs, { now = new Date(), windowMs = YEAR_MS, minCount = 2 } = {}) {
  const recent = jobs.filter((j) => {
    if ((j.status || "completed") !== "completed") return false
    const t = jobTime(j)
    return !Number.isNaN(t) && now.getTime() - t <= windowMs
  })

  const buckets = new Map()
  for (const j of recent) {
    const trade = tradeForItem(j)
    if (!buckets.has(trade.key)) buckets.set(trade.key, { trade, jobs: [] })
    buckets.get(trade.key).jobs.push(j)
  }

  return [...buckets.values()]
    .filter((b) => b.jobs.length >= minCount)
    .map(({ trade, jobs: group }) => {
      const ordered = [...group].sort((a, b) => jobTime(a) - jobTime(b))
      const first = ordered[0]
      const last = ordered[ordered.length - 1]
      const firstCost = parseCost(first.cost)
      const lastCost = parseCost(last.cost)
      const rising = firstCost > 0 && lastCost > firstCost
      let note = `${trade.label} has needed attention ${group.length} times in the last 12 months — a recurring pattern usually points to a root cause worth addressing, not re-patching.`
      if (rising) {
        note += " Repair costs are trending up, too, a sign the system may be aging toward replacement."
      }
      return {
        key: trade.key,
        label: trade.label,
        count: group.length,
        jobs: ordered,
        rising,
        lastDate: last.date || "",
        note,
      }
    })
    .sort((a, b) => b.count - a.count || (b.rising ? 1 : 0) - (a.rising ? 1 : 0))
}
