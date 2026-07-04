// Lifespan and replacement-cost benchmarks per system type — the knowledge
// layer that lets the record predict spend instead of just holding facts.
// Ranges are typical US figures consistent with industry references
// (InterNACHI life-expectancy chart, national cost guides); everything is
// presented in the UI as "typical", never as a quote. Order matters: the
// first matching entry wins, so specific patterns come before general ones.

export const SYSTEM_BENCHMARKS = [
  {
    key: "water-heater-tankless",
    match: /tankless/i,
    label: "Tankless water heater",
    lifeYears: [15, 20],
    replaceCost: [2500, 4500],
    note: "Descale annually on hard water.",
  },
  {
    key: "water-heater",
    match: /water heater/i,
    label: "Tank water heater",
    lifeYears: [8, 12],
    replaceCost: [1300, 2500],
    note: "Anode rod check ~every 3 years stretches the high end.",
  },
  {
    key: "heat-pump",
    match: /heat pump|mini.?split/i,
    label: "Heat pump",
    lifeYears: [10, 15],
    replaceCost: [6000, 12000],
  },
  {
    key: "furnace",
    match: /furnace|boiler/i,
    label: "Furnace / boiler",
    lifeYears: [15, 20],
    replaceCost: [4500, 8000],
  },
  {
    key: "central-ac",
    match: /central a\/?c|air condition/i,
    label: "Central AC",
    lifeYears: [12, 17],
    replaceCost: [4500, 8000],
  },
  {
    key: "hvac",
    match: /hvac|forced.?air|heating & cooling|heating and cooling/i,
    label: "HVAC system (combined)",
    lifeYears: [12, 17],
    replaceCost: [7000, 14000],
  },
  {
    key: "roof",
    match: /roof|shingle/i,
    label: "Roof (architectural shingle)",
    lifeYears: [22, 30],
    replaceCost: [12000, 25000],
  },
  {
    key: "well",
    match: /\bwell\b/i,
    label: "Well pump",
    lifeYears: [10, 15],
    replaceCost: [1500, 3000],
    note: "Annual water test regardless of pump age.",
  },
  {
    key: "septic",
    match: /septic|drainfield/i,
    label: "Septic drainfield",
    lifeYears: [25, 35],
    replaceCost: [8000, 20000],
    note: "Pump the tank every 3–5 years ($350–600) — the cheapest insurance in the house.",
  },
  {
    key: "radon",
    match: /radon/i,
    label: "Radon mitigation fan",
    lifeYears: [5, 10],
    replaceCost: [300, 600],
  },
  {
    key: "sump",
    match: /sump/i,
    label: "Sump pump",
    lifeYears: [7, 10],
    replaceCost: [400, 900],
  },
  {
    key: "generator",
    match: /generator/i,
    label: "Standby generator",
    lifeYears: [20, 30],
    replaceCost: [6000, 12000],
    note: "Annual service keeps warranty and readiness.",
  },
  {
    key: "gutters",
    match: /gutter/i,
    label: "Gutters (aluminum)",
    lifeYears: [20, 30],
    replaceCost: [1500, 3500],
  },
  {
    key: "windows",
    match: /window/i,
    label: "Windows",
    lifeYears: [25, 40],
    replaceCost: [500, 1200],
    costUnit: "per window",
  },
  {
    key: "garage-door",
    match: /garage/i,
    label: "Garage door opener",
    lifeYears: [10, 15],
    replaceCost: [350, 700],
  },
  {
    key: "driveway",
    match: /driveway/i,
    label: "Driveway (asphalt)",
    lifeYears: [15, 25],
    replaceCost: [4000, 10000],
    note: "Sealcoat every 2–4 years extends the range.",
  },
  {
    key: "water-treatment",
    match: /softener|water treatment/i,
    label: "Water softener / treatment",
    lifeYears: [10, 15],
    replaceCost: [1500, 3000],
  },
  {
    key: "electrical-panel",
    match: /electrical|panel/i,
    label: "Electrical panel",
    lifeYears: [25, 40],
    replaceCost: [2000, 4000],
  },
]

export function benchmarkFor(system) {
  const hay = `${system.category || ""} ${system.detail || ""}`
  return SYSTEM_BENCHMARKS.find((b) => b.match.test(hay)) || null
}

export const fmtMoneyRange = ([lo, hi], unit) => {
  const f = (n) => `$${n.toLocaleString("en-US")}`
  const range = lo === hi ? f(lo) : `${f(lo)}–${f(hi).slice(1)}`
  return unit ? `${range} ${unit}` : range
}

// Where a system sits against its typical life, from installYear.
// status: healthy | approaching (window opens within 3 yrs) |
//         in-window | past (beyond typical life)
export function replacementHorizon(system, nowYear = new Date().getFullYear()) {
  const benchmark = benchmarkFor(system)
  const year = parseInt(system.installYear, 10)
  if (!benchmark || !Number.isFinite(year)) return null
  const [lifeLo, lifeHi] = benchmark.lifeYears
  const windowStart = year + lifeLo
  const windowEnd = year + lifeHi
  const age = nowYear - year
  let status = "healthy"
  if (nowYear > windowEnd) status = "past"
  else if (nowYear >= windowStart) status = "in-window"
  else if (windowStart - nowYear <= 3) status = "approaching"
  return { benchmark, age, windowStart, windowEnd, status }
}
