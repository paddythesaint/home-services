import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import {
  Card,
  ConditionBadge,
  PageHeader,
  Button,
  Modal,
  DynamicForm,
} from "../components"

const fields = [
  { name: "category", label: "Category", type: "text", placeholder: "e.g. HVAC" },
  { name: "detail", label: "Detail", type: "text", placeholder: "e.g. Trane XR16, installed 2016" },
  {
    name: "condition",
    label: "Condition",
    type: "select",
    options: ["good", "attention", "urgent"],
    optionLabels: { good: "Good", attention: "Attention", urgent: "Urgent" },
  },
  { name: "note", label: "Note", type: "textarea" },
]

export default function HealthReport() {
  const { uid, profile } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "healthReport")
  const [editing, setEditing] = useState(null) // null | "new" | item
  const [confirmDelete, setConfirmDelete] = useState(null)

  return (
    <div>
      <PageHeader
        title="Property Health Report"
        subtitle={
          profile.profileSessionDate
            ? `Generated from your Property Profile Session at ${profile.address}`
            : `Systems inventory for ${profile.address}`
        }
        action={<Button onClick={() => setEditing("new")}>+ Add system</Button>}
      />

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-brand-600">
            No systems recorded yet. Add your first one to start building your
            property's health report.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((system) => (
            <Card key={system.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-900">{system.category}</p>
                  <p className="text-sm text-brand-600">{system.detail}</p>
                </div>
                <ConditionBadge condition={system.condition} />
              </div>
              <p className="text-sm text-brand-700 mt-3">{system.note}</p>
              <div className="flex gap-3 mt-3 pt-3 border-t border-brand-100">
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
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing === "new" ? "Add system" : "Edit system"}
          onClose={() => setEditing(null)}
        >
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
        <Modal title="Delete system?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-brand-700 mb-4">
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
