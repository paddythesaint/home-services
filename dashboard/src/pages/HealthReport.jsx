import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import PhotoSection from "../PhotoSection"
import {
  Card,
  ConditionBadge,
  VerifiedBadge,
  PageHeader,
  Button,
  Modal,
  DynamicForm,
} from "../components"

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
  { name: "note", label: "Note", type: "textarea" },
]

export default function HealthReport() {
  const { uid, profile } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "healthReport")
  const [editing, setEditing] = useState(null) // null | "new" | item
  const [confirmDelete, setConfirmDelete] = useState(null)

  const unverifiedCount = items.filter((i) => !i.verified).length

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
          {items.map((system) => (
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

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line">
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
                <PhotoSection
                  uid={uid}
                  systemId={system.id}
                  onSuggest={(fields) => {
                    const patch = { ...fields }
                    if (fields.note) {
                      patch.note = system.note
                        ? `${system.note}\n${fields.note}`
                        : fields.note
                    }
                    update(system.id, patch)
                  }}
                />
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
