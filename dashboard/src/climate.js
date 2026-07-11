// Climate inference from a property's location, so the seasonal maintenance
// playbook fits the home's actual weather instead of assuming Charlottesville.
// A home's ZIP (parsed from its record) maps to a coarse US climate region;
// each region shifts the season boundaries and adjusts the checklist — drops
// tasks that don't apply (ice dams in Phoenix) and adds ones that do
// (hurricane prep on the Gulf, defensible space in the wildland West).
//
// The ZIP→region map is deliberately coarse (first-3-digit prefixes) and
// errs toward the mild "temperate" default; it's a sensible starting point a
// home's own record can later refine, not a climatology model.

// Pull a 5-digit ZIP from wherever it lives on the property record.
export function zipFromProfile(profile) {
  const p = profile || {}
  const hay = [p.zip, p.areaLabel, p.address, p.city].filter(Boolean).join(" ")
  const m = hay.match(/\b(\d{5})(?:-\d{4})?\b/)
  return m ? m[1] : ""
}

// Meteorological season boundaries per region, as a month→season array
// (index 0 = January … 11 = December). Warmer regions carry a longer summer
// and a shorter (or vanishing) winter.
const STANDARD = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"]
const LONG_WINTER = ["winter", "winter", "winter", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "winter", "winter"]
const LONG_SUMMER = ["winter", "spring", "spring", "summer", "summer", "summer", "summer", "summer", "summer", "fall", "fall", "winter"]
const MINIMAL_WINTER = ["winter", "spring", "spring", "summer", "summer", "summer", "summer", "summer", "summer", "summer", "fall", "winter"]

// Region definitions. `drop` removes base playbook tasks by id; `add` layers
// on region-specific tasks per season. Base tasks live in
// maintenanceIntelligence.js (universal home care); these are the climate
// deltas.
export const CLIMATE_REGIONS = {
  temperate: {
    id: "temperate",
    label: "Temperate / Mid-Atlantic",
    seasonByMonth: STANDARD,
    drop: [],
    add: {},
  },
  cold: {
    id: "cold",
    label: "Cold / Northern",
    seasonByMonth: LONG_WINTER,
    drop: [],
    add: {
      fall: [
        { id: "co-fa-insulate", label: "Insulate exposed pipes & hose bibs", trade: "Plumbing", note: "Hard freezes come early and stay — get ahead of the first one." },
      ],
      winter: [
        { id: "co-wi-snow", label: "Watch roof snow load after big storms", trade: "Roof & Exterior", note: "Heavy wet snow stresses the structure; rake the lower roof if it piles." },
      ],
    },
  },
  "hot-humid": {
    id: "hot-humid",
    label: "Hot-Humid / Southeast",
    seasonByMonth: LONG_SUMMER,
    drop: ["wi-roof"], // ice dams essentially never happen
    add: {
      summer: [
        { id: "hh-su-storm", label: "Storm & hurricane season prep", trade: "Roof & Exterior", note: "Trim limbs, clear drains, and check that openings seal before peak season." },
        { id: "hh-su-mold", label: "Check for humidity-driven mold", trade: "Safety & Air", note: "The wet heat grows mold fast — watch baths, closets, and the attic." },
      ],
    },
  },
  "hot-dry": {
    id: "hot-dry",
    label: "Hot-Dry / Southwest",
    seasonByMonth: LONG_SUMMER,
    drop: ["sp-gutter", "fa-gutter", "wi-roof"], // little rain, no ice
    add: {
      spring: [
        { id: "hd-sp-defensible", label: "Clear defensible space / brush", trade: "Landscaping", note: "Fire season starts dry — keep vegetation back from the structure." },
        { id: "hd-sp-drip", label: "Check drip irrigation before the heat", trade: "Landscaping", note: "A failed emitter in July costs plants fast in dry heat." },
      ],
    },
  },
  marine: {
    id: "marine",
    label: "Marine / Pacific Northwest",
    seasonByMonth: STANDARD,
    drop: ["wi-roof"], // mild, rarely freezes hard
    add: {
      fall: [
        { id: "ma-fa-moss", label: "Treat roof & walk moss growth", trade: "Roof & Exterior", note: "Persistent damp grows moss that lifts shingles — treat before winter rain." },
      ],
    },
  },
  subtropical: {
    id: "subtropical",
    label: "Subtropical / Gulf & Florida",
    seasonByMonth: MINIMAL_WINTER,
    drop: ["wi-roof", "wi-freeze", "wi-drafts", "fa-flue"], // little heating, no freeze/ice
    add: {
      summer: [
        { id: "st-su-hurricane", label: "Hurricane-season readiness", trade: "Roof & Exterior", note: "Shutters/impact openings, roof tie-downs, and a clear drainage path." },
        { id: "st-su-mold", label: "Manage year-round humidity & mold", trade: "Safety & Air", note: "Ventilation and dehumidification are the main event in this climate." },
      ],
    },
  },
}

// ZIP 3-digit prefix → region. Ranges are approximate and cover the obvious
// cases; everything unmatched falls back to temperate.
const RANGES = [
  [[10, 69], "cold"], // New England
  [[120, 149], "cold"], // Upstate NY
  [[490, 499], "cold"], // Michigan
  [[540, 599], "cold"], // WI, MN, Dakotas, Montana
  [[822, 834], "cold"], // WY, ID (higher elevation)
  [[270, 319], "hot-humid"], // NC, SC, GA (upper)
  [[350, 429], "hot-humid"], // AL, TN, MS, KY (south)
  [[700, 714], "hot-humid"], // Louisiana
  [[770, 789], "hot-humid"], // SE Texas / Gulf coast
  [[320, 349], "subtropical"], // Florida
  [[850, 865], "hot-dry"], // Arizona
  [[870, 884], "hot-dry"], // New Mexico
  [[889, 898], "hot-dry"], // Nevada
  [[900, 935], "hot-dry"], // Southern/inland California
  [[970, 986], "marine"], // Oregon, Washington
  [[936, 961], "marine"], // Northern coastal California
]

export function regionForZip(zip) {
  const p = parseInt(String(zip || "").slice(0, 3), 10)
  if (!Number.isFinite(p)) return "temperate"
  for (const [[lo, hi], region] of RANGES) {
    if (p >= lo && p <= hi) return region
  }
  return "temperate"
}

// The climate region for a property (its object from CLIMATE_REGIONS),
// defaulting to temperate when there's no usable ZIP.
export function climateFor(profile) {
  return CLIMATE_REGIONS[regionForZip(zipFromProfile(profile))] || CLIMATE_REGIONS.temperate
}
