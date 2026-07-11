// Matching between job-history entries and contractor-network profiles.
// A job is linked when it carries the contractor's id; unlinked jobs fall
// back to a name match on the free-text `sub` field so legacy entries
// (pre-Slice 9) still count — and can be bulk-linked from the network page.

export const norm = (s) => (s || "").trim().toLowerCase()

// Canonical vendor name for matching: drop trailing contact/notes clauses
// ("Monticello Air — (434) 246-7111" → "monticello air"), phone numbers,
// punctuation, and legal/filler tokens (LLC, Inc, Co, Services, &). Used
// only for comparison, never for display.
const FILLER = new Set([
  "llc", "inc", "co", "corp", "corporation", "company", "the", "and",
  "service", "services", "of", "a",
])
export function canonicalName(name) {
  return (name || "")
    .toLowerCase()
    .split(/\s[—–-]\s|\||\(/)[0] // cut at " — ", " - ", "|", or "("
    .replace(/\+?\d[\d\s().-]{6,}\d/g, " ") // phone-like runs
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(" ")
    .trim()
}

const tokenSet = (name) => new Set(canonicalName(name).split(/\s+/).filter(Boolean))

// Do two vendor names refer to the same contractor? Exact canonical match,
// token-subset (one name contains all of the other's words), or high token
// overlap. Conservative enough that "Blue Ridge Gutter" and "Blue Ridge
// Electric" stay distinct.
export function looksSameContractor(a, b, threshold = 0.6) {
  const ca = canonicalName(a)
  const cb = canonicalName(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  const A = tokenSet(a)
  const B = tokenSet(b)
  const small = A.size <= B.size ? A : B
  const big = A.size <= B.size ? B : A
  if (small.size > 0 && [...small].every((t) => big.has(t))) return true
  let shared = 0
  for (const t of A) if (B.has(t)) shared += 1
  return shared / (A.size + B.size - shared) >= threshold
}

// The best existing contractor a free-text vendor name resolves to, or null.
export function findContractorMatch(name, contractors) {
  return contractors.find((c) => looksSameContractor(name, c.name)) || null
}

// Likely-duplicate profiles in the network: groups of 2+ that look like the
// same contractor. Union-find over pairwise looksSame.
export function findDuplicateContractors(contractors) {
  const parent = contractors.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < contractors.length; i++) {
    for (let j = i + 1; j < contractors.length; j++) {
      if (looksSameContractor(contractors[i].name, contractors[j].name)) {
        parent[find(i)] = find(j)
      }
    }
  }
  const groups = new Map()
  contractors.forEach((c, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(c)
  })
  return [...groups.values()].filter((g) => g.length > 1)
}

export const jobMatchesContractor = (job, contractor) =>
  job.contractorId === contractor.id ||
  (!job.contractorId && job.sub && looksSameContractor(job.sub, contractor.name))

export const unlinkedMatches = (jobs, contractor) =>
  jobs.filter((j) => !j.contractorId && j.sub && looksSameContractor(j.sub, contractor.name))

// Structured "by home" view: a contractor's jobs grouped under the property
// they were performed at, most-worked-at home first, newest job first within
// each home — this is the shape the master network is meant to replace flat,
// string-matched lists with.
export function groupJobsByProperty(jobs) {
  const byProperty = new Map()
  for (const j of jobs) {
    if (!byProperty.has(j.propertyId)) {
      byProperty.set(j.propertyId, {
        propertyId: j.propertyId,
        propertyLabel: j.propertyLabel,
        jobs: [],
      })
    }
    byProperty.get(j.propertyId).jobs.push(j)
  }
  for (const group of byProperty.values()) {
    group.jobs.sort((a, b) => (b.order || 0) - (a.order || 0))
  }
  return [...byProperty.values()].sort((a, b) => b.jobs.length - a.jobs.length)
}
