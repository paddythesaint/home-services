// The record-quality gatekeeper: before a pending assistant action is
// confirmed, hold it against what the record already says. Three kinds of
// finding, all advisory — the founder always decides:
//   duplicate — the record already has something very like this
//   conflict  — the record says something this proposal contradicts
//               (most commonly a stale "not yet done" a completion beats)
//   unclear   — the proposal is missing the detail that makes it useful
// Pure functions over plain arrays; no Firestore in the room.

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "with", "for", "to", "and",
  "or", "is", "was", "were", "be", "been", "has", "have", "had", "by",
  "from", "as", "it", "its", "this", "that", "new", "old", "our", "we",
])

// Month names and bare numbers (years, counts) say when, not what — two
// records that share only "July 2026" are not about the same thing.
const MONTHS = new Set([
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
])

export function tokens(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !MONTHS.has(t) && !/^\d+$/.test(t))
}

// Containment overlap: how much of the smaller statement appears in the
// larger one. Robust when one side is a terse title and the other a full
// sentence, where plain Jaccard under-scores.
export function overlap(a, b) {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.min(ta.size, tb.size)
}

const DUP_THRESHOLD = 0.6
const SUBJECT_THRESHOLD = 0.4 // looser: same subject, possibly different claim

// A statement that says work happened vs. one that says it's still ahead.
const DONE_RE = /\b(replaced|installed|completed|finished|repaired|fixed|serviced|done)\b/i
const PENDING_RE = /\b(not yet|pending|recommended|scheduled|awaiting|to be|planned|needs?|upcoming)\b/i

// A done-statement and a pending-statement about the same subject are a
// supersession, never a duplicate — the stale-fact path owns that pair.
const supersessionPair = (a, b) =>
  (DONE_RE.test(a || "") && PENDING_RE.test(b || "")) ||
  (PENDING_RE.test(a || "") && DONE_RE.test(b || ""))

const openOrders = (workOrders) =>
  (workOrders || []).filter((w) => w.lane !== "done" && w.lane !== "canceled")

// Archived facts (merged duplicates, superseded statements) stay stored
// for history but drop out of everything current: the assistant's context,
// the gatekeeper, and the sweep.
export const activeFacts = (facts) => (facts || []).filter((f) => !f.archived)

const finding = (kind, note, match = "") => ({ kind, note, ...(match ? { match } : {}) })

// The main entry: one pending action against the current record.
// record: { facts, systems, jobs, workOrders } (any may be missing).
export function auditAction(action, record = {}) {
  const { systems = [], jobs = [], workOrders = [] } = record
  const facts = activeFacts(record.facts)
  const findings = []
  if (!action || !action.type) return findings

  if (action.type === "save_fact") {
    const dup = facts.find(
      (f) => !supersessionPair(action.fact, f.text) && overlap(action.fact, f.text) >= DUP_THRESHOLD
    )
    if (dup) findings.push(finding("duplicate", "The record already has a very similar fact", dup.text))
    // A completion statement may supersede a stale "still pending" fact
    // about the same subject (e.g. "replacement not yet completed").
    if (DONE_RE.test(action.fact || "")) {
      const stale = facts.find(
        (f) =>
          f !== dup && PENDING_RE.test(f.text || "") && overlap(action.fact, f.text) >= SUBJECT_THRESHOLD
      )
      if (stale) findings.push(finding("conflict", "May supersede an older fact that says this was still pending", stale.text))
    }
    if ((tokens(action.fact).length < 4 || /\b(unknown|tbd)\b/i.test(action.fact || "")) )
      findings.push(finding("unclear", "Thin fact — consider adding what, when, and who"))
  }

  if (action.type === "log_system") {
    const label = (s) => `${s.category || ""} ${s.detail || ""} ${s.brand || ""}`
    const dup = systems.find((s) => overlap(action.title, label(s)) >= DUP_THRESHOLD)
    if (dup) {
      findings.push(finding("duplicate", "A system like this is already tracked", dup.category))
      if (action.installYear && dup.installYear && String(action.installYear) !== String(dup.installYear))
        findings.push(
          finding(
            "conflict",
            `Install year differs from the tracked system (${dup.installYear} on record)`
          )
        )
    }
    if (!action.detail) findings.push(finding("unclear", "No brand/model captured"))
  }

  if (action.type === "log_job") {
    const dup = jobs.find(
      (j) => overlap(action.title, j.title) >= DUP_THRESHOLD && (!action.date || !j.date || j.date === action.date)
    )
    if (dup) findings.push(finding("duplicate", "A job like this is already in the history", `${dup.title}${dup.date ? ` (${dup.date})` : ""}`))
    if (!action.date) findings.push(finding("unclear", "No date — will be logged as today"))
  }

  if (action.type === "service_request") {
    const dup = openOrders(workOrders).find((w) => overlap(action.title, w.title) >= DUP_THRESHOLD)
    if (dup) findings.push(finding("duplicate", "An open work order already covers this", dup.title))
  }

  if (action.type === "log_quote") {
    const order = (workOrders || []).find((o) => o.id === action.workOrderId)
    const dup = (order?.quotes || []).find(
      (q) =>
        overlap(action.contractor, q.contractor) >= DUP_THRESHOLD &&
        (q.amount || "") === (action.amount || "")
    )
    if (dup) findings.push(finding("duplicate", "This quote is already on the order", `${dup.contractor} — ${dup.amount}`))
    if (!action.amount) findings.push(finding("unclear", "No amount on the quote"))
  }

  return findings
}

// True when the action has a duplicate finding — the confirm button should
// read "Confirm anyway" so nobody rubber-stamps a double entry.
export const hasDuplicate = (findings) => findings.some((f) => f.kind === "duplicate")

// --- The retrospective sweep (Slice 74) ------------------------------------
// The same judgment applied to what's ALREADY in the record: duplicate fact
// pairs, stale "still pending" facts a later record supersedes, duplicated
// systems/jobs, and facts too thin to be useful. Every finding carries a
// stable key so a founder's "keep it" dismissal sticks across runs.

const pairKey = (prefix, a, b) => `${prefix}:${[a.id, b.id].sort().join(":")}`

export function sweepRecord(record = {}, dismissedKeys = []) {
  const facts = activeFacts(record.facts)
  const { systems = [], jobs = [] } = record
  const skip = new Set(dismissedKeys)
  const out = []
  const push = (f) => {
    if (!skip.has(f.key)) out.push(f)
  }

  // Duplicate fact pairs. The one carrying less information is the archive
  // candidate; the fuller statement is kept.
  for (let i = 0; i < facts.length; i++)
    for (let j = i + 1; j < facts.length; j++) {
      const [a, b] = [facts[i], facts[j]]
      if (!supersessionPair(a.text, b.text) && overlap(a.text, b.text) >= DUP_THRESHOLD) {
        const [keep, redundant] =
          tokens(a.text).length >= tokens(b.text).length ? [a, b] : [b, a]
        push({
          key: pairKey("dupfact", a, b),
          kind: "duplicate-facts",
          note: "Two facts say nearly the same thing",
          keep,
          redundant,
        })
      }
    }

  // Stale facts: a "still pending" statement with later completion evidence
  // on the same subject — another fact that says done, or a logged job
  // (jobs are completions by nature).
  for (const stale of facts) {
    if (!PENDING_RE.test(stale.text || "")) continue
    const byFact = facts.find(
      (o) => o !== stale && DONE_RE.test(o.text || "") && overlap(stale.text, o.text) >= SUBJECT_THRESHOLD
    )
    const byJob = byFact
      ? null
      : jobs.find((j) => overlap(j.title, stale.text) >= SUBJECT_THRESHOLD)
    const evidence = byFact || byJob
    if (evidence)
      push({
        key: `stale:${stale.id}:${evidence.id}`,
        kind: "stale-fact",
        note: "A later record says this was done",
        stale,
        evidence: byFact ? byFact.text : `${byJob.title}${byJob.date ? ` (${byJob.date})` : ""}`,
      })
  }

  // Duplicate systems / jobs — advisory only; their pages own the fix.
  const label = (s) => `${s.category || ""} ${s.detail || ""} ${s.brand || ""}`
  for (let i = 0; i < systems.length; i++)
    for (let j = i + 1; j < systems.length; j++)
      if (overlap(systems[i].category, label(systems[j])) >= DUP_THRESHOLD)
        push({
          key: pairKey("dupsys", systems[i], systems[j]),
          kind: "duplicate-systems",
          note: "Two tracked systems look like the same unit",
          a: systems[i],
          b: systems[j],
        })
  for (let i = 0; i < jobs.length; i++)
    for (let j = i + 1; j < jobs.length; j++)
      if (
        overlap(jobs[i].title, jobs[j].title) >= DUP_THRESHOLD &&
        (jobs[i].date || "") === (jobs[j].date || "")
      )
        push({
          key: pairKey("dupjob", jobs[i], jobs[j]),
          kind: "duplicate-jobs",
          note: "The same job may be logged twice",
          a: jobs[i],
          b: jobs[j],
        })

  // Thin facts.
  for (const f of facts)
    if (tokens(f.text).length < 4 || /\b(unknown|tbd)\b/i.test(f.text || ""))
      push({ key: `thin:${f.id}`, kind: "thin-fact", note: "Too thin to be useful later", fact: f })

  return out
}
