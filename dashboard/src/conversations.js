// Reading assistant transcripts back. The Assistant persists every chat to
// the `conversations` collection (delete-locked for the record) but nothing
// surfaced them — this is the shaping for a review page. Pure over the stored
// conversation docs: { startedBy, startedOn, summary, messages:[{ role, text,
// hadPhoto?, hadDoc?, actions?:[{ type, fact?, title?, status }] }] }.

export const ACTION_META = {
  save_fact: { label: "Fact saved", tone: "brand" },
  service_request: { label: "Request raised", tone: "amber" },
  log_job: { label: "Job logged", tone: "brand" },
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
