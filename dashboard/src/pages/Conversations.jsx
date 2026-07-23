import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import {
  ACTION_META,
  conversationActions,
  conversationsSummary,
  messageCount,
  byRecency,
} from "../conversations"
import { Card, PageHeader, StatTile } from "../components"

// The assistant log: every conversation on this home and the records each one
// created, so the team can review what was said and what got committed.
// Read-only — the transcripts themselves stay delete-locked.

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
  const { uid } = useOutletContext()
  const { items, loading } = useItems(uid, "conversations")
  const { items: documents } = useItems(uid, "documents")
  const ordered = byRecency(items)
  const summary = conversationsSummary(items)
  const docs = [...documents].sort((a, b) => (b.order || 0) - (a.order || 0))

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
        <StatTile label="Documents" value={docs.length} sub="Uploaded files" />
      </div>

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
            No assistant conversations recorded yet on this home. Chats with the Assistant are
            saved here so you can review what was said and what it changed.
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
