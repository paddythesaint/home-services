import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
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

export default function PriorityList() {
  const { uid } = useOutletContext()
  const { items, add, update, remove, moveUp, moveDown } = useItems(uid, "priorityList")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  return (
    <div>
      <PageHeader
        title="90-Day Priority List"
        subtitle="Ranked recommendations for what to tackle next on your property."
        action={<Button onClick={() => setEditing("new")}>+ Add item</Button>}
      />

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-brand-600">
            Nothing on your priority list yet. Add an item to get started.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-brand-900">{item.title}</p>
                    <p className="text-sm text-brand-600">{item.category}</p>
                    <p className="text-sm text-brand-700 mt-1.5">{item.reason}</p>
                    <div className="flex gap-3 mt-3">
                      <Button variant="ghost" className="!px-0" onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="!px-0"
                        onClick={() => setConfirmDelete(item)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                  <UrgencyBadge urgency={item.urgency} />
                  <p className="text-sm text-brand-600">{item.estCost}</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveUp(index)}
                      className="text-brand-500 hover:text-brand-800 disabled:opacity-30 text-xs px-1.5 py-0.5 border border-brand-200 rounded"
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => moveDown(index)}
                      className="text-brand-500 hover:text-brand-800 disabled:opacity-30 text-xs px-1.5 py-0.5 border border-brand-200 rounded"
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

      {confirmDelete && (
        <Modal title="Delete item?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-brand-700 mb-4">
            Remove "{confirmDelete.title}" from your priority list?
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
