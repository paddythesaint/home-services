// Requirements intelligence: for a named task, what's typically still
// missing to close it out? Curated playbooks pattern-matched against the
// priority's text — the same encoded-domain-knowledge move as
// benchmarks.js, applied to the resolution pipeline. Suggestions are
// one-click adds in the UI, never auto-inserted, and each carries a
// dedupeKey so anything the record already tracks isn't re-suggested.

const PLAYBOOKS = [
  {
    match: /filter/i,
    materials: [
      {
        item: "Replacement filter",
        spec: "size is printed on the old filter's rim (e.g. 16x25x1, MERV 8–13)",
        dedupeKey: "filter",
      },
    ],
    info: [
      { ask: "Filter size (printed on the rim of the current filter)?", type: "fact", dedupeKey: "size" },
    ],
  },
  {
    match: /gutter/i,
    info: [
      { ask: "Linear footage of the gutter run?", type: "measurement", dedupeKey: "footage" },
      { ask: "Photo of the roofline / problem section", type: "photo", dedupeKey: "photo" },
    ],
  },
  {
    match: /caulk|seal(ant|ing)?\b|grout/i,
    materials: [
      { item: "Silicone caulk", spec: "kitchen/bath rated — match existing color", dedupeKey: "caulk" },
    ],
    info: [{ ask: "Color/finish to match?", type: "fact", dedupeKey: "color" }],
  },
  {
    match: /water heater|anode/i,
    materials: [
      { item: "Anode rod", spec: "match length/thread to the model on the nameplate", dedupeKey: "anode" },
    ],
    info: [
      { ask: "Tank capacity and fuel type (from the nameplate)?", type: "fact", dedupeKey: "capacity" },
    ],
  },
  {
    match: /leak|drip|faucet|toilet/i,
    info: [
      { ask: "Photo of the leak / fixture", type: "photo", dedupeKey: "photo" },
      { ask: "Which room and fixture exactly?", type: "fact", dedupeKey: "which room" },
    ],
  },
  {
    match: /paint|touch.?up/i,
    materials: [
      { item: "Paint + supplies", spec: "quart vs gallon depends on area", dedupeKey: "paint" },
    ],
    info: [
      { ask: "Paint color code, or a photo of the leftover can?", type: "fact", dedupeKey: "color" },
    ],
  },
  {
    // \b keeps "roofline" (usually gutter work) from triggering this one.
    match: /\broof\b|shingle/i,
    info: [
      { ask: "Photo of the affected roof area (from the ground is fine)", type: "photo", dedupeKey: "photo" },
      { ask: "Roughly how many shingles/tabs are affected?", type: "fact", dedupeKey: "how many" },
    ],
  },
  {
    match: /window|door\b|screen/i,
    info: [
      { ask: "Width × height measurement of the unit?", type: "measurement", dedupeKey: "width" },
      { ask: "Photo of the unit and any manufacturer labels", type: "photo", dedupeKey: "photo" },
    ],
  },
  {
    match: /electric|outlet|switch|breaker|light fixture/i,
    info: [
      { ask: "Photo of the fixture and the panel directory", type: "photo", dedupeKey: "photo" },
      { ask: "Which breaker/circuit, if labeled?", type: "fact", dedupeKey: "breaker" },
    ],
  },
  {
    match: /fence|deck|board|railing/i,
    materials: [
      { item: "Matching lumber & fasteners", spec: "confirm dimensions/species from photo", dedupeKey: "lumber" },
    ],
    info: [
      { ask: "Linear feet or number of boards affected?", type: "measurement", dedupeKey: "feet" },
    ],
  },
  {
    match: /radon/i,
    info: [
      { ask: "Latest radon reading, and where it was measured?", type: "fact", dedupeKey: "reading" },
    ],
  },
  {
    match: /sump|well pump|pump\b/i,
    info: [
      { ask: "Pump model/horsepower (label on the unit)?", type: "fact", dedupeKey: "model" },
      { ask: "Photo of the pit / unit", type: "photo", dedupeKey: "photo" },
    ],
  },
  {
    match: /dishwasher|washer|dryer|fridge|refrigerator|oven|stove|range\b|appliance/i,
    info: [
      { ask: "Photo of the model/serial plate", type: "photo", dedupeKey: "model" },
      { ask: "What's the symptom, and when does it happen?", type: "fact", dedupeKey: "symptom" },
    ],
  },
]

// Anything already tracked (or already suggested) isn't offered again.
const norm = (s) => (s || "").trim().toLowerCase()
const covered = (existingTexts, dedupeKey) =>
  existingTexts.some((t) => t.includes(norm(dedupeKey)))

const MAX_SUGGESTIONS = 4

export function suggestRequirements(priority) {
  const hay = `${priority.title || ""} ${priority.category || ""} ${priority.reason || ""}`
  const existingMaterials = (priority.materialsNeeded || []).map((m) => norm(`${m.item} ${m.spec}`))
  const existingInfo = (priority.infoNeeded || []).map((i) => norm(i.ask))

  const materials = []
  const info = []
  const seen = new Set()

  for (const play of PLAYBOOKS) {
    if (!play.match.test(hay)) continue
    for (const m of play.materials || []) {
      if (seen.has(`m:${m.dedupeKey}`) || covered(existingMaterials, m.dedupeKey)) continue
      seen.add(`m:${m.dedupeKey}`)
      materials.push(m)
    }
    for (const i of play.info || []) {
      if (seen.has(`i:${i.dedupeKey}`) || covered(existingInfo, i.dedupeKey)) continue
      seen.add(`i:${i.dedupeKey}`)
      info.push(i)
    }
  }

  // Keep it useful, not noisy.
  let budget = MAX_SUGGESTIONS
  const cappedMaterials = materials.slice(0, budget)
  budget -= cappedMaterials.length
  const cappedInfo = info.slice(0, Math.max(0, budget))

  return { materials: cappedMaterials, info: cappedInfo }
}
