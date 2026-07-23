// Reading assistant transcripts back. The Assistant persists every chat to
// the `conversations` collection (delete-locked for the record) but nothing
// surfaced them — this is the shaping for a review page. Pure over the stored
// conversation docs: { startedBy, startedOn, summary, messages:[{ role, text,
// hadPhoto?, hadDoc?, actions?:[{ type, fact?, title?, status }] }] }.

export const ACTION_META = {
  save_fact: { label: "Fact saved", tone: "brand" },
  service_request: { label: "Request raised", tone: "amber" },
  log_job: { label: "Job logged", tone: "brand" },
  log_system: { label: "System added", tone: "brand" },
  log_quote: { label: "Quote logged", tone: "brand" },
}

// A readable label for one committed action.
export function actionLabel(a) {
  return a.title || a.fact || ACTION_META[a.type]?.label || a.type
}

// Every record a conversation committed, flattened, with per-type counts —
// the "what did this chat actually change" digest.
export function conversationActions(conv) {
  const items = []
  for (const m of conv?.messages || []) {
    for (const a of m.actions || []) {
      items.push({ type: a.type, label: actionLabel(a), status: a.status })
    }
  }
  const counts = items.reduce((c, it) => {
    c[it.type] = (c[it.type] || 0) + 1
    return c
  }, {})
  return { items, counts, total: items.length }
}

export const messageCount = (conv) => (conv?.messages || []).length

// Conversations newest first (by insert order, then startedOn as a fallback).
export function byRecency(conversations) {
  return [...conversations].sort((a, b) => (b.order || 0) - (a.order || 0))
}

// Portfolio/home rollup: how many conversations and how many records they
// created in total.
export function conversationsSummary(conversations) {
  let records = 0
  for (const c of conversations) records += conversationActions(c).total
  return { conversations: conversations.length, records }
}

// The safety net: proposed actions that were never confirmed before the
// chat was closed. They live on in the stored transcript (status stays
// "pending"), so the Assistant Log can surface them for a later confirm or
// dismiss instead of letting them silently evaporate.
export function pendingActions(conversations) {
  const items = []
  for (const c of conversations) {
    ;(c.messages || []).forEach((m, msgIndex) => {
      ;(m.actions || []).forEach((a, actionIndex) => {
        if (a.status === "pending") {
          items.push({
            conversationId: c.id,
            msgIndex,
            actionIndex,
            action: a,
            startedOn: c.startedOn || "",
          })
        }
      })
    })
  }
  return items
}

// A conversation's messages with ONE action's status rewritten — the update
// the log writes back after a confirm ("done") or dismiss ("dismissed").
export function withActionStatus(conv, msgIndex, actionIndex, status) {
  return (conv.messages || []).map((m, mi) =>
    mi === msgIndex
      ? {
          ...m,
          actions: (m.actions || []).map((a, ai) => (ai === actionIndex ? { ...a, status } : a)),
        }
      : m
  )
}

// Does a free-text date label fall within a [from, to] range (YYYY-MM-DD
// strings from date inputs, either optional)? An unparseable/empty label is
// excluded only when a bound is actually set.
export function inDateRange(label, from = "", to = "") {
  if (!from && !to) return true
  const t = Date.parse(label || "")
  if (Number.isNaN(t)) return false
  if (from && t < Date.parse(from)) return false
  if (to && t > Date.parse(to) + 86_399_999) return false // include the whole 'to' day
  return true
}

// Free-text search across a conversation: summary, dates, who, message text,
// and the labels of the records it committed.
export function conversationMatches(conv, query = "") {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    conv.summary,
    conv.startedOn,
    conv.startedBy,
    ...(conv.messages || []).map((m) => m.text),
    ...conversationActions(conv).items.map((i) => i.label),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return hay.includes(q)
}

// Apply the search box + date range to a conversation list.
export function filterConversations(list, { query = "", from = "", to = "" } = {}) {
  return list.filter(
    (c) => conversationMatches(c, query) && inDateRange(c.startedOn, from, to)
  )
}
