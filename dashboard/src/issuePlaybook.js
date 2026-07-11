// The issue playbook: home-domain expertise encoded as data, the same
// "knowledge as a module" pattern as benchmarks.js (lifespans/costs) and
// trades.js (taxonomy). A priority list is a set of tasks; this layer
// understands the *conditions* beneath them — what's really going on, what
// it calcifies into if deferred (with rough cost + timeframe per stage),
// and how the fix should be bundled. Home-agnostic; seeded from 895.
//
// Detection here is deterministic keyword matching — cheap, testable, and
// good enough to surface the obvious clusters and duplicates. The AI layer
// (later phase) enriches this with the specific home's record; it does not
// replace it.

import { fmtMoneyRange } from "./benchmarks"

// Order matters: the first entry whose signature matches a priority wins,
// so acute/specific conditions come before general ones.
export const ISSUE_PLAYBOOK = [
  {
    key: "combustion-safety",
    title: "Combustion & air-safety",
    // Burners, flues, gas appliances — not bare "exhaust" (that catches
    // bath fans), only combustion-appliance venting.
    match: /gas leak|burner|\bflue\b|carbon monoxide|combustion|\bstove\b|water heater (?:vent|exhaust|gasket|burner)|furnace exhaust|backdraf/i,
    rootCause:
      "A fuel-burning appliance isn't firing or venting cleanly. In an airtight house this degrades indoor air fast and carries a CO risk.",
    tradeLabel: "HVAC / gas-safety",
    escalation: [
      { stage: "Efficiency loss & minor fumes", when: "now", cost: [150, 400] },
      { stage: "Carbon-monoxide exposure risk", when: "weeks–months", cost: [400, 1500] },
      { stage: "Health incident / emergency replacement", when: "unpredictable", cost: [3000, 8000] },
    ],
    bundle: {
      title: "Combustion-safety service visit",
      resolution:
        "One gas-safety visit to service the burners, tighten/replace exhaust gaskets, verify draft on every fuel appliance, and repair or decommission the flagged stove — closed together, not one ticket at a time.",
    },
  },
  {
    key: "ventilation",
    title: "Moisture ventilation",
    // Ventilation-specific only — bare "moisture"/"damp" collide with the
    // drainage/water-management bucket, so they're intentionally left out.
    match: /\bmold\b|mildew|bath(?:room)? fan|exhaust fan|\bventilat|\bcfm\b|humidit|condensation/i,
    rootCause:
      "Moist air isn't being cleared — undersized, failed, or mis-ducted exhaust fans let humidity linger, which is what grows the mold.",
    tradeLabel: "HVAC / ventilation",
    escalation: [
      { stage: "Surface mold & staining", when: "now", cost: [150, 400] },
      { stage: "Recurring mold + drywall/trim damage", when: "6–12 months", cost: [1200, 2500] },
      { stage: "Framing rot & air-quality remediation", when: "2+ years", cost: [5000, 12000] },
    ],
    bundle: {
      title: "Whole-home moisture ventilation project",
      resolution:
        "Upsize/replace the bath exhaust fans, confirm every duct actually vents to the exterior (not the attic), remediate the existing mold, and add a humidity sensor so it self-monitors — one coordinated project.",
    },
  },
  {
    key: "water-management",
    title: "Exterior water management",
    match: /drainage|regrad|\bgrading\b|downspout|gutter|sump|standing water|pooling|retaining wall|foundation (?:water|moisture|damp)|basement (?:water|moisture|damp|seep)/i,
    rootCause:
      "Water isn't being carried away from the house — clogged/short gutters, low grading, or a failing drain lets it collect against the foundation.",
    tradeLabel: "Landscaping / exterior",
    escalation: [
      { stage: "Pooling & saturated soil at foundation", when: "now", cost: [200, 900] },
      { stage: "Basement moisture, efflorescence, mold", when: "1–2 years", cost: [1500, 4000] },
      { stage: "Foundation movement / structural repair", when: "3+ years", cost: [8000, 25000] },
    ],
    bundle: {
      title: "Foundation water-management project",
      resolution:
        "Handle it as one grade-and-drainage pass: clear/extend gutters and downspouts 5–6 ft out, regrade the low spots to fall away from the house, and address the retaining-wall drainage together.",
    },
  },
  {
    key: "roof-envelope",
    title: "Roof & envelope",
    match: /\broof|shingle|flashing|soffit|fascia|chimney (?:cap|crown|flashing)|ice dam/i,
    rootCause:
      "The roof or its flashings are letting the envelope down — small breaches that admit water at the most expensive place to admit it.",
    tradeLabel: "Roofing",
    escalation: [
      { stage: "Lifted tabs / minor flashing gaps", when: "now", cost: [200, 800] },
      { stage: "Active leak, decking & insulation damage", when: "1–2 storms", cost: [1500, 5000] },
      { stage: "Structural decking + interior damage", when: "2+ years", cost: [8000, 20000] },
    ],
    bundle: {
      title: "Roof envelope repair",
      resolution:
        "Re-seat lifted tabs, re-flash the penetrations, and confirm the chimney/valley details in one trip while the roofer is up there.",
    },
  },
  {
    key: "electrical-safety",
    title: "Electrical safety",
    match: /electric|\bpanel\b|breaker|generator|surge|\bwiring\b|\boutlet|gfci|aluminum wir/i,
    rootCause:
      "An electrical component is out of spec or unprotected — the failure modes here run to fire and shock, so it earns priority.",
    tradeLabel: "Electrical",
    escalation: [
      { stage: "Nuisance trips / unprotected circuit", when: "now", cost: [150, 600] },
      { stage: "Overheating connections, damaged devices", when: "months", cost: [600, 2500] },
      { stage: "Electrical fire risk", when: "unpredictable", cost: [5000, 15000] },
    ],
    bundle: {
      title: "Electrical-safety visit",
      resolution:
        "One licensed-electrician visit to clear the flagged items together — panel/breaker, GFCI protection, and generator/surge — rather than piecemeal service calls.",
    },
  },
  {
    key: "water-quality",
    title: "Water & air quality",
    match: /\bwell\b|radon|filtration|water treat|softener|sediment|water quality|arsenic|bacteria/i,
    rootCause:
      "A source-water or radon item that affects what the household drinks and breathes — worth confirming on a cadence, not reacting to.",
    tradeLabel: "Water / radon",
    escalation: [
      { stage: "Untested / lapsed monitoring", when: "now", cost: [150, 500] },
      { stage: "Contaminant or radon exposure unmanaged", when: "ongoing", cost: [800, 3000] },
      { stage: "Remediation + health cost", when: "cumulative", cost: [3000, 9000] },
    ],
    bundle: {
      title: "Water & radon check",
      resolution:
        "Batch the well test, radon read, and filtration/softener service into one water-quality visit.",
    },
  },
  {
    key: "hvac-efficiency",
    title: "HVAC performance",
    match: /hvac|furnace|\bac\b|air.?condition|heat pump|mini.?split|refrigerant|\bcoil\b|thermostat|\bfilter\b|short.?cycl|uneven (?:temp|heat|cool)/i,
    rootCause:
      "The heating/cooling system isn't running at spec — a maintenance or component item that quietly costs efficiency and lifespan.",
    tradeLabel: "HVAC",
    escalation: [
      { stage: "Reduced efficiency, higher bills", when: "now", cost: [150, 500] },
      { stage: "Component wear, comfort complaints", when: "season", cost: [500, 2000] },
      { stage: "Premature system replacement", when: "years early", cost: [6000, 14000] },
    ],
    bundle: {
      title: "HVAC service visit",
      resolution:
        "Fold the flagged HVAC items — filter, refrigerant, coil, thermostat — into one maintenance visit under the service plan.",
    },
  },
]

// Which issue a priority belongs to (title + category + reason), or null.
export function issueForPriority(p) {
  const hay = [p.title, p.category, p.reason].filter(Boolean).join(" ")
  return ISSUE_PLAYBOOK.find((iss) => iss.match.test(hay)) || null
}

// The worst-case cost if an issue is deferred all the way — used to rank
// clusters by escalation risk.
export function escalationCeiling(issue) {
  const last = issue.escalation[issue.escalation.length - 1]
  return last ? last.cost[1] : 0
}

// A one-line "if you keep waiting" framing from the escalation ladder.
export function consequenceLine(issue) {
  return issue.escalation
    .map((s) => `${s.stage} (${s.when}, ~${fmtMoneyRange(s.cost)})`)
    .join(" → ")
}

// Normalize a title to comparable word tokens (drop punctuation and a few
// filler words) for near-duplicate detection.
const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "for", "fix", "repair", "&"])
function tokens(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w))
  )
}

function jaccard(a, b) {
  const A = tokens(a)
  const B = tokens(b)
  if (A.size === 0 || B.size === 0) return 0
  let shared = 0
  for (const w of A) if (B.has(w)) shared += 1
  return shared / (A.size + B.size - shared)
}

// Within a cluster, pairs of priorities whose titles overlap enough to be
// the same work described twice. Returns arrays of the two priority ids.
export function findDuplicates(items, threshold = 0.5) {
  const pairs = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (jaccard(items[i].title, items[j].title) >= threshold) {
        pairs.push([items[i].id, items[j].id])
      }
    }
  }
  return pairs
}

// The whole analysis: open priorities clustered by issue (2+ to count),
// each with its duplicate pairs, ranked by escalation risk.
export function detectIssues(priorities) {
  const open = priorities.filter(
    (p) => !p.status || p.status === "open" || p.status === "scheduled"
  )
  const buckets = new Map()
  for (const p of open) {
    const issue = issueForPriority(p)
    if (!issue) continue
    if (!buckets.has(issue.key)) buckets.set(issue.key, { issue, items: [] })
    buckets.get(issue.key).items.push(p)
  }
  return [...buckets.values()]
    .filter(({ items }) => items.length >= 2)
    .map((c) => ({ ...c, duplicates: findDuplicates(c.items) }))
    .sort((a, b) => escalationCeiling(b.issue) - escalationCeiling(a.issue))
}
