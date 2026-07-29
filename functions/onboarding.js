// New-home onboarding automation: the back-end processes that kick off by
// themselves once a property exists, so home #2, #3, #20 climbs the
// learning curve without anyone hand-building it (founder spec, 7/28).
//
// Three self-filling pieces, all idempotent:
//   1. A starter care calendar — the seasonal baseline every home in this
//      climate needs, written once when the calendar is empty.
//   2. Hazard facts — FEMA flood zone (live lookup) and EPA radon zone
//      (county designation), written once as fixed-id facts.
//   3. Registry-aware care — when the record learns the home has a well,
//      the annual water test joins the calendar by itself.
//
// Pure helpers here; the scheduled sweep in index.js owns Firestore.

// The seasonal baseline for a central-Virginia home. Deliberately generic:
// the walkthrough and record refine it; this makes day one useful.
const STARTER_CALENDAR = [
  { month: "January", task: "Test smoke & CO detectors; replace batteries as needed" },
  { month: "February", task: "Check water heater for leaks/corrosion; note age" },
  { month: "March", task: "Spring gutter & downspout check after winter" },
  { month: "April", task: "HVAC cooling service before the season" },
  { month: "May", task: "Clear vegetation from AC condenser; check irrigation" },
  { month: "June", task: "Inspect deck/porch and exterior caulking" },
  { month: "July", task: "Replace HVAC filter; check condensate line" },
  { month: "August", task: "Walk the roofline & attic — look for leaks and pests" },
  { month: "September", task: "HVAC heating service before the season" },
  { month: "October", task: "Gutter cleaning after leaf drop; check grading" },
  { month: "November", task: "Disconnect hoses; winterize outside faucets" },
  { month: "December", task: "Dryer vent cleaning; check for drafts" },
]

// EPA radon Zone 1 counties we serve (Virginia Piedmont/Blue Ridge). ZIP
// prefixes keep this conservative — outside the list, no radon fact.
const RADON_ZONE1_ZIP_PREFIXES = ["229", "228", "245", "246", "244", "240", "241"]

function radonZoneFact(profile = {}) {
  const zip = (profile.areaLabel || "").match(/\b(\d{5})\b/)?.[1] || ""
  if (!RADON_ZONE1_ZIP_PREFIXES.some((p) => zip.startsWith(p))) return null
  return {
    id: "enrich-radonzone",
    text: "EPA Radon Zone 1 county (highest predicted indoor radon potential) — periodic radon awareness worthwhile. Source: EPA Map of Radon Zones.",
    category: "Air Quality",
  }
}

// FEMA NFHL flood zone at a point; fetch-injected for tests. Returns a
// fact or null (lookup failure = try again on the next sweep, never block).
async function floodZoneFact(lat, lon, fetchImpl = fetch) {
  try {
    const geom = encodeURIComponent(
      JSON.stringify({ x: Number(lon), y: Number(lat), spatialReference: { wkid: 4326 } })
    )
    const res = await fetchImpl(
      `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${geom}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json`
    )
    if (!res.ok) return null
    const data = await res.json()
    const a = (data.features || [])[0]?.attributes
    if (!a?.FLD_ZONE) return null
    const minimal = /X/.test(a.FLD_ZONE) && /MINIMAL/i.test(a.ZONE_SUBTY || "")
    return {
      id: "enrich-floodzone",
      text: `FEMA flood zone ${a.FLD_ZONE}${a.ZONE_SUBTY ? ` — ${a.ZONE_SUBTY.toLowerCase()}` : ""}${minimal ? " (no flood insurance requirement)" : ""}. Source: FEMA NFHL, area lookup.`,
      category: "Site & Hazards",
    }
  } catch {
    return null
  }
}

// Registry-aware care: private well → annual water test (VDH guidance).
// Returns the task to add, or null if the calendar already carries one.
function wellTestTask(systems = [], calendar = []) {
  const hasWell = systems.some((s) => /well|pressure tank/i.test(`${s.category} ${s.detail || ""}`))
  if (!hasWell) return null
  const covered = calendar.some((t) => /water test|well test/i.test(t.task || ""))
  if (covered) return null
  return {
    month: "May",
    task: "Annual well water test (bacteria, nitrates) — VDH recommends yearly for private wells",
  }
}

module.exports = { STARTER_CALENDAR, radonZoneFact, floodZoneFact, wellTestTask }
