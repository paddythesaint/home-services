import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { todayLabel } from "../dates"
import { Card, PageHeader, UrgencyBadge, Button, Modal, DynamicForm } from "../components"

const fields = [
  { name: "title", label: "Title", type: "text" },
  { name: "category", label: "Category", type: "text" },
  { name: "reason", label: "Reason", type: "textarea" },
  { name: "estCost", label: "Estimated cost", type: "text", placeholder: "e.g. $150 – $350" },
  {
    name: "urgency",
    label: "Urgency",
    type: "select",
    options: ["high", "medium", "low"],
    optionLabels: { high: "High", medium: "Medium", low: "Low" },
  },
]

// Items predate the status field, so absence means "open".
const isOpen = (item) => !item.status || item.status === "open" || item.status === "scheduled"

const DISPOSITION_LABEL = {
  scheduled: "Scheduled",
  resolved: "Resolved",
  dismissed: "Dismissed",
}

export default function PriorityList() {
  const { uid } = useOutletContext()
  const { items, add, update, remove, moveUp, moveDown } = useItems(uid, "priorityList")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [resolving, setResolving] = useState(null) // item being resolved/dismissed
  const [resolveMode, setResolveMode] = useState("resolved")
  const [resolveNote, setResolveNote] = useState("")

  const openItems = items.filter(isOpen)
  const closedItems = items.filter((i) => !isOpen(i))

  function disposition(item, status) {
    setResolving(item)
    setResolveMode(status)
    setResolveNote("")
  }

  async function confirmDisposition() {
    await update(resolving.id, {
      status: resolveMode,
      resolvedOn: todayLabel(),
      resolutionNote: resolveNote.trim(),
    })
    setResolving(null)
  }

  return (
    <div>
      <PageHeader
        title="90-Day Priority List"
        subtitle="Ranked recommendations for what to tackle next on your property."
        action={<Button onClick={() => setEditing("new")}>+ Add item</Button>}
      />

      {openItems.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            Nothing open right now. {closedItems.length > 0 && "See resolved items below, or "}
            add an item to get started.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {openItems.map((item, index) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-ink-2 text-sm font-semibold shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">
                      {item.title}
                      {item.status === "scheduled" && (
                        <span className="ml-2 text-xs font-medium text-blue-700">
                          Scheduled
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-ink-2">{item.category}</p>
                    <p className="text-sm text-ink-2 mt-1.5">{item.reason}</p>
                    <div className="flex gap-3 mt-3 flex-wrap">
                      <Button variant="ghost" className="!px-0" onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                      {item.status !== "scheduled" && (
                        <Button
                          variant="ghost"
                          className="!px-0"
                          onClick={() => update(item.id, { status: "scheduled" })}
                        >
                          Mark scheduled
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="!px-0"
                        onClick={() => disposition(item, "resolved")}
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-0"
                        onClick={() => disposition(item, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                  <UrgencyBadge urgency={item.urgency} />
                  <p className="text-sm text-ink-2">{item.estCost}</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveUp(items.indexOf(item))}
                      className="text-ink-3 hover:text-ink-2 disabled:opacity-30 text-xs px-1.5 py-0.5 border border-line rounded"
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      disabled={index === openItems.length - 1}
                      onClick={() => moveDown(items.indexOf(item))}
                      className="text-ink-3 hover:text-ink-2 disabled:opacity-30 text-xs px-1.5 py-0.5 border border-line rounded"
                    >
                      &darr;
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {closedItems.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-ink-2 mb-2">
            Closed ({closedItems.length})
          </h2>
          <div className="flex flex-col gap-2">
            {closedItems.map((item) => (
              <div
                key={item.id}
                className="bg-surface border border-line rounded-lg px-4 py-3 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink-2 line-through decoration-ink-3/50">
                    {item.title}
                  </p>
                  <p className="text-xs text-ink-3">
                    {DISPOSITION_LABEL[item.status] || "Closed"}
                    {item.resolvedOn && ` · ${item.resolvedOn}`}
                    {item.resolutionNote && ` · ${item.resolutionNote}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="text-xs text-ink-3 hover:text-ink"
                    onClick={() => update(item.id, { status: "open", resolvedOn: "", resolutionNote: "" })}
                  >
                    Reopen
                  </button>
                  <button
                    type="button"
                    className="text-xs text-ink-3 hover:text-red-600"
                    onClick={() => setConfirmDelete(item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add item" : "Edit item"} onClose={() => setEditing(null)}>
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? {} : editing}
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

      {resolving && (
        <Modal
          title={resolveMode === "resolved" ? "Resolve item" : "Dismiss item"}
          onClose={() => setResolving(null)}
        >
          <p className="text-sm text-ink-2 mb-3">"{resolving.title}"</p>
          <label className="flex flex-col gap-1 text-sm mb-4">
            <span className="font-medium text-ink-2">
              {resolveMode === "resolved" ? "What was done? (optional)" : "Why dismiss? (optional)"}
            </span>
            <textarea
              className="border border-line rounded-lg px-3 py-2 bg-surface text-ink"
              rows={2}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder={
                resolveMode === "resolved"
                  ? "e.g. Serviced by Monticello Air 7/3/26"
                  : "e.g. Not applicable to this property"
              }
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button onClick={confirmDisposition}>
              {resolveMode === "resolved" ? "Resolve" : "Dismiss"}
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete item?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Permanently remove "{confirmDelete.title}"? Resolving or dismissing
            keeps the record; delete removes it entirely.
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
