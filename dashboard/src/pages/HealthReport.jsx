import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import PhotoSection from "../PhotoSection"
import ActivitySection from "../ActivitySection"
import { addItem } from "../firestoreApi"
import { todayLabel, todayISO, isoToLabel, addMonthsISO } from "../dates"
import { replacementHorizon, fmtMoneyRange } from "../benchmarks"
import {
  Card,
  ConditionBadge,
  VerifiedBadge,
  PageHeader,
  Button,
  Modal,
  DynamicForm,
} from "../components"

const FREQ_OPTIONS = ["0", "1", "3", "6", "12", "24", "36"]
const FREQ_LABELS = {
  0: "No recurring check",
  1: "Monthly",
  3: "Quarterly",
  6: "Every 6 months",
  12: "Yearly",
  24: "Every 2 years",
  36: "Every 3 years",
}

const fields = [
  { name: "category", label: "Category", type: "text", placeholder: "e.g. HVAC" },
  { name: "detail", label: "Detail", type: "text", placeholder: "e.g. Trane XR16, installed 2016" },
  { name: "brand", label: "Brand / model", type: "text" },
  { name: "installYear", label: "Install year", type: "text" },
  { name: "lastServiced", label: "Last serviced", type: "text" },
  { name: "location", label: "Location in home", type: "text", placeholder: "e.g. basement utility room" },
  {
    name: "condition",
    label: "Condition",
    type: "select",
    options: ["good", "attention", "urgent"],
    optionLabels: { good: "Good", attention: "Attention", urgent: "Urgent" },
  },
  {
    name: "verifyFrequencyMonths",
    label: "Recurring check",
    type: "select",
    options: FREQ_OPTIONS,
    optionLabels: FREQ_LABELS,
  },
  { name: "note", label: "Note", type: "textarea" },
]

function dueClass(nextDue) {
  if (!nextDue) return ""
  return nextDue <= todayISO() ? "text-status-critical" : "text-ink-3"
}

export default function HealthReport() {
  const { uid, profile } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "healthReport")
  const [editing, setEditing] = useState(null) // null | "new" | item
  const [confirmDelete, setConfirmDelete] = useState(null)

  const unverifiedCount = items.filter((i) => !i.verified).length

  // Record a verification: stamp the system, roll its next-due date forward by
  // its frequency, and drop a dated entry in the activity log so the history
  // accumulates rather than overwrites.
  async function logVerification(system) {
    const freq = Number(system.verifyFrequencyMonths) || 0
    const patch = {
      verified: true,
      verifiedOn: todayLabel(),
      lastVerified: todayISO(),
    }
    if (freq > 0) patch.nextDue = addMonthsISO(freq)
    await update(system.id, patch)
    await addItem(uid, "activity", {
      systemId: system.id,
      type: "service",
      summary: "Verified / checked",
      date: todayLabel(),
      order: Date.now(),
    })
  }

  return (
    <div>
      <PageHeader
        title="Property Health Report"
        subtitle={
          profile.walkthroughCompletedOn
            ? `Walkthrough completed ${profile.walkthroughCompletedOn} at ${profile.address}`
            : `Systems inventory for ${profile.address}`
        }
        action={<Button onClick={() => setEditing("new")}>+ Add system</Button>}
      />

      {unverifiedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-900">
          {unverifiedCount} system{unverifiedCount === 1 ? "" : "s"} not yet
          verified in person.{" "}
          <Link to="/walkthrough" className="font-medium underline">
            Run the walkthrough
          </Link>{" "}
          to confirm them — or snap nameplate photos right here on each card.
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            No systems recorded yet. Add your first one to start building your
            property's health report.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((system) => {
            const freq = Number(system.verifyFrequencyMonths) || 0
            return (
              <Card key={system.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{system.category}</p>
                    <p className="text-sm text-ink-2">{system.detail}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <ConditionBadge condition={system.condition} />
                    <VerifiedBadge verified={system.verified} />
                  </div>
                </div>

                {(system.brand || system.installYear || system.lastServiced || system.location) && (
                  <p className="text-xs text-ink-3 mt-2">
                    {[
                      system.brand,
                      system.installYear && `Installed ${system.installYear}`,
                      system.lastServiced && `Serviced ${system.lastServiced}`,
                      system.location,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

                <p className="text-sm text-ink-2 mt-2 whitespace-pre-line">{system.note}</p>

                {freq > 0 && (
                  <p className={`text-xs mt-2 ${dueClass(system.nextDue)}`}>
                    {FREQ_LABELS[freq]} check ·{" "}
                    {system.nextDue
                      ? `next due ${isoToLabel(system.nextDue)}`
                      : "not yet scheduled"}
                    {system.lastVerified && ` · last ${isoToLabel(system.lastVerified)}`}
                  </p>
                )}

                {(() => {
                  const h = replacementHorizon(system)
                  if (!h) return null
                  const warn = h.status === "in-window" || h.status === "past"
                  return (
                    <p className={`text-xs mt-2 ${warn ? "text-amber-800" : "text-ink-3"}`}>
                      Year {h.age} of a typical {h.benchmark.lifeYears[0]}–
                      {h.benchmark.lifeYears[1]} · replacement window {h.windowStart}–
                      {h.windowEnd} · ~
                      {fmtMoneyRange(h.benchmark.replaceCost, h.benchmark.costUnit)}
                      {h.status === "past" && " — beyond typical life, budget replacement"}
                      {h.status === "in-window" && " — in the window now"}
                    </p>
                  )
                })()}

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line flex-wrap">
                  <Button variant="ghost" className="!px-0" onClick={() => setEditing(system)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-0"
                    onClick={() => setConfirmDelete(system)}
                  >
                    Delete
                  </Button>
                  {freq > 0 && (
                    <Button
                      variant="ghost"
                      className="!px-0"
                      onClick={() => logVerification(system)}
                    >
                      Log check
                    </Button>
                  )}
                  <PhotoSection
                    uid={uid}
                    systemId={system.id}
                    onSuggest={(f) => {
                      const patch = { ...f }
                      if (f.note) {
                        patch.note = system.note
                          ? `${system.note}\n${f.note}`
                          : f.note
                      }
                      update(system.id, patch)
                    }}
                  />
                </div>

                <div className="mt-3 pt-3 border-t border-line">
                  <ActivitySection uid={uid} systemId={system.id} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={editing === "new" ? "Add system" : "Edit system"}
          onClose={() => setEditing(null)}
        >
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? { verifyFrequencyMonths: "0" } : editing}
            onSubmit={(values) => {
              if (editing === "new") {
                add(values)
              } else {
                update(editing.id, values)
              }
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete system?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{confirmDelete.category}" from your Property Health Report?
          </p>
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
