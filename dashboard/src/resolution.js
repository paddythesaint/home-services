// Resolution pipeline for priorities: the question per item, in order, is
// "what's needed to close it out?" (materials + info) and then "how does it
// get actioned?" (the resolution path). Readiness is computed, never stored.

export const RESOLUTION_PATHS = ["subscription-visit", "diy", "specialist", "project-quote"]

export const PATH_META = {
  "subscription-visit": {
    label: "Next visit",
    detail: "Batched onto the recurring visit — part of the subscription.",
  },
  diy: {
    label: "DIY",
    detail: "Homeowner does it; we supply the materials list.",
  },
  specialist: {
    label: "Specialist",
    detail: "Dispatch a specific trade (HVAC, plumber, electrician…).",
  },
  "project-quote": {
    label: "Get quotes",
    detail: "Needs an estimate — bundled with related work where possible.",
  },
}

export const MATERIAL_STATUSES = ["needed", "purchased", "on-truck"]
export const MATERIAL_STATUS_LABEL = {
  needed: "Needed",
  purchased: "Purchased",
  "on-truck": "On the truck",
}

export const INFO_TYPES = ["fact", "photo", "measurement"]

// Items predate the status field, so absence means "open".
export const isOpenPriority = (p) =>
  !p.status || p.status === "open" || p.status === "scheduled"

export const materialSatisfied = (m) => m.status !== "needed"
export const infoSatisfied = (i) => i.status === "provided"

// What still blocks closeout. A priority with no recorded requirements is
// trivially unblocked — "ready" then means "nothing known to be missing".
export function openRequirements(p) {
  const materials = (p.materialsNeeded || []).filter((m) => !materialSatisfied(m))
  const info = (p.infoNeeded || []).filter((i) => !infoSatisfied(i))
  return { materials, info, count: materials.length + info.length }
}

export const isReadyToAction = (p) => openRequirements(p).count === 0

export const requirementId = () =>
  `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// The pipeline readout: open → ready to action → closing on the next visit.
export function resolutionCounts(priorities) {
  const open = priorities.filter(isOpenPriority)
  const ready = open.filter(isReadyToAction)
  const nextVisit = open.filter((p) => p.resolutionPath === "subscription-visit")
  return { open: open.length, ready: ready.length, nextVisit: nextVisit.length }
}

// Everything the next recurring visit closes, plus its consolidated
// materials list (with per-item status so the truck gets packed right).
export function visitManifest(priorities) {
  const items = priorities.filter(
    (p) => isOpenPriority(p) && p.resolutionPath === "subscription-visit"
  )
  const materials = items.flatMap((p) =>
    (p.materialsNeeded || []).map((m) => ({ ...m, priorityId: p.id, priorityTitle: p.title }))
  )
  return { items, materials }
}

// Open project-quote work grouped by bundle tag — one truck roll per bundle.
export function quoteBundles(priorities) {
  const quotable = priorities.filter(
    (p) => isOpenPriority(p) && p.resolutionPath === "project-quote"
  )
  const groups = new Map()
  for (const p of quotable) {
    const tag = (p.bundleTag || "").trim() || "Ungrouped"
    if (!groups.has(tag)) groups.set(tag, [])
    groups.get(tag).push(p)
  }
  return [...groups.entries()].map(([tag, items]) => ({ tag, items }))
}
