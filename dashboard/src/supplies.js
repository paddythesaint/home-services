// Filter inventory (7/31): the home's consumables ledger — what it takes
// (sizes and how many), what's on hand, and the replacement rhythm. Three
// questions, one record: how many do I need, how many do I have, and when
// do they get changed. Air filters first, water filters alongside; the
// same shape can carry other consumables later.
//
// Nothing is stored on the calendar: due dates derive from
// lastReplacedMs + intervalMonths, so marking a replacement slides the
// schedule forward by itself.

export const AIR_SIZES = [
  "16x20x1",
  "16x25x1",
  "20x20x1",
  "20x25x1",
  "14x30x1",
  "16x25x4",
  "20x25x4",
  "20x25x5",
]

export const WATER_TYPES = [
  "Refrigerator filter",
  "Under-sink filter",
  "Whole-house sediment",
  "Whole-house carbon",
  "RO membrane",
  "UV lamp",
]

// Smart defaults per kind — each line can override.
export const DEFAULT_INTERVAL = { air: 3, water: 6 }

export const supplyLabel = (s) =>
  s.kind === "air" ? `${s.size} air filter` : s.size || "Water filter"

const monthsAfter = (ms, n) => {
  const d = new Date(ms)
  d.setMonth(d.getMonth() + n)
  return d.getTime()
}

export const intervalFor = (s) =>
  Number(s.intervalMonths) || DEFAULT_INTERVAL[s.kind] || 3

// Next change: measured from the last replacement; a line that has never
// been replaced measures from when it was added to the record.
export function nextDueMs(s, now = new Date()) {
  const base = s.lastReplacedMs || s.createdOnMs || now.getTime()
  return monthsAfter(base, intervalFor(s))
}

export const isDue = (s, now = new Date()) => nextDueMs(s, now) <= now.getTime()

export const dueNow = (supplies = [], now = new Date()) =>
  supplies.filter((s) => isDue(s, now))

// Not enough on hand to cover one full replacement.
export function lowStock(supplies = []) {
  return supplies
    .filter((s) => (s.stock ?? 0) < (s.count || 1))
    .map((s) => ({ ...s, shortBy: (s.count || 1) - (s.stock ?? 0) }))
}

export const restockLine = (s) =>
  `Restock ${supplyLabel(s)} — need ${s.count || 1}, have ${s.stock ?? 0}`

// "20x25x1 ×4 · Refrigerator filter ×1" — the combined task text.
export const replacementSummary = (lines = []) =>
  lines.map((s) => `${supplyLabel(s)} ×${s.count || 1}`).join(" · ")

// Upcoming replacements bucketed by calendar month index (0-11) over the
// next 12 months — the care calendar renders these as derived rows. Each
// line appears once, at its next due month (past-due lines land on the
// current month).
export function upcomingByMonth(supplies = [], now = new Date()) {
  const byMonth = new Map()
  for (const s of supplies) {
    const due = new Date(Math.max(nextDueMs(s, now), now.getTime()))
    const m = due.getMonth()
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m).push(s)
  }
  return byMonth
}
