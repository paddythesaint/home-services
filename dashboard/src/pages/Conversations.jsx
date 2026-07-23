import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import {
  ACTION_META,
  actionLabel,
  conversationActions,
  conversationsSummary,
  messageCount,
  byRecency,
  filterConversations,
  inDateRange,
  pendingActions,
  withActionStatus,
} from "../conversations"
import { applyAssistantAction } from "../assistantActions"
import { Card, PageHeader, StatTile, Button } from "../components"

// The assistant log: every conversation on this home and the records each one
// created, so the team can review what was said and what got committed.
// Read-only — the transcripts themselves stay delete-locked.

// What confirming a pending action will do (present tense — ACTION_META's
// labels are past tense for already-committed records).
const PENDING_LABEL = {
  save_fact: "Save fact",
  log_job: "Log job",
  log_system: "Add system",
  service_request: "File request",
}

function ActionChip({ type, label, status }) {
  const meta = ACTION_META[type] || { label: type, tone: "brand" }
  const tone =
    meta.tone === "amber"
      ? "bg-amber-50 text-amber-900 border border-amber-200"
      : "bg-brand-100 text-brand-900"
  return (
    <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${tone}`}>
      <span className="font-medium">{meta.label}:</span>
      <span>{label}</span>
      {status && status !== "applied" && <span className="text-ink-3">· {status}</span>}
    </span>
  )
}

function ConversationCard({ conv }) {
  const [open, setOpen] = useState(false)
  const { items: actions, total } = conversationActions(conv)
  const msgs = messageCount(conv)

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate">{conv.summary || "Conversation"}</p>
            <p className="text-xs text-ink-3 mt-0.5">
              {conv.startedOn || "—"}
              {conv.startedBy && ` · ${conv.startedBy}`} · {msgs} message{msgs === 1 ? "" : "s"}
            </p>
          </div>
          <span className="shrink-0 text-xs text-ink-3">
            {total > 0 ? `${total} record${total === 1 ? "" : "s"} added` : "no records"} ·{" "}
            {open ? "Hide" : "View"}
          </span>
        </div>
        {!open && actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {actions.map((a, i) => (
              <ActionChip key={i} type={a.type} label={a.label} status={a.status} />
            ))}
          </div>
        )}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2.5">
          {(conv.messages || []).map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-brand-600 text-white rounded-br-sm"
                    : "bg-plane text-ink rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                {(m.hadPhoto || m.hadDoc) && (
                  <p
                    className={`text-xs mt-1 ${m.role === "user" ? "text-white/75" : "text-ink-3"}`}
                  >
                    📎 {m.hadPhoto ? "photo attached" : m.hadDoc || "document attached"}
                  </p>
                )}
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.actions.map((a, j) => (
                      <ActionChip key={j} type={a.type} label={a.title || a.fact || a.type} status={a.status} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function Conversations() {
  const { uid, user } = useOutletContext()
  const { items, loading, update } = useItems(uid, "conversations")
  const { items: documents } = useItems(uid, "documents")
  const summary = conversationsSummary(items)

  // The safety net: proposed actions nobody confirmed before closing the
  // chat. Confirm applies the record here; dismiss retires the suggestion.
  const pending = pendingActions(items)
  const [busyKey, setBusyKey] = useState("")

  async function resolvePending(p, status) {
    setBusyKey(`${p.conversationId}-${p.msgIndex}-${p.actionIndex}`)
    try {
      if (status === "done") await applyAssistantAction(uid, p.action, user?.email)
      const conv = items.find((c) => c.id === p.conversationId)
      if (conv) {
        await update(p.conversationId, {
          messages: withActionStatus(conv, p.msgIndex, p.actionIndex, status),
        })
      }
    } finally {
      setBusyKey("")
    }
  }

  const [query, setQuery] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const filtering = Boolean(query || from || to)

  const ordered = filterConversations(byRecency(items), { query, from, to })
  const docs = [...documents]
    .sort((a, b) => (b.order || 0) - (a.order || 0))
    .filter(
      (d) =>
        (!query || (d.name || "").toLowerCase().includes(query.trim().toLowerCase())) &&
        inDateRange(d.uploadedOn || d.date, from, to)
    )

  function clearFilters() {
    setQuery("")
    setFrom("")
    setTo("")
  }
  const inputClass =
    "border border-line rounded-lg px-3 py-2 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400"

  return (
    <div>
      <PageHeader
        title="Assistant Log"
        subtitle="Everything that came in through the assistant on this home — conversations, the records each one created, and uploaded documents. Read-only; the transcripts stay on the record."
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatTile label="Conversations" value={summary.conversations} sub="On this home" />
        <StatTile
          label="Records created"
          value={summary.records}
          sub="Facts, systems, jobs, requests"
        />
        <StatTile label="Documents" value={documents.length} sub="Uploaded files" />
      </div>

      {pending.length > 0 && (
        <Card
          title={`Awaiting confirmation (${pending.length})`}
          className="mb-4 border-amber-200 bg-amber-50/40"
        >
          <p className="text-xs text-ink-3 mb-2">
            The assistant proposed these, but nobody confirmed them before the chat closed.
            Confirm to write the record now, or dismiss.
          </p>
          <ul className="flex flex-col gap-2">
            {pending.map((p) => {
              const key = `${p.conversationId}-${p.msgIndex}-${p.actionIndex}`
              const busy = busyKey === key
              return (
                <li key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">
                      {PENDING_LABEL[p.action.type] || p.action.type}:
                    </span>{" "}
                    <span className="text-ink-2">{actionLabel(p.action)}</span>
                    {p.startedOn && <span className="text-ink-3"> · {p.startedOn}</span>}
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="subtle"
                      className="!py-1 !px-3 !text-xs"
                      disabled={busy}
                      onClick={() => resolvePending(p, "done")}
                    >
                      {busy ? "…" : "Confirm"}
                    </Button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolvePending(p, "dismissed")}
                      className="text-xs text-ink-3 hover:text-ink disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {(items.length > 0 || documents.length > 0) && (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="flex flex-col gap-1 text-xs text-ink-3 flex-1 min-w-[12rem]">
            Search
            <input
              type="search"
              className={inputClass}
              placeholder="Text, record, contractor…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-3">
            From
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-3">
            To
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {filtering && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-ink-3 hover:text-ink pb-2"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {docs.length > 0 && (
        <Card title="Uploads & documents" className="mb-4">
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">
                  📎 {d.name || "Document"}
                </span>
                <span className="shrink-0 text-xs text-ink-3">
                  {d.uploadedOn || d.date || ""}
                  {d.uploadedBy && ` · ${d.uploadedBy}`}
                  {d.url && !d.url.startsWith("mock://") && (
                    <>
                      {" · "}
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:text-brand-800 underline"
                      >
                        open
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {loading ? (
        <Card>
          <p className="text-sm text-ink-2">Loading conversations…</p>
        </Card>
      ) : ordered.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            {filtering
              ? "No conversations match your search or date range."
              : "No assistant conversations recorded yet on this home. Chats with the Assistant are saved here so you can review what was said and what it changed."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((conv) => (
            <ConversationCard key={conv.id} conv={conv} />
          ))}
        </div>
      )}
    </div>
  )
}
