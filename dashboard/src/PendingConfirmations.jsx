// The confirmation queue as a portable card. Since intake auto-files pure
// information (7/27), the only things left here are real decisions —
// requests, jobs, quotes, new systems — so the card lives where decisions
// get made: at the top of the Assistant. Renders nothing when the queue
// is empty, which is now the normal state.

import { useState } from "react"
import { Link } from "react-router-dom"
import { useItems } from "./useItems"
import { pendingActions, withActionStatus, actionLabel } from "./conversations"
import { applyAssistantAction } from "./assistantActions"
import { auditAction, hasDuplicate } from "./recordAudit"
import { Card, Button } from "./components"

const PENDING_LABEL = {
  save_fact: "Save fact",
  log_job: "Log job",
  log_system: "Add system",
  service_request: "File request",
  log_quote: "Log quote",
}

export default function PendingConfirmations({ uid, email }) {
  const { items, update } = useItems(uid, "conversations")
  const { items: facts } = useItems(uid, "facts")
  const { items: systems } = useItems(uid, "healthReport")
  const { items: jobs } = useItems(uid, "jobHistory")
  const { items: workOrders } = useItems(uid, "workOrders")
  const [busyKey, setBusyKey] = useState("")

  const pending = pendingActions(items)
  if (pending.length === 0) return null

  async function resolve(p, status) {
    setBusyKey(`${p.conversationId}-${p.msgIndex}-${p.actionIndex}`)
    try {
      if (status === "done") await applyAssistantAction(uid, p.action, email)
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

  return (
    <Card
      title={`Awaiting your OK (${pending.length})`}
      className="mb-4 border-amber-200 bg-amber-50/40"
    >
      <p className="text-xs text-ink-3 mb-2">
        Proposed from chats and emails — confirm to write the record, or dismiss.{" "}
        <Link to="/conversations" className="underline hover:text-ink">
          Full transcripts
        </Link>
      </p>
      <ul className="flex flex-col gap-2">
        {pending.map((p) => {
          const key = `${p.conversationId}-${p.msgIndex}-${p.actionIndex}`
          const busy = busyKey === key
          const findings = auditAction(p.action, { facts, systems, jobs, workOrders })
          return (
            <li key={key} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-ink">
                  {PENDING_LABEL[p.action.type] || p.action.type}:
                </span>{" "}
                <span className="text-ink-2">{actionLabel(p.action)}</span>
                {p.startedOn && <span className="text-ink-3"> · {p.startedOn}</span>}
                {findings.map((f, i) => (
                  <span
                    key={i}
                    className={`block text-xs mt-0.5 ${
                      f.kind === "unclear" ? "text-ink-3" : "text-amber-800"
                    }`}
                  >
                    {f.kind === "duplicate" && "⚠ Possible duplicate — "}
                    {f.kind === "conflict" && "⚠ Check the record — "}
                    {f.note}
                    {f.match && `: “${f.match}”`}
                  </span>
                ))}
              </span>
              <span className="shrink-0 flex items-center gap-2">
                <Button
                  variant="subtle"
                  className="!py-1 !px-3 !text-xs"
                  disabled={busy}
                  onClick={() => resolve(p, "done")}
                >
                  {busy ? "…" : hasDuplicate(findings) ? "Confirm anyway" : "Confirm"}
                </Button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resolve(p, "dismissed")}
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
  )
}
