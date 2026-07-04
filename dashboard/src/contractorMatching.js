// Matching between job-history entries and contractor-network profiles.
// A job is linked when it carries the contractor's id; unlinked jobs fall
// back to a name match on the free-text `sub` field so legacy entries
// (pre-Slice 9) still count — and can be bulk-linked from the network page.

export const norm = (s) => (s || "").trim().toLowerCase()

export const jobMatchesContractor = (job, contractor) =>
  job.contractorId === contractor.id ||
  (!job.contractorId && job.sub && norm(job.sub).includes(norm(contractor.name)))

export const unlinkedMatches = (jobs, contractor) =>
  jobs.filter((j) => !j.contractorId && j.sub && norm(j.sub).includes(norm(contractor.name)))

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
