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

export function tokens(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
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

const openOrders = (workOrders) =>
  (workOrders || []).filter((w) => w.lane !== "done" && w.lane !== "canceled")

const finding = (kind, note, match = "") => ({ kind, note, ...(match ? { match } : {}) })

// The main entry: one pending action against the current record.
// record: { facts, systems, jobs, workOrders } (any may be missing).
export function auditAction(action, record = {}) {
  const { facts = [], systems = [], jobs = [], workOrders = [] } = record
  const findings = []
  if (!action || !action.type) return findings

  if (action.type === "save_fact") {
    const dup = facts.find((f) => overlap(action.fact, f.text) >= DUP_THRESHOLD)
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
