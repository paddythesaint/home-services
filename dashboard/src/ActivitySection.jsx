import { useEffect, useState } from "react"
import { subscribeActivity, addItem, removeItem } from "./firestoreApi"
import { todayLabel } from "./dates"
import { Button } from "./components"

export const ACTIVITY_TYPES = {
  reading: { label: "Reading", color: "var(--color-status-good)" },
  action: { label: "Action", color: "var(--color-brand-600)" },
  observation: { label: "Observation", color: "var(--color-status-warn)" },
  service: { label: "Service", color: "var(--color-ink-3)" },
}

// Collapsible per-system history timeline: typed entries (reading / action /
// observation / service) with optional structured value + unit, so numbers
// like radon pCi/L accumulate instead of overwriting the system note.
export default function ActivitySection({ uid, systemId, startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  const [entries, setEntries] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ type: "action", summary: "", value: "", unit: "" })

  useEffect(() => {
    if (!open) return
    return subscribeActivity(uid, systemId, setEntries)
  }, [open, uid, systemId])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-600 hover:text-brand-800"
      >
        History &rsaquo;
      </button>
    )
  }

  function set(name, value) {
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function save() {
    if (!form.summary.trim()) return
    const entry = {
      systemId,
      type: form.type,
      summary: form.summary.trim(),
      date: todayLabel(),
      order: Date.now(),
    }
    if (form.value.trim()) entry.value = form.value.trim()
    if (form.unit.trim()) entry.unit = form.unit.trim()
    await addItem(uid, "activity", entry)
    setForm({ type: "action", summary: "", value: "", unit: "" })
    setAdding(false)
  }

  const inputClass =
    "border border-line rounded-lg px-2.5 py-1.5 bg-surface text-ink text-sm"

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-brand-600 hover:text-brand-800"
        >
          History &#9662;
        </button>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-ink-3 hover:text-ink"
          >
            + Add entry
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {Object.entries(ACTIVITY_TYPES).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} w-20`}
              placeholder="Value"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
            />
            <input
              className={`${inputClass} w-20`}
              placeholder="Unit"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <input
              className={`${inputClass} flex-1`}
              placeholder="What happened?"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
            />
            <Button onClick={save} disabled={!form.summary.trim()}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {entries === null ? (
        <p className="text-xs text-ink-3 mt-2">Loading…</p>
      ) : entries.length === 0 ? (
        !adding && (
          <p className="text-xs text-ink-3 mt-2">
            No history yet — readings, actions, and observations land here.
          </p>
        )
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {entries.map((entry) => {
            const meta = ACTIVITY_TYPES[entry.type] || ACTIVITY_TYPES.action
            return (
              <li key={entry.id} className="flex items-start gap-2 text-sm group">
                <span
                  className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <span className="text-xs text-ink-3">
                    {entry.date} · {meta.label}
                  </span>
                  <p className="text-ink-2">
                    {entry.summary}
                    {entry.value && (
                      <span className="font-medium text-ink">
                        {" "}
                        — {entry.value}
                        {entry.unit ? ` ${entry.unit}` : ""}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Delete entry"
                  onClick={() => removeItem(uid, "activity", entry.id)}
                  className="ml-auto text-ink-3 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100"
                >
                  &times;
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
