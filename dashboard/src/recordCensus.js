// The live-record census (Phase 0 of the grounded roadmap): score the
// actual registry, asset by asset, on the fields downstream intelligence
// depends on; diff it against what a complete profile of THIS class of
// home should contain; and report which proposed features have fuel in
// the tank today. Pure functions — the founder-only Census page feeds it
// the live collections, tests feed it fixtures.

import { overlap } from "./recordAudit"

// What a ~5-acre rural Virginia property with well/septic/propane/
// generator/workshop should have on its registry. `match` runs against
// category + detail + brand; `capture` is the cheapest zero-typing way to
// fill the gap, feeding the guided fill session.
export const EXPECTED_RURAL_HOME = [
  { label: "Well pump", match: /well pump|water pump|submersible/i, capture: "nameplate photo" },
  { label: "Well pressure tank", match: /pressure tank/i, capture: "nameplate photo" },
  { label: "Water treatment / softener", match: /soften|neutraliz|water treatment|filtration/i, capture: "nameplate photo" },
  { label: "Septic system", match: /septic|drainfield/i, capture: "walkthrough question" },
  { label: "Propane tank(s)", match: /propane/i, capture: "walkthrough question" },
  { label: "Standby generator", match: /generator/i, capture: "nameplate photo" },
  { label: "HVAC zones", match: /hvac|heat pump|furnace|air handler|mini.?split|central a\/?c/i, capture: "nameplate photo per zone" },
  { label: "Water heater(s)", match: /water heater/i, capture: "nameplate photo each" },
  { label: "Electrical panel", match: /electrical panel|breaker panel|load center|electrical service/i, capture: "nameplate photo" },
  { label: "Workshop / outbuilding", match: /workshop|outbuilding|barn|shed/i, capture: "walkthrough question" },
  { label: "Sump pump", match: /sump/i, capture: "nameplate photo" },
  { label: "Radon mitigation", match: /radon/i, capture: "walkthrough question" },
  { label: "Bath exhaust fans", match: /exhaust fan|bath fan|ventilation fan|extractor/i, capture: "walkthrough question" },
  { label: "Roof", match: /roof|shingle/i, capture: "walkthrough question" },
  { label: "Gutters", match: /gutter/i, capture: "walkthrough question" },
  { label: "Washer", match: /\bwasher\b|washing machine/i, capture: "nameplate photo" },
  { label: "Dryer", match: /\bdryer\b/i, capture: "nameplate photo" },
  { label: "Refrigerator", match: /refrigerator|fridge/i, capture: "nameplate photo" },
  { label: "Dishwasher", match: /dishwasher/i, capture: "nameplate photo" },
  { label: "Range / oven", match: /\brange\b|\boven\b|cooktop|stove/i, capture: "nameplate photo" },
]

const assetText = (s) => `${s.category || ""} ${s.detail || ""} ${s.brand || ""}`

const SERIAL_RE = /\b(serial|s\/n|sn[#:\s])/i

// Field-by-field completeness, weighted by what downstream features
// actually consume. Returns { score: 0-100, missing: [labels] }.
export function assetCompleteness(system, { jobs = [], warranties = [], facts = [], photos = [] } = {}) {
  const checks = [
    { label: "make/model", weight: 20, ok: Boolean(system.brand || system.detail) },
    { label: "install year", weight: 20, ok: Boolean(system.installYear) },
    { label: "verified condition", weight: 15, ok: Boolean(system.condition) && Boolean(system.verified) },
    { label: "location", weight: 10, ok: Boolean(system.location) },
    {
      label: "serial",
      weight: 10,
      ok:
        SERIAL_RE.test(`${system.detail || ""} ${system.note || ""}`) ||
        facts.some((f) => !f.archived && SERIAL_RE.test(f.text || "") && overlap(f.text, system.category) >= 0.4),
    },
    {
      label: "warranty link",
      weight: 10,
      ok: warranties.some((w) => overlap(`${w.item || ""} ${w.provider || ""} ${w.category || ""}`, assetText(system)) >= 0.4),
    },
    {
      label: "service history",
      weight: 10,
      ok: jobs.some(
        (j) => (j.category && j.category === system.category) || overlap(j.title, system.category) >= 0.6
      ),
    },
    { label: "photo", weight: 5, ok: photos.some((p) => p.systemId === system.id) },
  ]
  const score = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0)
  return { score, missing: checks.filter((c) => !c.ok).map((c) => c.label) }
}

// Which expected systems the registry doesn't know exist at all.
export function missingSystems(systems = []) {
  return EXPECTED_RURAL_HOME.filter((e) => !systems.some((s) => e.match.test(assetText(s))))
}

// The feature-fuel table: for each roadmap candidate, is its trigger data
// in the tank today? Pure counts — the roadmap document interprets them.
export function featureFuel({ systems = [], jobs = [], warranties = [], facts = [], careCalendar = [] } = {}) {
  const liveFacts = facts.filter((f) => !f.archived)
  const majors = systems.filter((s) =>
    /hvac|heat|water heater|well|generator|roof|septic|pump/i.test(assetText(s))
  )
  const appliances = EXPECTED_RURAL_HOME.slice(15) // washer…range
  return [
    {
      feature: "Capital-event triggers",
      needs: "install years on life-limited systems",
      have: `${majors.filter((s) => s.installYear).length}/${majors.length} major systems dated`,
      ready: majors.length > 0 && majors.filter((s) => s.installYear).length / Math.max(majors.length, 1) >= 0.5,
    },
    {
      feature: "Weekly brief",
      needs: "any due-dates: care tasks, verification cadence, warranty expiries",
      have: `${careCalendar.length} calendar tasks · ${systems.filter((s) => s.nextDue).length} cadenced systems · ${warranties.length} warranties`,
      ready: careCalendar.length + systems.filter((s) => s.nextDue).length + warranties.length > 0,
    },
    {
      feature: "Emergency Card",
      needs: "shutoff locations & emergency procedures",
      have: `${liveFacts.filter((f) => /shut.?off|main valve|breaker/i.test(f.text || "")).length} shutoff facts on record`,
      ready: false, // captured only by the dedicated walkthrough — expected empty
    },
    {
      feature: "Repair-vs-replace doctrine (appliances)",
      needs: "appliances present in the registry",
      have: `${appliances.filter((e) => systems.some((s) => e.match.test(assetText(s)))).length}/${appliances.length} appliance classes registered`,
      ready: appliances.some((e) => systems.some((s) => e.match.test(assetText(s)))),
    },
    {
      feature: "Recall matching",
      needs: "brand + model per asset",
      have: `${systems.filter((s) => s.brand && s.detail).length}/${systems.length} assets carry brand+model`,
      ready: systems.filter((s) => s.brand && s.detail).length > 0,
    },
    {
      feature: "Vendor designation with receipts",
      needs: "jobs linked to contractors",
      have: `${jobs.filter((j) => j.contractorId).length}/${jobs.length} jobs contractor-linked`,
      ready: jobs.some((j) => j.contractorId),
    },
  ]
}

// The paste-back block: everything the roadmap needs to ground its
// data-readiness scores, as compact text.
export function censusSummary(record) {
  const { systems = [] } = record
  const scored = systems.map((s) => ({ s, ...assetCompleteness(s, record) }))
  const avg = scored.length
    ? Math.round(scored.reduce((t, x) => t + x.score, 0) / scored.length)
    : 0
  const lines = [
    `CENSUS ${new Date().toISOString().slice(0, 10)} — ${systems.length} assets, avg completeness ${avg}/100`,
    ...scored
      .sort((a, b) => a.score - b.score)
      .map((x) => `- ${x.s.category}: ${x.score} (missing: ${x.missing.join(", ") || "nothing"})`),
    `MISSING FROM REGISTRY: ${missingSystems(systems).map((m) => m.label).join(", ") || "none"}`,
    "FUEL:",
    ...featureFuel(record).map((f) => `- ${f.feature}: ${f.have} → ${f.ready ? "READY" : "NOT READY"}`),
  ]
  return lines.join("\n")
}
