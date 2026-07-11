import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { RecordTabs } from "../HubTabs"
import { isoToLabel } from "../dates"
import {
  COVERAGE_TYPES,
  COVERAGE_LABEL,
  coverageStatus,
  coverageAlerts,
  expiryLine,
  byExpiry,
  STATUS_META,
} from "../warranties"
import { Card, PageHeader, Button, Modal, DynamicForm } from "../components"

// The coverage ledger: every warranty, plan, and service contract on the
// home, ordered so the things about to lapse sit at the top — with a banner
// that calls out anything expiring or already expired. This is asset
// protection made legible: what's still covered, and what's about to stop
// being covered while there's still time to renew or use it.

const fields = [
  { name: "item", label: "What's covered", type: "text", placeholder: "e.g. HVAC — Trane XR16 condenser" },
  { name: "provider", label: "Provider / brand", type: "text", placeholder: "e.g. Trane, or the plan issuer" },
  {
    name: "type",
    label: "Coverage type",
    type: "select",
    options: COVERAGE_TYPES,
    optionLabels: COVERAGE_LABEL,
  },
  { name: "policyNumber", label: "Policy / contract #", type: "text" },
  { name: "start", label: "Start date", type: "date" },
  { name: "expiry", label: "Expiry date", type: "date" },
  { name: "coverage", label: "What it covers", type: "textarea" },
  { name: "notes", label: "Notes", type: "textarea" },
]

const TONE_CLASS = {
  good: "bg-brand-100 text-brand-900",
  warn: "bg-amber-50 text-amber-900 border border-amber-200",
  critical: "bg-red-50 text-red-800 border border-red-200",
  muted: "bg-plane text-ink-3",
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown
  return (
    <span className={`inline-block text-xs font-medium rounded-full px-2 py-0.5 ${TONE_CLASS[meta.tone]}`}>
      {meta.label}
    </span>
  )
}

export default function Warranties() {
  const { uid } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "warranties")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const alerts = coverageAlerts(items)
  const ordered = byExpiry(items)

  function submit(values) {
    if (editing === "new") add(values)
    else update(editing.id, values)
    setEditing(null)
  }

  return (
    <div>
      <RecordTabs />
      <PageHeader
        title="Coverage & Warranties"
        subtitle="Every warranty, plan, and service contract on the home — with what's still covered and what's about to lapse."
        action={<Button onClick={() => setEditing("new")}>+ Add coverage</Button>}
      />

      {alerts.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/40">
          <p className="text-sm font-semibold text-ink mb-1.5">
            {alerts.length} coverage item{alerts.length === 1 ? "" : "s"} need attention
          </p>
          <ul className="flex flex-col gap-1.5">
            {alerts.map((w) => (
              <li key={w.id} className="text-sm text-ink-2 flex items-center justify-between gap-3">
                <span>
                  {w.item}
                  {w.provider && <span className="text-ink-3"> · {w.provider}</span>}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-ink-3">{expiryLine(w)}</span>
                  <StatusPill status={coverageStatus(w)} />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-3 mt-2">
            Renew, use it while it's live, or line up the replacement before coverage stops.
          </p>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            No coverage logged yet. Add appliance and system warranties, extended plans, a home
            warranty, or service contracts — the record will flag them before they expire.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((w) => {
            const status = coverageStatus(w)
            return (
              <Card key={w.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{w.item}</p>
                    <p className="text-sm text-ink-2">
                      {COVERAGE_LABEL[w.type] || "Coverage"}
                      {w.provider && ` · ${w.provider}`}
                      {w.policyNumber && <span className="text-ink-3"> · #{w.policyNumber}</span>}
                    </p>
                    <p className="text-sm text-ink-3 mt-1">
                      {w.start && `${isoToLabel(w.start)} → `}
                      {w.expiry ? isoToLabel(w.expiry) : "no end date"}
                    </p>
                    {w.coverage && <p className="text-sm text-ink-2 mt-1.5">{w.coverage}</p>}
                    {w.notes && <p className="text-sm text-ink-3 mt-1">{w.notes}</p>}
                    <div className="flex gap-3 mt-3">
                      <Button variant="ghost" className="!px-0" onClick={() => setEditing(w)}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="!px-0"
                        onClick={() => setConfirmDelete(w)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <StatusPill status={status} />
                    <p className="text-xs text-ink-3">{expiryLine(w)}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={editing === "new" ? "Add coverage" : "Edit coverage"}
          onClose={() => setEditing(null)}
        >
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? { type: "manufacturer" } : editing}
            onSubmit={submit}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete coverage?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">Remove "{confirmDelete.item}" from the ledger?</p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                remove(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
